/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
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
	}
};

Metadata.prototype = {
	
	name: null,
	filePath: null,
	idField: null,
	fields: null,
	collection: null,
	proto: null,
	isEmbedded: false,

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
		})
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

	getFieldNameByProperty: function(property){
		return this.propertiesToFields[property];
	}
};

module.exports = Metadata;