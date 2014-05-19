/*
 * This file is part of the bass.js library.
 *
 * (c) Anthony Matarazzo <email@anthonymatarazzo.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var fs = require('fs');

var Annotation = require('conga-annotations').Annotation;

module.exports = Annotation.extend({

	annotation: 'Bass:Inherit',
	targets: [Annotation.CONSTRUCTOR],

	/**
	 * The document name you want to inherit from (must exist within the same bass definition)
	 *
	 * @type {String}
	 */
	document: null,

	init: function(data){

		if (!data.document) {
			throw new Error('"document" is a require @Bass:Inherit annotation property');
		}

		this.document = data.document || null;
	}

});