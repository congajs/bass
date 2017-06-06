// core libs
const Annotation = require('conga-annotations').Annotation;

/**
 * The @MyCustomAnnotation is just a fake annotation to make sure it can
 * get attached to bass and handled correctly
 */
module.exports = class MyCustomAnnotation extends Annotation {
    /**
     * {@inheritdoc}
     */
    static get annotation() { return 'MyCustomAnnotation'; }

    /**
     * {@inheritdoc}
     */
    static get targets() { return [Annotation.PROPERTY] }
}
