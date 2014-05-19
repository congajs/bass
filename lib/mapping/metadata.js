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
		'one-to-one': {

		},

		'one-to-many': {

		}
	};
	this.embeds = {
		'one': {},
		'many': {}
	};
	this.propertiesToFields = {};
	this.listeners = [];
	this.indexes = {
		compound: [],
		single: []
	};
	this.inherits = [];
};

Metadata.prototype = {
	
	name: null,
	filePath: null,
	idField: null,
	fields: null,
	collection: null,
	proto: null,
	isEmbedded: null,

	propertiesToFields: {} ,

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

	addField: function(field){
		this.fields.push(field);
		this.propertiesToFields[field.property] = field.name;
	},
	
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

	getIdField: function(){

		var idField = this.idField;
		var returnField;

		this.fields.forEach(function(field){
			if (field.property == idField){
				returnField = field;
			}
		});
		
		return returnField;

	},

	getIdFieldName: function(){
		return this.getIdField().name;
	},

	getIdPropertyName: function(){
		return this.idField;
	},

	getRelations: function(){
		return this.relations;
	},

	getRelationFields: function(){

		var fields = [];

		for (var i in this.relations){
			for (var j in this.relations[i]){
				fields.push(j);
			}
		}

		return fields;
	},


	getRelationByFieldName: function(name){
		for (var i in this.relations){
			for (var j in this.relations[i]){
				if (j === name){
					return this.relations[i][j];
				}
			}
		}
	},

	/**
	 * Get a field object by its property name
	 * @param {String} property
	 * @returns {Object|null}
	 */
	getFieldByProperty: function(property) {

		var i, len = this.fields.length;

		for (i = 0; i < len; i++) {
			if (this.fields[i].property == property) {

				return this.fields[i];
			}
		}

		return null;
	},

	/**
	 * Get a field's name by its document's property name
	 * @param {String} property
	 * @returns {String}
	 */
	getFieldNameByProperty: function(property){
		return this.propertiesToFields[property];
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