/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var EventDispatcher = require('./dispatcher');
var MetadataBuilder = require('./mapping/metadata-builder');

/**
 * The Registry holds on to all the metadata for Documents,
 * manager definitions, adapters, and connections
 *
 * @author Marc Roulias <marc@lampjunkie.com>
 */
function Registry() {
	this.managerDefinitions = {};
	this.connections = {};
	this.adapters = {};
}

Registry.prototype = {

	/**
	 * Collection of manager definitions that have been registered
	 * @type {Object}
	 */
	managerDefinitions: null ,

	/**
	 * Collection of connections that have been registered
	 * @type {Object}
	 */
	connections: null ,

	/**
	 * Collection of adapters that have been registered
	 * @type {Object}
	 */
	adapters: null ,

	/**
	 * Register a ManagerDefinition
	 * 
	 * @param  {String}            name
	 * @param  {ManagerDefinition} managerDefinition
	 * @return {void}
	 */
	registerManagerDefinition: function(name, managerDefinition){
		this.managerDefinitions[name] = managerDefinition;
	},

	/**
	 * Get a ManagerDefinition by name
	 * 
	 * @param  {String} name
	 * @return {ManagerDefinition}
	 */
	getManagerDefinition: function(name){
		return this.managerDefinitions[name];
	},

	/**
	 * Register a connection
	 * 
	 * @param  {String} name
	 * @param  {Object} connection
	 * @return {void}
	 */
	registerConnection: function(name, connection){
		this.connections[name] = connection;
	},

	/**
	 * Get an connection by name
	 * 
	 * @param  {String} name
	 * @return {Object}
	 */
	getConnection: function(name){
		if (typeof this.connections[name] === 'undefined'){
			throw new Error('connection: ' + name + ' isn\'t registered!');
		}
		return this.connections[name];
	},

	/**
	 * Register an Adapter
	 * 
	 * @param  {Adapter} adapter
	 * @return {void}
	 */
	registerAdapter: function(adapter){
		this.adapters[adapter.name] = adapter;
	},

	/**
	 * Get an adapter by name
	 * 
	 * @param  {String} name
	 * @return {Object}
	 */
	getAdapter: function(name){
		if (typeof this.adapters[name] === 'undefined'){
			throw new Error('adapter: ' + name + ' isn\'t registered!');
		}
		return this.adapters[name];
	}
};

Registry.prototype.constructor = Registry;

module.exports = Registry;