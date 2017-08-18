/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const ManagerFactory = require('./manager-factory');

/**
 * The Session creates a new Manager instance with a unique
 * UnitOfWork so that database operations are isolated to
 * a unique request, etc.
 *
 * @author  Marc Roulias <marc@lampjunkie.com>
 *
 * @param  {Registry} registry
 */
module.exports = class Session {

	constructor(registry) {
		this.registry = registry;
		this.managerFactory = new ManagerFactory(registry);
		this.managers = {};
	}

	/**
	 * Get a manager by it's name
	 *
	 * @param  {String} name
	 * @return {Object}
	 */
	getManager(name) {
		if (typeof this.managers[name] === 'undefined') {
			this.managers[name] = this.managerFactory.factory(name, this);
		}
		return this.managers[name];
	}

	/**
	 * The the manager for a model name
	 *
	 * @param  {String} type
	 * @return {Manager}
	 */
	getManagerForModelName(name) {
		return this.getManager(this.registry.modelNameToManagerNameMap[name]);
	}

	getManagerForModelPrototypeId(id) {
		return this.getManager(this.registry.prototypIdToManagerNameMap[id]);
	}

	/**
	 * Close the session
	 *
	 * @return {void}
	 */
	close() {
		this.managers = null;
	}
}
