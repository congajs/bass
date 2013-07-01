/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var ManagerFactory = require('./manager-factory');

/**
 * The Session creates a new Manager instance with a unique
 * UnitOfWork so that database operations are isolated to
 * a unique request, etc.
 *
 * @author  Marc Roulias <marc@lampjunkie.com>
 * 
 * @param  {Registry} registry
 */
var Session = function(registry){
	this.registry = registry;
	this.managerFactory = new ManagerFactory(registry);
	this.managers = {};
};

Session.prototype = {

	/**
	 * Get a manager by it's name
	 * 
	 * @param  {String} name
	 * @return {Object}
	 */
	getManager: function(name)
	{
		if (typeof this.managers[name] === 'undefined'){
			this.managers[name] = this.managerFactory.factory(name);
		}
		return this.managers[name];
	}
};

module.exports = Session;