/* jshint node:true */

'use strict';

var _ = require('lodash');
var debug = require('debug')('queue');
var assert = require('assert');
var jsonschema = require('jsonschema');
var validator = new (jsonschema.Validator)();
var constants = require(__dirname + '/constants');
var EventEmitter = require('events').EventEmitter;

var STATUSES = constants.task.statuses;

function assertModel(model) {
	_.each([
		'wipe',
		'insert',
		'update',
		'delete',
		'findOne',
		'findById'
	], function(method) {
		assert(_.isFunction(model[method]), 'Model is missing function `' + method + '`');
	});
}

function Queue(name, eventEmitter, model, options) {
	if (!(this instanceof Queue)) {
		return new Queue(name, eventEmitter, model, options);
	}

	EventEmitter.call(this);

	assertModel(model);

	this.name = name;
	this.model = model;
	this.options = _.defaults({
		timeout: 1000 * 60, // 60 seconds
		persistent: false,
		concurrency: 1
	}, options);
	this.eventEmitter = eventEmitter;
}

Queue.prototype = Object.create(EventEmitter.prototype);

Queue.prototype.name = null;

Queue.prototype.model = null;

Queue.prototype.options = {	timeout: null, persistent: null, concurrency: null };

Queue.prototype.eventEmitter = null;

Queue.prototype.emitTaskEvent = function(queue, task, status) {
	this.emit(status ? status : task.status, task);
	this.eventEmitter.emit(
		this.name + '.' + (status ? status : task.status),
		task
	);
};

// jsonschema validator that can be used in beforeInsert
Queue.prototype.validator = validator;

Queue.prototype.clear = function *() {
	return yield *this.model.wipe();
};

// function that can be overridden to validate tasks before insertion
// throw an error if task is not valid
Queue.prototype.beforeInsert = function *() { return; };

Queue.prototype.insertOne = function *(task) {
	debug('_insertOne - got task %j', task);

	yield *this.beforeInsert(task);

	task = {
		data: task.data || null,
		status: task.status || constants.task.status.QUEUED,
		priority: task.priority || constants.task.priority.NORMAL
	};

	var res = validator.validate(task, constants.task.schema);
	assert(res.valid, JSON.stringify(res.errors));

	debug('_insertOne - inserting task %j', task);

	task = yield *this.model.insert(task);

	this.emitTaskEvent(this, task);

	return task;
};

Queue.prototype.insert = function *(tasks) {
	debug('insert - got task(s) %j', tasks);

	var multiple = Array.isArray(tasks);

	if (!multiple) {
		return yield *this.insertOne(tasks);
	} else {
		// yield an array for parallel execution
		for (var i = 0, len = tasks.length; i < len; i += 1) {
			tasks[i] = yield *this.insertOne(tasks[i]);
		}
		return tasks;
	}
};

Queue.prototype._done = function *(taskId, status, error) {
	error = (error instanceof Error ? error + '' : error);

	if (this.options.persistent) {
		return yield *this.status(taskId, status, null, error);
	} else {
		var task = yield *this.model.delete(taskId);
		assert(task, 'Task not found');

		task.status = status;
		if (error) { task.error = error; }
		this.emitTaskEvent(this, task);
		this.emitTaskEvent(this, task, 'deleted');
		return task;
	}
};

Queue.prototype.done = function *(taskId) {
	return yield *this._done(taskId, constants.task.status.DONE);
};

Queue.prototype.failed = function *(taskId, error) {
	assert(error instanceof Error || _.isString(error), 'Missing error');
	return yield *this._done(taskId, constants.task.status.FAILED, error);
};

Queue.prototype.started = function *(taskId) {
	return yield *this.status(taskId, constants.task.status.IN_PROGRESS);
};

Queue.prototype.next = function *() {
	var task = yield *this.model.findOne({
		status: constants.task.status.QUEUED
	// get those with highest priority (dsc) and get them in order of insertion (asc)
	}, { priority: -1, _id: 1 });

	// only expose required properties
	if (task) {
		task = { _id: task._id, data: task.data };
	}

	return task;
};

Queue.prototype.status = function *(taskId, status, allowedStatuses, error) {
	assert(taskId, 'Missing task id');
	assert(STATUSES.indexOf(status) > -1, 'Invalid status');

	var task, updates = { status: status };

	if (typeof error !== 'undefined') { updates.error = error; }

	if (!allowedStatuses) {
		task = yield *this.model.update(taskId, updates);
		assert(task, 'Task not found');
	} else {
		task = yield *this.findById(taskId);
		assert(task, 'Task not found');
		assert(allowedStatuses.indexOf(task.status) > -1, 'Task status must be one of ' + allowedStatuses);

		task = yield *this.model.update(taskId, { status: status, error: error });
	}

	this.emitTaskEvent(this, task);
	return task;
};

Queue.prototype.cancel = function *(taskId) {
	return yield *this.status(
		taskId,
		constants.task.status.CANCELLED,
		[constants.task.status.PAUSED, constants.task.status.QUEUED]
	);
};

// proxied to underlying model
Queue.prototype.findById = function *() {
	return yield *this.model.findById.apply(this.model, arguments);
};

Queue.prototype.findOne = function *() {
	return yield *this.model.findOne.apply(this.model, arguments);
};

module.exports = Queue;