/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// core modules
const fs = require('fs');
const util = require('util');
const Repository = require('./../../repository');

// third party modules
const _ = require('lodash');

// local modules
const Annotation = require('conga-annotations').Annotation;

module.exports = class DocumentAnnotation extends Annotation {

    /**
     * Define the annotation string to find
     *
     * @var {String}
     */
    static get annotation() { return 'Bass:Document'; }

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

        // this.name = null;
        // this.collection = null;
        // this.repository = null;
        // this.repositoryClass = null;
    }

    init(data) {

        // set defaults
        this.name = data.name || null;
        this.collection = data.collection || null;
        this.repository = data.repository || null;
        this.repositoryClass = data.repositoryClass || null;

        if (this.repository !== null) {

            // if a custom repository is defined, we have to set it up now
            var dir = this.getDirectory();
            var path = require.resolve(dir + '/' + this.repository);

            if (!path) {
                throw new Error('Repository path does not exist for ' + this.name + ' at ' + this.repository);
            }

            var stat = fs.lstatSync(path);

            if (!stat || !stat.isFile()) {
                throw new Error('Repository path does not exist for ' + this.name + ' at ' + this.repository);
            }

            var repositoryClass = require(path);

            if (typeof repositoryClass !== 'function') {
                throw new Error('Repository must be a class constructor (function), a type of "' + (typeof repositoryClass) + '" was given');
            }

            // make sure custom repository extends our Repository
            if (!(repositoryClass instanceof Repository)) {

                // this allows people to build repositories without extending the base repository
                function RepositoryWrapper(manager, metadata) {
                    Repository.apply(this, [manager, metadata]);

                    // this allows user defined repositories to ignore the manager and metadata in their constructors
                    repositoryClass.apply(this, Array.prototype.slice.call(arguments, 2));
                }

                // RepositoryWrapper inherits from the base repository
                util.inherits(RepositoryWrapper, Repository);

                // mixin the wrapper prototype with the custom prototype
                this.repositoryClass = RepositoryWrapper;
                for (var m in repositoryClass.prototype) {
                    this.repositoryClass.prototype[m] = repositoryClass.prototype[m];
                }

            } else {

                // use the custom class
                this.repositoryClass = repositoryClass;
            }
        }
    }

}
