/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var VersionListener = function(){};

VersionListener.prototype = {

	onPrePersist: function(event, cb){

		if (typeof event.metadata.versionProperty !== 'undefined'){
			if (typeof event.document[event.metadata.versionProperty] !== 'number'){
				// @todo - maybe throw an error instead???
				event.document[event.metadata.versionProperty] = 0;
			}
			event.document[event.metadata.versionProperty]++;
		}

		cb();
	}
};

module.exports = VersionListener;