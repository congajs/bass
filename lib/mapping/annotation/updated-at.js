/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Annotation = require('conga-annotations').Annotation;

var UpdatedAt = function(data){

};

UpdatedAt.annotation = 'Bass:UpdatedAt';
UpdatedAt.targets = [Annotation.PROPERTY];

module.exports = UpdatedAt;