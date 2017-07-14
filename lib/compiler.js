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
 * for models and registers them in the Bass Registry
 *
 * @author Marc Roulias <marc@lampjunkie.com>
 */
module.exports = class Compiler {

	/**
	 * Construct the Compiler with a config object
	 *
	 * @param  {Object} config
	 */
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

		/**
		 * The map of managers to document paths
		 *
		 * @type {Object}
		 */
		this.documentPathMap = {};
	}

	/**
	 * Compile
	 *
	 * @param  {Function} cb
	 * @return {void}
	 */
	compile(cb) {

		this.validateDocumentPaths((err) => {

			if (err) {
				return cb(err);
			}

			this.buildDocumentPathMap();
			this.registerAdapters();

			this.initializeConnections((err) => {
				this.registerManagerDefinitions((err) => {
					cb(err, this.registry);
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

			Object.keys(manager.documents).forEach((key) => {
				lookups.push(manager.documents[key]);
			});
		}

		// find duplicate paths
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

				// check if path exists
				if (!fs.existsSync(path)) {
					throw new Error("The document path: " + path + " does not exist. (defined in manager: " + managerName + ")")
				}

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

	/**
	 * Build and register all of the manager definitiions based on what
	 * was defined in the config object
	 *
	 * @param  {Function} cb
	 * @return {void}
	 */
	registerManagerDefinitions(cb) {

		const registry = this.registry;
		const metadataRegistry = this.metadataRegistry;

		let managerName;

		for (managerName in this.config.managers) {

			let config = this.config.managers[managerName];

			// make sure there is a connection defined
			if (!config.connection) {
				throw new Error("You are missing a connection name in manager: " + managerName);
			}

			// make sure there is an adapter defined
			if (!config.adapter) {
				throw new Error("You are missing an adapter name in manager: " + managerName);
			}

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
				config.slaves.forEach((slave) => {
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

						throw new Error('Logger class must contain methods: info, error, debug');
						return;
					}

					definition.logger = logger;
				}
			}

			this.compileDefinition(definition);
			this.registerEventListenersOnDefinition(config, definition);

			definition.connection.boot(definition.metadataRegistry, (err) => {

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

		const discriminator = new DiscriminatorListener();
		const versionListener = new VersionListener();

		definition.metadataRegistry.registerEventListener('preHydrate', discriminator, 'onPreHydrate', 99998);
		definition.metadataRegistry.registerEventListener('createDocument', discriminator, 'onCreateDocument', 99998);

		definition.metadataRegistry.registerEventListener('prePersist', versionListener, 'onPrePersist', 1);
		definition.metadataRegistry.registerEventListener('preUpdate', versionListener, 'onPreUpdate', 1);
		definition.metadataRegistry.registerEventListener('prePersist', new CreatedAtListener(), 'onPrePersist', 2);
		definition.metadataRegistry.registerEventListener('preUpdate', new UpdatedAtListener(), 'onPreUpdate', 2);

		if (typeof config.listeners !== 'undefined') {

			config.listeners.forEach((listener) => {

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
		annotationPaths.forEach((annotationPath) => {
			annotationRegistry.registerAnnotation(annotationPath);
		});

		// create the annotation reader
		const reader = new annotations.Reader(annotationRegistry);

		const metadataBuilder = new MetadataBuilder();

		// parse out annotations for each model
		documents.forEach((document) => {

			definition.logger.debug('[bass] - parsing annotations for: ' + document.filePath);

			reader.parse(document.filePath);

			const metadata = metadataBuilder.build({
				managerName: definition.managerName,
				filePath: document.filePath,
				namespace: document.namespace,
				definitions: reader.definitionAnnotations,
				properties: reader.propertyAnnotations,
				methods: reader.methodAnnotations
			});

			definition.metadataRegistry.registerMetadata(metadata);

			this.handleCustomAnnotationsOnDocument(reader, definition, metadata);

		});

		definition.metadataRegistry.handleInheritance();
	}

	/**
	 * Pass annotation data, etc. to any custom annotation handlers that are configured
	 *
	 * @param  {Reader}            reader      the annotation reader
	 * @param  {ManagerDefinition} definition  the manager definition
	 * @param  {Metadata}          metadata    the document metadata
	 * @return {void}
	 */
	handleCustomAnnotationsOnDocument(reader, definition, metadata) {

		if (typeof this.config.annotation !== 'undefined'
			&& typeof this.config.annotation.handlers !== 'undefined') {
			this.config.annotation.handlers.forEach((handler) => {

				if (typeof handler.handleAnnotations !== 'function') {
					throw new Error('Annotation handler: ' + definition.filePath + ' is missing a "handleAnnotations() method"');
				}

				handler.handleAnnotations.call(handler, reader, definition, metadata);
			});
		}
	}

	/**
	 * Find the full paths for annotations within an adapter
	 * and combine them with the native annotation paths and any
	 * configured custom annotations
	 *
	 * @param  {Object} adapter
	 * @return {Object}
	 */
	findAllAnnotationPathsForAdapter(adapter) {

		let adapterAnnotations = [];

		if (typeof adapter.annotations !== 'undefined'){
			adapterAnnotations = adapter.annotations;
		}

		// adding any custom annotations
		adapterAnnotations = adapterAnnotations.concat(this.getCustomAnnotationPaths());

		return this.annotationPaths.concat(adapterAnnotations);
	}

	/**
	 * Get all of the custom annotation paths that may have been defined
	 * in custom annotation handlers passed in the config
	 *
	 * @return {Array}
	 */
	getCustomAnnotationPaths() {

		let paths = [];

		if (typeof this.config.annotation !== 'undefined'
			&& typeof this.config.annotation.handlers !== 'undefined') {
			this.config.annotation.handlers.forEach((handler) => {
				paths = paths.concat(handler.getAnnotationPaths());
			});
		}

		return paths;
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
	 *
	 * @return {Array}
	 */
	 findAllDocumentPathsForDefinition(definition) {

		const paths = [];

		this.documentPathMap[definition.managerName].forEach((file) => {
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

		const files = fs.readdirSync(modelPath);
		const ext = 'js';

		let paths = [];

		files.forEach((file) => {

			const filePath = path.join(modelPath, file);
			const stat = fs.lstatSync(filePath);

			if (stat) {
				if (stat.isFile() && filePath.substr(-1 * (ext.length + 1)) === '.' + ext) {

					paths.push(filePath);

				} else if (stat.isDirectory()) {

					// RECURSION
					paths = paths.concat(this.findDocumentsInPath(filePath));
				}
			}
		});

		return paths;
	}

	/**
	 * Register the adapters from the config
	 *
	 * @return {void}
	 */
	registerAdapters() {

		const registry = this.registry;

		if (!this.config.adapters) {
			throw new Error('No bass adapters have been configured!');
		}

		this.config.adapters.forEach((adapter) => {

			try {
				registry.registerAdapter(require(path.join(adapter, 'lib', 'adapter')));
			} catch (e) {
				console.log(e);
				throw new Error('Could not find adapter module: ' + adapter + '!');
			}
		});
	}

	/**
	 * Initialize connections from the config
	 *
	 * @param  {Function} done
	 * @return {void}
	 */
	initializeConnections(done) {

		if (!this.config.logging) {
			throw new Error('Missing "logging" property in your config!');
		}


		const registry = this.registry;
		const connections = this.config.connections;
		const calls = [];
		const logger = this.config.logging.logger;

		for (let i in connections) {

			const connection = connections[i];

			if (!connection.adapter) {
				throw new Error("You are missing an adapter name for connection: '" + i + "'");
			}

			((i, connection) => {

				calls.push(
					(callback) => {

						const options = connection.options || {};

                        if (typeof connection['auto-connect'] === 'undefined' || connection['auto-connect']) {

                            registry.getAdapter(connection.adapter).connectionFactory.factory(connection, logger, (err, conn) => {

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
			})(i, connection);
		}

		// initialize the connections!
		async.series(calls, (err, connections) => {
			done(err);
		});
	}
}
