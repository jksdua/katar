/* jshint node:true */
/* globals describe, beforeEach, it */

'use strict';

var co = require('co');
var chai = require('chai');
var should = chai.should();

describe('#queueServer', function() {
	var queueServer = require(__dirname + '/..');
	var qs;

	beforeEach(function() {
		qs = queueServer();
	});

	describe('#queue', function() {
		var queue;

		beforeEach(function() {
			queue = qs.queue('test', { persistent: true });
		});

		describe('#todo', function() {
			it('--- events ---');
			it('--- timeout ---');
			it('--- persistence ---');
			it('--- custom adapter ---');
		});

		describe('#insert', function() {
			it('should work for single task', function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data' });
					task = yield *queue.findById(task._id);
					task.should.eql({
						_id: task._id,
						data: 'data',
						status: 'queued',
						priority: 0
					});
				})(done);
			});

			it('should work for multiple tasks', function(done) {
				co(function *() {
					var tasks = yield *queue.insert(
						[{ data: 'data1' }, { data: 'data2' }]);
					tasks.length.should.equal(2);
					tasks[0].data.should.equal('data1');
					tasks[1].data.should.equal('data2');
				})(done);
			});

			it('should allow tasks adding their own priority', function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data', priority: 5 });
					var taskId = task._id;
					task = yield *queue.findById(taskId);
					task.should.eql({
						_id: taskId,
						data: 'data',
						status: 'queued',
						priority: 5
					});
				})(done);
			});

			it('should allow tasks adding their own status', function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data', status: 'paused' });
					var taskId = task._id;
					task = yield *queue.findById(taskId);
					task.should.eql({
						_id: taskId,
						data: 'data',
						status: 'paused',
						priority: 0
					});
				})(done);
			});

			describe('#beforeInsert', function() {
				it('should not insert if an error is thrown', function(done) {
					queue.beforeInsert = function *(task) {
						task.should.eql({ data: 'data' });
						throw new Error('boom');
					};

					co(function *() {
						return yield *queue.insert({ data: 'data' });
					})(function(err) {
						err.message.should.equal('boom');
						done();
					});
				});

				it('should insert if no error is thrown', function(done) {
					queue.beforeInsert = function *(task) {
						task.should.eql({ data: 'data' });
					};

					co(function *() {
						return yield *queue.insert({ data: 'data' });
					})(function(err, task) {
						should.not.exist(err);
						should.exist(task);
						done();
					});
				});
			});
		});

		describe('#done', function() {
			var taskId;

			beforeEach(function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data' });
					taskId = task._id;
				})(done);
			});

			it('should update task', function(done) {
				co(function *() {
					var task = yield *queue.done(taskId);
					task.should.eql({ _id: taskId, data: 'data', status: 'done', priority: 0 });
				})(done);
			});
		});

		describe('#next', function() {
			describe('#tasks remaining', function() {
				var tasks = [
					{ data: 'data1', status: 'done' },
					{ data: 'data2', status: 'paused' },
					{ data: 'data3', status: 'queued' },
					{ data: 'data4', status: 'queued' }
				];

				beforeEach(function(done) {
					co(function *() {
						tasks = yield *queue.insert(tasks);
					})(done);
				});

				it('should return a task', function(done) {
					co(function *() {
						var task = yield *queue.next();
						task.should.eql({ _id: tasks[2]._id, data: tasks[2].data });
					})(done);
				});
			});

			describe('#no tasks left', function() {
				describe('#empty db', function() {
					it('should not return a task', function(done) {
						co(function *() {
							var task = yield *queue.next();
							should.not.exist(task);
						})(done);
					});
				});

				describe('#only uneligible tasks', function() {
					var tasks = [
						{ data: 'data1', status: 'done' },
						{ data: 'data2', status: 'paused' },
						{ data: 'data3', status: 'failed' },
						{ data: 'data4', status: 'paused' }
					];

					beforeEach(function(done) {
						co(function *() {
							return yield *queue.insert(tasks);
						})(done);
					});

					it('should not return a task', function(done) {
						co(function *() {
							var task = yield *queue.next();
							should.not.exist(task);
						})(done);
					});
				});
			});
		});

		describe('#started', function() {
			var taskId;

			beforeEach(function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data' });
					taskId = task._id;
				})(done);
			});

			it('should update the task', function(done) {
				co(function *() {
					var task = yield *queue.started(taskId);
					task.status.should.equal('in progress');

					task = yield *queue.findById(taskId);
					task.status.should.equal('in progress');
				})(done);
			});
		});

		describe('#status', function() {
			var taskId;

			beforeEach(function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data' });
					taskId = task._id;
				})(done);
			});

			it('should throw an error if status is invalid', function(done) {
				co(function *() {
					yield *queue.status(taskId, 'wateva');
				})(function(err) {
					err.message.should.contain('status');
					done();
				});
			});

			it('should throw an error if taskId is invalid', function(done) {
				co(function *() {
					yield *queue.status(taskId + 'wateva', 'in progress');
				})(function(err) {
					err.message.should.contain('not found');
					done();
				});
			});

			it('should update the task if status is valid', function(done) {
				co(function *() {
					var task = yield *queue.status(taskId, 'paused');
					task.status.should.equal('paused');

					task = yield *queue.findById(taskId);
					task.status.should.equal('paused');
				})(done);
			});
		});

		describe('#cancel', function() {
			var taskId;

			beforeEach(function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data' });
					taskId = task._id;
				})(done);
			});

			it('should thrown an error if taskId is not valid', function(done) {
				co(function *() {
					yield *queue.cancel(taskId + 'wateva');
				})(function(err) {
					err.message.should.contain('not found');
					done();
				});
			});

			it('should thrown an error if current task status is invalid', function(done) {
				co(function *() {
					// setup
					yield *queue.status(taskId, 'in progress');

					// actual assertion
					yield *queue.cancel(taskId);
				})(function(err) {
					err.message.should.contain('status');
					done();
				});
			});

			it('should work', function(done) {
				co(function *() {
					var task = yield *queue.cancel(taskId);
					task.status.should.equal('cancelled');

					task = yield *queue.findById(taskId);
					task.status.should.equal('cancelled');
				})(done);
			});
		});

		describe('#failed', function() {
			var taskId;

			beforeEach(function(done) {
				co(function *() {
					var task = yield *queue.insert({ data: 'data' });
					taskId = task._id;
				})(done);
			});

			it('should fail if no error is given', function(done) {
				var errorCaught = false;
				co(function *() {
					try {
						yield *queue.failed(taskId, null);
					} catch(err) {
						errorCaught = true;
						err.message.should.equal('Missing error');
					}

					var task = yield *queue.findById(taskId);
					task.status.should.equal('queued');

					errorCaught.should.equal(true);
				})(done);
			});

			it('should fail if error is an object', function(done) {
				var errorCaught = false;
				co(function *() {
					try {
						yield *queue.failed(taskId, { error: 'boom' });
					} catch(err) {
						errorCaught = true;
						err.message.should.equal('Missing error');
					}

					var task = yield *queue.findById(taskId);
					task.status.should.equal('queued');

					errorCaught.should.equal(true);
				})(done);
			});

			it('should work if error is a string', function(done) {
				co(function *() {
					var task = yield *queue.failed(taskId, 'woot');
					task.error.should.equal('woot');
					task.status.should.equal('failed');
				})(done);
			});

			it('should work if an error is an error', function(done) {
				co(function *() {
					var task = yield *queue.failed(taskId, new Error('woot'));
					task.error.should.equal('Error: woot');
					task.status.should.equal('failed');
				})(done);
			});
		});
	});
});