/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// native modules
var crypto = require('crypto');

// third-party modules
var _ = require('lodash');
var async = require('async');

/**
 * The UnitOfWork manages all database operations that need
 * to be performed
 * 
 * @param  {Registry}      registry
 * @param  {Mapper}        mapper
 * @param  {Client}        client
 * @param  {DocumentCache} documentCache
 */
var UnitOfWork = function(registry, mapper, client, documentCache){
	this.registry = registry;
	this.mapper = mapper;
	this.client = client;
	this.documentCache = documentCache;
	this.clear();
};

UnitOfWork.prototype = {

	/**
	 * Persist a Document object
	 *
	 * This method will determine if the Document should be
	 * scheduled for an insert or update
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	persist: function(document){

		var objectId;

		if (typeof document.__objectId === 'undefined'){
			objectId = this.generateObjectId();
			document.__objectId = objectId;
		}

		var metadata = this.registry.getMetadataForDocument(document);

		if (document[metadata.getIdField().property] === null 
			|| typeof document[metadata.getIdField().property] === 'undefined'){

			document.__isNew = true;
			this.scheduleInsert(document);
		} else {
			document.__isNew = false;
			this.scheduleUpdate(document);
		}
	},

	/**
	 * Schedule an insert
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	scheduleInsert: function(document){

		var metadata = this.registry.getMetadataForDocument(document);

		// one-to-one
		for (var i in metadata.relations['one-to-one']){
			if(typeof document[i] !== 'undefined'){
				this.persist(document[i]);
			}
		}

		// one-to-many
		for (var i in metadata.relations['one-to-many']){
			
			if (_.isArray(document[metadata.relations['one-to-many'][i].field])){
				document[i].forEach(function(oneToManyDoc){
					this.persist(oneToManyDoc);
				}, this);
			}
		}

		this.inserts[document.__objectId] = document;
	},

	/**
	 * Schedule an update
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	scheduleUpdate: function(document){
		this.updates[document.__objectId] = document;
	},

	/**
	 * Schedule a removal
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	scheduleRemoval: function(document){
		this.removals[document.__objectId] = document;
	},

	/**
	 * Flush the unit of work
	 *
	 * This method will run all scheduled inserts/updates/removals
	 * 
	 * @param  {Function} cb
	 * @return {void}
	 */
	flush: function(cb){

		var that = this;

		var calls = [
			function(callback){
				that.runInserts(function(err){
					callback();
				});
			},
			function(callback){
				that.runUpdates(function(err){
					callback();
				});
			},
			function(callback){
				that.runRemovals(function(err){
					callback();
				});
			}
		];

		// run the calls
		async.series(calls, function(err, data){
			that.clear();
			cb(null);
		});
	},

	/**
	 * Run the scheduled inserts
	 * 
	 * @param  {Function} cb
	 * @return {void}
	 */
	runInserts: function(cb){

		var registry = this.registry;
		var mapper = this.mapper;
		var client = this.client;
		var documentCache = this.documentCache;

		var calls = [];

		for (var i in this.inserts){

			var document = this.inserts[i];

			(function(document){

				calls.push(
					function(callback){
						
						// grab the meta data
						var metadata = registry.getMetadataForDocument(document);

						registry.eventDispatcher.dispatch('prePersist', {

							document: document,
							metadata: metadata,

						}, function(){

							// convert entity to a simple object for persistence
							var data = mapper.mapModelToData(metadata, document);

							// persist it
							client.insert(metadata, metadata.collection, data, function(err, data){

								console.log(err);

								console.log('=================== INSERT =================');
								console.log(data);

								document[metadata.getIdField().property] = 
									mapper.adapterMapper.convertDbToJavascript(data[metadata.getIdFieldName()])
								document.__isNew = false;
								documentCache.addDocument(document);

								callback();
							});
						});
					}
				);
			}(document));
		};

		// initialize the connections!
		async.series(calls, function(err, data){
			cb(null);
		});
	},

	/**
	 * Run the scheduled updates
	 * 
	 * @param  {Function} cb
	 * @return {void}
	 */
	runUpdates: function(cb){

		var registry = this.registry;
		var mapper = this.mapper;
		var client = this.client;

		var calls = [];

		for (var i in this.updates){

			var document = this.updates[i];

			(function(document){

				calls.push(

					function(callback){
						
						// grab the meta data
						var metadata = registry.getMetadataForDocument(document);

						registry.eventDispatcher.dispatch('prePersist', {

							document: document,
							metadata: metadata,

						}, function(){

							// convert entity to a simple object for persistence
							var data = mapper.mapModelToData(metadata, document);

							// persist it
							client.update(metadata, metadata.collection, data[metadata.getIdFieldName()], data, function(err, data){
								callback();
							});

						});
					}
				);
			}(document));
		};

		// initialize the connections!
		async.series(calls, function(err, data){
			cb(null);
		});
	},

	/**
	 * Run the scheduled removals
	 * 
	 * @param  {Function} cb
	 * @return {void}
	 */
	runRemovals: function(cb){
		
		var registry = this.registry;
		var mapper = this.mapper;
		var client = this.client;
		var documentCache = this.documentCache;

		var calls = [];

		for (var i in this.removals){

			var document = this.removals[i];

			(function(document){

				calls.push(
					function(callback){
						
						// grab the meta data
						var metadata = registry.getMetadataForDocument(document);

						// convert entity to a simple object for persistence
						var data = mapper.mapModelToData(metadata, document);

						// persist it
						client.remove(metadata, metadata.collection, data[metadata.getIdFieldName()], function(err){
							documentCache.removeDocument(document);
							callback();
						});
					}
				);
			}(document));
		};

		// run the calls
		async.series(calls, function(err, data){
			cb(null);
		});
	},

	/**
	 * Clear all scheduled modifications
	 * 
	 * @return {void}
	 */
	clear: function(){
		this.updates = {},
		this.inserts = {},
		this.removals = {}
	},

	/**
	 * Generate a unique internal id for a document object
	 * 
	 * @return {String}
	 */
	generateObjectId: function(){
		var current_date = (new Date()).valueOf().toString();
		var random = Math.random().toString();
		return crypto.createHash('sha1').update(current_date + random).digest('hex');
	},

};

module.exports = UnitOfWork;