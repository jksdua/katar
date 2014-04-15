/* jshint node:true */

'use strict';

var _ = require('lodash');

var task = Object.create(null, {
	status: {
		value: {
			PAUSED: 'paused',
			QUEUED: 'queued',
			IN_PROGRESS: 'in progress',
			DONE: 'done',
			FAILED: 'failed',
			CANCELLED: 'cancelled'
		}
	},
	priority: {
		value: {
			HIGH: 10,
			NORMAL: 0,
			LOW: -10
		}
	}
});

var STATUSES = task.statuses = _.values(task.status);

Object.defineProperty(task, 'schema', {
	value: {
		status: { type: 'string', enum: STATUSES, required: true },
		priority: { type: 'number', required: true },
		error: { type: 'string' }, // useful if status is error
		data: { type: 'any' } // data type is upto the queue
	}
});

exports.task = task;