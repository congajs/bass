/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const Annotation = require('conga-annotations').Annotation;

module.exports = class IdAnnotation extends Annotation {

	/**
	 * Define the annotation string to find
	 * 
	 * @var {String}
	 */
	static get annotation() { return 'Bass:Id'; }

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
    	
	 	/**
		 * The id generation strategy
		 *
		 * Possible values:
		 *
		 *     - AUTO
		 *     - MANUAL
		 *     
		 * @type {String}
		 */
		this.strategy = 'AUTO';
    }

    init(data) {
    	this.strategy = data.strategy || 'AUTO';
    }

}