/*
 * This file is part of the bass.js library.
 *
 * (c) Marc Roulias <marc@lampjunkie.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

const _ = require('lodash');

/**
 * The EventDispatcher allows you to add named events and dispatch
 * all the events associated with a name
 * 
 * @author Marc Roulias <marc@lampjunkie.com>
 */
module.exports = class EventDispatcher {

	constructor() {

		/**
		 * Hash of event names to arrays of attached listeners
		 * 
		 * {'my.event': [Function,Function,Function]}
		 * 
		 * 
		 * @var {Object}
		 */
		this.events = {};

		this.documentEvents = {};
		this.documentEventCache = {};
	}

	/**
	 * Add a new event listener
	 * 
	 * @param {Object} event
	 * @param {Object} obj
	 * @param {String} method
	 * @param {Number} priority
	 */
	addListener(event, obj, method, priority) {
	
		if (typeof this.events[event] === 'undefined') {
			this.events[event] = [];
		}
		
		this.events[event].push({ obj : obj, method : method });
	}

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
	addDocumentListener(name, event, obj, method, priority) {

		if (typeof this.documentEvents[name] === 'undefined') {
			this.documentEvents[name] = {};
		}

		this.documentEvents[name][event] = { obj : obj, method : method };
	}

	/**
	 * Dispatch an event
	 * 
	 * @param {String} name
	 * @param {Object} event
	 * @param {Function} cb
	 */
	dispatch(name, event, cb) {

		const that = this;
		let evt;

		if ((typeof this.events[name] === 'undefined' || 
			this.events[name].length === 0) && 
			(typeof event.metadata.events[name] === 'undefined' || event.metadata.events[name].length === 0)) {
			cb();
			return;
		}

		const events = [];

		if (typeof this.events[name] !== 'undefined') {
			for (let i=0, j=this.events[name].length; i<j; i++) {
				events.push(this.events[name][i]);
			}
		}

		// check if metadata has listeners
		if (event.metadata.listeners.length > 0) {

			for(let i=0, j=event.metadata.listeners.length; i<j; i++) {

				if (typeof this.documentEvents[event.metadata.listeners[i]] === 'undefined') {
					console.error('Bass document listener: ' + event.metadata.listeners[i] + ' is not registered');
					process.exit();
				}

				events.push(this.documentEvents[event.metadata.listeners[i]][name]);
			}
		}

		// find event methods on document
		if (typeof event.metadata.events[name] !== 'undefined' && event.metadata.events[name].length > 0) {
			for (let i in event.metadata.events[name]) {
				events.push({
					obj: event.document,
					method: event.metadata.events[name][i].method
				});
			}
		}

		const walk = function(index, cb){

			try {
				if (typeof events[index] !== 'undefined') {

					evt = events[index];
					
					evt.obj[evt.method].call(evt.obj, event, function(){
						walk(index+1, cb);
					});

				} else {
					cb();
				}			
			} catch (err){
				console.log(err.stack);
			}
		};
		
		walk(0,cb);
	}
}
