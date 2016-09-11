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
 * @param  {Registry}       registry
 * @param  {AdapterMapper|*} adapterMapper
 */
module.exports = class Mapper {

	constructor(registry, adapterMapper) {
		this.registry = registry;
		this.adapterMapper = adapterMapper;
	}

	/**
	 * Map a collection name to its document name
	 *
	 * @param {String} collectionName
	 * @returns {String|null} the document name (if found)
	 */
	mapCollectionNameToDocumentName(collectionName) {

		// @todo - get rid of this looop!
		const metas = this.registry.metas;
		for (let name in metas) {
			if (name === collectionName ||
				metas[name].name === collectionName ||
				metas[name].collection === collectionName) {

				return metas[name].name;
			}
		}
		return null;
	}

	/**
	 * Map a document name to its collection name
	 *
	 * @param {String} documentName
	 * @returns {String|null} The collection name (if found)
	 */
	mapDocumentNameToCollectionName(documentName) {

		// @todo - get rid of this loop!
		const metas = this.registry.metas;
		for (let name in metas) {
			if (metas[name].name === documentName ||
				metas[name].collection === documentName) {

				return metas[name].collection;
			}
		}
		return null;
	}

	/**
	 * Map an object of criteria to the correct types for
	 * the database to use
	 * 
	 * @param  {Metadata} metadata
	 * @param  {Object} criteria
	 * @return {Object}
	 */
	mapCriteriaToDatabase(metadata, criteria) {

		if (typeof this.adapterMapper.mapCriteriaToDatabase === 'function') {
			return this.adapterMapper.mapCriteriaToDatabase(metadata, criteria);
		}

		const dbCriteria = {};

		if (criteria) {
			for (let i in metadata.fields) {
				if (typeof criteria[metadata.fields[i].property] !== 'undefined') {

					dbCriteria[metadata.fields[i].name] = this.adapterMapper.convertJavascriptToDb(
						metadata.fields[i].type,
						criteria[metadata.fields[i].property]);

				}
			}
		}

		return dbCriteria;
	}

	/**
	 * Map a Query's properties, etc. to the adapter's database
	 * 
	 * @param  {Metadata} metadata
	 * @param  {Query}    query
	 * @return {Query}
	 * @throws Error
	 */
	mapQueryToDatabase(metadata, query) {

		let name ,
			property ,
			convertedProperty ,
			converted ,
			dbQuery = new Query() ,
			conditionAlias = query.getConditionAlias() ,
			conditionAliasReg = new RegExp('^' + conditionAlias + '\.'),
			hasConvertFieldNameToDb = (typeof this.adapterMapper.convertFieldNameToDb === 'function');

		for (property in query._conditions) {

			if (conditionAlias && conditionAlias.length !== 0) {
				property = property.replace(conditionAliasReg, '');
			}

			if (hasConvertFieldNameToDb) {
				convertedProperty = this.adapterMapper.convertFieldNameToDb(metadata, property);
				converted = (convertedProperty !== property);
			} else {
				convertedProperty = null;
				converted = false;
			}

			name = metadata.getFieldNameByProperty(converted ? convertedProperty : property);

			if (!name){
				throw new Error('Invalid Field: ' + property);
			}

			//dbQuery._conditions[name] = this.adapterMapper.mapQueryValue(query._conditions[i]);		// TODO : pass value to adapter mapper (recursive) and return formatted value (ie. ObjectId)
			dbQuery._conditions[converted ? property : name] = query._conditions[property];
		}

		for (property in query._sort) {

			if (hasConvertFieldNameToDb) {
				convertedProperty = this.adapterMapper.convertFieldNameToDb(metadata, property);
				converted = (convertedProperty !== property);
			} else {
				convertedProperty = null;
				converted = false;
			}

			name = metadata.getFieldNameByProperty(converted ? convertedProperty : property);

			if (!name) {
				throw new Error('Invalid Sort By Field: ' + property);
			}

			dbQuery._sort[converted ? property : name] = query._sort[property];
		}

		dbQuery._limit = query._limit;
		dbQuery._skip = query._skip;

		dbQuery.countFoundRows(query.getCountFoundRows());

		return dbQuery;
	}

	/**
	 * Map an object literal of data to a model, recursively
	 * 
	 * @param {Metadata} metadata The metadata for the document you are mapping
	 * @param {Object} data The data you are mapping from
	 * @param {Function} cb The is the callback to execute when finished
	 * @param {Function|undefined} walkRecursive When a recursive mapDataToModel happens, this function executes on the document
	 * @returns {void}
	 */
	mapDataToModel(metadata, data, cb, walkRecursive) {

		const self = this;
		const model = new metadata.proto();

		const reference = {
			data: data ,
			document: model ,
			metadata: metadata ,
			registry: this.registry
		};

		// set internal flag to indicate that this is not a new instance
		model.__isNew = false;

		this.registry.eventDispatcher.dispatch('preHydrate', reference, function() {

			const data = reference.data;
			const model = reference.document;
			const metadata = reference.metadata;

			metadata.fields.forEach(function(field) {

				let value = this.adapterMapper.convertDbToJavascript(field.type, data[field.name]);

				if (typeof value == 'undefined'){
					value = data[field.default];
				}

				if (typeof value !== 'undefined'){

					if (field.type === 'Number') {

						value = parseInt(value, 10);

					} else if (field.type === 'Boolean') {

						value = !!value;
					}

					const func = 'set' + field.property.charAt(0).toUpperCase() + field.property.substr(1, field.property.length);
					if (typeof model[func] === 'function') {

						model[func](value);

					} else {

						model[field.property] = value;
					}
				}

			}, self);

			const relationFields = metadata.getRelationFields();

			const calls = [];

			relationFields.forEach(function(field) {

				calls.push(
					function(callback){

						if (data) {
							model[field] = data[field];
						}
						self.adapterMapper.convertDataRelationToDocument(metadata, field, data, model, self, function(err, document) {

							if (err) {
								cb(err, model);
								return;
							}

							const relation = metadata.getRelationByFieldName(field);
							const relationMetadata = self.registry.getMetadataByName(relation.document);

							if (_.isArray(document[field])) {

								const subCalls = [];
								const datas = document[field];

								model[field] = [];

								datas.forEach(function(subData) {

									if (!(subData instanceof relationMetadata.proto)) {

										(function(subData){
											subCalls.push(
												function(cb) {

													self.mapDataToModel(relationMetadata, subData, function(err, doc){

														model[field].push(doc);

														if (typeof walkRecursive === 'function') {
															walkRecursive(err, doc, field);
														}

														cb(err);

													}, walkRecursive);
												}
											);
										}(subData));

									} else {

										//model[field].push(subData);
									}
								});

								if (subCalls.length > 0) {

									async.parallel(subCalls, function(err){

										callback(err);

									});
								} else {

									callback(null);
								}
							} else {

								if (document[field]) {

									self.mapDataToModel(relationMetadata, document[field], function(err, doc){

										model[field] = doc;

										if (typeof walkRecursive === 'function') {
											walkRecursive(err, doc, field);
										}

										callback(err);

									}, walkRecursive);
								} else {

									callback(null);
								}
							}
						});

					}
				);
			});

			const finish = function(err) {
				const reference = {
					data: data ,
					document: model ,
					metadata: metadata ,
					registry: self.registry
				};

				// build internal map of initial values to be able to build changesets later
				model.__loadedData = {};

				metadata.fields.forEach(function(field) {
					model.__loadedData[field.property] = model[field.property];
				});

				self.registry.eventDispatcher.dispatch('postHydrate', reference, function() {
					cb(err, reference.document);
				});
			};

			if (calls.length > 0) {

				async.parallel(calls, function(err){
					finish(err);
				});

			} else {

				finish(null);
			}
		});
	}
	
	/**
	 * This maps raw data from the database to new models
	 *
	 * The process is split in to two in order to grab related data
	 * in as few queries as possible and merging all the data togther
	 * 
	 * @param  {Manager}    manager
	 * @param  {Metadata}   metadata
	 * @param  {Object}     data
	 * @param  {Function}   cb
	 * @param  {Function}   walk
	 * @return {void}
	 */
	mapDataToModels(manager, metadata, data, cb, walk) {

		const self = this;
		const calls = [];

		// var start = new Date();

		for (let i = 0, j = data.length; i < j; i++) {

			(function(doc, idx, metadata) {
				calls.push(
					function(callback){

						self.mapDataToPartialModel(metadata, doc, function(err, mappedModel) {

							data[idx] = mappedModel;

							if (typeof walk === 'function') {
								walk(err, mappedModel, idx);
							}

							callback(err);

						}, walk);
					}
				);

			}(data[i], i, metadata));
		}

		if (calls.length > 0) {

			async.parallel(calls, function(err) {

				// var s = new Date();

				self.mergeInRelations(manager, metadata, data, function(err, data){

					// var e = new Date();
					// var t = e - s;
					// console.log('merge relations: ' + metadata.name + ' - ' + t);

					// var end = new Date();
					// var time = end - start;
					// console.log('map to models: ' + metadata.name + ' - ' + time);


					cb(err, data);
				})

			});

		} else {

			cb(null, data);
		}
	}

	/**
	 * Run queries on a collection of partial models and merge the related
	 * models in to each model
	 * 
	 * @param  {Manager}  manager
	 * @param  {Metadata} metadata
	 * @param  {Object}   data
	 * @param  {Function} cb
	 * @return {void}
	 */
	mergeInRelations(manager, metadata, data, cb) {
		this.adapterMapper.mergeInRelations(manager, metadata, data, cb);
	}

	/**
	 * Map raw data to a model using sparse information for any joins
	 * so that they can be grabbed later on in bulk and merged in
	 * 
	 * @param  {Metadata} metadata
	 * @param  {Object}   data
	 * @param  {Function} cb
	 * @param  {Function} walk
	 * @return {void}
	 */
	mapDataToPartialModel(metadata, data, cb, walk) {

		// var start = new Date();

		const self = this;
		const model = new metadata.proto();

		const reference = {
			data: data ,
			document: model ,
			metadata: metadata ,
			registry: this.registry
		};

		// set internal flag to indicate that this is not a new instance
		model.__isNew = false;

		this.registry.eventDispatcher.dispatch('preHydrate', reference, function() {

			const data = reference.data;
			const model = reference.document;
			const metadata = reference.metadata;

			metadata.fields.forEach(function(field){

				let value = this.adapterMapper.convertDbToJavascript(field.type, data[field.name]);

				if (typeof value == 'undefined'){
					value = data[field.default];
				}

				if (typeof value !== 'undefined'){

					if (field.type === 'Number') {

						value = parseInt(value, 10);

					} else if (field.type === 'Boolean') {

						value = !!value;
					}

					const func = 'set' + field.property.charAt(0).toUpperCase() + field.property.substr(1, field.property.length);
					if (typeof model[func] === 'function') {

						model[func](value);

					} else {

						model[field.property] = value;
					}
				}

			}, self);

			self.adapterMapper.mapPartialRelationsToModel(model, metadata, data, function(err, model) {
				// var end = new Date();
				// var time = end - start;
				//console.log('map data to partial model: ' + metadata.name + ' - ' + time);
				cb(null, model);
			});

		});
	}

	/**
	 * Map a model to an object literal
	 * 
	 * @param {Metadata} metadata
	 * @param {Object} model
	 * @param {Function} cb
	 * @returns {void}
	 */
	mapModelToData(metadata, model, cb) {

		const self = this;
		const data = {};

		// set id if this model has a manual id strategy
		if (metadata.getIdStrategy() == 'MANUAL'){
			data[metadata.getIdFieldName()] = model[metadata.getIdPropertyName()];
		}

		for (let i in metadata.fields){

			if (!metadata.fields[i].table ||
				(metadata.fields[i].table === metadata.name ||
				 metadata.fields[i].table === metadata.collection)) {

				// make sure we aren't setting the id field
				if (metadata.fields[i].property != metadata.idField) {

					data[metadata.fields[i].name] =
						this.adapterMapper.convertJavascriptToDb(
							metadata.fields[i].type,
							model[metadata.fields[i].property]
						);
				}
			}
		}

		this.adapterMapper.convertRelationsToData(metadata, model, data, function() {

			async.each(
				Object.keys(metadata.embeds['one']),

				function (embedKey, cb2) {
					const embed = metadata.embeds['one'][embedKey];
					const embedMetadata = self.registry.getMetadataByName(embed.document);
					self.mapModelToData(embedMetadata, model[embed.field], function (embedData) {
						data[embed.field] = embedData;
						cb2();
					});
				},

				function (err) {

					async.each(
						Object.keys(metadata.embeds['many']),

						function (embedKey, cb3) {
							const embed = metadata.embeds['many'][embedKey];

							data[embed.field] = [];
							if (model[embed.field]) {
								const embedMetadata = self.registry.getMetadataByName(embed.document);
								async.each(
									model[embed.field],

									function (fieldItem, cb4) {
										self.mapModelToData(embedMetadata, fieldItem, function (embedData) {
											if (embedData) {
												data[embed.field].push(embedData);
											}
											cb4();
										});
									},

									function (err) {
										cb3(err);
									}
								);
							} else {
								cb3();
							}
						},

						function (err) {
							cb(data);
						}
					);
				}
			);
		});
	}

	/**
	 * Reduce a model's mapped-data representation to a proper database format valid for insert or update
	 * @param {Metadata} metadata
	 * @param {Object} data
	 */
	reduceMappedData(metadata, data) {

		// reduce the data given so it is suitable for storage
		let fieldName;
		const reducedData = {};

		for (fieldName in data) {
			if (data[fieldName] !== undefined &&
				!metadata.isFieldReadOnly(fieldName)) {

				reducedData[fieldName] = data[fieldName];

			}
		}

		return reducedData;
	}
}
