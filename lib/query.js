var Query = function(){
	this.conditions = {};
	this._sort = {};
	this._limit = null;
};

Query.prototype = {

	_sort: null,
	_limit: null,
	_skip: null,

	currentField: null,

	where: function(field){

		this.currentField = field;

		return this;
	},

	equals: function(value){

		if (this.currentField === null){
			throw new Error('equals() must be called after where()');
		}

		this.conditions[this.currentField] = value;

		return this;
	},

	and: function(conditions){

	},

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

	limit: function(limit){
		this._limit = limit;
		return this;
	},

	skip: function(skip){
		this._skip = skip;
		return this;
	},

	getSort: function(){
		return this._sort;
	},

	getLimit: function(){
		return this._limit;
	},

	getSkip: function(){
		return this._skip;
	}

};

'gt gte lt lte ne in nin all regex size maxDistance'.split(' ').forEach(function ($conditional) {
	Query.prototype[$conditional] = function (path, val) {
		if (arguments.length === 1) {
			val = path;
			path = this.currentField;
		}
		var conds = this.conditions[path] || (this.conditions[path] = {});
		conds[$conditional] = val;
		return this;
	};
});

module.exports = Query;