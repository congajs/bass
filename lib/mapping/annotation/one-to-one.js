/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Annotation = require('conga-annotations').Annotation;

var OneToOne = function(data){
  this.name = data['name'];
  this.document = data['document'];
};

OneToOne.annotation = 'OneToOne';
OneToOne.targets = [Annotation.PROPERTY];

OneToOne.prototype.name = null;
OneToOne.prototype.document = null;

module.exports = OneToOne;