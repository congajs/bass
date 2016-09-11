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
module.exports = class DocumentCache {

	constructor(registry) {
		this.registry = registry;
		this.documents = {};
	}

	/**
	 * Add a document to the cache
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	addDocument(document) {

		const metadata = this.registry.getMetadataForDocument(document);
		const name = metadata.name;
		const id = document[metadata.getIdPropertyName()];

		if (typeof this.documents[name] === 'undefined') {
			this.documents[name] = {};
		}

		this.documents[name][id] = document;
	}

	/**
	 * Update documents from cache by criteria
	 * @param {Object} criteria
	 * @param {Object} data
	 * @return {void}
	 */
	updateDocumentsByCriteria(criteria, data) {

		let id ,
			name ,
			property ,
			found ,
			i ,
			len ,
			m ,
			update;

		for (name in this.documents) {

			update = [];

			for (id in this.documents[name]) {

				found = true;

				for (property in criteria) {

					if (typeof this.documents[name][id][property] === 'undefined' ||
						this.documents[name][id][property] === criteria[property]) {

						found = false;
						break;
					}
				}

				if (found) {
					update.push(id);
				}
			}

			len = update.length;
			for (i = 0; i < len; i++) {

				for (m in data) {
					this.documents[name][update[i]][m] = data[m];
				}

			}
		}
	}

	/**
	 * Remove a document from the cache
	 * 
	 * @param  {Object} document
	 * @return {void}
	 */
	removeDocument(document) {

		const metadata = this.registry.getMetadataForDocument(document);
		const name = metadata.name;
		const id = document[metadata.getIdField().name];

		if (!this.hasDocument(name, id)) {
			return;
		}

		delete this.documents[name][id];
	}

	/**
	 * Remove documents from cache by criteria
	 * @param {Object} criteria
	 * @return {void}
	 */
	removeDocumentsByCriteria(criteria) {

		let id ,
			name ,
			property ,
			found ,
			i ,
			len ,
			remove;

		for (name in this.documents) {

			remove = [];

			for (id in this.documents[name]) {

				found = true;

				for (property in criteria) {

					if (typeof this.documents[name][id][property] === 'undefined' ||
						this.documents[name][id][property] === criteria[property]) {

						found = false;
						break;
					}
				}

				if (found) {
					remove.push(id);
				}
			}

			len = remove.length;
			for (i = 0; i < len; i++) {

				delete this.documents[name][remove[i]];

			}
		}
	}

	/**
	 * Get a document by type and id
	 * 
	 * @param  {String} type
	 * @param  {*} id
	 * @return {Object}
	 */
	getDocument(type, id) {
		
		if (typeof this.documents[type] === 'undefined') {
			return null;
		}

		if (typeof this.documents[type][id] === 'undefined') {
			return null;
		}

		return this.documents[type][id];
	}

	/**
	 * Check if the cache has a document
	 * 
	 * @param  {String} type
	 * @param  {*} id
	 * @return {Boolean}
	 */
	hasDocument(type, id) {

		if (typeof this.documents[type] !== 'undefined') {
			if (typeof this.documents[type][id] !== 'undefined') {
				return true;
			}
		}

		return false;
	}

	/**
	 * Clear the cache
	 * 
	 * @return {void}
	 */
	clear() {
		this.documents = {};
	}

}