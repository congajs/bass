/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

module.exports = class VersionListener {

	onPrePersist(event, cb) {
		event.document[event.metadata.versionProperty] = 1;
		cb();
	}

	onPreUpdate(event, cb) {
		if (typeof event.metadata.versionProperty !== 'undefined') {
			if (isNaN(event.document[event.metadata.versionProperty])) {
				// @todo - maybe throw an error instead???
				event.document[event.metadata.versionProperty] = 0;
			}
			event.document[event.metadata.versionProperty]++;
		}

		cb();
	}

}