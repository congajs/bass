/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * The ManagerDefinition holds all the information
 * that is needed to create a new Manager for a Session
 *
 * @constructor
 */
module.exports = class ManagerDefinition {

	constructor() {

		this.managerName = null;
		this.adapter = null;
		this.connection = null;
		this.registry = null;
		this.metadataRegistry = null;
		this.documents = null;
		this.mapper = null;
		this.logger = null;

		/**
		 * The driver used for this definition
		 *
		 * @type {String}
		 */
		this.driver = null;

		/**
		 * Hold on to slave connections for master definitions
		 * @type {Object|null}
		 */
		this.slaveConnections = {};
	}

	boot(cb) {
		this.connection.boot(this.metadataRegistry, function(err) {
			cb(err);
		});
	}
}
