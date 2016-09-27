/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// local modules
const Query = require('./query');
const QueryResult = require('./query-result');

/**
 * This is the generic base repository for all other document repositories
 * 
 * @param {Manager} manager The Bass Manager associated / controlling this repository
 * @param {Metadata} metadata The metadata specific to this repository
 *
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
module.exports = class Repository {

	constructor(manager, metadata) {

		/**
		 * The manager
		 *
		 * @type {Manager}
		 */
		this._manager = null;

		/**
		 * The metadata specific to this repository
		 *
		 * @type {Metadata}
		 */
		this.metadata = null;

		/**
		 * The manager driver adapter
		 *
		 * @type {Object}
		 */
		this.adapter = null;

		/**
		 * The registry attached to our manager
		 *
		 * @type {Registry}
		 */
		this.registry = null;

		/**
		 * The client for the attached manager
		 *
		 * @type {Client}
		 */
		this.client = null;

		/**
		 * The mapper for this repository / the attached manager
		 *
		 * @type {Manager}
		 */
		this.mapper = null;

		/**
		 * The document cache reference for the attached manager
		 *
		 * @type {DocumentCache}
		 */
		this.documentCache = null;

		if (manager) {
			this._setManager(manager);
		}
		if (metadata) {
			this._setMetadata(metadata);
		}
	}

	/**
	 * Set the metadata for this repository
	 *
	 * @param metadata
	 * @returns {Repository}
	 * @private
	 */
	_setMetadata(metadata) {
		this.metadata = metadata;
		return this;
	}

	/**
	 * Set a new manager on this repository
	 *
	 * @param {Manager} manager
	 * @returns {Repository}
	 * @private
	 */
	_setManager(manager) {
		if (manager) {
			this._manager = manager;

			this.adapter = this._manager.definition.adapter;
			this.registry = this._manager.registry;
			this.client = this._manager.client;
			this.mapper = this._manager.mapper;
			this.documentCache = this._manager.documentCache;
		}
		return this;
	}

	/**
	 * Get the manager
	 *
	 * @returns {Manager}
	 */
	getManager() {
		return this._manager;
	}

	/**
	 * Get the repository name
	 *
	 * @returns {String}
	 */
	getName() {
		return this.metadata.name;
	}

	/**
	 * Get the collection (table) name
	 *
	 * @returns {String|null}
	 */
	getCollectionName() {
		return this.metadata.collection || null;
	}

	/**
	 * Get a slave client
	 * @param {String|null} name The slave (connection name) to fetch - if not given, a random slave is returned
	 * @returns {Client}
	 */
	getReaderClient(name) {
		if (!this._manager) {
			return null;
		}
		return this._manager.getReaderClient(name);
	}

	/**
	 * Create a collection level lock
	 *
	 * @param {String|Array.<Object>} locks The collection names and lock types you want to lock
	 * @returns {Promise}
	 */
	lockCollection(locks) {

		return new Promise((resolve, reject) => {

			if (typeof this.client.createLock === 'function') {

				// TODO : we need an expression class for the Lock
				if (!locks) {
					locks = [{collection: this.getCollectionName(), type: 'WRITE'}];
				}

				this.client.createLock(locks, function(err, data) {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});

			} else {
				setTimeout(function(){
					reject(new Error('Client does not support collection level locking'));
				}, 1);
			}

		});
	}

	/**
	 * Release a collection level lock
	 *
	 * @param {String|Array.<Object>} locks The collection names and lock types you want to remove
	 * 										Note: different clients have different behavior for locks
	 * @returns {Promise}
	 * @throws Error
	 */
	unlockCollection(locks) {

		return new Promise((resolve, reject) => {

			if (typeof this.client.releaseLock === 'function') {

				// TODO : we need an expression class for the Lock
				if (!locks) {
					locks = [{collection: this.getCollectionName(), type: 'READ'}];
				}

				this.client.releaseLock(locks, function(err, data) {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				});

			} else {
				setTimeout(function(){
					reject(new Error('Client does not support collection level locking'));
				}, 1);
			}

		});
	}

	/**
	 * Update documents by search criteria
	 * @param {Object} criteria Criteria to search records to be updated
	 * @param {Object} data Data to update the documents with
	 * @returns {Promise}
	 */
	updateBy(criteria, data) {

		const mapper = this.mapper;
		const metadata = this.metadata;
		const documentCache = this.documentCache;
		const dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);
		const manager = this._manager;
		const self = this;

		return new Promise((resolve, reject) => {

			mapper.mapModelToData(metadata, data, function(mappedData) {

				// TODO : this doesn't seem safe - we need to make sure _id is what we think it is
				if (typeof mappedData['_id'] !== 'undefined') {
					delete mappedData['_id'];
				}

				const reducedData = mapper.reduceMappedData(metadata, mappedData);

				self.client.updateBy(metadata, metadata.collection, dbCriteria, reducedData, function(err, result){

					if (err){

						eject(err);

					} else {

						documentCache.updateDocumentsByCriteria(criteria, reducedData);

						resolve(result);
					}
				});
			});
		});
	}

	/**
	 * Remove documents by search criteria
	 * @param {Object} criteria Criteria to search records to be removed
	 * @returns {Promise}
	 */
	removeBy(criteria) {

		const mapper = this.mapper;
		const metadata = this.metadata;
		const documentCache = this.documentCache;
		const dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);
		const manager = this._manager;

		return new Promise((resolve, reject) => {

			this.client.removeBy(metadata, metadata.collection, dbCriteria, function(err, result){

				if (err){

					reject(err);

				} else {

					documentCache.removeDocumentsByCriteria(criteria);
					resolve(result);
				}
			});

		});
	}

	/**
	 * Find a document by id
	 * 
	 * @param  {*} id
	 * @return {Promise}
	 */
	find(id) {

		const mapper = this.mapper;
		const metadata = this.metadata;
		const documentCache = this.documentCache;
		const manager = this._manager;

		return new Promise((resolve, reject) => {

		// if(this.documentCache.hasDocument(name, id)){
		// 	deferred.resolve(this.documentCache.getDocument(name, id));
		// } else {

				try {
					var convertedId = mapper.adapterMapper.convertModelValueToDbValue(metadata.getIdField().type, id);
				} catch(e) {
					setTimeout(function(){
						reject(e);
					}, 1);
					return;
				}

				this.getReaderClient().find(
					metadata,
					metadata.collection,
					convertedId,
					function(err, data) {

						if (err !== null) {

							reject(err);

						} else {

							if (data === null){

								resolve(null);

							} else {

								// @todo - newer stuff with populate
								// manager.mapToModel(metadata, data, populate, (err, model) => {

								// });

								manager.mapDataToModel(metadata, data, function(err, document){

									if (err) {

										reject(err);

									} else {

										//documentCache.addDocument(document);

										resolve(document);
									}
								});
							}
						}
					}
				);
		// }

		});
	}

	/**
	 * Find documents by simple criteria
	 * 
	 * @param  {Object}  criteria
	 * @param  {Object}  sort
	 * @param  {Number}  skip
	 * @param  {Number}  limit
	 * @return {Promise}
	 */
	findBy(criteria, sort, skip, limit) {

		const mapper = this.mapper;
		const metadata = this.metadata;
		const documentCache = this.documentCache;
		const manager = this._manager;
		const dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);

		return new Promise((resolve, reject) => {

			this.getReaderClient().findBy(metadata, metadata.collection, dbCriteria, sort, skip, limit, function(err, data){

				if (err){

					reject(err);

				} else {

					if (data === null){

						resolve([]);

					} else {

						manager.mapDataToModels(metadata, data, function(err, documents){
							if (err) {

								reject(err);

							} else {

								resolve(documents);
							}
						});
					}
				}
			});

		});
	}

	/**
	 * Find a single document by simple criteria
	 *
	 * @param {Object} criteria
	 * @param {Object|undefined} sort allows control to sort the results (optional)
	 * @return {Promise}
	 */
	findOneBy(criteria, sort) {

		return new Promise((resolve, reject) => {

			this.findBy(criteria, sort || null, 0, 1).then(function(documents){

				let result = null;

				if (documents !== null && documents.length !== 0) {
					result = documents[0];
				}

				resolve(result);

			}, function(err) {

				reject(err);
			});

		});
	}

	/**
	 * Find documents where a field has a value in an array of values
	 *
	 * @param {String} field The document's field to search by
	 * @param {Array.<(String|Number)>} values Array of values to search for
	 * @param {Object|null|undefined} sort Object hash of field names to sort by, -1 value means DESC, otherwise ASC
	 * @param {Number|null} limit The limit to restrict results
	 * @return {Promise}
	 */
	findWhereIn(field, values, sort, limit) {

		const metadata = this.metadata;
		const mapper = this.mapper;
		const manager = this._manager;

		return new Promise((resolve, reject) => {

			field = metadata.getFieldNameByProperty(field);

			if (!Array.isArray(values) || values.length === 0) {

				setTimeout(function() {
					resolve([]);
				}, 1);

			} else {

				this.getReaderClient().findWhereIn(metadata, field, values, sort, limit, function(err, data) {
					if (err) {

						reject(err);

					} else {

						manager.mapDataToModels(metadata, data, function(err, documents) {
							if (err) {

								reject(err);

							} else {

								resolve(documents);
							}
						});
					}
				});

			}

		});
	}

	/**
	 * Find total document count by simple criteria
	 * 
	 * @param  {Object}  criteria
	 * @return {Promise}
	 */
	findCountBy(criteria) {

		const query = new Query();

		Object.keys(criteria || {}).forEach(function(key) {
			query.where(key).equals(criteria[key]);
		});

		return this.findCountByQuery(query);
	}

	/**
	 * Find documents by a Query
	 *
	 * @param  {Query} query
	 * @return {Promise}
	 */
	findByQuery(query) {

		const mapper = this.mapper;
		const metadata = this.metadata;
		const documentCache = this.documentCache;
		const manager = this._manager;
		const dbQuery = mapper.mapQueryToDatabase(metadata, query);

		return new Promise((resolve, reject) => {

			this.getReaderClient().findByQuery(metadata, metadata.collection, dbQuery, function(err, queryResult) {

				if (err){

					reject(err);

				} else {

					if (queryResult === null) {

						resolve([]);

					} else {
						if (Array.isArray(queryResult)) {

							queryResult = new QueryResult(query, queryResult);

						} else if (typeof queryResult !== 'object' ||
									queryResult.constructor.name !== 'QueryResult') {

							reject(new Error('Invalid response returned from findByQuery.  Expecting one of Array or QueryResult'));
							return;
						}

						manager.mapDataToModels(metadata, queryResult.data, function(err, docs) {

							if (err) {

								reject(err);

							} else {

								queryResult.data = docs;

								resolve(queryResult);
							}
						});
					}
				}
			});

		});
	}

	/**
	 * Find total document count by a Query
	 * 
	 * @param  {Query} query
	 * @return {Promise}
	 */
	findCountByQuery(query) {

		const mapper = this.mapper;
		const metadata = this.metadata;
		const documentCache = this.documentCache;
		const dbQuery = mapper.mapQueryToDatabase(metadata, query);

		return new Promise((resolve, reject) => {

			this.getReaderClient().findCountByQuery(metadata, metadata.collection, dbQuery, function(err, data) {
				if (err){

					reject(err);

				} else {

					resolve(data);
				}
			});

		});
	}

	/**
	 * Create a new Query object specific to the current persistence adapter
	 * 
	 * @return {Query}
	 */
	createQuery() {
		return new Query();
	}

	/**
	 * Create a QueryBuilder object specific to the current persistence adapter
	 *
	 * @return {QueryBuilder|null}
	 */
	createQueryBuilder() {

		if (!this._manager) {
			return null;
		}

		let qb;
		const adapter = this.adapter || this._manager.definition.adapter;

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
	}

	/**
	 * TODO : this doesn't belong here - create an adapter repository that extends base and extend all respective repositories from that
	 * Create an SQL query
	 *
	 * @param {String} sql The Query
	 * @param {Object|null|undefined} params The query parameters
	 * @returns {QueryClient|null}
	 */
	createSqlQuery(sql, params) {
		var qb = this.createQueryBuilder();

		if (!qb) {
			return null;
		}

		return qb.getQuery().setSql(sql).setParameters(params);
	}
}
