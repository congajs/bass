/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// third party modules
const _ = require('lodash');

/**
 * The metadata class keeps track of document to collection (storage) mapping
 * and other information for documents
 *
 * @constructor
 */
module.exports = class Metadata {

    constructor() {

        /**
         * The associated manager name
         *
         * @type {String}
         */
        this.managerName = null;

        /**
         * The name of the model
         *
         * @type {String}
         */
        this.name = null;

        /**
         * The file path to the model class
         *
         * @type {String}
         */
        this.filePath = null;

        /**
         * The id field name
         * @type {String}
         */
        this.idField = null;

        /**
         * The id strategy
         *
         * @type {String}
         */
        this.idStrategy = null;

        /**
         * The collection/table name
         *
         * @type {String}
         */
        this.collection = null;

        /**
         * Reference to the model's class prototype
         *
         * @type {Object}
         */
        this.proto = null;

        /**
         * Is this an embedded document in another model
         *
         * @type {Boolean}
         */
        this.isEmbedded = null;

        /**
         * Array of all of the Field objects
         *
         * @type {Array}
         */
        this.fields = [];

        /**
         * Hash of adapter specific meta data
         *
         * @type {Object}
         */
        this.adapters = {};

        /**
         * Hash of mapped relations
         *
         * @type {Object}
         */
        this.relations = {
            'one-to-one': {},
            'one-to-many': {}
        };

        /**
         * Hash of mapped embeds
         *
         * @type {Object}
         */
        this.embeds = {
            'one': {},
            'many': {}
        };

        /**
         * Array of attached listeners
         *
         * @type {Array}
         */
        this.listeners = [];

        /**
         * Collection of the different indexes
         *
         * @type {Object}
         */
        this.indexes = {
            compound: [],
            single: []
        };

        /**
         * Keep track of document names that this metadata inherits from
         *
         * @type {Array<{String}>}
         */
        this.inherits = [];

        /**
         * Hash of read only properties
         *
         * @type {Object}
         */
        this.readOnly = {};

        /**
         * Know if inheritance has been performed on this metadata already
         *
         * @type {Boolean}
         */
        this.inherited = false;

        /**
         * Collection of all registered events for this model
         *
         * @type {Object}
         */
        this.events = {
            'prePersist': [],
            'postPersist': [],
            'preUpdate': []
        };

        /**
         * Cached map of property names to field data
         *
         * @type {Object}
         */
        this.propertiesToFields = {};

        /**
         * Cached map of field names to property names
         *
         * @type {Object}
         */
        this.fieldNamesToPropertyNames = {};

        /**
         * Cached map of field names to relations
         *
         * @type {Object}
         */
        this.fieldNamesToRelations = {};

        /**
         * Cached array of all of the relation field names
         *
         * @type {Array}
         */
        this.relationFieldNames = [];

    }

    /**
     * Initialize the cache, etc.
     *
     * @return {Void}
     */
    init() {

        // this.fields.forEach(function(field){
        //     this.fieldNamesToPropertyNames[field.name] = field.property;
        // }, this);

        // build field name to relation map
        for (const i in this.relations){
            for (const j in this.relations[i]){
                this.fieldNamesToRelations[j] = this.relations[i][j];
                this.relationFieldNames.push(j);
            }
        }
        for (const i in this.embeds){
            for (const j in this.embeds[i]){
                this.fieldNamesToRelations[j] = this.embeds[i][j];
                this.relationFieldNames.push(j);
            }
        }

    }

    /**
     * Add a field
     *
     * @param {Object}
     */
    addField(field) {
        this.fields.push(field);
        this.propertiesToFields[field.property] = field;
        this.fieldNamesToPropertyNames[field.name] = field.property;
    }

    /**
     * Add a "single" index
     *
     * @param {String} property
     * @param {String} name
     * @param {Object} data
     */
    addSingleIndex(property, name, data) {
        this.indexes.single.push({
            field: this.getFieldNameByProperty(property),
            isUnique: data.isUnique,
            isSparse: data.isSparse
        });
    }

    getIndexes() {
        return this.indexes;
    }

    addCompoundIndex(properties, name, data) {

    }

    /**
     * Get the id field data
     *
     * @return {Object}
     */
    getIdField() {
        return this.propertiesToFields[this.idField];
    }

    getIdFieldName() {
        return this.getIdField().name;
    }

    getIdPropertyName() {
        return this.idField;
    }

    getIdStrategy() {
        return this.idStrategy;
    }

    getRelations() {
        return this.relations;
    }

    /**
     * Get an array of all of the relation field names
     *
     * @return {Array} [description]
     */
    getRelationFields() {
        return this.relationFieldNames;
    }

    /**
     * Get relation info for a field name
     *
     * @param  {String} name
     * @return {Object}
     */
    getRelationByFieldName(name) {
        return this.fieldNamesToRelations[name];
    }

    /**
     * Get relation info for a property name
     *
     * @param {String} property
     * @returns {Object}
     */
    getRelationByProperty(property) {
        const field = this.getFieldByProperty(property);
        if (!field) {
            return null;
        }
        return this.getRelationByFieldName(field.name);
    }

    /**
     * Get a field object by its property name
     * @param {String} property
     * @returns {Object|null}
     */
    getFieldByProperty(property) {
        if (property in this.propertiesToFields) {
            return this.propertiesToFields[property];
        }
        return null;
    }

    /**
     * Get a field's name by its document's property name
     * @param {String} property
     * @returns {String}
     */
    getFieldNameByProperty(property) {
        const field = this.getFieldByProperty(property);
        if (!field) {
            return null;
        }
        return field.name;
    }

    /**
     * Get the property matching a field name
     * @param {String} fieldName
     * @returns {String|null}
     */
    getPropertyByFieldName(fieldName) {

        if (fieldName in this.fieldNamesToPropertyNames) {
            return this.fieldNamesToPropertyNames[fieldName];
        }

        return null;
    }

    /**
     * See if a property is read only
     * @param {String} property The name of the property
     * @returns {Boolean}
     */
    isPropertyReadOnly(property) {
        return !!this.readOnly[property];
    }

    /**
     * See if a field is read only
     * @param {String} fieldName The name of the field
     * @returns {Boolean}
     */
    isFieldReadOnly(fieldName) {

        const property = this.getPropertyByFieldName(fieldName);
        if (!property) {
            return false;
        }

        return !!this.isPropertyReadOnly(property);

    }

    /**
     * Merge an existing metadata instance onto this instance
     *
     * @param {Metadata} metadata The object to merge onto this object
     * @returns {void}
     */
    mergeMetadata(metadata) {

        if (!(metadata instanceof Metadata) &&
            metadata.constructor.name !== 'Metadata') {

            throw new Error('Invalid argument, expecting Metadata, got ' + metadata.constructor.name);
        }

        const scalar = /string|number|boolean/;
        const owner = ['isEmbedded'];
        const skip = ['name', 'filePath', 'proto', 'inherits'];

        Object.getOwnPropertyNames(metadata).forEach(function(name) {
            if (skip.indexOf(name) > -1 && typeof this[name] !== 'undefined') {
                return true;
            }

            const isOwner = owner.indexOf(name) > -1;

            if (typeof this[name] === 'undefined') {

                this[name] = metadata[name];

            } else if (name === 'fields' ) {

                let i ,
                    x ,
                    xlen ,
                    found ,
                    len = metadata.fields.length;

                for (i = 0; i < len; i++) {
                    found = false;
                    xlen = this.fields.length;
                    for (x = 0; x < xlen; x++) {
                        if (this.fields[x].name === metadata.fields[i].name) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        this.fields.push(metadata.fields[i]);
                    }
                }

            } else if (!isOwner) {

                if (scalar.test(typeof metadata[name])) {

                    this[name] = metadata[name];

                } else if (typeof metadata[name] !== 'function') {

                    //_.merge(this[name], _.cloneDeep(metadata[name]));
                    _.merge(this[name], metadata[name]);

                }

            } else if (this[name] === null) {

                // owner fields only get set if they are null
                this[name] = metadata[name];

            }
            return true;
        }, this);
    }
}
