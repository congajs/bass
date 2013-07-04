/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * The DocumentCache keeps track of all documents that
 * have been loaded in a Session.
 * 
 * @param  {Registry} registry
 */
var DocumentCache = function(registry){
	this.registry = registry;
	this.documents = {};
};

DocumentCache.prototype = {

	/**
	 * Add a document to the cache
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	addDocument: function(document){
		var metadata = this.registry.getMetadataForDocument(document);
		var name = metadata.name;
		var id = document[metadata.getIdPropertyName()];

		if (typeof this.documents[name] === 'undefined'){
			this.documents[name] = {};
		}

		this.documents[name][id] = document;
	},

	/**
	 * Remove a document from the cache
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	removeDocument: function(document){
		var metadata = this.registry.getMetadataForDocument(document);
		var name = metadata.name;
		var id = document[metadata.getIdField().name];

		if (!this.hasDocument(name, id)){
			return;
		}

		delete this.documents[name][id];
	},

	/**
	 * Get a document by type and id
	 * 
	 * @param  {String} type
	 * @param  {Mixed} id
	 * @return {Object}
	 */
	getDocument: function(type, id){
		
		if (typeof this.documents[type] === 'undefined'){
			return null;
		}

		if (typeof this.documents[type][id] === 'undefined'){
			return null;
		}

		return this.documents[type][id];
	},

	/**
	 * Check if the cache has a document
	 * 
	 * @param  {String} type
	 * @param  {Mixed} id
	 * @return {Boolean}
	 */
	hasDocument: function(type, id){

		if (typeof this.documents[type] !== 'undefined'){
			if (typeof this.documents[type][id] !== 'undefined'){
				return true;
			}
		}

		return false;
	},

	/**
	 * Clear the cache
	 * 
	 * @return {void}
	 */
	clear: function(){
		this.documents = {};
	}

};

module.exports = DocumentCache;