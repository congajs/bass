// core libs
const path = require('path');

/**
 * The paths to all the annotations we support
 * @type {Array<String>}
 */
const paths = [
    path.join(__dirname, 'MyCustomAnnotation')
];

/**
 * This is an annotation handler which attaches and processes custom annotations
 */
module.exports = class MyCustomAnnotationHandler {
    /**
     * Get all annotation paths
     * @returns {Array<String>}
     */
    getAnnotationPaths() {
        return paths;
    }

    /**
     * Process all of the annotations on a document
     *
     * @param  {Reader}            reader      the annotation reader
	 * @param  {ManagerDefinition} definition  the manager definition
	 * @param  {Metadata}          metadata    the document metadata
     * @return {void}
     */
    handleAnnotations(reader, definition, metadata) {
        console.log('handling custom annotation')
    }
}
