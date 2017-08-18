/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// local libs
const EventDispatcher = require('./dispatcher');

/**
 * The MetadataRegistry holds on to all of the metadata
 * for the documents registered with a Manager and provides
 * methods to retrieve them.
 *
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
module.exports = class MetadataRegistry {

    constructor() {
        // set defaults
        this.metas = {};
        this.protoIdsToMeta = {};
        this.eventDispatcher = new EventDispatcher();
    };

    /**
     * Register metadata for a document
     *
     * @param  {Object} metadata
     * @return {void}
     */
    registerMetadata(metadata) {
        this.metas[metadata.name] = metadata;
        this.protoIdsToMeta[metadata.proto.prototype._BASS_PROTOTYPE_ID] = metadata;
    }

    /**
     * Get the Metadata for a document instance
     *
     * @param  {Object} document
     * @return {Metadata}
     * @throws Error
     */
    getMetadataForDocument(document) {

        const protoId = Object.getPrototypeOf(document)._BASS_PROTOTYPE_ID;

        if (typeof this.protoIdsToMeta[protoId] === 'undefined') {
            throw new Error('document is not registered');
        }

        return this.protoIdsToMeta[protoId];
    }

    /**
     * Get the Metadata for a given document name
     *
     * @param {String} name
     * @returns {Metadata}
     * @throws Error
     */
    getMetadataByName(name) {

        if (typeof this.metas[name] === 'undefined') {
            throw new Error('document: ' + name + ' not found!');
        }

        return this.metas[name];
    }

    /**
     * Register an event listener
     *
     * @param  {String} event
     * @param  {Object} obj
     * @param  {String} method
     * @param  {Number} priority
     * @return {void}
     */
    registerEventListener(event, obj, method, priority) {
        this.eventDispatcher.addListener(event, obj, method, priority);
    }

    /**
     * Register a document event listener
     *
     * @param  {String} name
     * @param  {String} event
     * @param  {Object} obj
     * @param  {String} method
     * @param  {Number} priority
     * @return {void}
     */
    registerDocumentEventListener(name, event, obj, method, priority) {
        this.eventDispatcher.addDocumentListener(name, event, obj, method, priority);
    }

    /**
     * Handle metadata inheritance
     *
     * @return {void}
     */
    handleInheritance() {

        const inheritMetadata = (function(metadata) {

            if (metadata.inherited) {
                return;
            }

            let i,
                inherit ,
                inherited = false ,
                len = metadata.inherits.length;

            for (i = 0; i < len; i++) {

                inherit = this.getMetadataByName(metadata.inherits[i]);

                if (inherit) {

                    // RECURSION
                    inheritMetadata(inherit);

                    metadata.mergeMetadata(inherit);
                    inherited = true;
                }
            }

            metadata.inherited = inherited;

        }).bind(this);

        let name;
        for (name in this.metas) {

            inheritMetadata(this.metas[name]);

        }
    }
}
