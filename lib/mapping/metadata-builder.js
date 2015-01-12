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

function MetadataBuilder() {
	this.postAnnotations = [];
}

MetadataBuilder.prototype = {

	/**
	 * Annotations to handle after all other annotations are done
	 *
	 * @type {Array<{Annotation}>}
	 */
	postAnnotations: [] ,

	/**
	 * Build the metadata
	 *
	 * @param {Object} data
	 * @returns {Metadata}
	 */
	build: function(data){

		var metadata = new Metadata();

		metadata.filePath = data.filePath;
		metadata.namespace = data.namespace;
		metadata.proto = require(data.filePath);
        
        //anotation properties
        var annotations_props = data.properties.concat(data.method)

		this.handleConstructorAnnotations(metadata, data.constructor);
		this.handlePropertyAnnotations(metadata, annotations_props);

		// handle annotations that need to be loaded after all other annotations are loaded
		this.handlePostAnnotations(metadata);

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

			if (annotation.postAnnotation) {
				if (this.postAnnotations.indexOf(annotation) === -1) {
					this.postAnnotations.push(annotation);
				}
				continue;
			}

			// TODO : I think the business logic for each annotation belongs in its own class, not here ( annotation.process(metadata) ? )
			switch (annotation.annotation) {

				// @Document
				case 'Bass:Document' :
					metadata.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
					metadata.collection = annotation.collection;
					metadata.repository = annotation.repository !== null ? path.join(path.dirname(metadata.filePath), annotation.repository) : null;
					metadata.repositoryClass = annotation.repositoryClass;
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

				// @Inherit
				case 'Bass:Inherit' :
					metadata.inherits.push(annotation.document);
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

			if (annotation.postAnnotation) {
				if (this.postAnnotations.indexOf(annotation) === -1) {
					this.postAnnotations.push(annotation);
				}
				continue;
			}

			// TODO : I think the business logic for each annotation belongs in its own class, not here ( annotation.process(metadata) ? )
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

                case 'Bass:AltData':
                    metadata.addAltData(annotation.name, metadata.proto.prototype[annotation.target]);

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
					if (typeof metadata.relations['one-to-one'] === 'undefined') {

						metadata.relations['one-to-one'] = {};

					}
					metadata.relations['one-to-one'][annotation.target] = {
						field: annotation.target,
						document: annotation.document
					};
					break;

				// @OneToMany
				case 'Bass:OneToMany' :
					if (typeof metadata.relations['one-to-many'] === 'undefined') {

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
					if (typeof metadata.embeds.one === 'undefined') {

						metadata.embeds['one'] = {};

					}
					metadata.embeds['one'][annotation.target] = {
						targetDocument: annotation.targetDocument
					};
					break;

				// @EmbedMany
				case 'Bass:EmbedMany' :
					if (typeof metadata.embeds.many === 'undefined') {

						metadata.embeds['many'] = {};

					}
					metadata.embeds['many'][annotation.target] = {
						targetDocument: annotation.targetDocument
					};
					break;
			}
		}
	} ,

	/**
	 * Handle annotations that need to run last
	 * @param {Metadata} metadata
	 * @returns {void}
	 * @protected
	 */
	handlePostAnnotations: function(metadata) {

		for (var i in this.postAnnotations){

			var annotation = this.postAnnotations[i];

			// TODO : I think the business logic for each annotation belongs in its own class, not here ( annotation.process(metadata) ? )
			switch (annotation.annotation) {

				// @Index
				case 'Bass:Index' :
					var name = annotation.name !== null ? annotation.name : 'idx_' + annotation.target;
					metadata.addSingleIndex(annotation.target, name, {
						isUnique: annotation.unique,
						isSparse: annotation.sparse
					});
					break;

				// @Discriminator
				case 'Bass:Discriminator' :
					metadata.discriminator = annotation;
					break;
			}
		}

		this.postAnnotations = [];
	}
};

MetadataBuilder.prototype.constructor = MetadataBuilder;

module.exports = MetadataBuilder;
