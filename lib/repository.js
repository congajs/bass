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

				this.client.find(
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
								mapper.mapDataToModel(metadata, data, function(err, document){

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

		var dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);

		this.client.findBy(metadata, metadata.collection, dbCriteria, sort, skip, limit, function(err, data){

			if (err){

				deferred.reject(err);

			} else {

				if (data === null){
					deferred.resolve([]);
				} else {

					mapper.mapDataToModels(metadata, data, function(err, documents){
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
	 * Find total document count by simple criteria
	 * 
	 * @param  {Object}  criteria
	 * @return {Promise}
	 */
	findCountBy: function(criteria){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.metadata;
		var documentCache = this.documentCache;

		var dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);

		this.client.findCountBy(metadata, metadata.collection, dbCriteria, function(err, data){

			if (err){

				deferred.reject(err);

			} else {

				deferred.resolve(data);				
			}
		});

		return deferred.promise;
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

		var	dbQuery = mapper.mapQueryToDatabase(metadata, query);

		this.client.findByQuery(metadata, metadata.collection, dbQuery, function(err, queryResult){

			if (err){

				deferred.reject(err);

			} else {
				if (queryResult === null){
					deferred.resolve([]);
				} else {
					if (Array.isArray(queryResult)) {

						queryResult = new QueryResult(query, queryResult);

					} else if (typeof queryResult !== 'object' ||
								queryResult.constructor.name !== 'QueryResult') {

						deferred.reject(new Error('Invalid response returned from findByQuery.  Expecting one of Array or QueryResult'));
						return;
					}
					mapper.mapDataToModels(metadata, queryResult.data, function(err, documents){
						if (err) {

							deferred.reject(err);

						} else {

							queryResult.data = documents;

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

		this.client.findCountByQuery(metadata, metadata.collection, dbQuery, function(err, data){

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

		if (!this.getManager()) {
			return null;
		}

		var qb;
		var adapter = this.adapter || this._manager.definition.adapter;

		if (typeof adapter['queryBuilderFactory'] !== 'undefined' &&
			typeof adapter['queryBuilderFactory']['factory'] === 'function') {

			qb = adapter.queryBuilderFactory.factory(this._manager.definition, this.getManager());

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
	 * Create an SQL query
	 *
	 * @param {String} sql The Query
	 * @param {Object|null|undefined} params The query parameters
	 * @returns {QueryClient}
	 */
	createSqlQuery: function(sql, params) {
		return this.createQueryBuilder().getQuery().setSql(sql).setParameters(params);
	}
};


Repository.prototype.constructor = Repository;

module.exports = Repository;