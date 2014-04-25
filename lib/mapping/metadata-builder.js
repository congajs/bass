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

			// TODO : I think the business logic for each annotation belongs in its own class, not here
			switch (annotation.annotation) {

				// @Document
				case 'Bass:Document' :
					metadata.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
					metadata.collection = annotation.collection;
					metadata.repository = annotation.repository !== null ? path.join(path.dirname(metadata.filePath), annotation.repository) : null;
					break;

				// @EmbeddedDocument
				case 'Bass:EmbeddedDocument' :
					metadata.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
					metadata.isEmbedded = true;
					break;

				// @DocumentListener
				case 'Bass:DocumentListener' :
					metadata.listeners.push(annotation.listener);
					break;

				// @Discriminator
				case 'Bass:Discriminator' :
					metadata.discriminator = annotation;
					break;
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

		var i;
		for (i in annotations){
			
			var annotation = annotations[i];

			// TODO : I think the business logic for each annotation belongs in its own class, not here
			switch (annotation.annotation) {
				// @Id
				case 'Bass:Id' :
					metadata.idField = annotation.target;
					break;

				// @Field
				case 'Bass:Field' :
					var field = new Field();
					field.table = annotation.table;
					field.name = annotation.name !== null ? annotation.name : annotation.target;
					field.type = annotation.type !== null ? annotation.type.toLowerCase() : 'string';
					field.property = annotation.target;
					field.default = metadata.proto.prototype[annotation.target];

					metadata.addField(field);
					break;

				// @Version
				case 'Bass:Version' :
					metadata.versionProperty = annotation.target;
					break;

				// @CreatedAt
				case 'Bass:CreatedAt' :
					metadata.createdAtProperty = annotation.target;
					break;

				// @UpdatedAt
				case 'Bass:UpdatedAt' :
					metadata.updatedAtProperty = annotation.target;
					break;

				// @OneToOne
				case 'Bass:OneToOne' :
					if (typeof metadata.relations === 'undefined'){
						metadata.relations = {'one-to-one': {}};

					} else if (typeof metadata.relations['one-to-one'] === 'undefined') {

						metadata.relations['one-to-one'] = {};

					}
					metadata.relations['one-to-one'][annotation.target] = {
						field: annotation.target,
						document: annotation.document
					};
					break;

				// @OneToMany
				case 'Bass:OneToMany' :
					if (typeof metadata.relations === 'undefined') {

						metadata.relations = {'one-to-many': {}};

					} else if (typeof metadata.relations['one-to-many'] === 'undefined') {

						metadata.relations['one-to-many'] = {};

					}
					metadata.relations['one-to-many'][annotation.target] = {
						field: annotation.target,
						document: annotation.document,
						sort: annotation.sort,
						direction: annotation.direction
					};
					break;

				// @EmbedOne
				case 'Bass:EmbedOne' :
					if (typeof metadata.embeds === 'undefined') {

						metadata.embeds = {'one': {}};

					} else if (typeof metadata.embeds.one === 'undefined') {

						metadata.embeds.one = {};

					}
					metadata.embeds['one'][annotation.target] = {
						targetDocument: annotation.targetDocument
					};
					break;

				// @EmbedMany
				case 'Bass:EmbedMany' :
					if (typeof metadata.embeds === 'undefined') {

						metadata.embeds = {'many': {}};

					} else if (typeof metadata.embeds.many === 'undefined') {

						metadata.embeds.many = {};

					}
					metadata.embeds['many'][annotation.target] = {
						targetDocument: annotation.targetDocument
					};
					break;
			}
		}

		// loop though again for indexes so that we already have field information
		// @todo - figure out a more efficient way to do this
		for (i in annotations){

			// @Index
			if (annotation.annotation === 'Bass:Index'){

				var name = annotation.name !== null ? annotation.name : 'idx_' + annotation.target;

				metadata.addSingleIndex(annotation.target, name, {
					isUnique: annotation.unique,
					isSparse: annotation.sparse
				});
			}
		}
	}
};

module.exports = MetadataBuilder;