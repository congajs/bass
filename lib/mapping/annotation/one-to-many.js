/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Annotation = require('conga-annotations').Annotation;

var OneToMany = function(data){
  this.name = data['name'];
  this.document = data['document'];
};

OneToMany.annotation = 'OneToMany';
OneToMany.targets = [Annotation.PROPERTY];

OneToMany.prototype.name = null;
OneToMany.prototype.document = null;

module.exports = OneToMany;