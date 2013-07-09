/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Annotation = require('conga-annotations').Annotation;

var CreatedAt = function(data){

};

CreatedAt.annotation = 'Bass:CreatedAt';
CreatedAt.targets = [Annotation.PROPERTY];

module.exports = CreatedAt;