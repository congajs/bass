/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// native modules
const fs = require('fs');
const path = require('path');

// third-party modules
const _ = require('lodash');
const annotations = require('conga-annotations');
const async = require('async');

// local modules
const EventDispatcher = require('./dispatcher');
const ManagerDefinition = require('./manager-definition');
const Mapper = require('./mapper');
const MetadataBuilder = require('./mapping/metadata-builder');
const MetadataRegistry = require('./metadata-registry');
const Registry = require('./registry');
const Connection = require('./connection');

// default event listeners
const CreatedAtListener = require('./listener/created-at');
const UpdatedAtListener = require('./listener/updated-at');
const VersionListener = require('./listener/version');
const DiscriminatorListener = require('./listener/discriminator');

/**
 * The Compiler compiles all the Metadata information
 * for models and registers them to the Bass Registry
 * 
 * @author Marc Roulias <marc@lampjunkie.com>
 */
module.exports = class Compiler {

	constructor(config) {

		this.config = config;
		this.registry = new Registry();
		this.metadataRegistry = new MetadataRegistry();

		/**
		 * The built-in annotation paths
		 * 
		 * @type {Array}
		 */
		this.annotationPaths = [
			path.join(__dirname, 'mapping', 'annotation', 'created-at'),
			path.join(__dirname, 'mapping', 'annotation', 'discriminator') ,
			path.join(__dirname, 'mapping', 'annotation', 'document'),
			path.join(__dirname, 'mapping', 'annotation', 'document-listener'),
			path.join(__dirname, 'mapping', 'annotation', 'embed-one'),
			path.join(__dirname, 'mapping', 'annotation', 'embed-many'),
			path.join(__dirname, 'mapping', 'annotation', 'embedded-document'),
			path.join(__dirname, 'mapping', 'annotation', 'field'),
			path.join(__dirname, 'mapping', 'annotation', 'id'),
			path.join(__dirname, 'mapping', 'annotation', 'index'),
			path.join(__dirname, 'mapping', 'annotation', 'one-to-many'),
			path.join(__dirname, 'mapping', 'annotation', 'one-to-one'),
			path.join(__dirname, 'mapping', 'annotation', 'updated-at'),
			path.join(__dirname, 'mapping', 'annotation', 'version'),
			path.join(__dirname, 'mapping', 'annotation', 'inherit'),
			path.join(__dirname, 'mapping', 'annotation', 'read-only'),
			path.join(__dirname, 'mapping', 'annotation', 'post-persist'),
			path.join(__dirname, 'mapping', 'annotation', 'pre-persist'),
			path.join(__dirname, 'mapping', 'annotation', 'pre-update'),				
		];

		this.documentPathMap = {};
	}

	/**
	 * Compile
	 * @param  {Function} cb
	 * @return {void}
	 */
	compile(cb) {

		const self = this;

		this.validateDocumentPaths(function(err) {

			if (err) {
				return cb(err);
			}

			self.buildDocumentPathMap();

			self.registerAdapters();

			self.initializeConnections(function(err) {
				self.registerManagerDefinitions(function(err) {
					cb(err, self.registry);
				});
			});
		});
	}

	/**
	 * Validate that there are new duplicate document paths defined between the managers
	 * 
	 * @param  {Function} cb
	 * @return {void}
	 */
	validateDocumentPaths(cb) {

		const lookups = [];

		for (let i in this.config.managers) {
			let manager = this.config.managers[i];
			Object.keys(manager.documents).forEach(function(key) {

					lookups.push(manager.documents[key]);

			});
		}

		const duplicates = _.uniq(_.filter(lookups, function (value, index, iteratee) {
			return _.includes(iteratee, value, index + 1);
		}));

		if (duplicates.length > 0) {
			cb(new Error("The follow duplicate paths were found in bass manager configurations: " + duplicates.join(',')))
		} else {
			cb(null);
		}
	}

	/**
	 * Build the document path map for all of the managers
	 * 
	 * @return {void}
	 */
	buildDocumentPathMap() {

		// build full map based on directory based paths
		for (let managerName in this.config.managers) {

			this.documentPathMap[managerName] = [];

			// add all files from all directory paths
			for (let namespace in this.config.managers[managerName].documents) {
				let path = this.config.managers[managerName].documents[namespace];

				// check if this is a directory
				if (fs.lstatSync(path).isDirectory()) {
					this.documentPathMap[managerName] = this.documentPathMap[managerName].concat(this.findDocumentsInPath(path));
				}
			}
		}

		// remove duplicate file paths from map
		for (let managerName in this.config.managers) {

			// add all files from all directory paths
			for (let namespace in this.config.managers[managerName].documents) {
				let path = this.config.managers[managerName].documents[namespace];

				// check if this is a file
				if (!fs.lstatSync(path).isDirectory()) {
					
					// remove path from any other managers
					for (let i in this.documentPathMap) {
						let index = this.documentPathMap[i].indexOf(path);
						if (index > -1) {
							delete this.documentPathMap[i][index];
						}
					}
					this.documentPathMap[managerName].push(path);
				}
			}
		}
	}

	registerManagerDefinitions(cb) {

		const registry = this.registry;
		const metadataRegistry = this.metadataRegistry;

		let managerName;

		for (managerName in this.config.managers) {

			let config = this.config.managers[managerName];
			let definition = new ManagerDefinition();

			definition.managerName = managerName;
			definition.registry = registry;
			definition.adapter = registry.getAdapter(config.adapter);
			definition.connection = registry.getConnection(config.connection);
			definition.documents = config.documents;
			definition.metadataRegistry = metadataRegistry; //new MetadataRegistry();
			definition.mapper = new Mapper(definition.metadataRegistry, new definition.adapter.mapper(definition.metadataRegistry));

			// the (string) driver being used
			definition.driver = this.config.connections[managerName].driver || null;

			// register the slave connections on the definition (NOTE: order of defined managers does matter)
			if (Array.isArray(config.slaves)) {
				config.slaves.forEach(function(slave) {
					let connection = registry.getConnection(slave);
					if (connection) {
						definition.slaveConnections[slave] = connection;
					} else {
						console.error('Slave connection, "' + slave + '", not found in registry');
					}
				});
			}

			definition.logger = null;
			if (this.config.logging) {
				if (this.config.logging.logger) {

					const logger = this.config.logging.logger;

					if (typeof logger.info !== 'function' ||
						typeof logger.error !== 'function' ||
						typeof logger.debug !== 'function') {

						cb(new Error('Logger class must contain methods: info, error, debug'));
						return;
					}

					definition.logger = logger;
				}
			}

			this.compileDefinition(definition);

			this.registerEventListenersOnDefinition(config, definition);

			definition.connection.boot(definition.metadataRegistry, function(err){

			});

			registry.registerManagerDefinition(managerName, definition);
		}

		cb(null);
	}

	/**
	 * Register all of the built-in event listeners as well
	 * as document listeners defined in all the currently
	 * registered document objects.
	 * 
	 * @param  {Object}     config
	 * @param  {Definition} definition
	 * @return {void}
	 */
	registerEventListenersOnDefinition(config, definition) {

		definition.metadataRegistry.eventDispatcher = new EventDispatcher();

		const discriminator = new DiscriminatorListener();
		const versionListener = new VersionListener();

		definition.metadataRegistry.registerEventListener('preHydrate', discriminator, 'onPreHydrate', 99998);
		definition.metadataRegistry.registerEventListener('createDocument', discriminator, 'onCreateDocument', 99998);

		definition.metadataRegistry.registerEventListener('prePersist', versionListener, 'onPrePersist', 1);
		definition.metadataRegistry.registerEventListener('preUpdate', versionListener, 'onPreUpdate', 1);
		definition.metadataRegistry.registerEventListener('prePersist', new CreatedAtListener(), 'onPrePersist', 2);
		definition.metadataRegistry.registerEventListener('preUpdate', new UpdatedAtListener(), 'onPreUpdate', 2);
	
		if (typeof config.listeners !== 'undefined') {

			config.listeners.forEach(function(listener) {

				for (let event in listener.events) {

					definition.logger.debug('[bass] - register listener: ' + listener.name + ':' + event);

					definition.metadataRegistry.registerDocumentEventListener(
						listener.name, 
						event, 
						listener.listener, 
						listener.events[event],
						1
					);
				}
			});
		}
	}

	/**
	 * Compile a Definition based on the current adapter's configuration
	 * 
	 * @param  {Definition} definition
	 * @return {void}
	 */
	compileDefinition(definition) {

		// get all of the document paths that belong to manager definition
		const documents = this.findAllDocumentPathsForDefinition(definition);

		// get all of the annotation paths that belong to definition's adapter
		const annotationPaths = this.findAllAnnotationPathsForAdapter(definition.adapter);

		// create the annotation registry for models
		const annotationRegistry = new annotations.Registry();

		// register annotations from config
		annotationPaths.forEach(function(annotationPath){
			annotationRegistry.registerAnnotation(annotationPath);
		});

		// create the annotation reader
		const reader = new annotations.Reader(annotationRegistry);

		const metadataBuilder = new MetadataBuilder();

		// parse out annotations for each model
		documents.forEach(function(document) {

			definition.logger.debug('[bass] - parsing annotations for: ' + document.filePath);

			reader.parse(document.filePath);

			let metadata = metadataBuilder.build({
				managerName: definition.managerName,
				filePath: document.filePath,
				namespace: document.namespace,
				definitions: reader.definitionAnnotations,
				properties: reader.propertyAnnotations,
				methods: reader.methodAnnotations
			});

			definition.metadataRegistry.registerMetadata(metadata);
		});

		definition.metadataRegistry.handleInheritance();
	}

	/**
	 * Find the full paths for annotations within an adapter
	 * and combine them with the native annotation paths.
	 * 
	 * @param  {Object} adapter
	 * @return {Object}
	 */
	findAllAnnotationPathsForAdapter(adapter) {

		let adapterAnnotations = [];

		if (typeof adapter.annotations !== 'undefined'){
			adapterAnnotations = adapter.annotations;
		}

		return this.annotationPaths.concat(adapterAnnotations);
	}

	/**
	 * Find all of the model files in the current configuration paths
	 * and return an array of hashes
	 *
	 * Return format:
	 *
	 *   [
	 *     { filePath: '/full/path/to/file.js', namespace: 'model-namespace'},
	 *     ...
	 *   ]
	 * @return {[type]}
	 */
	 findAllDocumentPathsForDefinition(definition) {

		const paths = [];

		this.documentPathMap[definition.managerName].forEach(function(file) {
			paths.push({
				filePath: file,
				namespace: file
			});
		});

		return paths;
	}

	/**
	 * Get an array of absolute file paths to all models
	 * in a given directory path
	 * 
	 * @param  {String} modelPath
	 * @return {Array}
	 */
	findDocumentsInPath(modelPath) {

		const paths = [];
		const files = fs.readdirSync(modelPath);
		const ext = 'js';

		files.forEach(function(file) {
			const filePath = path.join(modelPath, file);
			const stat = fs.lstatSync(filePath);
			if (stat) {
				if (stat.isFile() && filePath.substr(-1*(ext.length+1)) == '.' + ext) {

					paths.push(filePath);

				} else if (stat.isDirectory()) {

					// RECURSION
					paths = paths.concat(this.findDocumentsInPath(filePath));
				}
			}
		}, this);

		return paths;
	}

	/**
	 * Register the adapters from the config
	 * 
	 * @return {void}
	 */
	registerAdapters() {

		const registry = this.registry;

		this.config.adapters.forEach(function(adapter) {
			registry.registerAdapter(require(path.join(adapter, 'lib', 'adapter')));
		});
	}

	/**
	 * Initialize connections from the config
	 * 
	 * @param  {Function} done
	 * @return {void}
	 */
	initializeConnections(done) {

		const that = this;
		const registry = this.registry;
		const connections = this.config.connections;
		const calls = [];
		const logger = this.config.logging.logger;

		for (let i in connections) {

			const connection = connections[i];

			(function(i, connection) {
				calls.push(
					function(callback) {

						const options = connection.options || {};

                        if (typeof connection['auto-connect'] === 'undefined' || connection['auto-connect']) {

                            registry.getAdapter(connection.adapter).connectionFactory.factory(connection, logger, function (err, conn) {
								
								if (err) {
									console.log(err);
									callback(err);
								} else {
									conn.options = options;
	                                registry.registerConnection(i, conn);
	                                callback(null);									
								}


                            });

                        } else {

                            // The client does not want a default connection - this implies that a new connection
                            // will be created. The dummy registration meets the needs of conga bass manager
                            // definition.
							const conn = new Connection(null);
							conn.options = options;

							registry.registerConnection(i, conn);

                            callback(null);
                        }
					}
				);
			}(i, connection));
		}

		// initialize the connections!
		async.series(calls, function(err, connections) {
			done(err);
		});
	}
};
