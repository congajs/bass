/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// native modules
var path = require('path');

// local modules
var Field = require('./field');
var Metadata = require('./metadata');

// annotations
var CreatedAtAnnotation = require('../mapping/annotation/created-at');
var DocumentAnnotation = require('../mapping/annotation/document');
var DocumentListenerAnnotation = require('../mapping/annotation/document-listener');
var FieldAnnotation = require('../mapping/annotation/field');
var IdAnnotation = require('../mapping/annotation/id');
var UpdatedAtAnnotation = require('../mapping/annotation/updated-at');
var VersionAnnotation = require('../mapping/annotation/version');

var OneToManyAnnotation = require('../mapping/annotation/one-to-many');
var OneToOneAnnotation = require('../mapping/annotation/one-to-one');

var MetadataBuilder = function(){};

MetadataBuilder.prototype = {
		
	build: function(data){

		var metadata = new Metadata();
		
		metadata.filePath = data.filePath;
		metadata.namespace = data.namespace;
		metadata.proto = require(data.filePath);
		
		this.handleConstructorAnnotations(metadata, data.constructor);
		this.handlePropertyAnnotations(metadata, data.properties);

		return metadata;
	},
	
	/**
	 * Handle all of the constructor annotations on a model and apply
	 * settings to the Metadata
	 * 
	 * @param {Metadata} metadata
	 * @param {Array} annotations
	 * @returns {void}
	 */
	handleConstructorAnnotations: function(metadata, annotations){

		for (var i in annotations){
			
			var annotation = annotations[i];

			// @Document
			if (annotation instanceof DocumentAnnotation){
				metadata.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
				metadata.collection = annotation.collection;
				metadata.repository = typeof annotation.repository !== 'undefined' ? path.join(path.dirname(metadata.filePath), annotation.repository) : null;
			}

			// @DocumentListener
			if (annotation instanceof DocumentListenerAnnotation){
				metadata.listeners.push(annotation.listener);
			}
		}
	},
	
	/**
	 * Handle all of the property annotations on a model and apply
	 * settings to the Metadata
	 * 
	 * @param {Metadata} metadata
	 * @param {Array} annotations
	 * @returns {void}
	 */
	handlePropertyAnnotations: function(metadata, annotations){

		for (var i in annotations){
			
			var annotation = annotations[i];

			// @Id
			if (annotation instanceof IdAnnotation){
				metadata.idField = annotation.target;
			}

			// @Field
			if (annotation instanceof FieldAnnotation){
				
				var field = new Field();
				
				field.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
				field.type = annotation.type !== 'undefined' ? annotation.type.toLowerCase() : 'string';
				field.property = annotation.target;
				field.default = metadata.proto.prototype[annotation.target];
				
				metadata.addField(field);
			}

			// @Version
			if (annotation instanceof VersionAnnotation){
				metadata.versionProperty = annotation.target;
			}

			// @CreatedAt
			if (annotation instanceof CreatedAtAnnotation){
				metadata.createdAtProperty = annotation.target;
			}

			// @UpdatedAt
			if (annotation instanceof UpdatedAtAnnotation){
				metadata.updatedAtProperty = annotation.target;
			}

			// @OneToOne
			if (annotation instanceof OneToOneAnnotation){

				if (typeof metadata.relations === 'undefined'){
					metadata.relations['one-to-one'] = {};
				}

				metadata.relations['one-to-one'][annotation.target] = {
					field: annotation.name,
					document: annotation.document
				}
			}

			// @OneToMany
			if (annotation instanceof OneToManyAnnotation){

				if (typeof metadata.relations === 'undefined'){
					metadata.relations['one-to-many'] = {};
				}

				metadata.relations['one-to-many'][annotation.target] = {
					field: annotation.name,
					document: annotation.document
				}
			}
		}
	}
};

module.exports = MetadataBuilder;