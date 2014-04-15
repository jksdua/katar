/* jshint node:true */

'use strict';

/**
	Todo

	- Task timeout
	- Concurrency
	- Workers on the network - incoming, outgoing
 */

/**
	Dependencies
 */
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

var Queue = require(__dirname + '/Class.Queue');
var memoryDb = require('katar-memorydb');
var constants = require(__dirname + '/constants');

/**
	Creates a queue server that can be used to host task queues

	@class QueueServer
	@param {Object} options Options to creating a queue server
		@param {Object} options.db Data adapter compatible with queue server
		@param {Object} options.eventEmitter Event emitter to be used for emitting events
 */
function QueueServer(options) {
	if (!(this instanceof QueueServer)) {
		return new QueueServer(options);
	}

	EventEmitter.call(this);

	options = options || {};

	this.queues = {};

	this.db = options.db || memoryDb();
	this.eventEmitter = options.eventEmitter;

	if ('memorydb' === this.db.name) {
		console.warn('Using a memory datastore. Use a persistent datastore in production');
	}
}

QueueServer.prototype = Object.create(EventEmitter.prototype);

QueueServer.prototype.db = null;

QueueServer.prototype.queues = null;

QueueServer.prototype.workers = null;

QueueServer.prototype.eventEmitter = null;

QueueServer.prototype.queue = function(name, options) {
	if (arguments.length > 1) {
		// avoid duplicate queues
		assert(!this.queues[name], 'Duplicate queue');

		var model = this.db.model(name);
		var queue = new Queue(name, this.eventEmitter || this, model, options);
		this.queues[name] = queue;

		return queue;
	} else {
		return this.queues[name];
	}
};

QueueServer.constants = constants;

module.exports = QueueServer;