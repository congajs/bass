/*
 * This file is part of the bass.js library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const fs = require('fs');

const Annotation = require('conga-annotations').Annotation;

module.exports = class InheritAnnotation extends Annotation {

    /**
     * Define the annotation string to find
     *
     * @var {String}
     */
    static get annotation() { return 'Bass:Inherit'; }

    /**
     * The possible targets
     *
     * (Annotation.DEFINITION, Annotation.CONSTRUCTOR, Annotation.PROPERTY, Annotation.METHOD)
     *
     * @type {Array}
     */
    static get targets() { return [Annotation.DEFINITION] }

    constructor(data, filePath) {

        super(data, filePath);

        /**
         * The document name you want to inherit from (must exist within the same bass definition)
         *
         * @type {String}
         */
        this.document = null;
    }

    init(data) {

        if (!data.document) {
            throw new Error('"document" is a require @Bass:Inherit annotation property');
        }

        this.document = data.document || null;
    }

}
