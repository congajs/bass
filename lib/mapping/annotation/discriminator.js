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

module.exports = class DiscriminatorAnnotation extends Annotation {

    /**
     * Define the annotation string to find
     *
     * @var {String}
     */
    static get annotation() { return 'Bass:Discriminator'; }

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

        this.postAnnotation = true;
        this.field = null;
        this.map = null;
        this.mapped = null;
    }

    init(data) {

        if (!data.field) {
            throw new Error('"field" is a required Discriminator annotation property');
        }

        this.mapped = [];
        this.field = data.field;

        if (data.map) {

            this.map = data.map;

            var dir = this.getDirectory();

            var path, stat, m;

            for (m in this.map) {

                path = require.resolve(dir + '/' + this.map[m]);
                if (!path) {
                    throw new Error('Discriminator mapped path does not exist for ' + this.field + ' = ' + m + ' at ' + this.map[m]);
                }

                stat = fs.lstatSync(path);

                if (!stat || !stat.isFile()) {
                    throw new Error('Discriminator mapped path does not exist for ' + this.field + ' = ' + m + ' at ' + this.map[m]);
                }

                this.mapped[m] = require(path);
            }
        }
    }

}
