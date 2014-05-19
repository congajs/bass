/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third-party modules
var Q = require('q');

// local modules
var Compiler = require('./compiler');
var Session = require('./session');

/**
 * The Bass object is the main object which controls
 * the lifecycle of bass.js and provides methods to
 * create new sessions and access connections.
 * 
 * @author Marc Roulias <marc@lampjunkie.com>
 *
 * @param {Object} config
 */
function Bass(config) {
	this.config = config;
}

/**
 * The repository class exposed for inheritance
 */
Bass.Repository = require('./repository');

/**
 * The Query class exposed
 */
Bass.Query = require('./query');

/**
 * The QueryResult class exposed
 */
Bass.QueryResult = require('./query-result');


Bass.prototype = {

	/**
	 * Initialize bass with the current configuration object
	 * and return a Promise
	 * 
	 * @return {Promise}
	 */
	init: function(){

		var deferred = Q.defer();
		var that = this;
		var compiler = new Compiler(this.config);
		
		compiler.compile(function(err, registry){
			if (err === null){
				that.registry = registry;
				deferred.resolve();
			} else {
				console.log(err.stack);
				deferred.raise(new Error(err));
			}
		});

		return deferred.promise;
	},

	/**
	 * Create a new Session object and return it
	 *
	 * @return {Session}
	 */
	createSession: function(){
		return new Session(this.registry);
	},

	/**
	 * Get a connection by name
	 * 
	 * @param  {String} name
	 * @return {Object}
	 */
	getConnection: function(name){
		return this.registry.getConnection(name);
	},

	/**
	 * Close all connections and shutdown bass.js
	 * 
	 * @return {Promise}
	 */
	shutdown: function(){

		// TODO : finish?  bass-mongodb adapter connection does not have a close and deferred here never resolves

		var deferred = Q.defer();

		for (var i in this.registry.connections){
			this.registry.connections[i].close();
		}

		return deferred.promise;
	}
};

Bass.prototype.constructor = Bass;

module.exports = Bass;