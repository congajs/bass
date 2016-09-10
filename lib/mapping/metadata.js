/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third party modules
var _ = require('lodash');

/**
 * The metadata class keeps track of document to collection (storage) mapping
 * and other information for documents
 *
 * @constructor
 */
var Metadata = function(){

	this.fields = [];
	this.adapters = {};
	this.relations = {
		'one-to-one': {},
		'one-to-many': {}
	};
	this.embeds = {
		'one': {},
		'many': {}
	};

	this.listeners = [];
	this.indexes = {
		compound: [],
		single: []
	};
	this.inherits = [];
	this.readOnly = {};
	this.events = {
		'prePersist': [],
		'postPersist': [],
		'preUpdate': []
	};

	this.propertiesToFields = {};
	this.fieldNamesToPropertyNames = {};
	this.fieldNamesToRelations = {};
	this.relationFieldNames = [];
};

Metadata.prototype = {
	
	name: null,
	filePath: null,

	/**
	 * The id field name
	 * @type {String}
	 */
	idField: null,


	idStrategy: null,
	fields: null,
	collection: null,
	proto: null,
	isEmbedded: null,

	/**
	 * Cached map of property names to field data
	 * 
	 * @type {Object}
	 */
	propertiesToFields: null,

	/**
	 * Cached map of field names to property names
	 * 
	 * @type {Object}
	 */
	fieldNamesToPropertyNames: null,

	/**
	 * Cached map of field names to relations
	 * 
	 * @type {Object}
	 */
	fieldNamesToRelations: null,

	/**
	 * Cached array of all of the relation field names
	 * 
	 * @type {Array}
	 */
	relationFieldNames: null,

	listeners: {} ,
	indexes: {} ,

	/**
	 * Keep track of document names that this metadata inherits from
	 *
	 * @type {Array<{String}>}
	 */
	inherits: [] ,

	/**
	 * Know if inheritance has been performed on this metadata already
	 *
	 * @type {Boolean}
	 */
	inherited: false ,

	/**
	 * Hash of mapped relations
	 * 
	 * @type {Object}
	 */
	relations: {},

	/**
	 * Hash of mapped embeds
	 * 
	 * @type {Object}
	 */
	embeds: {},

	/**
	 * Hash of adapter specific meta data
	 * 
	 * @type {Object}
	 */
	adapters: {},

	/**
	 * Hash of read only properties
	 *
	 * @type {Object}
	 */
	readOnly: {},

	/**
	 * Initialize the cache, etc.
	 * 
	 * @return {Void}
	 */
	init: function(){

		// this.fields.forEach(function(field){
		// 	this.fieldNamesToPropertyNames[field.name] = field.property;
		// }, this);
		
		// build field name to relation map
		for (var i in this.relations){
			for (var j in this.relations[i]){
				this.fieldNamesToRelations[j] = this.relations[i][j];
				this.relationFieldNames.push(j);
			}
		}
		for (var i in this.embeds){
			for (var j in this.embeds[i]){
				this.fieldNamesToRelations[j] = this.embeds[i][j];
				this.relationFieldNames.push(j);
			}
		}

	},

	/**
	 * Add a field
	 * 
	 * @param {Object}
	 */
	addField: function(field){
		this.fields.push(field);
		this.propertiesToFields[field.property] = field;
		this.fieldNamesToPropertyNames[field.name] = field.property;
	},
	
	/**
	 * Add a "single" index
	 * 
	 * @param {String} property
	 * @param {String} name
	 * @param {Object} data
	 */
	addSingleIndex: function(property, name, data){
		this.indexes.single.push({
			field: this.getFieldNameByProperty(property),
			isUnique: data.isUnique,
			isSparse: data.isSparse
		});
	},

	getIndexes: function(){
		return this.indexes;
	},

	addCompoundIndex: function(properties, name, data){

	},

	/**
	 * Get the id field data
	 * 
	 * @return {Object}
	 */
	getIdField: function(){
		return this.propertiesToFields[this.idField];
	},

	getIdFieldName: function(){
		return this.getIdField().name;
	},

	getIdPropertyName: function(){
		return this.idField;
	},

	getIdStrategy: function(){
		return this.idStrategy;
	},

	getRelations: function(){
		return this.relations;
	},

	/**
	 * Get an array of all of the relation field names
	 * 
	 * @return {Array} [description]
	 */
	getRelationFields: function(){
		return this.relationFieldNames;
	},

	/**
	 * Get relation info for a field name
	 * 
	 * @param  {String} name
	 * @return {Object}
	 */
	getRelationByFieldName: function(name){
		return this.fieldNamesToRelations[name];
	},

	/**
	 * Get a field object by its property name
	 * @param {String} property
	 * @returns {Object|null}
	 */
	getFieldByProperty: function(property) {

		if (typeof this.propertiesToFields[property] !== 'undefined'){
			return this.propertiesToFields[property];
		}

		return null;
	},

	/**
	 * Get a field's name by its document's property name
	 * @param {String} property
	 * @returns {String}
	 */
	getFieldNameByProperty: function(property){
		return this.propertiesToFields[property].name;
	} ,

	/**
	 * Get the property matching a field name
	 * @param {String} fieldName
	 * @returns {String|null}
	 */
	getPropertyByFieldName: function(fieldName) {

		if (typeof this.fieldNamesToPropertyNames[property] !== 'undefined'){
			return this.fieldNamesToPropertyNames[property];
		}
		
		return null;

	} ,

	/**
	 * See if a property is read only
	 * @param {String} property The name of the property
	 * @returns {Boolean}
	 */
	isPropertyReadOnly: function(property) {
		return !!this.readOnly[property];
	} ,

	/**
	 * See if a field is read only
	 * @param {String} fieldName The name of the field
	 * @returns {Boolean}
	 */
	isFieldReadOnly: function(fieldName) {

		var property = this.getPropertyByFieldName(fieldName);
		if (!property) {
			return false;
		}

		return !!this.isPropertyReadOnly(property);

	} ,

	/**
	 * Merge an existing metadata instance onto this instance
	 *
	 * @param {Metadata} metadata The object to merge onto this object
	 * @returns {void}
	 */
	mergeMetadata: function(metadata) {

		if (!(metadata instanceof Metadata) &&
			metadata.constructor.name !== 'Metadata') {

			throw new Error('Invalid argument, expecting Metadata, got ' + metadata.constructor.name);
		}

		var scalar = /string|number|boolean/;
		var owner = ['isEmbedded'];
		var skip = ['name', 'filePath', 'proto', 'inherits'];

		Object.getOwnPropertyNames(metadata).forEach(function(name) {
			if (skip.indexOf(name) > -1 && typeof this[name] !== 'undefined') {
				return true;
			}

			var isOwner = owner.indexOf(name) > -1;

			if (typeof this[name] === 'undefined') {

				this[name] = metadata[name];

			} else if (name === 'fields' ) {

				var i ,
					x ,
					xlen ,
					found ,
					len = metadata.fields.length;

				for (i = 0; i < len; i++) {
					found = false;
					xlen = this.fields.length;
					for (x = 0; x < xlen; x++) {
						if (this.fields[x].name === metadata.fields[i].name) {
							found = true;
							break;
						}
					}
					if (!found) {
						this.fields.push(metadata.fields[i]);
					}
				}

			} else if (!isOwner) {

				if (scalar.test(typeof metadata[name])) {

					this[name] = metadata[name];

				} else if (typeof metadata[name] !== 'function') {

					//_.merge(this[name], _.cloneDeep(metadata[name]));
					_.merge(this[name], metadata[name]);

				}

			} else if (this[name] === null) {

				// owner fields only get set if they are null
				this[name] = metadata[name];

			}
			return true;
		}, this);
	}
};

Metadata.prototype.constructor = Metadata;

module.exports = Metadata;