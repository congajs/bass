/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// native modules
var crypto = require('crypto');

// third-party modules
var _ = require('lodash');
var async = require('async');

/**
 * The UnitOfWork manages all database operations that need
 * to be performed
 *
 * @param  {Registry}      registry
 * @param  {Mapper}        mapper
 * @param  {Client}        client
 * @param  {DocumentCache} documentCache
 */
function UnitOfWork(registry, mapper, client, documentCache){
	this.registry = registry;
	this.mapper = mapper;
	this.client = client;
	this.documentCache = documentCache;
	this.clear();
}

// processing type flags
UnitOfWork.PROCESSING_TYPE_INSERT = 'INSERT';
UnitOfWork.PROCESSING_TYPE_UPDATE = 'UPDATE';
UnitOfWork.PROCESSING_TYPE_REMOVE = 'REMOVE';

UnitOfWork.prototype = {

	/**
	 * Object hash of persisted documents (objectId => document, objectId is generated in this class)
	 *
	 * @type {Object}
	 */
	documents: {} ,

	/**
	 * Hash of object ids that are in our documents hash but scheduled for removal
	 *
	 * @type {Object}
	 */
	removals: {} ,

	/**
	 * Persist a Document object
	 *
	 * This method will determine if the Document should be
	 * scheduled for an insert or update
	 *
	 * @param  {Object} document
	 * @return {void}
	 */
	persist: function(document){

		if (!document) {
			return;
		}

		var i, objectId;

		// get or create the unique objectId for persistence
		if (!document.__objectId) {

			objectId = this.generateObjectId();
			document.__objectId = objectId;

		} else {

			objectId = document.__objectId;
		}

		if (typeof document.__processing === 'undefined') {
			document.__processing = null;
		}

		if (typeof document.__processed === 'undefined') {
			document.__processed = [];
		}

		// register the document for flush
		this.documents[objectId] = document;

		var metadata = this.registry.getMetadataForDocument(document);
		var idField = metadata.getIdField();

		if (document.__isNew ||
			typeof document[idField.property] === 'undefined' ||
			document[idField.property] === null) {

			// mark that this document is new and needs to be inserted
			document.__isNew = true;

			// one-to-one
			for (i in metadata.relations['one-to-one']) {
				if (typeof document[i] !== 'undefined' && document[i]) {
					this.persist(document[i]);
				}
			}

			// one-to-many
			for (i in metadata.relations['one-to-many']) {
				if (_.isArray(document[metadata.relations['one-to-many'][i].field])){
					document[i].forEach(function(oneToManyDoc){
						if (oneToManyDoc) {
							this.persist(oneToManyDoc);
						}
					}, this);
				}
			}

		} else {

			// we are not inserting this document
			document.__isNew = false;
		}
	},

	/**
	 * See if a document is persisted
	 * @param {Object} document
	 * @returns {Boolean}
	 */
	isDocumentPersisted: function(document) {
		return (document.__objectId && this.documents[document.__objectId]);
	} ,

	/**
	 * Schedule an insert (alias to persist)
	 *
	 * @param  {Object} document
	 * @return {void}
	 * @throws Error
	 */
	scheduleInsert: function(document) {
		if (document.__isNew !== undefined && !document.__isNew) {
			throw new Error('Document cannot be inserted');
		}
		this.persist(document);
	} ,

	/**
	 * Schedule an update (alias to persist)
	 *
	 * @param  {Object} document
	 * @return {void}
	 */
	scheduleUpdate: function(document) {
		if (document.__isNew) {
			throw new Error('Document cannot be updated');
		}
		this.persist(document);
	} ,

	/**
	 * Schedule a removal (you must call this if you want to remove a document)
	 *
	 * @param  {Object} document
	 * @return {void}
	 * @throws Error
	 */
	scheduleRemoval: function(document) {
		if (!this.isDocumentPersisted(document)) {

			// make sure the document is persisted
			this.persist(document);

		}
		if (document.__isNew) {

			// fail
			throw new Error('Unable to remove document');

		} else if (!this.removals[document.__objectId]) {

			// schedule removal
			this.removals[document.__objectId] = true;
		}
	} ,

	/**
	 * Flush the unit of work - or a single document
	 *
	 * This method will flush all persisted documents by running either insert, update, or removal respectively on each document
	 *
	 * Optional document - if provided as the first argument, only it is flushed, if not provided all are flushed
	 *
	 * @param  {Function} cb Callback to execute
	 * @return {void}
	 */
	flush: function(cb){

		var objectId ,
			self = this ,
			documents = {} ,
			inserts = [] ,
			updates = [] ,
			removals = [];

		if (arguments.length === 2 &&
			arguments[0] instanceof Object &&
			typeof arguments[1] === 'function') {

			if (this.isDocumentPersisted(arguments[0])) {

				// flush a single document
				documents[arguments[0].__objectId] = arguments[0];

				// clear the document, it is flushed (flushing)
				this.documents[arguments[0].__objectId] = null;

			}
		} else {

			// copy documents for local scope
			documents = this.documents;

			// clear documents, they are flushed (flushing)
			this.documents = {};

		}

		// flush each document
		for (objectId in documents) {

			// the saved document was nullified or removed
			if (!documents[objectId]) {
				continue;
			}

			if (this.removals[objectId]) {

				// control flow for parallel operations
				if (documents[objectId].__processing === UnitOfWork.PROCESSING_TYPE_REMOVE ||
					documents[objectId].__processed.indexOf(UnitOfWork.PROCESSING_TYPE_REMOVE) !== -1) {

					continue;
				}

				// mark that we are processing this document (before the closure)
				documents[objectId].__processing = UnitOfWork.PROCESSING_TYPE_REMOVE;

				// create a closure for the document
				(function(document) {
					removals.push(function(callback) {
						self.runRemoval(document, function() {

							delete self.removals[objectId];

							callback();

						});
					});
				}(documents[objectId]));

			} else if (documents[objectId].__isNew) {

				// control flow for parallel operations
				if (documents[objectId].__processing === UnitOfWork.PROCESSING_TYPE_INSERT ||
					documents[objectId].__processed.indexOf(UnitOfWork.PROCESSING_TYPE_INSERT) !== -1) {

					continue;
				}

				// mark that we are processing this document (before the closure)
				documents[objectId].__processing = UnitOfWork.PROCESSING_TYPE_INSERT;

				// create a closure for the document
				(function(document) {
					inserts.push(function(callback) {
						self.runInsert(document, function() {

							callback();

						});
					});
				}(documents[objectId]));

			} else {

				// control flow for parallel operations
				if (documents[objectId].__processing === UnitOfWork.PROCESSING_TYPE_UPDATE ||
					documents[objectId].__processed.indexOf(UnitOfWork.PROCESSING_TYPE_UPDATE) !== -1) {

					continue;
				}

				// mark that we are processing this document (before the closure)
				documents[objectId].__processing = UnitOfWork.PROCESSING_TYPE_UPDATE;

				// create a closure for the document
				(function(document) {
					updates.push(function(callback) {
						self.runUpdate(document, function() {

							callback();

						});
					});
				}(documents[objectId]));
			}
		}

		// run inserts, updates, then removals, in that order, in series
		async.series(inserts, function() {
			async.series(updates, function() {
				async.series(removals, function() {
					// execute our callback, we are done
					cb(null);
				});
			});
		});
	},

	/**
	 * Run an insert operation on a document
	 * @param {Object|*} document The document to run the insert on
	 * @param {Function} cb The callback to execute when finished
	 */
	runInsert: function(document, cb) {

		// save references in local scope (in case they get replaced on the object during the operation)
		var registry = this.registry;
		var mapper = this.mapper;
		var client = this.client;
		var documentCache = this.documentCache;

		// grab the meta data
		var metadata = registry.getMetadataForDocument(document);

		registry.eventDispatcher.dispatch('prePersist', {

			document: document,
			metadata: metadata

		}, function() {

			// convert entity to a simple object for persistence
			mapper.mapModelToData(metadata, document, function(data) {

				// persist it
				client.insert(metadata, metadata.collection, data, function(err, data) {

					document[metadata.getIdField().property] = mapper.adapterMapper.convertDbToJavascript(
						metadata.getIdField().type,
						data[metadata.getIdFieldName()]
					);

					// we are done processing this document
					document.__isNew = false;
					document.__processing = null;
					document.__processed.push(UnitOfWork.PROCESSING_TYPE_INSERT);

					// save the document in our cache
					documentCache.addDocument(document);

					if (err) {

						registry.eventDispatcher.dispatch('errorInsert', {

							err: err ,
							document: document ,
							metadata: metadata

						}, function() {

							cb();

						});

					} else {

						cb();

					}
				});
			});
		});
	} ,

	/**
	 * Run an update operation on a document
	 * @param {Object|*} document The document to run the update on
	 * @param {Function} cb The callback to execute when finished
	 */
	runUpdate: function(document, cb) {

		// save references in local scope (in case they get replaced on the object during the operation)
		var registry = this.registry;
		var mapper = this.mapper;
		var client = this.client;

		// grab the meta data
		var metadata = registry.getMetadataForDocument(document);

		registry.eventDispatcher.dispatch('prePersist', {

			document: document,
			metadata: metadata

		}, function() {

			// convert entity to a simple object for persistence
			mapper.mapModelToData(metadata, document, function(data) {

				// persist it
				client.update(metadata, metadata.collection, data[metadata.getIdFieldName()], data, function(err, data) {

					// we are done processing this document
					document.__processing = null;
					document.__processed.push(UnitOfWork.PROCESSING_TYPE_UPDATE);

					if (err) {

						registry.eventDispatcher.dispatch('errorUpdate', {

							err: err ,
							document: document ,
							metadata: metadata

						}, function() {

							cb();

						});

					} else {

						cb();

					}
				});
			});
		});
	} ,

	/**
	 * Run a removal operation on a document
	 * @param {Object|*} document The document to run the removal on
	 * @param {Function} cb The callback to execute when finished
	 */
	runRemoval: function(document, cb) {

		// save references in local scope (in case they get replaced on the object during the operation)
		var registry = this.registry;
		var mapper = this.mapper;
		var client = this.client;
		var documentCache = this.documentCache;

		// grab the meta data
		var metadata = registry.getMetadataForDocument(document);

		// convert entity to a simple object for persistence
		mapper.mapModelToData(metadata, document, function(data) {

			// persist it
			client.remove(metadata, metadata.collection, data[metadata.getIdFieldName()], function(err){

				// mark that we are done processing this document
				document.__processing = null;
				document.__processed.push(UnitOfWork.PROCESSING_TYPE_REMOVE);

				// remove the document from cache
				documentCache.removeDocument(document);

				if (err) {

					registry.eventDispatcher.dispatch('errorRemoval', {

						err: err ,
						document: document ,
						metadata: metadata

					}, function() {

						cb();

					});

				} else {

					cb();

				}
			});
		});
	} ,

	/**
	 * Clear ALL scheduled modifications
	 *
	 * @param {Object|undefined|*} document Optional document to clear, if not provided, everything is cleared
	 * @return {void}
	 */
	clear: function(document) {
		if (document instanceof Object &&
			document.__objectId) {

			if (this.documents[document.__objectId]) {
				document.__processing = null;
				document.__processed = [];
				this.documents[document.__objectId] = null;
			}

			if (this.removals[document.__objectId]) {
				delete this.removals[document.__objectId];
			}

		} else {

			var m;

			for (m in this.documents) {
				this.documents[m].__processing = null;
				this.documents[m].__processed = [];
			}

			this.documents = {};
			this.removals = {};

		}
	},

	/**
	 * Generate a unique internal id for a document object
	 *
	 * @return {String}
	 */
	generateObjectId: function() {
		var current_date = (new Date()).valueOf().toString();
		var random = Math.random().toString();
		return crypto.createHash('sha1').update(current_date + random).digest('hex');
	}
};

UnitOfWork.prototype.constructor = UnitOfWork;

module.exports = UnitOfWork;