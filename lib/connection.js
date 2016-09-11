/*
 * This file is part of the bass-sql library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const IdStrategy = require('./id-strategy');

module.exports = class Connection {

	constructor(connection) {

		/**
		 * The underlying connection object
		 */
		this.connection = connection;

		/**
		 * Connection options
		 */		
		this.options = null;
	}

	/**
	 *
	 * @param  {Metadata} metadataRegistry
	 * @param  {Function} cb
	 * @return {void}
	 */
	boot(metadataRegistry, cb) {
		if (cb){
			cb(null);
		}
	}

	/**
	 * Instantiate a new IdStrategy instance - this is here so adapters can overload the id strategy
	 * @param {String|*} idStrategy
	 * @returns {IdStrategy}
	 */
	createIdStrategy(idStrategy) {
		return new IdStrategy(idStrategy);
	}

	/**
	 * Generate an ID for an id-field based on a given connection strategy
	 * @returns {String|undefined}
	 */
	generateIdFieldValue() {
		if (this.options && this.options.idStrategy) {
			const strategy = this.createIdStrategy(this.options.idStrategy);
			return strategy.generate() || undefined;
		}
		return undefined;
	}

};
