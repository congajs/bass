/*
 * This file is part of the bass.js library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third party modules
const _ = require('lodash');

/**
 * When a document has a discriminator, the document needs to be evaluated based
 * on the defined discriminator field, and swapped with the matching values
 * in the discriminator map. This is done on "preHydrate" and "createDocument".
 *
 * The DiscriminatorListener listens for the necessary events to map the document
 *
 * @constructor
 */
module.exports = class DiscriminatorListener {

	/**
	 * Executed when a discriminator-document is hydrated
	 *
	 * @param {Object} event The event object
	 * @param {Function} cb The callback
	 */
	onPreHydrate(event, cb) {

		// only continue if we have the necessary data
		if (event.data instanceof Object &&
			event.registry instanceof Object &&
			event.metadata instanceof Object &&
			event.metadata.discriminator instanceof Object &&
			event.metadata.discriminator.field &&
			Array.isArray(event.metadata.discriminator.mapped) &&
			typeof event.data[event.metadata.discriminator.field] !== 'undefined' &&
			typeof event.metadata.discriminator.mapped[event.data[event.metadata.discriminator.field]] === 'function') {

			// overwrite the document class with the mapped class (@see bass/lib/mapping/annotation/discriminator.js)
			const document = new event.metadata.discriminator.mapped[ event.data[event.metadata.discriminator.field] ];

			// merge the metadata when applicable
			if (document !== event.document &&
				document instanceof event.document.constructor &&
				document.constructor.name !== event.document.constructor.name) {

				const documentMeta = event.registry.getMetadataForDocument(document);
				if (documentMeta && documentMeta !== event.metadata) {

					documentMeta.mergeMetadata(event.metadata);
					event.metadata = documentMeta;
				}
			}

			// assign the new document reference
			event.document = document;
		}

		// execute the callback
		cb();
	}

	/**
	 * Executed when a new discriminator-document is created (before associations are mapped)
	 *
	 * @param {Object} event The event object
	 * @param {Function} cb The callback
	 */
	onCreateDocument(event, cb) {

		this.onPreHydrate(event, cb);
	}
}
