/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third-part modules
var _ = require('lodash');
var Q = require('q');

// local modules
var DocumentCache = require('./document-cache');
var Mapper = require('./mapper');
var UnitOfWork = require('./unit-of-work');
var Query = require('./query');

/**
 * The manager provides the interface to an adapter and it's
 * associated documents and connection
 * 
 * @param  {Definition} definition
 */
function Manager(definition){

	this.definition = definition;
	this.registry = definition.metadataRegistry;
	this.mapper = definition.mapper;

	// get the client for the current driver
	if (typeof definition.adapter.clientFactory === 'object' &&
		typeof definition.adapter.clientFactory.factory === 'function') {

		// use the factory
		this.client = definition.adapter.clientFactory.factory(definition);

	} else if (typeof definition.adapter.client === 'function') {

		// there is no factory, but a client class is provided, use that
		this.client = new definition.adapter.client(definition.connection, definition.logger);

	}

	// make sure we have a client!
	if (!this.client || typeof this.client !== 'object') {
		throw new Error('Unable to find Client for adapter "' + definition.adapter.name + '"');
	}

	// @todo - doing this for now:
	this.mapper.adapterMapper.client = this.client;

	this.documentCache = new DocumentCache(this.registry);
	this.unitOfWork = new UnitOfWork(this.registry, this.mapper, this.client, this.documentCache);

	this.repositories = {};
}

Manager.prototype = {

	/**
	 * Get the Repository for a document type
	 * 
	 * @param  {String} name
	 * @return {Repository}
	 */
	getRepository: function(name){
		// create new repository object if it wasn't created already
		if (typeof this.repositories[name] === 'undefined'){

			var metadata = this.registry.getMetadataByName(name);

			var repo = require('./repository');

			// extend base repository with custom one
			if (metadata.repository !== null){
				var customRepo = require(metadata.repository);
				repo.prototype = _.extend(repo.prototype, customRepo.prototype);
			}

			this.repositories[name] = new repo(this, metadata);
		}

		return this.repositories[name];
	},

	/**
	 * Persist a document
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	persist: function(document){
		this.unitOfWork.persist(document);
	},

	/**
	 * Remove a document
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	remove: function(document){
		this.unitOfWork.scheduleRemoval(document);
	},

	/**
	 * Flush the current UnitOfWork to run all scheduled modifications
	 * 
	 * @return {Promise}
	 */
	flush: function(cb){

		var deferred = Q.defer();

		this.unitOfWork.flush(function(err){
			if (err){
				deferred.reject(new Error(err));
			} else {
				deferred.resolve();
			}
		});

		return deferred.promise;
	},

	/**
	 * Find a document by it's id
	 * 
	 * @param  {String}   name
	 * @param  {*}    id
	 * @return {Promise}
	 */
	find: function(name, id){
		return this.getRepository(name).find(id);
	},

	/**
	 * Find documents of a certain type based on a Query
	 * 
	 * @param  {String}  name
	 * @param  {Query}   query
	 * @return {Promise}
	 */
	findByQuery: function(name, query){
		return this.getRepository(name).findByQuery(query);
	},

	/**
	 * Find the total count of documents of a certain type based on a Query
	 * 
	 * @param  {String}  name
	 * @param  {Query}   query
	 * @return {Promise}
	 */
	findCountByQuery: function(name, query){
		return this.getRepository(name).findCountByQuery(query);
	},

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
	findBy: function(name, criteria, sort, skip, limit){
		return this.getRepository(name).findBy(criteria, sort, skip, limit);
	},

	/**
	 * Find the document count for simple criteria
	 * 
	 * @param  {String}  name
	 * @param  {Object}  criteria
	 * @return {Promise}
	 */
	findCountBy: function(name, criteria){
		return this.getRepository(name).findCountBy(criteria);
	},

	/**
	 * Find a single document of a given type by simple criteria
	 * 
	 * @param  {String}  name
	 * @param  {Object}  criteria
	 * @return {Promise}
	 */
	findOneBy: function(name, criteria){
		return this.getRepository(name).findOneBy(criteria);
	},

	/**
	 * Create a new document object
	 * 
	 * @param  {String} name
	 * @param  {Object} data
	 * @return {Object}
	 */
	createDocument: function(name, data){

		if (data === undefined) {
			data = {};
		}

		var metadata = this.registry.getMetadataByName(name);

		try {
			var document = new metadata.proto();
		} catch (e){
			console.log(e.stack);
			return null;
		}

		var collectionName = this.mapper.mapDocumentNameToCollectionName(name);

		// set values from data, otherwise use default value from prototype
		metadata.fields.forEach(function(field){

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

								document[field.property] = _.extend(meta.constructor.prototype, data[field.property]);

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
							document[field.property] = _.cloneDeep(meta.constructor.prototype);

						} else {

							// clone the generic object
							document[field.property] = _.cloneDeep(meta);
						}

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

		return document;
	},

	/**
	 * Get the fields for a document
	 *
	 * @param {String} documentName The document / model name
	 * @returns {Array}
	 */
	getDocumentFields: function(documentName) {
		var metadata = this.registry.getMetadataByName(documentName);
		return Array.prototype.slice.call(metadata.fields);
	} ,

	/**
	 * Get the fields for a document, by its collection's name
	 *
	 * @param {String} collectionName
	 * @returns {*}
	 */
	getDocumentFieldsForCollection: function(collectionName) {
		var documentName = this.mapper.mapCollectionNameToDocumentName(collectionName);
		if (!documentName) {
			return null;
		}
		return this.getDocumentFields(documentName);
	} ,

	/**
	 * Create a new Query object specific to the current persistence adapter
	 * 
	 * @return {Query}
	 */
	createQuery: function(){
		return new Query();
	},

	/**
	 * Create a QueryBuilder object specific to the current persistence adapter
	 *
	 * @return {QueryBuilder|null}
	 */
	createQueryBuilder: function() {
		var adapter = this.definition.adapter;

		if (typeof adapter['queryBuilderFactory'] !== 'undefined' &&
			typeof adapter['queryBuilderFactory']['factory'] === 'function') {

			return adapter.queryBuilderFactory.factory(this.definition, this);

		} else if (typeof adapter['queryBuilder'] === 'function') {

			return new adapter.queryBuilder(this);
		}

		return null;
	} ,

	/**
	 * Create an SQL query
	 *
	 * @param {String} sql The Query
	 * @param {Object|null|undefined} params The query parameters
	 * @param {String|null|undefined} repositoryName The repository name to connect this query to
	 * @returns {QueryClient}
	 */
	createSqlQuery: function(sql, params, repositoryName) {
		if (repositoryName) {
			return this.getRepository(repositoryName).createSqlQuery(sql, params);
		}

		return this.createQueryBuilder().getQuery().setSql(sql).setParameters(params);
	} ,

	/**
	 * Start a transaction
	 *
	 * @returns {Promise}
	 */
	startTransaction: function() {
		var deferred = Q.defer();

		if (typeof this.client.startTransaction !== 'function') {

			setTimeout(function(){
				deferred.reject(new Error('Client does not support transactions'));
			}, 1);

		} else {
			this.client.startTransaction(function(err, queryResult) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(queryResult);
				}
			});
		}

		return deferred.promise;
	} ,

	/**
	 * Commit a transaction / run a commit command
	 *
	 * @returns {Promise}
	 */
	commitTransaction: function() {
		var deferred = Q.defer();

		if (typeof this.client.commitTransaction !== 'function') {

			setTimeout(function(){
				deferred.reject(new Error('Client does not support commitTransaction'));
			}, 1);

		} else {
			this.client.commitTransaction(function(err, queryResult) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(queryResult);
				}
			});
		}

		return deferred.promise;
	} ,

	/**
	 * Rollback a transaction
	 *
	 * @returns {Promise}
	 */
	rollbackTransaction: function() {
		var deferred = Q.defer();

		if (typeof this.client.rollbackTransaction !== 'function') {

			setTimeout(function(){
				deferred.reject(new Error('Client does not support rollbackTransaction'));
			}, 1);

		} else {
			this.client.rollbackTransaction(function(err, queryResult) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(queryResult);
				}
			});
		}

		return deferred.promise;
	} ,

	/**
	 * Get the native connection for this manager's adapter
	 * 
	 * @return {Object}
	 */
	getConnection: function(){
		return this.definition.connection;
	},

	/**
	 * Change the client connection
	 *
	 * @param {Connection} conn
	 * @return {void}
	 */
	changeClientConnection: function(conn) {

		this.client.db = conn;
		this.unitOfWork.client.connection = conn;

		// NOTE: creating new reference to Mapper and Adapter-Mapper so that the connections are in sync and not being referenced by any other modules
		this.mapper = new Mapper(
			this.mapper.registry,
			new this.mapper.adapterMapper.constructor(this.mapper.adapterMapper.registry, this.client)
		);
	},

	/**
	 * Reconnect with new connection configuration
	 * 
	 * @param  {Object}   config
	 * @param  {Function} cb
	 * @return {void}
	 */
	connectWithConfig: function(config, cb){

		var self = this;

		this.definition.registry.getAdapter(config.adapter).connectionFactory.factory(config, function(err, conn){

			if (err) {
				console.log(err.stack);
			}

			self.changeClientConnection(conn);

			cb(err);
		});
	}
};

Manager.prototype.constructor = Manager;

module.exports = Manager;