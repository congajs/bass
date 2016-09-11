/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const Manager = require('./manager');

/**
 * The ManagerFactory creates a new Manager from
 * a ManagerDefinition
 * 
 * @param  {Registry} registry
 */
module.exports = class ManagerFactory {

	constructor(registry) {
		this.registry = registry;
	}

	/**
	 * Create a new Manager from a manager definition
	 * 
	 * @param  {String}   name
	 * @param  {Function} cb
	 * @return {void}
	 */
	factory(name, cb) {
		const definition = this.registry.getManagerDefinition(name);
		return new Manager(definition);
	}
}