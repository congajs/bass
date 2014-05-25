/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var UpdatedAtListener = function(){};

UpdatedAtListener.prototype = {

	onPrePersist: function(event, cb){

		if (event.document.__isNew === false){
			if (typeof event.metadata.updatedAtProperty !== 'undefined'){
				event.document[event.metadata.updatedAtProperty] = new Date();
			}
		}

		cb();
	}
};

module.exports = UpdatedAtListener;