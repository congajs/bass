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
var ManagerDefinition = function(){};

ManagerDefinition.prototype = {

	adapter: null,
	connection: null,
	metadataRegistry: null,

	boot: function(cb){
		this.connection.boot(this.metadataRegistry, function(err){
			cb(err);
		});
	}
};

module.exports = ManagerDefinition;