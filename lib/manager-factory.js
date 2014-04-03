/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Manager = require('./manager');

/**
 * The ManagerFactory creates a new Manager from
 * a ManagerDefinition
 * 
 * @param  {Registry} registry
 */
function ManagerFactory(registry){
	this.registry = registry;
}

ManagerFactory.prototype = {

	registry: null ,

	/**
	 * Create a new Manager from a manager definition
	 * 
	 * @param  {String}   name
	 * @param  {Function} cb
	 * @return {void}
	 */
	factory: function(name, cb){
		var definition = this.registry.getManagerDefinition(name);
		return new Manager(definition);
	}
};

ManagerFactory.prototype.constructor = ManagerFactory;

module.exports = ManagerFactory;