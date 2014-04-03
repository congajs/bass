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
 * @type {Object}
 */
function ManagerDefinition() { }

ManagerDefinition.prototype = {

	adapter: null,
	connection: null,
	registry: null,
	metadataRegistry: null,

	/**
	 * The driver used for this definition
	 *
	 * @type {String}
	 */
	driver: null,

	boot: function(cb){
		this.connection.boot(this.metadataRegistry, function(err){
			cb(err);
		});
	}
};

ManagerDefinition.prototype.constructor = ManagerDefinition;

module.exports = ManagerDefinition;