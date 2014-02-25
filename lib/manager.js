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
var Manager = function(definition){
	
	this.definition = definition;
	this.registry = definition.metadataRegistry;
	this.mapper = definition.mapper;
	this.client = new definition.adapter.client(definition.connection, definition.logger);

	// @todo - doing this for now:
	this.mapper.adapterMapper.client = this.client;

	this.documentCache = new DocumentCache(this.registry);
	this.unitOfWork = new UnitOfWork(this.registry, this.mapper, this.client, this.documentCache);

	this.repositories = {};
};

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

			var repository = new repo(null, this.client, this.mapper, metadata, this.documentCache);

			this.repositories[name] = repository;
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

		if (typeof data === 'undefined'){
			data = {};
		}

		var metadata = this.registry.getMetadataByName(name);

		try {
			var document = new metadata.proto();
		} catch (e){
			console.log(e);
		}

		// set values from data, otherwise use default value from prototype
		metadata.fields.forEach(function(field){
			if (typeof data[field.property] !== 'undefined'){
				document[field.property] = data[field.property];
			} else {
				document[field.property] = field.default;
			}
		})

		return document;
	},

	/**
	 * Create a new Query object specific to the current persistence adapter
	 * 
	 * @return {Query}
	 */
	createQuery: function(){
		return new Query();
	},

	/**
	 * Get the native connection for this manager's adapter
	 * 
	 * @return {Object}
	 */
	getConnection: function(){
		return this.definition.connection;
	},

	/**
	 * Reconnect with new connection configuration
	 * 
	 * @param  {Object}   config
	 * @param  {Function} cb
	 * @return {Void}
	 */
	connectWithConfig: function(config, cb){

		var self = this;

		this.definition.registry.getAdapter(config.adapter).connectionFactory.factory(config, function(err, conn){

			self.client.db = conn;
			//self.unitOfWork.client.connection = conn;
			cb(err);
		});
	}
};

module.exports = Manager;