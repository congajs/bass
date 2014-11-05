/**
 * The Query provides a fluent interface to build
 * the full query to an underlying database
 *
 * @constructor
 * @author  Marc Roulias <marc@lampjunkie.com>
 */
function Query(){
	this._conditions = {};
	this._sort = {};
}

// TODO: what's this for?
Query.extend = function(sub){

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
	 * Object hash of conditions
	 *
	 * @type {Object}
	 */
	_conditions: null ,

	/**
	 * The current field for the fluent interface
	 * 
	 * @type {String}
	 */
	_currentField: null,

	/**
	 * Boolean flag to count the total rows in the
	 * result set (without limit or offset)
	 *
	 * @type {Boolean}
	 */
	_countFoundRows: false ,

	/**
	 * Set the conditions all at once (this replaces all previous conditions)
	 * @param {Object} conditions
	 * @returns {Query}
	 */
	conditions: function(conditions) {
		if (!(conditions instanceof Object)) {
			try {
				var obj = JSON.parse(conditions);
			} catch (e) { console.error(e); }

			if (!obj) {
				throw new Error('conditions must be an object');
			}

			conditions = obj;
		}

		this._conditions = conditions;

		return this;
	} ,

	/**
	 * Set alias collection names for all field conditions
	 * NOTE: this is for sql adapters but has to be here for now, unless we make an adapter query object)
	 * Turns {id: 5} into {alias.id: 5}
	 *
	 * @param {String} alias The alias name to prefix each field with
	 * @returns {Query}
	 */
	conditionAlias: function(alias) {
		var field,
			newField,
			operator;

		if (!this._conditions) {
			return this;
		}

		var conditions = {};

		for (field in this._conditions) {
			newField = field;
			if (newField.indexOf('.') === -1) {
				newField = alias + '.' + newField;
			}
			conditions[newField] = this._conditions[field];
		}

		this._conditions = conditions;

		return this;
	} ,

	/**
	 * Specify the current field to run operations on
	 *
	 * query.where('myField'). .... 
	 *
	 * 
	 * @param  {String} field
	 * @return {Query}
	 */
	where: function(field) {
		this._currentField = field;
		return this;
	},

	/**
	 * Add an "equals" condition to the current field
	 *
	 * query.where('myField').equals('some value')
	 *
	 * @param {String|undefined} path The field name
	 * @param {*} value
	 * @return {Query}
	 */
	equals: function(path, value) {
		if (arguments.length === 1) {
			if (this._currentField === null){
				throw new Error('equals must be called after where()');
			}
			value = path;
			path = this._currentField;
		}
		this._conditions[path] = value;
		return this;
	},

	/**
	 * Alias for 'equals'
	 * @param {String|undefined} path The field name
	 * @param {*} value
	 * @returns {Query}
	 */
	eq: function(path, value) {
		return this.equals(path, value);
	} ,

	and: function(conditions) {

	},

	/**
	 * Sort conditions in order by the given array
	 * @param {Array<String>} keys Array of field names, in order as you would like them to be executed in the query
	 * @returns {Query}
	 */
	sortConditions: function(keys) {

		if (!Array.isArray(keys)) {
			if (!keys) {
				return;
			}
			keys = [keys];
		}

		var obj = {};
		var conditions = this._conditions;

		(keys || []).forEach(function(key) {
			if (typeof conditions[key] !== 'undefined') {
				obj[key] = conditions[key];
			}
		});

		Object.keys(conditions).forEach(function(key) {
			if (typeof obj[key] === 'undefined') {
				obj[key] = conditions[key];
			}
		});

		this._conditions = obj;

		return this;

	} ,

	/**
	 * Set the sort fields and directions
	 * 
	 * @param  {Object} sort
	 * @return {Query}
	 */
	sort: function(sort) {
		if (typeof sort === 'object') {
			for (var field in sort) {

				var dir = sort[field];

				if (dir === 'asc') {

					dir = 1;

				} else if (dir === 'desc') {

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
	limit: function(limit) {
		this._limit = parseInt(limit, 10);
		return this;
	},

	/**
	 * Set the skip number
	 * 
	 * @param  {Number} skip
	 * @return {Query}
	 */
	skip: function(skip) {
		this._skip = parseInt(skip, 10);
		return this;
	},

	/**
	 * Set the countFoundRows bool
	 * @param {Boolean} bool
	 * @returns {Query}
	 */
	countFoundRows: function(bool) {
		this._countFoundRows = !!bool;
		return this;
	} ,

	/**
	 * Get all of the defined conditions
	 * 
	 * @return {Object}
	 */
	getConditions: function() {
		return this._conditions;
	},

	/**
	 * Get the sort
	 * 
	 * @return {Object}
	 */
	getSort: function() {
		return this._sort;
	},

	/**
	 * See if this query object already has a sort-by definition
	 * @returns {Boolean}
	 */
	hasSort: function() {
		return (Object.getOwnPropertyNames(this._sort).length > 0);
	} ,

	/**
	 * Get the limit
	 * 
	 * @return {Number}
	 */
	getLimit: function() {
		return this._limit;
	},

	/**
	 * Get the skip number
	 * 
	 * @return {Number}
	 */
	getSkip: function() {
		return this._skip;
	} ,

	/**
	 * Get the countFoundRows flag
	 *
	 * @returns {Boolean}
	 */
	getCountFoundRows: function() {
		return !!this._countFoundRows;
	}
};

['gt','gte','lt','lte','ne','in','nin','all','regex','size','maxDistance'].forEach(function (conditional) {
	Query.prototype[conditional] = function (path, val) {
		if (arguments.length === 1) {
			if (this._currentField === null){
				throw new Error(conditional + ' must be called after where()');
			}
			val = path;
			path = this._currentField;
		}
		if (!this._conditions[path]) {
			this._conditions[path] = {};
		}
		this._conditions[path][conditional] = val;
		return this;
	};
});

Query.prototype.constructor = Query;

module.exports = Query;