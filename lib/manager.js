/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third-part modules
var Q = require('q');

// local modules
var DocumentCache = require('./document-cache');
var Mapper = require('./mapper');
var UnitOfWork = require('./unit-of-work');
var Query = require('./query');

var Manager = function(definition){
	
	this.registry = definition.metadataRegistry;
	this.mapper = definition.mapper;
	this.client = new definition.adapter.client(definition.connection);

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
		if (typeof this.repositories[name] === 'undefined'){
			var metadata = this.registry.getMetadataByName(name);
			var repo = require(metadata.repository);
			var repository = new repo();

			repository.collection = metadata.collection;
			repository.client = this.client
			repository.mapper = this.mapper;
			repository.registry = this.registry;
			repository.metadata = metadata;

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
	 * @param  {Mixed}    id
	 * @return {Promise}
	 */
	find: function(name, id, cb){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.registry.getMetadataByName(name);
		var documentCache = this.documentCache;
		
		// if(this.documentCache.hasDocument(name, id)){
		// 	deferred.resolve(this.documentCache.getDocument(name, id));
		// } else {

			this.client.find(metadata, metadata.collection, mapper.adapterMapper.convertJavascriptToDb(metadata.getIdField().type, id), function(err, data){

				if (data === null){
					deferred.resolve(null);
					return;
				} else {
					mapper.mapDataToModel(metadata, data, function(err, document){
						documentCache.addDocument(document);
						deferred.resolve(document);						
					});
				}
			});	
		// }

		return deferred.promise;
	},

	findByQuery: function(name, query){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.registry.getMetadataByName(name);
		var documentCache = this.documentCache;

		var dbQuery = mapper.mapQueryToDatabase(metadata, query);

		this.client.findByQuery(metadata, metadata.collection, dbQuery, function(err, data){

			if (data === null){
				deferred.resolve([]);
				return;
			} else {

				mapper.mapDataToModels(metadata, data, function(err, documents){
					deferred.resolve(documents);
				});
			}
		});

		return deferred.promise;
	},

	countByQuery: function(name, query){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.registry.getMetadataByName(name);
		var documentCache = this.documentCache;

		var dbQuery = mapper.mapQueryToDatabase(metadata, query);

		this.client.countByQuery(metadata, metadata.collection, dbQuery, function(err, data){

			if (data === null){
				deferred.resolve([]);
				return;
			} else {

				deferred.resolve(data);

			}
		});

		return deferred.promise;
	},

	findBy: function(name, criteria, sort, skip, limit){

		var deferred = Q.defer();

		var mapper = this.mapper;
		var metadata = this.registry.getMetadataByName(name);
		var documentCache = this.documentCache;

		var dbCriteria = mapper.mapCriteriaToDatabase(metadata, criteria);

		this.client.findBy(metadata, metadata.collection, dbCriteria, sort, skip, limit, function(err, data){

			if (data === null){
				deferred.resolve([]);
				return;
			} else {

				mapper.mapDataToModels(metadata, data, function(err, documents){
					deferred.resolve(documents);
				});
			}
		});

		return deferred.promise;
	},

	findOneBy: function(name, criteria){

		var deferred = Q.defer();

		this.findBy(name, criteria, null, 0, 1).then(function(documents){
			deferred.resolve(documents[0]);
		});

		return deferred.promise;
	},

	/**
	 * Create a new document object
	 * 
	 * @param  {String} name
	 * @param  {Object} data
	 * @return {Object}
	 */
	createDocument: function(name, data){

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
	}
};

module.exports = Manager;