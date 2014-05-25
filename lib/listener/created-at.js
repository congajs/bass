/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var CreatedAtListener = function(){};

CreatedAtListener.prototype = {

	onPrePersist: function(event, cb) {

		if (event.document.__isNew){
			if (typeof event.metadata.createdAtProperty !== 'undefined'){
				event.document[event.metadata.createdAtProperty] = new Date();
			}			
		}

		cb();
	}
};

module.exports = CreatedAtListener;