/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third-party modules
var Q = require('q');

// local modules
var Query = require('./query');
var QueryResult = require('./query-result');

/**
 * This is the generic base repository for all other document repositories
 * 
 * @param {Manager} manager The Bass Manager associated / controlling this repository
 * @param {Metadata} metadata The metadata specific to this repository
 *
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
function Repository(manager, metadata) {
	if (manager) {
		this._setManager(manager);
	}
	if (metadata) {
		this._setMetadata(metadata);
	}
}

Repository.prototype = {

	/**
	 * The manager
	 *
	 * @type {Manager}
	 */
	_manager: null ,

	/**
	 * The metadata specific to this repository
	 *
	 * @type {Metadata}
	 */
	metadata: null ,

	/**
	 * The manager driver adapter
	 *
	 * @type {Object}
	 */
	adapter: null ,

	/**
	 * The registry attached to our manager
	 *
	 * @type {Registry}
	 */
	registry: null ,

	/**
	 * The client for the attached manager
	 *
	 * @type {Client}
	 */
	client: null ,

	/**
	 * The mapper for this repository / the attached manager
	 *
	 * @type {Manager}
	 */
	mapper: null ,

	/**
	 * The document cache reference for the attached manager
	 *
	 * @type {DocumentCache}
	 */
	documentCache: null ,

	/**
	 * Set the metadata for this repository
	 *
	 * @param metadata
	 * @returns {Repository}
	 * @private
	 */
	_setMetadata: function(metadata) {
		this.metadata = metadata;
		return this;
	} ,

	/**
	 * Set a new manager on this repository
	 *
	 * @param {Manager} manager
	 * @returns {Repository}
	 * @private
	 */
	_setManager: function(manager) {
		if (manager) {
			this._manager = manager;

			this.adapter = this._manager.definition.adapter;
			this.registry = this._manager.registry;
			this.client = this._manager.client;
			this.mapper = this._manager.mapper;
			this.documentCache = this._manager.documentCache;
		}
		return this;
	} ,

	/**
	 * Get the manager
	 *
	 * @returns {Manager}
	 */
	getManager: function() {
		return this._manager;
	} ,

	/**
	 * Get the repository name
	 *
	 * @returns {String}
	 */
	getName: function() {
		return this.metadata.name;
	} ,

	/**
	 * Get the collection (table) name
	 *
	 * @returns {String|null}
	 */
	getCollectionName: function() {
		return this.metadata.collection || null;
	} ,

	/**
	 * Get a slave client
	 * @param {String|null} name The slave (connection name) to fetch - if not given, a random slave is returned
	 * @returns {Client}
	 */
	getReaderClient: function(name) {
		if (!this._manager) {
			return null;
		}
		return this._manager.getReaderClient(name);
	} ,

	/**
	 * Create a collection level lock
	 *
	 * @param {String|Array.<Object>} locks The collection names and lock types you want to lock
	 * @returns {Promise}
	 */
	lockCollection: function(locks) {
		var deferred = Q.defer();

		if (typeof this.client.createLock === 'function') {

			// TODO : we need an expression class for the Lock
			if (!locks) {
				locks = [{collection: this.getCollectionName(), type: 'WRITE'}];
			}

			this.client.createLock(locks, function(err, data) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(data);
				}
			});

		} else {
			setTimeout(function(){
				deferred.reject(new Error('Client does not support collection level locking'));
			}, 1);
		}

		return deferred.promise;
	} ,

	/**
	 * Release a collection level lock
	 *
	 * @param {String|Array.<Object>} locks The collection names and lock types you want to remove
	 * 										Note: different clients have different behavior for locks
	 * @returns {Promise}
	 * @throws Error
	 */
	unlockCollection: function(locks) {
		var deferred = Q.defer();

		if (typeof this.client.releaseLock === 'function') {

			// TODO : we need an expression class for the Lock
			if (!locks) {
				locks = [{collection: this.getCollectionName(), type: 'READ'}];
			}

			this.client.releaseLock(locks, function(err, data) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(data);
				}
			});

		} else {
			setTimeout(function(){
				deferred.reject(new Error('Client does not support collection level locking'));
			}, 1);
		}

		return deferred.promise;
	} ,

	/**
	 * Update documents by search criteria
	 * @param {Object} criteria Criteria to search records to be updated
	 * @param {Object} data Data to update the documents with
	 * @returns {Promise}
	 */
	updateBy: function(criteria, data) {

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.metadata;
		var documentCache = this.documentCache;

		var dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);

		var manager = this._manager;

		var self = this;

		mapper.mapModelToData(metadata, data, function(mappedData) {

			// TODO : this doesn't seem safe - we need to make sure _id is what we think it is
			if (typeof mappedData['_id'] !== 'undefined') {
				delete mappedData['_id'];
			}

			var reducedData = mapper.reduceMappedData(metadata, mappedData);

			self.client.updateBy(metadata, metadata.collection, dbCriteria, reducedData, function(err, result){

				if (err){

					deferred.reject(err);

				} else {

					documentCache.updateDocumentsByCriteria(criteria, reducedData);

					deferred.resolve(result);

				}
			});

		});

		return deferred.promise;
	},

	/**
	 * Remove documents by search criteria
	 * @param {Object} criteria Criteria to search records to be removed
	 * @returns {Promise}
	 */
	removeBy: function(criteria) {

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.metadata;
		var documentCache = this.documentCache;

		var dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);

		var manager = this._manager;

		this.client.removeBy(metadata, metadata.collection, dbCriteria, function(err, result){

			if (err){

				deferred.reject(err);

			} else {

				documentCache.removeDocumentsByCriteria(criteria);

				deferred.resolve(result);

			}
		});

		return deferred.promise;
	},

	/**
	 * Find a document by id
	 * 
	 * @param  {*} id
	 * @return {Promise}
	 */
	find: function(id){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.metadata;
		var documentCache = this.documentCache;

		var manager = this._manager;

		// if(this.documentCache.hasDocument(name, id)){
		// 	deferred.resolve(this.documentCache.getDocument(name, id));
		// } else {

				try {
					var convertedId = mapper.adapterMapper.convertJavascriptToDb(metadata.getIdField().type, id);
				} catch(e) {
					setTimeout(function(){
						deferred.reject(e);
					}, 1);
					return deferred.promise;
				}

				this.getReaderClient().find(
					metadata,
					metadata.collection,
					convertedId,
					function(err, data) {
						if (err !== null) {

							deferred.reject(err);

						} else {
							if (data === null){

								deferred.resolve(null);

							} else {

								manager.mapDataToModel(metadata, data, function(err, document){
									if (err) {

										deferred.reject(err);

									} else {

										documentCache.addDocument(document);

										deferred.resolve(document);
									}
								});
							}
						}
					}
				);
		// }

		return deferred.promise;
	},

	/**
	 * Find documents by simple criteria
	 * 
	 * @param  {Object}  criteria
	 * @param  {Object}  sort
	 * @param  {Number}  skip
	 * @param  {Number}  limit
	 * @return {Promise}
	 */
	findBy: function(criteria, sort, skip, limit){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.metadata;
		var documentCache = this.documentCache;
		var manager = this._manager;

		var dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);

		this.getReaderClient().findBy(metadata, metadata.collection, dbCriteria, sort, skip, limit, function(err, data){

			if (err){

				deferred.reject(err);

			} else {

				if (data === null){

					deferred.resolve([]);

				} else {

					manager.mapDataToModels(metadata, data, function(err, documents){
						if (err) {

							deferred.reject(err);

						} else {

							deferred.resolve(documents);
						}
					});
				}
			}
		});

		return deferred.promise;
	},

	/**
	 * Find a single document by simple criteria
	 *
	 * @param  {Object} criteria
	 * @return {Promise}
	 */
	findOneBy: function(criteria){

		var deferred = Q.defer();

		this.findBy(criteria, null, 0, 1).then(function(documents){

			var result = null;

			if (documents !== null && documents.length > 0){
				result = documents[0];
			}

			deferred.resolve(result);

		}, function(err){

			deferred.reject(err);
		});

		return deferred.promise;
	},

	/**
	 * Find documents where a field has a value in an array of values
	 *
	 * @param {String} field The document's field to search by
	 * @param {Array.<(String|Number)>} values Array of values to search for
	 * @param {Object|null|undefined} sort Object hash of field names to sort by, -1 value means DESC, otherwise ASC
	 * @param {Number|null} limit The limit to restrict results
	 * @return {Promise}
	 */
	findWhereIn: function(field, values, sort, limit) {
		var deferred = Q.defer();

		var metadata = this.metadata;

		var mapper = this.mapper;

		var manager = this._manager;

		if (!Array.isArray(values) || values.length === 0) {

			setTimeout(function() {
				deferred.resolve([]);
			}, 1);

		} else {

			this.getReaderClient().findWhereIn(metadata, field, values, sort, limit, function(err, data) {
				if (err) {

					deferred.reject(err);

				} else {

					manager.mapDataToModels(metadata, data, function(err, documents){
						if (err) {

							deferred.reject(err);

						} else {

							deferred.resolve(documents);
						}
					});
				}
			});

		}

		return deferred.promise;
	} ,

	/**
	 * Find total document count by simple criteria
	 * 
	 * @param  {Object}  criteria
	 * @return {Promise}
	 */
	findCountBy: function(criteria){

		var query = new Query();

		Object.keys(criteria || {}).forEach(function(key) {
			query.where(key).equals(criteria[key]);
		});

		return this.findCountByQuery(query);
	},

	/**
	 * Find documents by a Query
	 * 
	 * @param  {Query} query
	 * @return {Promise}
	 */
	findByQuery: function(query){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.metadata;
		var documentCache = this.documentCache;
		var manager = this._manager;

		var	dbQuery = mapper.mapQueryToDatabase(metadata, query);

		this.getReaderClient().findByQuery(metadata, metadata.collection, dbQuery, function(err, queryResult){

			if (err){

				deferred.reject(err);

			} else {
				if (queryResult === null) {

					deferred.resolve([]);

				} else {
					if (Array.isArray(queryResult)) {

						queryResult = new QueryResult(query, queryResult);

					} else if (typeof queryResult !== 'object' ||
								queryResult.constructor.name !== 'QueryResult') {

						deferred.reject(new Error('Invalid response returned from findByQuery.  Expecting one of Array or QueryResult'));
						return;
					}

					manager.mapDataToModels(metadata, queryResult.data, function(err, docs) {
						if (err) {

							deferred.reject(err);

						} else {

							queryResult.data = docs;

							deferred.resolve(queryResult);

						}
					});
				}
			}
		});

		return deferred.promise;
	},

	/**
	 * Find total document count by a Query
	 * 
	 * @param  {Query} query
	 * @return {Promise}
	 */
	findCountByQuery: function(query){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.metadata;
		var documentCache = this.documentCache;

		var dbQuery = mapper.mapQueryToDatabase(metadata, query);

		this.getReaderClient().findCountByQuery(metadata, metadata.collection, dbQuery, function(err, data) {
			if (err){

				deferred.reject(err);

			} else {

				deferred.resolve(data);
			}
		});

		return deferred.promise;
	},

	/**
	 * Create a new Query object specific to the current persistence adapter
	 * 
	 * @return {Query}
	 */
	createQuery: function(){
		return new Query();
	} ,

	/**
	 * Create a QueryBuilder object specific to the current persistence adapter
	 *
	 * @return {QueryBuilder|null}
	 */
	createQueryBuilder: function() {

		if (!this._manager) {
			return null;
		}

		var qb;
		var adapter = this.adapter || this._manager.definition.adapter;

		if (typeof adapter['queryBuilderFactory'] !== 'undefined' &&
			typeof adapter['queryBuilderFactory']['factory'] === 'function') {

			qb = adapter.queryBuilderFactory.factory(this._manager.definition, this._manager);

		} else if (typeof adapter['queryBuilder'] === 'function') {

			qb = new adapter.queryBuilder(this._manager);
		}

		if (qb) {
			qb.setRepositoryName(this.getName());
			return qb;
		}

		return null;
	} ,

	/**
	 * TODO : this doesn't belong here - create an adapter repository that extends base and extend all respective repositories from that
s	 * Create an SQL query
	 *
	 * @param {String} sql The Query
	 * @param {Object|null|undefined} params The query parameters
	 * @returns {QueryClient|null}
	 */
	createSqlQuery: function(sql, params) {
		var qb = this.createQueryBuilder();

		if (!qb) {
			return null;
		}

		return qb.getQuery().setSql(sql).setParameters(params);
	}
};

Repository.prototype.constructor = Repository;

module.exports = Repository;