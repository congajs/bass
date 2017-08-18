/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// native modules
const crypto = require('crypto');

// third-party modules
const _ = require('lodash');
const async = require('async');

/**
 * The UnitOfWork manages all database operations that need
 * to be performed
 *
 * @param  {MetadataRegistry} registry
 * @param  {Mapper} mapper
 * @param  {Client} client
 * @param  {DocumentCache} documentCache
 */
module.exports = class UnitOfWork {

    constructor(registry, mapper, client, documentCache) {

        this.registry = registry;
        this.mapper = mapper;
        this.client = client;
        this.documentCache = documentCache;
        this.clear();

        /**
         * Object hash of persisted documents (objectId => document, objectId is generated in this class)
         *
         * @type {Object}
         */
        this.documents = {};

        /**
         * Hash of object ids that are in our documents hash but scheduled for removal
         *
         * @type {Object}
         */
        this.removals = {};
    }

    // processing type flags
    static get PROCESSING_TYPE_INSERT() { return 'INSERT'; }
    static get PROCESSING_TYPE_UPDATE() { return 'UPDATE'; }
    static get PROCESSING_TYPE_REMOVE() { return 'REMOVE'; }

    /**
     * Persist a Document object
     *
     * This method will determine if the Document should be
     * scheduled for an insert or update
     *
     * @param  {Object} document
     * @return {void}
     */
    persist(document) {

        if (!document) {
            return;
        }

        let i, objectId, metadata;

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

        try {
            metadata = this.registry.getMetadataForDocument(document);
        } catch (e) {
            console.log(e.stack);
            throw e;
        }

        const idField = metadata.getIdField();
        const idStrategy = metadata.getIdStrategy();

        // this case handles documents that have a manual id, but are new
        if (typeof document.__isNew === 'undefined' && idStrategy === 'MANUAL') {
            document.__isNew = true;
        }

        // this case handles partial objects that haven't been fully loaded and just contain an id
        if (typeof document.__isNew === 'undefined' && idStrategy == 'AUTO' && document[metadata.getIdPropertyName()] !== null) {
            document.__isNew = false;
            document.__isReference = true;
        }

        // don't persist references
        if (!document.__isReference) {
            // register the document for flush
            this.documents[objectId] = document;
        }

        if (document.__isNew ||
            (typeof document[idField.property] === 'undefined' ||
            document[idField.property] === null
            &&
            idStrategy == 'AUTO')) {

            // mark that this document is new and needs to be inserted
            document.__isNew = true;

            // one-to-one
            for (i in metadata.relations['one-to-one']) {
                if (typeof document[i] !== 'undefined' && document[i]) {
                    //this.persist(document[i]);
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
    }

    /**
     * See if a document is persisted
     * @param {Object} document
     * @returns {Boolean}
     */
    isDocumentPersisted(document) {
        return (document.__objectId && this.documents[document.__objectId]);
    }

    /**
     * Schedule an insert (alias to persist)
     *
     * @param  {Object} document
     * @return {void}
     * @throws Error
     */
    scheduleInsert(document) {

        // make sure the document is persisted (registered with unit-of-work)
        if (!this.isDocumentPersisted(document)) {
            this.persist(document);
        }

        if (document.__isNew !== undefined && !document.__isNew) {

            // we cannot insert an existing document, and we don't want to accidentally update it when it was scheduled for insert
            this.clear(document);

            throw new Error('Document cannot be inserted');
        }

    }

    /**
     * Schedule an update (alias to persist)
     *
     * @param  {Object} document
     * @return {void}
     */
    scheduleUpdate(document) {

        // make sure the document is persisted (registered with unit-of-work)
        if (!this.isDocumentPersisted(document)) {
            this.persist(document);
        }

        if (document.__isNew) {

            // we cannot update a new document
            this.clear(document);

            throw new Error('Document cannot be updated');
        }

    }

    /**
     * Schedule a removal (you must call this if you want to remove a document)
     *
     * @param  {Object} document
     * @return {void}
     * @throws Error
     */
    scheduleRemoval(document) {

        // make sure the document is persisted (registered with unit-of-work)
        if (!this.isDocumentPersisted(document)) {
            //this.persist(document);
            document.__objectId = this.generateObjectId();
        }

        if (document.__isNew) {

            // fail
            throw new Error('Unable to remove document');

        } else if (!this.removals[document.__objectId]) {


            this.documents[document.__objectId] = document;

            // schedule removal
            this.removals[document.__objectId] = true;
        }
    }

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
    flush(cb) {

        let objectId, documents = {};

        const self = this,
              inserts = [],
              updates = [],
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

            cb = arguments[1];

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

            // control flow for parallel operations, do not continue if the document is currently being processed
            if (documents[objectId].__processing) {
                continue;
            }

            if (this.removals[objectId]) {

                // mark that we are processing this document (before the closure)
                documents[objectId].__processing = UnitOfWork.PROCESSING_TYPE_REMOVE;

                // create a closure for the document
                (function(document) {
                    removals.push(function(callback) {
                        self.runRemoval(document, function(err) {
                            delete self.removals[objectId];
                            callback(err);
                        });
                    });
                }(documents[objectId]));

            } else if (documents[objectId].__isNew) {

                // mark that we are processing this document (before the closure)
                documents[objectId].__processing = UnitOfWork.PROCESSING_TYPE_INSERT;

                // create a closure for the document
                (function(document) {
                    inserts.push(function(callback) {
                        self.runInsert(document, function(err) {

                            callback(err);

                        });
                    });
                }(documents[objectId]));

            } else {

                // mark that we are processing this document (before the closure)
                documents[objectId].__processing = UnitOfWork.PROCESSING_TYPE_UPDATE;

                // create a closure for the document
                (function(document) {
                    updates.push(function(callback) {
                        self.runUpdate(document, function(err) {

                            callback(err);

                        });
                    });
                }(documents[objectId]));
            }
        }

        // run inserts, updates, then removals, in that order, in series
        async.series(inserts, function(err) {
            if (err) {
                cb(err);
                return;
            }
            async.series(updates, function(err) {
                if (err) {
                    cb(err);
                    return;
                }
                async.series(removals, function(err) {
                    // execute our callback, we are done
                    cb(err);
                });
            });
        });
    }

    /**
     * Run an insert operation on a document
     * @param {Object|*} document The document to run the insert on
     * @param {Function} cb The callback to execute when finished
     */
    runInsert(document, cb) {

        // save references in local scope (in case they get replaced on the object during the operation)
        const registry = this.registry;
        const mapper = this.mapper;
        const client = this.client;
        const documentCache = this.documentCache;

        // grab the meta data
        const metadata = registry.getMetadataForDocument(document);

        // make sure we have set the processing state
        if (!document.__processing) {
            document.__processing = UnitOfWork.PROCESSING_TYPE_INSERT;
        }

        registry.eventDispatcher.dispatch('prePersist', {

            document: document,
            metadata: metadata

        }, function() {

            // generate an object id on the document, when applicable
            const idField = metadata.getIdField();
            const idStrategy = client.db.options.idStrategy || null;
            if (idStrategy && (document[idField.property] === undefined || document[idField.property] === null)) {
                document[idField.property] = client.db.generateIdFieldValue();
            }

            // convert entity to a simple object for persistence
            mapper.mapModelToData(metadata, document, function(data) {

                // persist it
                client.insert(metadata, metadata.collection, data, function(err, data) {

                    document[idField.property] = mapper.adapterMapper.convertDbValueToModelValue(
                        idField.type,
                        data[idField.name]
                    );

                    // we are done processing this document
                    document.__isNew = false;
                    document.__processing = null;

                    // save the document in our cache
                    documentCache.addDocument(document);

                    if (err) {

                        registry.eventDispatcher.dispatch('errorInsert', {

                            err: err ,
                            document: document ,
                            metadata: metadata

                        }, function() {

                            cb(err);

                        });

                    } else {


                        registry.eventDispatcher.dispatch('postPersist', {

                            document: document,
                            metadata: metadata

                        }, function() {


                            cb();

                        });

                    }
                });
            });
        });
    }

    /**
     * Run an update operation on a document
     * @param {Object|*} document The document to run the update on
     * @param {Function} cb The callback to execute when finished
     */
    runUpdate(document, cb) {

        // save references in local scope (in case they get replaced on the object during the operation)
        const registry = this.registry;
        const mapper = this.mapper;
        const client = this.client;

        // grab the meta data
        const metadata = registry.getMetadataForDocument(document);

        // make sure we have set the processing state
        if (!document.__processing) {
            document.__processing = UnitOfWork.PROCESSING_TYPE_UPDATE;
        }

        // get the id
        const id = document[metadata.getIdPropertyName()];

        registry.eventDispatcher.dispatch('preUpdate', {

            document: document,
            metadata: metadata

        }, function() {

            // convert entity to a simple object for persistence
            mapper.mapModelToData(metadata, document, function(mappedData) {

                const reducedData = mapper.reduceMappedData(metadata, mappedData);

                // persist it
                client.update(metadata, metadata.collection, id, reducedData, function(err, data) {

                    // we are done processing this document
                    document.__processing = null;

                    if (err) {

                        registry.eventDispatcher.dispatch('errorUpdate', {

                            err: err ,
                            document: document ,
                            metadata: metadata

                        }, function() {

                            cb(err);

                        });

                    } else {


                        registry.eventDispatcher.dispatch('postUpdate', {

                            document: document,
                            metadata: metadata

                        }, function() {

                            cb();
                        });

                    }
                });
            });
        });
    }

    /**
     * Run a removal operation on a document
     * @param {Object|*} document The document to run the removal on
     * @param {Function} cb The callback to execute when finished
     */
    runRemoval(document, cb) {

        // save references in local scope (in case they get replaced on the object during the operation)
        const registry = this.registry;
        const mapper = this.mapper;
        const client = this.client;
        const documentCache = this.documentCache;

        // grab the meta data
        const metadata = registry.getMetadataForDocument(document);

        // make sure we have set the processing state
        if (!document.__processing) {
            document.__processing = UnitOfWork.PROCESSING_TYPE_REMOVE;
        }

        // persist it
        client.remove(metadata, metadata.collection, document[metadata.getIdPropertyName()], function(err){

            // mark that we are done processing this document
            document.__processing = null;

            // remove the document from cache
            documentCache.removeDocument(document);

            if (err) {

                registry.eventDispatcher.dispatch('errorRemoval', {

                    err: err ,
                    document: document ,
                    metadata: metadata

                }, function() {

                    cb(err);

                });

            } else {
                cb();
            }
        });

    }

    /**
     * Clear ALL scheduled modifications
     *
     * @param {Object|undefined|*} document Optional document to clear, if not provided, everything is cleared
     * @return {void}
     */
    clear(document) {

        if (document instanceof Object &&
            document.__objectId) {

            if (this.documents[document.__objectId]) {
                document.__processing = null;
                this.documents[document.__objectId] = null;
            }

            if (this.removals[document.__objectId]) {
                delete this.removals[document.__objectId];
            }

        } else {

            let m;

            for (m in this.documents) {
                this.documents[m].__processing = null;
            }

            this.documents = {};
            this.removals = {};
        }
    }

    /**
     * Generate a unique internal id for a document object
     *
     * @return {String}
     */
    generateObjectId() {
        const current_date = (new Date()).valueOf().toString();
        const random = Math.random().toString();
        return crypto.createHash('sha1').update(current_date + random).digest('hex');
    }
}
