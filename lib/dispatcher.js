/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var _ = require('lodash');

/**
 * The EventDispatcher allows you to add named events and dispatch
 * all the events associated with a name
 * 
 * @author Marc Roulias <marc@lampjunkie.com>
 */
var EventDispatcher = function(){
	this.events = {};
	this.documentEvents = {};
	this.documentEventCache = {};
};

/**
 * Hash of event names to arrays of attached listeners
 * 
 * {'my.event': [Function,Function,Function]}
 * 
 * 
 * @var {Object}
 */
EventDispatcher.prototype.events = null;

/**
 * Add a new event listener
 * 
 * @param {String} event
 * @param {Function} method
 * @param {Number} priority
 */
EventDispatcher.prototype.addListener = function(event, obj, method, priority){
	
	if (typeof this.events[event] === 'undefined'){
		this.events[event] = [];
	}
	
	this.events[event].push({ obj : obj, method : method });
};

/**
 * Add a new document event listener
 *
 * @param  {String} name
 * @param  {String} event
 * @param  {Object} object
 * @param  {String} method
 * @param  {Number} priority
 * @return {void}
 */
EventDispatcher.prototype.addDocumentListener = function(name, event, obj, method, priority){

	if (typeof this.documentEvents[name] === 'undefined'){
		this.documentEvents[name] = {};
	}

	this.documentEvents[name][event] = { obj : obj, method : method };
};

/**
 * Dispatch an event
 * 
 * @param {String} name
 * @param {Object} event
 * @param {Function} cb
 */
EventDispatcher.prototype.dispatch = function(name, event, cb){

	var that = this;
	var evt;

	if (typeof this.events[name] === 'undefined' || this.events[name].length === 0){
		cb();
		return;
	}

	var events = [];

	for (var i=0, j=this.events[name].length; i<j; i++){
		events.push(this.events[name][i]);
	}

	// check if metadata has listeners
	if (event.metadata.listeners.length > 0){

		for(var i=0, j=event.metadata.listeners.length; i<j; i++){

			if (typeof this.documentEvents[event.metadata.listeners[i]] === 'undefined'){
				console.error('Bass document listener: ' + event.metadata.listeners[i] + ' is not registered');
				process.exit();
			}

			events.push(this.documentEvents[event.metadata.listeners[i]][name]);
		}
	}

	var walk = function(index, cb){

		try {
			if (typeof events[index] !== 'undefined'){
				
				evt = events[index];
				
				var start = new Date();

				evt.obj[evt.method].call(evt.obj, event, function(){
					walk(index+1, cb);
				});

			} else {
				cb();
			}			
		} catch (err){
			console.log(err);
		}


	};
	
	walk(0,cb);
};

module.exports = EventDispatcher;