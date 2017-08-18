/*
 * This file is part of the bass.js library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const Annotation = require('conga-annotations').Annotation;

module.exports = class ReadOnlyAnnotation extends Annotation {

    /**
     * Define the annotation string to find
     * 
     * @var {String}
     */
    static get annotation() { return 'Bass:ReadOnly'; }

    /**
     * The possible targets
     *
     * (Annotation.DEFINITION, Annotation.CONSTRUCTOR, Annotation.PROPERTY, Annotation.METHOD)
     *
     * @type {Array}
     */
    static get targets() { return [Annotation.PROPERTY] }

}
