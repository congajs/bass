/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third-party modules

// local modules
const Compiler = require('./compiler');
const Session = require('./session');

/**
 * The Bass class is the main class which controls
 * the lifecycle of bass.js and provides methods to
 * create new sessions and access connections.
 * 
 * @author Marc Roulias <marc@lampjunkie.com>
 *
 * @param {Object} config
 */
module.exports = class Bass {

	/**
	 * Create new Bass instance with config options
	 * 
	 * @param  {Object} config
	 * @return {void}
	 */
	constructor(config) {
		this.config = config;
	}

	/**
	 * Initialize bass with the current configuration object
	 * and return a Promise
	 *
	 * @param {Compiler} [compiler]
	 * @return {Promise}
	 */
	init(compiler = null) {

		if (!(compiler instanceof Compiler)) {
			compiler = new Compiler(this.config);
		} else if (compiler.config !== this.config) {
			compiler.config = Object.assign({}, this.config, compiler.config);
		}

		return new Promise((resolve, reject) => {

			compiler.compile((err, registry) => {
				if (err === null) {
					this.registry = registry;
					resolve();
				} else {
					reject(new Error(err));
				}
			});

		});
	}

	/**
	 * Create a new Session object and return it
	 *
	 * @return {Session}
	 */
	createSession() {
		return new Session(this.registry);
	}

	/**
	 * Get a connection by name
	 * 
	 * @param  {String} name
	 * @return {Object}
	 */
	getConnection(name) {
		return this.registry.getConnection(name);
	}

	/**
	 * Close all connections and shutdown bass.js
	 * 
	 * @return {Promise}
	 */
	shutdown() {

		// TODO : finish?  bass-mongodb adapter connection does not have a close and deferred here never resolves
		const registry = this.registry;

		return new Promise(function(resolve, reject) {
			for (let i in registry.connections) {
				registry.connections[i].close();
			}

			resolve();
		});

	}
}
