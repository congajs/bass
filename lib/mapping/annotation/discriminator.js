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

	annotation: 'Bass:Discriminator',
	targets: [Annotation.CONSTRUCTOR],

	field: null,
	map: null,
	mapped: null,

	init: function(data){

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

});