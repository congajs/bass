/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// native modules
const crypto = require('crypto');
const path = require('path');

// local modules
const Field = require('./field');
const Metadata = require('./metadata');

module.exports = class MetadataBuilder {

	constructor() {

		/**
		 * Annotations to handle after all other annotations are done
		 *
		 * @type {Array<{Annotation}>}
		 */
		this.postAnnotations = [];
	}

	/**
	 * Build the metadata
	 *
	 * @param {Object} data
	 * @returns {Metadata}
	 */
	build(data) {

		const metadata = new Metadata();

		metadata.filePath = data.filePath;
		metadata.namespace = data.namespace;
		metadata.proto = require(data.filePath);

		// create and store unique id on prototype
		const protoId = crypto.createHash('md5').update(data.filePath).digest("hex");
		metadata.proto.prototype._BASS_PROTOTYPE_ID = protoId;

		this.handleDefinitionAnnotations(metadata, data.definitions);
		this.handlePropertyAnnotations(metadata, data.properties);
		this.handleMethodAnnotations(metadata, data.methods);

		// handle annotations that need to be loaded after all other annotations are loaded
		this.handlePostAnnotations(metadata);

		// initialize the metadata cache
		metadata.init();

		return metadata;
	}

	/**
	 * Handle all of the constructor annotations on a model and apply
	 * settings to the Metadata
	 * 
	 * @param {Metadata} metadata
	 * @param {Array} annotations
	 * @returns {void}
	 */
	handleDefinitionAnnotations(metadata, annotations) {

		let i;
		let annotation;

		for (i in annotations){
			
			annotation = annotations[i];

			if (annotation.postAnnotation) {
				if (this.postAnnotations.indexOf(annotation) === -1) {
					this.postAnnotations.push(annotation);
				}
				continue;
			}

			// TODO : I think the business logic for each annotation belongs in its own class, not here ( annotation.process(metadata) ? )
			switch (annotation.constructor.name) {

				// @Bass:Document
				case 'DocumentAnnotation' :
					metadata.name = annotation.name || annotation.target;
					metadata.collection = annotation.collection;
					metadata.repository = annotation.repository !== null ? path.join(path.dirname(metadata.filePath), annotation.repository) : null;
					metadata.repositoryClass = annotation.repositoryClass;
					break;

				// @Bass:EmbeddedDocument
				case 'EmbeddedDocumentAnnotation' :
					metadata.name = typeof annotation.name !== 'undefined' ? annotation.name : annotation.target;
					metadata.isEmbedded = true;
					break;

				// @Bass:DocumentListener
				case 'DocumentListenerAnnotation' :
					metadata.listeners.push(annotation.listener);
					break;

				// @Bass:Inherit
				case 'InheritAnnotation' :
					metadata.inherits.push(annotation.document);
					break;
			}
		}
	}

	/**
	 * Handle all of the property annotations on a model and apply
	 * settings to the Metadata
	 * 
	 * @param {Metadata} metadata
	 * @param {Array} annotations
	 * @returns {void}
	 */
	handlePropertyAnnotations(metadata, annotations) {

		let i;
		let annotation;

		for (i in annotations){
			
			annotation = annotations[i];

			if (annotation.postAnnotation) {
				if (this.postAnnotations.indexOf(annotation) === -1) {
					this.postAnnotations.push(annotation);
				}
				continue;
			}

			// TODO : I think the business logic for each annotation belongs in its own class, not here ( annotation.process(metadata) ? )
			switch (annotation.constructor.name) {

				// @Bass:Id
				case 'IdAnnotation' :
					metadata.idField = annotation.target;
					metadata.idStrategy = annotation.strategy;
					break;

				// @Bass:Field
				case 'FieldAnnotation' :
					var field = new Field();
					field.table = annotation.table;
					field.name = annotation.name !== null ? annotation.name : annotation.target;
					field.type = annotation.type !== null ? annotation.type.toLowerCase() : 'string';
					field.property = annotation.target;
					field.default = metadata.proto.prototype[annotation.target];

					metadata.addField(field);
					break;

				// @Bass:Version
				case 'VersionAnnotation' :
					metadata.versionProperty = annotation.target;
					break;

				// @Bass:CreatedAt
				case 'CreatedAtAnnotation' :
					metadata.createdAtProperty = annotation.target;
					break;

				// @Bass:UpdatedAt
				case 'UpdatedAtAnnotation' :
					metadata.updatedAtProperty = annotation.target;
					break;

				// @Bass:OneToOne
				case 'OneToOneAnnotation' :
					if (typeof metadata.relations['one-to-one'] === 'undefined') {

						metadata.relations['one-to-one'] = {};

					}
					metadata.relations['one-to-one'][annotation.target] = {
						field: annotation.target,
						document: annotation.document,
						column: annotation.name
					};
					break;

				// @Bass:OneToMany
				case 'OneToManyAnnotation' :
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

				// @Bass:EmbedOne
				case 'EmbedOneAnnotation' :
					if (typeof metadata.embeds.one === 'undefined') {

						metadata.embeds['one'] = {};

					}
					metadata.embeds['one'][annotation.target] = {
						document: annotation.document,
						field: annotation.target
					};
					break;

				// @Bass:EmbedMany
				case 'EmbedManyAnnotation' :
					if (typeof metadata.embeds.many === 'undefined') {

						metadata.embeds['many'] = {};

					}
					metadata.embeds['many'][annotation.target] = {
						document: annotation.document,
						field: annotation.target
					};
					break;

				// @Bass:ReadOnly
				case 'ReadOnlyAnnotation' :
					metadata.readOnly[annotation.target] = true;
					break;
			}
		}
	}

	/**
	 * Handle all of the method annotations on a model and apply
	 * settings to the Metadata
	 * 
	 * @param {Metadata} metadata
	 * @param {Array} annotations
	 * @returns {void}
	 */
	handleMethodAnnotations(metadata, annotations) {

		let i;
		let annotation;

		for (i in annotations){
			
			annotation = annotations[i];

			if (annotation.postAnnotation) {
				if (this.methodAnnotations.indexOf(annotation) === -1) {
					this.methodAnnotations.push(annotation);
				}
				continue;
			}

			// TODO : I think the business logic for each annotation belongs in its own class, not here ( annotation.process(metadata) ? )
			switch (annotation.constructor.name) {

				// @Bass:PrePersist
				case 'PrePersistAnnotation' :

					metadata.events['prePersist'].push({
						method: annotation.target
					});
					break;

				// @Bass:PostPersist
				case 'PostPersistAnnotation' :

					metadata.events['postPersist'].push({
						method: annotation.target
					});
					break;

				// @Bass:PreUpdate
				case 'PreUpdateAnnotation' :

					metadata.events['preUpdate'].push({
						method: annotation.target
					});
					break;

			}
		}
	}

	/**
	 * Handle annotations that need to run last
	 * @param {Metadata} metadata
	 * @returns {void}
	 * @protected
	 */
	handlePostAnnotations(metadata) {

		let i;
		let annotation;

		for (i in this.postAnnotations){

			annotation = this.postAnnotations[i];

			// TODO : I think the business logic for each annotation belongs in its own class, not here ( annotation.process(metadata) ? )
			switch (annotation.constructor.name) {

				// @Index
				case 'IndexAnnotation' :
					let name = annotation.name !== null ? annotation.name : 'idx_' + annotation.target;
					metadata.addSingleIndex(annotation.target, name, {
						isUnique: annotation.unique,
						isSparse: annotation.sparse
					});
					break;

				// @Discriminator
				case 'DiscriminatorAnnotation' :
					metadata.discriminator = annotation;
					break;
			}
		}

		this.postAnnotations = [];
	}
}
