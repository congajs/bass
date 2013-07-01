/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Field = function(){};

Field.prototype = {
  name: null,
  property: null,
  type: null,
  default: null
};

module.exports = Field;