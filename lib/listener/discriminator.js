/*
 * This file is part of the bass.js library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

function DiscriminatorListener() { }

DiscriminatorListener.prototype = {

	onPreHydrate: function(event, cb){

		if (typeof event.data !== 'undefined' &&
			event.data instanceof Object &&
			typeof event.metadata !== 'undefined' &&
			event.metadata.discriminator instanceof Object &&
			event.metadata.discriminator.field &&
			typeof event.data[event.metadata.discriminator.field] !== 'undefined' &&
			Array.isArray(event.metadata.discriminator.mapped) &&
			typeof event.metadata.discriminator.mapped[event.data[event.metadata.discriminator.field]] === 'function') {

			// overwrite the document class with the mapped class (@see bass/lib/mapping/annotation/discriminator.js)
			event.document = new event.metadata.discriminator.mapped[ event.data[event.metadata.discriminator.field] ];
		}

		cb();
	} ,

	onCreateDocument: function(event, cb) {

		this.onPreHydrate(event, cb);
	}
};

DiscriminatorListener.prototype.constructor = DiscriminatorListener;

module.exports = DiscriminatorListener;