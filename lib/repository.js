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

/**
 * This is the generic base repository for all other document repositories
 * 
 * @param  {Registry} registry [description]
 * @param  {String} type     [description]
 * @param  {Object} client   [description]
 *
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
var Repository = function(adapter, client, mapper, metadata, documentCache){
	this.adapter = adapter;
	this.client = client;
	this.mapper = mapper;
	this.metadata = metadata;
	this.documentCache = documentCache;
};

Repository.prototype = {

	/**
	 * Find a document by id
	 * 
	 * @param  {Mixed} id
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

			this.client.find(metadata, 
							 metadata.collection, 
							 mapper.adapterMapper.convertJavascriptToDb(metadata.getIdField().type, id), 
							 function(err, data){

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

			deferred.resolve(data);

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

			deferred.resolve(data);

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
	}
};

module.exports = Repository;