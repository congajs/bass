/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// native modules
var fs = require('fs');
var path = require('path');

// third-party modules
var annotations = require('conga-annotations');
var async = require('async');

// local modules
var EventDispatcher = require('./dispatcher');
var ManagerDefinition = require('./manager-definition');
var Mapper = require('./mapper');
var MetadataBuilder = require('./mapping/metadata-builder');
var MetadataRegistry = require('./metadata-registry');
var Registry = require('./registry');
var Connection = require('./connection');

// default event listeners
var CreatedAtListener = require('./listener/created-at');
var UpdatedAtListener = require('./listener/updated-at');
var VersionListener = require('./listener/version');
var DiscriminatorListener = require('./listener/discriminator');

/**
 * The Compiler compiles all the Metadata information
 * for models and registers them to the Bass Registry
 * 
 * @author Marc Roulias <marc@lampjunkie.com>
 */
function Compiler(config) {
	this.config = config;
	this.registry = new Registry();
}

Compiler.prototype = {

	/**
	 * The built-in annotation paths
	 * 
	 * @type {Array}
	 */
	annotationPaths: [
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
		path.join(__dirname, 'mapping', 'annotation', 'read-only')
	],

	/**
	 * Compile
	 * @param  {Function} cb
	 * @return {void}
	 */
	compile: function(cb){

		var that = this;

		this.registerAdapters();

		this.initializeConnections(function(err){

			that.registerManagerDefinitions(function(err){
				cb(err, that.registry);
			});

		});
	},

	registerManagerDefinitions: function(cb) {
		var registry = this.registry;

		var managerName;
		for (managerName in this.config.managers) {

			var config = this.config.managers[managerName];
			var definition = new ManagerDefinition();

			definition.managerName = managerName;
			definition.registry = registry;
			definition.adapter = registry.getAdapter(config.adapter);
			definition.connection = registry.getConnection(config.connection);
			definition.documents = config.documents;
			definition.metadataRegistry = new MetadataRegistry();
			definition.mapper = new Mapper(definition.metadataRegistry, new definition.adapter.mapper(definition.metadataRegistry));

			// the (string) driver being used
			definition.driver = this.config.connections[managerName].driver || null;

			// register the slave connections on the definition (NOTE: order of defined managers does matter)
			if (Array.isArray(config.slaves)) {
				config.slaves.forEach(function(slave) {
					var connection = registry.getConnection(slave);
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

					var logger = this.config.logging.logger;

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
	},

	/**
	 * Register all of the built-in event listeners as well
	 * as document listeners defined in all the currently
	 * registered document objects.
	 * 
	 * @param  {Object}     config
	 * @param  {Definition} definition
	 * @return {void}
	 */
	registerEventListenersOnDefinition: function(config, definition){

		definition.metadataRegistry.eventDispatcher = new EventDispatcher();

		var discriminator = new DiscriminatorListener();
		definition.metadataRegistry.registerEventListener('preHydrate', discriminator, 'onPreHydrate', 99998);
		definition.metadataRegistry.registerEventListener('createDocument', discriminator, 'onCreateDocument', 99998);

		definition.metadataRegistry.registerEventListener('prePersist', new VersionListener(), 'onPrePersist', 1);
		definition.metadataRegistry.registerEventListener('prePersist', new CreatedAtListener(), 'onPrePersist', 2);
		definition.metadataRegistry.registerEventListener('prePersist', new UpdatedAtListener(), 'onPrePersist', 2);
	
		if (typeof config.listeners !== 'undefined'){

			config.listeners.forEach(function(listener){

				for (var event in listener.events){

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
	},

	/**
	 * Compile a Definition based on the current adapter's configuration
	 * 
	 * @param  {Definition} definition
	 * @return {void}
	 */
	compileDefinition: function(definition){

		// get all of the document paths that belong to manager definition
		var documents = this.findAllDocumentPathsForDefinition(definition);

		// get all of the annotation paths that belong to definition's adapter
		var annotationPaths = this.findAllAnnotationPathsForAdapter(definition.adapter);

		// create the annotation registry for models
		var annotationRegistry = new annotations.Registry();

		// register annotations from config
		annotationPaths.forEach(function(annotationPath){
			annotationRegistry.registerAnnotation(annotationPath);
		});

		// create the annotation reader
		var reader = new annotations.Reader(annotationRegistry);

		var metadataBuilder = new MetadataBuilder();

		// parse out annotations for each model
		documents.forEach(function(document){

			reader.parse(document.filePath);

			var metadata = metadataBuilder.build({
				filePath: document.filePath,
				namespace: document.namespace,
				constructor: reader.getConstructorAnnotations(),
				properties: reader.getPropertyAnnotations(),
				method: reader.getMethodAnnotations()
			});

			definition.metadataRegistry.registerMetadata(metadata);
		});

		definition.metadataRegistry.handleInheritance();
	},

	/**
	 * Find the full paths for annotations within an adapter
	 * and combine them with the native annotation paths.
	 * 
	 * @param  {Object} adapter
	 * @return {Object}
	 */
	findAllAnnotationPathsForAdapter: function(adapter){

		var adapterAnnotations = [];

		if (typeof adapter.annotations !== 'undefined'){
			adapterAnnotations = adapter.annotations;
		}

		return this.annotationPaths.concat(adapterAnnotations);
	},

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
	 findAllDocumentPathsForDefinition: function(definition){

		var paths = [];

		for (var namespace in definition.documents){

			var files = this.findDocumentsInPath(definition.documents[namespace]);
			files.forEach(function(file){
				paths.push({
					filePath: file,
					namespace: namespace
				})
			});
		}

		return paths;
	},

	/**
	 * Get an array of absolute file paths to all models
	 * in a given directory path
	 * 
	 * @param  {String} modelPath
	 * @return {Array}
	 */
	findDocumentsInPath: function(modelPath){
		var paths = [];
		var files = fs.readdirSync(modelPath);

		files.forEach(function(file){
			var filePath = path.join(modelPath, file);
			var stat = fs.lstatSync(filePath);
			if (stat) {
				if (stat.isFile()) {

					paths.push(filePath);

				} else if (stat.isDirectory()) {

					// RECURSION
					paths = paths.concat(this.findDocumentsInPath(filePath));

				}
			}
		}, this);

		return paths;
	},

	/**
	 * Register the adapters from the config
	 * 
	 * @return {void}
	 */
	registerAdapters: function(){

		var registry = this.registry;

		this.config.adapters.forEach(function(adapter){
			registry.registerAdapter(require(path.join(adapter, 'lib', 'adapter')));
		});
	},

	/**
	 * Initialize connections from the config
	 * 
	 * @param  {Function} done
	 * @return {void}
	 */
	initializeConnections: function(done){

		var that = this;
		var registry = this.registry;
		var connections = this.config.connections;
		var calls = [];

		for (var i in connections){

			var connection = connections[i];

			(function(i, connection){
				calls.push(
					function(callback){

						var options = connection.options || {};

                        if (typeof connection['auto-connect'] === 'undefined' || connection['auto-connect']) {

                            registry.getAdapter(connection.adapter).connectionFactory.factory(connection, function (err, conn) {
								conn.options = options;
                                registry.registerConnection(i, conn);
                                callback(err);
                            });

                        } else {

                            // The client does not want a default connection - this implies that a new connection
                            // will be created. The dummy registration meets the needs of conga bass manager
                            // definition.
							var conn = new Connection(null);
							conn.options = options;

							registry.registerConnection(i, conn);

                            callback(null);
                        }
					}
				);
			}(i, connection));
		}

		// initialize the connections!
		async.series(calls, function(err, connections){
			done(err);
		});
	}
};

Compiler.prototype.constructor = Compiler;

module.exports = Compiler;