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
	 * @param  {Object} data
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
	 */
	getMetadataForDocument: function(document){

		for (var i in this.metas){
			if (document instanceof this.metas[i].proto){
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
	}
};

module.exports = MetadataRegistry;