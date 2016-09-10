/*
 * This file is part of the bass-sql library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var IdStrategy = require('./id-strategy');

function Connection(connection) {
	this.connection = connection;
}

Connection.prototype = {

	/**
	 * The underlying connection object
	 */
	connection: null ,

	/**
	 * Connection options
	 */
	options: null ,

	/**
	 *
	 * @param  {Metadata} metadataRegistry
	 * @param  {Function} cb
	 * @return {void}
	 */
	boot: function(metadataRegistry, cb){
		if (cb){
			cb(null);
		}
	} ,

	/**
	 * Instantiate a new IdStrategy instance - this is here so adapters can overload the id strategy
	 * @param {String|*} idStrategy
	 * @returns {IdStrategy}
	 */
	createIdStrategy: function(idStrategy) {
		return new IdStrategy(idStrategy);
	} ,

	/**
	 * Generate an ID for an id-field based on a given connection strategy
	 * @returns {String|undefined}
	 */
	generateIdFieldValue: function() {
		if (this.options && this.options.idStrategy) {
			var strategy = this.createIdStrategy(this.options.idStrategy);
			return strategy.generate() || undefined;
		}
		return undefined;
	}

};

module.exports = Connection;