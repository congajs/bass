/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Annotation = require('conga-annotations').Annotation;

var Document = function(data){
  this.name = data['name'];
  this.collection = data['collection'];
  this.repository = data['repository'];
};

Document.annotation = 'Document';
Document.targets = [Annotation.CONSTRUCTOR];

Document.prototype.name = null;
Document.prototype.collection = null;
Document.prototype.repository = null;


module.exports = Document;