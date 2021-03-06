module.exports = class AdapterMapper {

    constructor(registry, client) {
        this.registry = registry;
        this.client = client;
    }

    /**
     * Convert a dot notation (such as used in find) to the appropiate mapped field name
     *
     * @param {Metadata} metadata
     * @param {String} fieldName
     */
    convertPropertyNameToDbName(metadata, fieldName) {

        let name = false;

        if (fieldName.indexOf('.') !== -1) {

            name = metadata.getFieldNameByProperty(fieldName.split('.').shift());

            if (name && metadata.getFieldByProperty(name).type !== 'object') {

                return fieldName;
            }
        }

        return name || fieldName;
    }

    /**
     * Convert a model value to a db value
     *
     * @param  {*} type
     * @param  {*} value
     * @return {*}
     */
    convertModelValueToDbValue(type, value) {
        return value;
    }

    /**
     * Convert a db value to a model value
     *
     * @param  {*} type
     * @param  {*} value
     * @return {*}
     */
    convertDbValueToModelValue(type, value) {
        return value;
    }

    /**
     * Convert relations on a model to data to insert
     *
     * @param  {Metadata} metadata
     * @param  {Object}   model
     * @param  {Object}   data
     * @param  {Function} cb
     * @return {void}
     */
    convertModelRelationsToData(metadata, model, data, cb) {
        cb(null, data);
    }

    /**
     * Convert relations in data to models attached to the given model
     *
     * @param  {Metadata} metadata
     * @param  {Object}   data
     * @param  {Object}   model
     * @param  {Mapper}   mapper
     * @param  {Function} cb
     * @return {void}
     */
    convertDataRelationsToModel(metadata, data, model, mapper, cb) {
        cb(null, model);
    }

    /**
     * Convert data for a relation field in to a model/models
     *
     * @param  {Metadata} metadata
     * @param  {String}   fieldName
     * @param  {Object}   data
     * @param  {Object}   model
     * @param  {Mapper}   mapper
     * @param  {Function} cb
     * @return {void}
     */
    convertDataRelationToDocument(metadata, fieldName, data, model, mapper, cb) {
        cb(null, model);
    }

    /**
     * Map raw data to a model using sparse information for any joins
     * so that they can be grabbed later on in bulk and merged in
     *
     * @param  {Object}   model
     * @param  {Metadata} metadata
     * @param  {Object}   data
     * @param  {Function} cb
     * @return {void}
     */
    mapPartialRelationsToModel(model, metadata, data, cb) {
        cb(null, model);
    }

    /**
     * Run queries on a collection of partial models and merge the related
     * models in to each model
     *
     * @param  {Manager}  manager
     * @param  {Metadata} metadata
     * @param  {Object}   data
     * @param  {Function} cb
     * @return {void}
     */
    mergeInRelations(manager, metadata, data, cb) {
        cb(null, data);
    }

    /**
     * Convert a dot notation (such as used in find) to the appropiate mapped field name
     * @param {Metadata} metadata
     * @param {String} property
     * @return {Object}
     */
    mapMetadataField(metadata, property) {
        // noop unless overwritten
        return metadata.getFieldByProperty(property);
    }

    /**
     * Convert a dot notation (such as used in find) to the appropiate mapped nested field name
     * This is in a separate method so no assumptions are made
     *
     * @param {Metadata} metadata
     * @param {String} property
     * @return {Object}
     */
    mapNestedMetadataField(metadata, property) {
        let field = metadata.getFieldByProperty(property);
        if (field) {
            return field;
        }
        const parts = property.split('.');
        while (parts.length > 1) {
            /*
                where 'parent.nested'
                    if 'parent' is a mapped relationship
                        look in the 'parent' document for the 'nested' field
             */
            const relation = metadata.getRelationByProperty(parts.shift());
            if (!relation) {
                // stop when we can't find a relationship, field is whatever we found last
                break;
            }
            // we found the relationship, now find the nested field
            const meta = metadata.registry.getMetadataForDocument(relation.document);
            if (!meta) {
                // fail-safe
                break;
            }
            metadata = meta;
            field = metadata.getFieldByProperty(parts[0]);
        }
        return field;
    }
};
