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

			// @Document
			if (annotation.annotation === 'Bass:Document'){
				metadata.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
				metadata.collection = annotation.collection;
				metadata.repository = annotation.repository !== null ? path.join(path.dirname(metadata.filePath), annotation.repository) : null;
			}

			// @EmbeddedDocument
			if (annotation.annotation === 'Bass:EmbeddedDocument'){
				metadata.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
				metadata.isEmbedded = true;
			}

			// @DocumentListener
			if (annotation.annotation === 'Bass:DocumentListener'){
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
			if (annotation.annotation === 'Bass:Id'){
				metadata.idField = annotation.target;
			}

			// @Field
			if (annotation.annotation === 'Bass:Field'){

				var field = new Field();
				
				field.name = annotation.name !== null ? annotation.name : annotation.target;
				field.type = annotation.type !== null ? annotation.type.toLowerCase() : 'string';
				field.property = annotation.target;
				field.default = metadata.proto.prototype[annotation.target];
				
				metadata.addField(field);
			}

			// @Version
			if (annotation.annotation === 'Bass:Version'){
				metadata.versionProperty = annotation.target;
			}

			// @CreatedAt
			if (annotation.annotation === 'Bass:CreatedAt'){
				metadata.createdAtProperty = annotation.target;
			}

			// @UpdatedAt
			if (annotation.annotation === 'Bass:UpdatedAt'){
				metadata.updatedAtProperty = annotation.target;
			}

			// @OneToOne
			if (annotation.annotation === 'Bass:OneToOne'){

				if (typeof metadata.relations === 'undefined'){
					metadata.relations['one-to-one'] = {};
				}

				metadata.relations['one-to-one'][annotation.target] = {
					field: annotation.target,
					document: annotation.document
				}
			}

			// @OneToMany
			if (annotation.annotation === 'Bass:OneToMany'){

				if (typeof metadata.relations === 'undefined'){
					metadata.relations['one-to-many'] = {};
				}

				metadata.relations['one-to-many'][annotation.target] = {
					field: annotation.target,
					document: annotation.document
				}
			}

			// @EmbedOne
			if (annotation.annotation === 'Bass:EmbedOne'){
				metadata.embeds['one'][annotation.target] = {
					targetDocument: annotation.targetDocument
				}
			}

			// @EmbedMany
			if (annotation.annotation === 'Bass:EmbedMany'){
				metadata.embeds['many'][annotation.target] = {
					targetDocument: annotation.targetDocument
				}
			}
		}

		// loop though again for indexes so that we already have field information
		// @todo - figure out a more efficient way to do this
		for (var i in annotations){

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