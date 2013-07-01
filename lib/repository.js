/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var Repository = function(registry, type, client){
	this.registry = registry;
	this.type = type;
	this.client = client;
};

Repository.prototype = {

	find: function(id){

	},

	findOneBy: function(criteria){

	},

	findBy: function(criteria, sort, offset, limit){

	},

	findCountByCriteria: function(criteria){

	}
};

module.exports = Repository;