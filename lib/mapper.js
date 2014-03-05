/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third-party modules
var _ = require('lodash');
var async = require('async');

// local modules
var Query = require('./query');

/**
 * The Mapper provides generic methods to map document
 * objects to the underlying adapter database
 * 
 * @param  {Registry       registry
 * @param  {AdapterMapper} adapterMapper
 */
var Mapper = function(registry, adapterMapper){
	this.registry = registry;
	this.adapterMapper = adapterMapper;
};

Mapper.prototype = {

	/**
	 * Map a collection name to its document name
	 *
	 * @param {String} collectionName
	 * @returns {String|null} the document name (if found)
	 */
	mapCollectionNameToDocumentName: function(collectionName) {
		var metas = this.registry.metas;
		for (var name in metas) {
			if (name === collectionName ||
				metas[name].name === collectionName ||
				metas[name].collection === collectionName) {

				return metas[name].name;
			}
		}
		return null;
	} ,

	/**
	 * Map a document name to its collection name
	 *
	 * @param {String} documentName
	 * @returns {String|null} The collection name (if found)
	 */
	mapDocumentNameToCollectionName: function(documentName) {
		var metas = this.registry.metas;
		for (var name in metas) {
			if (metas[name].name === documentName ||
				metas[name].collection === documentName) {

				return metas[name].collection;
			}
		}
		return null;
	} ,

	/**
	 * Map an object of criteria to the correct types for
	 * the database to use
	 * 
	 * @param  {Metadata} metadata
	 * @param  {Object} criteria
	 * @return {Object}
	 */
	mapCriteriaToDatabase: function(metadata, criteria){

		var dbCriteria = {};

		for(var i in metadata.fields){
			
			if (typeof criteria[metadata.fields[i].property] !== 'undefined'){
				dbCriteria[metadata.fields[i].name] = this.adapterMapper.convertJavascriptToDb(
					metadata.fields[i].type,
					criteria[metadata.fields[i].property]);				
			}

		}

		return dbCriteria;
	},

	/**
	 * Map a Query's properties, etc. to the adapter's database
	 * 
	 * @param  {Metadata} metadata
	 * @param  {Query}    query
	 * @return {Query}
	 * @throws Error
	 */
	mapQueryToDatabase: function(metadata, query){

		var i, name;
		var dbQuery = new Query();

		for (i in query._conditions){
			name = metadata.getFieldNameByProperty(i);
			if (!name){
				throw new Error('Invalid Field: ' + i);
			}
			//dbQuery._conditions[name] = this.adapterMapper.mapQueryValue(query._conditions[i]);		// TODO : pass value to adapter mapper (recursive) and return formatted value (ie. ObjectId)
			dbQuery._conditions[name] = query._conditions[i]
		}

		for (i in query._sort){
			name = metadata.getFieldNameByProperty(i);
			if (!name){
				throw new Error('Invalid Sort By Field: ' + i);
			}
			dbQuery._sort[name] = query._sort[i];
		}

		dbQuery._limit = query._limit;
		dbQuery._skip = query._skip;

		dbQuery.countFoundRows(query.getCountFoundRows());

		return dbQuery;
	},

	/**
	 * Map an object literal of data to a model
	 * 
	 * @param {Metadata} metadata
	 * @param {Object} data
	 * @param {Function} cb
	 * @returns {void}
	 */
	mapDataToModel: function(metadata, data, cb){

		var self = this;
		var model = new metadata.proto();

		metadata.fields.forEach(function(field){

			var value = this.adapterMapper.convertDbToJavascript(field.type, data[field.name]);

			if (typeof value == 'undefined'){
				value = data[field._default];
			}

			if (typeof value !== 'undefined'){

				if (field.type === 'Number'){
					value = parseInt(value, 10);
				}

				if (field.type === 'Boolean'){
					value = !!value;
				}

				model[field.property] = value;
			}

		}, this);

		var relationFields = metadata.getRelationFields();

		this.adapterMapper.convertDataRelationsToDocument(metadata, data, model, this, function(err, document){

			var calls = [];

			relationFields.forEach(function(field){

				if (_.isArray(document[field])){

					(function(field, metadata){

						calls.push(

							function(callback){

								var relation = metadata.getRelationByFieldName(field);
								var relationMetadata = self.registry.getMetadataByName(relation.document);

								var subCalls = [];
								var datas = model[field];

								model[field] = [];

								datas.forEach(function(subData){

									if (!(subData instanceof relationMetadata.proto)){

										(function(subData){
											self.mapDataToModel(relationMetadata, subData, function(err, doc){

												model[field].push(doc);
												callback();
											});
										}(subData));
									} else {

										//model[field].push(subData);
									}
								});

								async.series(subCalls, function(err, docs){
									callback();
								});
							}
						);

					}(field, metadata));

				} else {

					(function(field, metadata, document){

						calls.push(

							function(callback){

								var relation = metadata.getRelationByFieldName(field);
								var relationMetadata = self.registry.getMetadataByName(relation.document);

								self.mapDataToModel(relationMetadata, document[field], function(err, doc){
									document[field] = doc;
									callback(null, document);
								});
							}
						);

					}(field, metadata, model));
				}
			});

			async.series(calls, function(err, doc){
				cb(null, model);
			});
		});

	},
	
	/**
	 * Map an array of object literals to an array of models
	 * 
	 * @param {Metadata} metadata
	 * @param {Array} data
	 * @param {Function} cb
	 * @returns {void}
	 */
	mapDataToModels: function(metadata, data, cb){
		
		var self = this;
		var result = [];
		
		var calls = [];

		for (var i in data){

			(function(doc){

				calls.push(
					
					function(callback){
						self.mapDataToModel(metadata, doc, function(err, model){
							result.push(model);
							callback();
						})
					}
				);

			}(data[i]));
		}

		async.series(calls, function(){
			cb(null, result);
		});
	},
	
	/**
	 * Map a model to an object literal
	 * 
	 * @param {Metadata} metadata
	 * @param {Object} model
	 * @returns {Object}
	 */
	mapModelToData: function(metadata, model){

		var data = {};
		
		for (var i in metadata.fields){

			if (!metadata.fields[i].table ||
				(metadata.fields[i].table === metadata.name ||
				 metadata.fields[i].table === metadata.collection)) {

				data[metadata.fields[i].name] =
					this.adapterMapper.convertJavascriptToDb(
						metadata.fields[i].type,
						model[metadata.fields[i].property]
					);
			}
		}

		this.adapterMapper.convertRelationsToData(metadata, model, data, this);
		
		return data;
	}
};

module.exports = Mapper;