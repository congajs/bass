/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const Annotation = require('@conga/annotations').Annotation;

module.exports = class OneToManyAnnotation extends Annotation {

    /**
     * Define the annotation string to find
     * 
     * @var {String}
     */
    static get annotation() { return 'Bass:OneToMany'; }

    /**
     * The possible targets
     *
     * (Annotation.DEFINITION, Annotation.CONSTRUCTOR, Annotation.PROPERTY, Annotation.METHOD)
     *
     * @type {Array}
     */
    static get targets() { return [Annotation.PROPERTY] }

    constructor(data, filePath) {

        super(data, filePath);

        this.name = data.name || null;
        this.document = data.document || null;
        this.sort = data.sort || null;
        this.direction = data.direction || null;
    }

}
