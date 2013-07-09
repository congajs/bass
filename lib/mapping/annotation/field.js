/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Annotation = require('conga-annotations').Annotation;

var Field = function(data){
  this.name = data['name'];
  this.type = data['type'];
};

Field.annotation = 'Bass:Field';
Field.targets = [Annotation.PROPERTY];

Field.prototype.name = null;
Field.prototype.type = null;


module.exports = Field;