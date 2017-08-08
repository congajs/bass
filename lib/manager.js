/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// core modules
const util = require('util');

// third-party modules
const _ = require('lodash');
const async = require('async');

// local modules
const DocumentCache = require('./document-cache');
const Mapper = require('./mapper');
const UnitOfWork = require('./unit-of-work');
const Query = require('./query');
const Repository = require('./repository');

/**
 * The manager provides the interface to an adapter and it's
 * associated documents and connection
 * 
 * @param  {Definition} definition
 */
module.exports = class Manager {

	constructor(name, definition, session) {

		this.name = name;
		this.definition = definition;
		this.session = session;
		this.registry = definition.metadataRegistry;
		this.mapper = definition.mapper;

		// get the client for the current driver
		this.client = this._createClient();

		// make sure we have a client!
		if (!this.client || typeof this.client !== 'object') {
			throw new Error('Unable to find Client for adapter "' + definition.adapter.name + '"');
		}

		// create a client for each slave we have
		if (definition.slaveConnections) {
			this.slaves = {};
			const keys = Object.keys(definition.slaveConnections);
			for (let i = 0; i < keys.length; i++) {
				const slave = this._createClient(definition.slaveConnections[keys[i]]);
				if (slave) {
					this.slaves[keys[i]] = slave;
				}
			}
		}

		// @todo - doing this for now:
		/* TODO : I think this can cause problems:
		 * the mapper comes from the definition.
		 * the definition is shared between every manager
		 * each manager attaches its client to the definition's adapter mapper
		 * so when you have 5 managers at the same time, which client does the adapter manager get??????
		 * you end up with rogue instances and only one client gets used
		 * it works though cause it's the same definition, but private members on each client instance become mixed up
		 */
		this.mapper.adapterMapper.client = this.getReaderClient() || this.client;

		this.documentCache = new DocumentCache(this.registry);
		this.unitOfWork = new UnitOfWork(this.registry, this.mapper, this.client, this.documentCache);

		this.repositories = {};
	}

	/**
	 * Create a client using the manager's definition
	 * @param {Connection|undefined} connection The connection to use for the client (if not provided, the definition connection is used)
	 * @returns {Client|null}
	 * @private
	 */
	_createClient(connection) {

		if (!this.definition) {
			return null;
		}

		if (!connection) {
			if (this.definition.connection) {
				connection = this.definition.connection;
			} else {
				return null;
			}
		}

		// get the client for the current driver
		if (typeof this.definition.adapter.clientFactory === 'object' &&
			typeof this.definition.adapter.clientFactory.factory === 'function') {

			// use the factory
			return this.definition.adapter.clientFactory.factory(this.definition, connection);

		} else if (typeof this.definition.adapter.client === 'function') {

			// there is no factory, but a client class is provided, use that
			return new this.definition.adapter.client(connection, this.definition.logger);

		}

		return null;
	}

	/**
	 * Check if this manager has the given name
	 * 
	 * @param  {String}  name
	 * @return {Boolean}
	 */
	isManagerName(name) {
		return this.name === name;
	}

	/**
	 * Get the Repository for a document type
	 * 
	 * @param  {String} name
	 * @return {Repository}
	 */
	getRepository(name) {

		// create new repository object if it wasn't created already
		if (typeof this.repositories[name] === 'undefined') {

			const metadata = this.registry.getMetadataByName(name);

			if (typeof metadata.repositoryClass === 'function') {

				// use custom repository when available
				this.repositories[name] = new metadata.repositoryClass(this, metadata);

			} else {

				// no custom repository exists, so use our base class
				this.repositories[name] = new Repository(this, metadata);
			}
		}

		return this.repositories[name];
	}

	/**
	 * Get a slave client
	 * @param {String|null} name The slave (connection name) to fetch - if not given, a random slave is returned
	 * @returns {Client}
	 */
	getReaderClient(name) {

		if (!this.slaves) {

			// we don't have any slaves, return the client
			return this.client;

		} else if (name) {

			// return a specific slave
			return this.slaves[name] || null;

		} else {

			const keys = Object.keys(this.slaves);
			if (keys.length === 0) {
				// we don't have any slaves, return the client
				return this.client;
			} else if (keys.length === 1) {
				// return the first slave
				return this.slaves[keys[0]];
			} else {
				// return a random slave
				return this.slaves[keys[Math.floor(Math.random() * keys.length)]];
			}
		}
	}

    /**
     * Create a new collection / table
     * @param {String} collection The collection / table name to create
     * @returns {Promise}
     */
    createCollection(collection) {
        return this.getRepository(collection).createCollection();
    }

    /**
     * Delete a collection / table
     * @param {String} collection The collection / table name to create
     * @returns {Promise}
     */
    dropCollection(collection) {
        return this.getRepository(collection).dropCollection();
    }

    /**
     * Alias to mapper.mapToModel
     * @see Mapper.mapToModel
     */
    mapToModel(metadata, data, populate, cb) {
        this.mapper.mapToModel(this, metadata, data, populate, cb);
    }

	/**
	 * Alias to mapper.mapDataToModel
	 *
	 * @param {Metadata} metadata
	 * @param {Object|*} document
	 * @param {Function} cb
	 * @param {Function} walkRecursive
	 * @return {void}
	 */
	mapDataToModel(metadata, document, cb, walkRecursive) {
		this.mapper.mapDataToModel(this, metadata, document, cb, walkRecursive);
	}

	/**
	 * Alias to mapper.mapDataToModels
	 *
	 * @param {Metadata} metadata
	 * @param {[{}]} data
	 * @param {Function} cb
	 * @param {Function} walk
	 * @return {void}
	 */
	mapDataToModels(metadata, data, cb, walk) {
		this.mapper.mapDataToModels(this, metadata, data, cb, walk);
	}

	/**
	 * Alias to mapper.mapModelToData
	 *
	 * @param {Metadata} metadata
	 * @param {Object|*} model
	 * @param {Function} cb
	 * @return {void}
	 */
	mapModelToData(metadata, model, cb) {
		this.mapper.mapModelToData(metadata, model, cb);
	}

	/**
	 * Persist a document
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	persist(document) {
		this.unitOfWork.persist(document);
	}

	/**
	 * Update documents by search criteria
	 * @param {String} name The document class name to map the collection / table
	 * @param {Object} criteria Criteria to search records to be updated
	 * @param {Object} data The data to set on the documents
	 * @returns {Promise}
	 */
	updateBy(name, criteria, data) {
		return this.getRepository(name).updateBy(criteria, data);
	}

	/**
	 * Remove a document
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	remove(document) {
		this.unitOfWork.scheduleRemoval(document);
	}

	/**
	 * Remove documents by search criteria
	 * @param {String} name The document class name to map the collection / table
	 * @param {Object} criteria Criteria to search records to be removed
	 * @returns {Promise}
	 */
	removeBy(name, criteria) {
		return this.getRepository(name).removeBy(criteria);
	}

	/**
	 * Flush the current UnitOfWork to run all scheduled modifications
	 *
	 * @param {Object} [document] A single document to flush (optional)
	 * @return {Promise}
	 */
	flush(document) {

		return new Promise((resolve, reject) => {

			const cb = function(err) {

				if (err) {

					reject(err);

				} else {

					resolve();
				}
			};

			if (document instanceof Object) {

				// flushing a single document
				this.unitOfWork.flush(document, cb);

			} else {

				// flushing every document
				this.unitOfWork.flush(cb);
			}
		});
	}

	/**
	 * Find a document by it's id
	 * 
	 * @param  {String}   name
	 * @param  {*}    id
	 * @return {Promise}
	 */
	find(name, id) {
		return this.getRepository(name).find(id);
	}

	/**
	 * Find documents of a certain type based on a Query
	 * 
	 * @param  {String}  name
	 * @param  {Query}   query
	 * @return {Promise}
	 */
	findByQuery(name, query) {
		return this.getRepository(name).findByQuery(query);
	}

	/**
	 * Find the total count of documents of a certain type based on a Query
	 * 
	 * @param  {String}  name
	 * @param  {Query}   query
	 * @return {Promise}
	 */
	findCountByQuery(name, query) {
		return this.getRepository(name).findCountByQuery(query);
	}

	/**
	 * Find documents of a given type by basic criteria
	 * 
	 * @param  {String}  name
	 * @param  {Object}  criteria
	 * @param  {Object}  sort
	 * @param  {Number}  skip
	 * @param  {Number}  limit
	 * @return {Promise}
	 */
	findBy(name, criteria, sort, skip, limit) {
		return this.getRepository(name).findBy(criteria, sort, skip, limit);
	}

	/**
	 * Find documents where a field has a value in an array of values
	 *
	 * @param {String} name The document name you want to find by
	 * @param {String} field The document's field to search by
	 * @param {Array.<(String|Number)>} values Array of values to search for
	 * @param {Object|null} sort Object hash of field names to sort by, -1 value means DESC, otherwise ASC
	 * @param {Number|null} limit The limit to restrict results
	 * @return {Promise}
	 */
	findWhereIn(name, field, values, sort, limit) {
		return this.getRepository(name).findWhereIn(field, values, sort, limit);
	}

	/**
	 * Find the document count for simple criteria
	 * 
	 * @param  {String}  name
	 * @param  {Object}  criteria
	 * @return {Promise}
	 */
	findCountBy(name, criteria) {
		return this.getRepository(name).findCountBy(criteria);
	}

	/**
	 * Find a single document of a given type by simple criteria
	 * 
	 * @param  {String}  name
	 * @param  {Object}  criteria
	 * @param {Object|undefined} sort allows control to sort the results (optional)
	 * @return {Promise}
	 */
	findOneBy(name, criteria, sort) {
		return this.getRepository(name).findOneBy(criteria, sort);
	}

	/**
	 * Create a new document object
	 * 
	 * @param  {String} name
	 * @param  {Object} data
	 * @return {Object}
	 */
	createDocument(name, data) {

		if (data === undefined) {
			data = {};
		}

		let metadata = this.registry.getMetadataByName(name);
		let document;

		try {

			document = new metadata.proto();

		} catch (e){
			console.log(e.stack);
			return null;
		}

		// store this manager on the object
		// (this is used to be able to re-use the manager later on and access session)
		document._BASS_MANAGER = this;
		document.__isNew = true;

		const collectionName = this.mapper.mapDocumentNameToCollectionName(name);

		const reference = {
			data: data ,
			document: document ,
			metadata: metadata ,
			registry: this.registry
		};

		this.registry.eventDispatcher.dispatch('createDocument', reference, function() {

			// if the document was mapped differently in the event, change the document name
			if (reference.document.constructor.name !== document.constructor.name &&
				reference.document.constructor !== Function &&
				reference.document.constructor !== Object) {

				name = reference.document.constructor.name;
			}

			data = reference.data;
			document = reference.document;
			metadata = reference.metadata;

			// set values from data, otherwise use default value from prototype
			metadata.fields.forEach(function(field) {

				var meta;

				if (!field.table ||
					field.table === collectionName ||
					field.table === name) {

					if (typeof data[field.property] !== 'undefined'){

						// map the data object's property to the document
						if (data[field.property] instanceof Object) {

							meta = metadata.proto.prototype[field.property];

							if (meta && meta.constructor instanceof Function) {

								if (meta.constructor !== Object) {

									document[field.property] = _.extend(new meta.constructor(), data[field.property]);
									//document[field.property] = _.extend(meta.constructor.prototype, data[field.property]);

								} else {

									document[field.property] = _.merge(meta, data[field.property]);
								}

							} else {

								document[field.property] = _.cloneDeep(data[field.property]);
							}

						} else {

							document[field.property] = data[field.property];
						}

					} else if (typeof metadata.proto.prototype[field.property] === 'object') {

						// the data object doesn't have this field defined, but the prototype has a default value set
						meta = metadata.proto.prototype[field.property];

						if (meta instanceof Object) {

							if (meta.constructor !== Object) {

								// clone the constructor's prototype to get the class members onto the document
								document[field.property] = new meta.constructor(); //_.cloneDeep(meta.constructor.prototype);

							} else {

								// clone the generic object
								document[field.property] = _.cloneDeep(meta);
							}

						} else if (meta === null) {

							// typeof null === 'object' && !(null instanceof Object)
							document[field.property] = null;

						} else {

							// clone the meta property as the default
							document[field.property] = _.cloneDeep(meta);
						}

					} else {

						// use the default value provided by the field annotation
						document[field.property] = field.default;
					}
				}
			});
		});

		return document;
	}

	/**
	 * Refresh a document from the database
	 *
	 * This will find all relationships in a document which only have an id set
	 * and load in the rest of the data from the db.
	 * 
	 * @param  {Object}   document 
	 * @param  {Function} cb
	 * @return {Void}
	 */
	refreshDocument(document, cb) {
		cb();
	}

	/**
	 * Get the fields for a document
	 *
	 * @param {String} documentName The document / model name
	 * @returns {Array}
	 */
	getDocumentFields(documentName) {
		const metadata = this.registry.getMetadataByName(documentName);
		return Array.prototype.slice.call(metadata.fields);
	}

	/**
	 * Get the fields for a document, by its collection's name
	 *
	 * @param {String} collectionName
	 * @returns {*}
	 */
	getDocumentFieldsForCollection(collectionName) {
		const documentName = this.mapper.mapCollectionNameToDocumentName(collectionName);
		if (!documentName) {
			return null;
		}
		return this.getDocumentFields(documentName);
	}

	/**
	 * Get the metadata for a document
	 * 
	 * @param  {Object} document
	 * @return {Metadata}
	 */
	getMetadataForDocument(document) {
		return this.registry.getMetadataForDocument(document);
	}

	/**
	 * Create a new Query object specific to the current persistence adapter
	 * 
	 * @return {Query}
	 */
	createQuery(){
		return new Query();
	}

	/**
	 * Create a QueryBuilder object specific to the current persistence adapter
	 *
	 * @return {QueryBuilder|null}
	 */
	createQueryBuilder() {
		const adapter = this.definition.adapter;

		if (typeof adapter['queryBuilderFactory'] !== 'undefined' &&
			typeof adapter['queryBuilderFactory']['factory'] === 'function') {

			return adapter.queryBuilderFactory.factory(this.definition, this);

		} else if (typeof adapter['queryBuilder'] === 'function') {

			return new adapter.queryBuilder(this);
		}

		return null;
	}

	/**
	 * Create an SQL query
	 *
	 * @param {String} sql The Query
	 * @param {Object|null|undefined} params The query parameters
	 * @param {String|null|undefined} repositoryName The repository name to connect this query to
	 * @returns {QueryClient|null}
	 */
	createSqlQuery(sql, params, repositoryName) {
		if (repositoryName) {
			return this.getRepository(repositoryName).createSqlQuery(sql, params);
		}

		const queryBuilder = this.createQueryBuilder();
		if (!queryBuilder) {
			return null;
		}

		return queryBuilder.getQuery().setSql(sql).setParameters(params);
	}

	/**
	 * Start a transaction
	 *
	 * @returns {Promise}
	 */
	startTransaction() {

		return new Promise((resolve, reject) => {

			if (typeof this.client.startTransaction !== 'function') {

				reject(new Error('Client does not support transactions'));

			} else {
				this.client.startTransaction(function(err, queryResult) {
					if (err) {
						reject(err);
					} else {
						resolve(queryResult);
					}
				});
			}
		});
	}

	/**
	 * Commit a transaction / run a commit command
	 *
	 * @returns {Promise}
	 */
	commitTransaction() {

		return new Promise((resolve, reject) => {

			if (typeof this.client.commitTransaction !== 'function') {

				reject(new Error('Client does not support commitTransaction'));

			} else {
				this.client.commitTransaction(function(err, queryResult) {
					if (err) {
						reject(err);
					} else {
						resolve(queryResult);
					}
				});
			}

		});
	}

	/**
	 * Rollback a transaction
	 *
	 * @returns {Promise}
	 */
	rollbackTransaction() {

		return new Promise((resolve, reject) => {

			if (typeof this.client.rollbackTransaction !== 'function') {

				reject(new Error('Client does not support rollbackTransaction'));

			} else {
				this.client.rollbackTransaction(function(err, queryResult) {
					if (err) {
						reject(err);
					} else {
						resolve(queryResult);
					}
				});
			}

		});
	}

	/**
	 * Get the native connection for this manager's adapter
	 * 
	 * @return {Object}
	 */
	getConnection() {
		return this.definition.connection;
	}

	/**
	 * Change the client connection
	 *
	 * @param {Connection} conn
	 * @return {void}
	 */
	changeClientConnection(conn) {

		// TODO : what about slave connections?

		if (!conn.options) {
			conn.options = this.client.db.options;
		}

		this.client.db = conn;
		this.unitOfWork.client.connection = conn;

		// NOTE: creating new reference to Mapper and Adapter-Mapper so that the connections are in sync and not being referenced by any other modules
		this.mapper = new Mapper(
			this.registry,
			//new this.mapper.adapterMapper.constructor(this.mapper.adapterMapper.registry, this.client)
			new this.mapper.adapterMapper.constructor(this.registry, this.client)
		);
	}

	/**
	 * Reconnect with new connection configuration
	 * 
	 * @param  {Object}   config
	 * @param  {Function} cb
	 * @return {void}
	 */
	connectWithConfig(config, cb) {

		// TODO : what about slave connections?

		const self = this;

		this.definition.registry.getAdapter(config.adapter).connectionFactory.factory(config, function(err, conn) {

			if (err) {
				console.log(err.stack);
			}

			self.changeClientConnection(conn);

			cb(err);
		});
	}

	/**
	 * Close the client connection (and slaves too)
	 *
	 * @param {Function} cb The callback to execute when done
	 * @return {void}
	 */
	closeConnection(cb) {
		const clients = [this.client];
		if (this.slaves) {
			for (let n in this.slaves) {
				clients.push(this.slaves[n]);
			}
		}
		async.each(clients, function(client, cb) {
			if (!client || !client.db || !client.db.connection) {

				cb(null);

			} else {

				client.db.connection.close(cb);

			}
		}, function(err) {
			if (typeof cb === 'function') {
				cb(err);
			} else if (err) {
				console.error(err.stack || err);
			}
		});
	}

	/**
	 * Close the manager
	 * 
	 * @return {void}
	 */
	close() {
		this.client = null;
	}
};
