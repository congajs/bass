/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * The MetadataRegistry holds on to all of the metadata
 * for the documents registered with a Manager and provides
 * methods to retrieve them.
 *
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
var MetadataRegistry = function(){
	// set defaults
	this.metas = {};
};

MetadataRegistry.prototype = {

	/**
	 * Register metadata for a document
	 * 
	 * @param  {Object} metadata
	 * @return {void}
	 */
	registerMetadata: function(metadata){
		this.metas[metadata.name] = metadata;
	},

	/**
	 * Get the Metadata for a document instance
	 * 
	 * @param  {Object} document
	 * @return {Metadata}
	 * @throws Error
	 */
	getMetadataForDocument: function(document){

		for (var i in this.metas){
			if ((document instanceof this.metas[i].proto &&
				document.constructor.name === this.metas[i].proto.prototype.constructor.name) ||

				(document.constructor.name !== 'Object' &&
				 document.constructor.name !== 'Function' &&
				 document.constructor.name === this.metas[i].proto.prototype.constructor.name)) {

				return this.metas[i];
			}
		}
		
		throw new Error('document is not registered');
	},

	/**
	 * Get the Metadata for a given document name
	 * 
	 * @param {String} name
	 * @returns {Metadata}
	 * @throws Error
	 */
	getMetadataByName: function(name){

		for (var i in this.metas){
			if (this.metas[i].name == name){

				return this.metas[i];
			}
		}

		throw new Error('document: ' + name + ' not found!');
	},
	
	/**
	 * Register an event listener
	 * 
	 * @param  {String} event
	 * @param  {Object} obj
	 * @param  {String} method
	 * @param  {Number} priority
	 * @return {void}
	 */
	registerEventListener: function(event, obj, method, priority){
		this.eventDispatcher.addListener(event, obj, method, priority);
	},

	/**
	 * Register a document event listener
	 * 
	 * @param  {String} name
	 * @param  {String} event
	 * @param  {Object} obj
	 * @param  {String} method
	 * @param  {Number} priority
	 * @return {void}
	 */
	registerDocumentEventListener: function(name, event, obj, method, priority){
		this.eventDispatcher.addDocumentListener(name, event, obj, method, priority);
	},

	/**
	 * Handle metadata inheritance
	 *
	 * @return {void}
	 */
	handleInheritance: function() {

		var inheritMetadata = (function(metadata) {

			if (metadata.inherited) {
				return;
			}

			var i,
				inherit ,
				inherited = false ,
				len = metadata.inherits.length;

			for (i = 0; i < len; i++) {

				inherit = this.getMetadataByName(metadata.inherits[i]);

				if (inherit) {

					// RECURSION
					inheritMetadata(inherit);

					metadata.mergeMetadata(inherit);
					inherited = true;
				}
			}

			metadata.inherited = inherited;

		}).bind(this);

		var name;
		for (name in this.metas) {

			inheritMetadata(this.metas[name]);

		}
	}
};

module.exports = MetadataRegistry;
