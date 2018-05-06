/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const EventDispatcher = require('./dispatcher');
const MetadataBuilder = require('./mapping/metadata-builder');

/**
 * The Registry holds on to all the metadata for Documents,
 * manager definitions, adapters, and connections
 *
 * @author Marc Roulias <marc@lampjunkie.com>
 */
module.exports = class Registry {

    constructor() {

        /**
         * Collection of manager definitions that have been registered
         * @type {Object}
         */
        this.managerDefinitions = {};

        /**
         * Collection of connections that have been registered
         * @type {Object}
         */
        this.connections = {};

        /**
         * Collection of adapters that have been registered
         * @type {Object}
         */
        this.adapters = {};

        /**
         * A map of all model names to their associated manager names
         * @type {Object}
         */
        this.modelNameToManagerNameMap = {};

        /**
         * A map of all prototype id's to their associated manager names
         * @type {Object}
         */
        this.prototypIdToManagerNameMap = {};
    }

    /**
     * Register a ManagerDefinition
     *
     * @param  {String}            name
     * @param  {ManagerDefinition} definition
     * @return {void}
     */
    registerManagerDefinition(name, definition) {
        this.managerDefinitions[name] = definition;

        for (const metaName in definition.metadataRegistry.metas) {
            const meta = definition.metadataRegistry.metas[metaName];
            this.modelNameToManagerNameMap[metaName] = meta.managerName;
            this.prototypIdToManagerNameMap[meta.proto.prototype._BASS_PROTOTYPE_ID] = meta.managerName;
        }
    }

    /**
     * Get a ManagerDefinition by name
     *
     * @param  {String} name
     * @return {ManagerDefinition}
     */
    getManagerDefinition(name) {
        if (!(name in this.managerDefinitions)) {
            throw new Error('bass manager "' + name + '" is not registered!');
        }
        return this.managerDefinitions[name];
    }

    /**
     * Register a connection
     *
     * @param  {String} name
     * @param  {Object} connection
     * @return {void}
     */
    registerConnection(name, connection) {
        this.connections[name] = connection;
    }

    /**
     * Get an connection by name
     *
     * @param  {String} name
     * @return {Object}
     */
    getConnection(name) {
        if (!(name in this.connections)){
            throw new Error('connection: ' + name + ' is not registered!');
        }
        return this.connections[name];
    }

    /**
     * Register an Adapter
     *
     * @param  {Adapter} adapter
     * @return {void}
     */
    registerAdapter(adapter) {
        this.adapters[adapter.name] = adapter;
    }

    /**
     * Get an adapter by name
     *
     * @param  {String} name
     * @return {Object}
     */
    getAdapter(name) {
        if (!(name in this.adapters)){
            throw new Error('adapter: ' + name + ' is not registered!');
        }
        return this.adapters[name];
    }
}
