/**
 * The Query provides a fluent interface to build
 * the full query to an underlying database
 * 
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
var Query = function(){
	this.conditions = {};
	this._sort = {};
};

Query.prototype = {

	/**
	 * The sort criteria
	 * 
	 * @type {Object}
	 */
	_sort: null,

	/**
	 * The limit
	 * 
	 * @type {Number}
	 */
	_limit: null,

	/**
	 * The skip number
	 * 
	 * @type {Number}
	 */
	_skip: null,

	/**
	 * The current field for the fluent interface
	 * 
	 * @type {String}
	 */
	currentField: null,

	/**
	 * Specify the current field to run operations on
	 *
	 * query.where('myField'). .... 
	 *
	 * 
	 * @param  {String} field
	 * @return {Query}
	 */
	where: function(field){

		this.currentField = field;

		return this;
	},

	/**
	 * Add an "equals" condition to the current field
	 *
	 * query.where('myField').equals('some value')
	 *
	 * 
	 * @param  {Mixed} value
	 * @return {Query}
	 */
	equals: function(value){

		if (this.currentField === null){
			throw new Error('equals() must be called after where()');
		}

		this.conditions[this.currentField] = value;

		return this;
	},

	and: function(conditions){

	},

	/**
	 * Set the sort fields and directions
	 * 
	 * @param  {Object} sort
	 * @return {Query}
	 */
	sort: function(sort){

		if (typeof sort === 'object'){

			for (var field in sort){
				var dir = sort[field];

				if (dir === 'asc'){
					dir = 1;
				} else if (dir === 'desc'){
					dir = -1;
				}

				this._sort[field] = dir;
			}
		}

		return this;
	},

	/**
	 * Set the limit
	 * 
	 * @param  {Number} limit 
	 * @return {Query}
	 */
	limit: function(limit){
		this._limit = limit;
		return this;
	},

	/**
	 * Set the skip number
	 * 
	 * @param  {Number} skip
	 * @return {Query}
	 */
	skip: function(skip){
		this._skip = skip;
		return this;
	},

	/**
	 * Get all of the defined conditions
	 * 
	 * @return {Object}
	 */
	getConditions: function(){
		return this.conditions;
	},

	/**
	 * Get the sort
	 * 
	 * @return {Object}
	 */
	getSort: function(){
		return this._sort;
	},

	/**
	 * Get the limit
	 * 
	 * @return {Number}
	 */
	getLimit: function(){
		return this._limit;
	},

	/**
	 * Get the skip number
	 * 
	 * @return {Number}
	 */
	getSkip: function(){
		return this._skip;
	}

};

'gt gte lt lte ne in nin all regex size maxDistance'.split(' ').forEach(function (conditional) {
	Query.prototype[conditional] = function (path, val) {
		if (arguments.length === 1) {

			if (tyis.currentField === null){
				throw new Error(conditional + ' must be called after where()');
			}

			val = path;
			path = this.currentField;
		}
		var conds = this.conditions[path] || (this.conditions[path] = {});
		conds[conditional] = val;
		return this;
	};
});

module.exports = Query;