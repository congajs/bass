/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Annotation = require('conga-annotations').Annotation;

module.exports = Annotation.extend({

	annotation: 'Bass:Document',
	targets: [Annotation.CONSTRUCTOR],

	name: null,
	collection: null,
	repository: null,

	init: function(data){
		this.name = data.name;
	}

});