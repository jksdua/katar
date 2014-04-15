Katar
=====

A modular queue server for node.js


Features
--------

- Built on ES6 Harmony generators
- Support for multiple queues
- Completely modular
	- Pluggable data store
	- Process jobs using distributed workers over http, tcp or ipc 


Usage
-----

### Installation

```
npm install katar --save
```

katar and its subcomponents harness the full power of ES6 generators and as such require node *0.11.9* or higher, and must run node with the --harmony flag. If you don't like typing this, add an alias to your shell profile:

```
alias node='node --harmony'
```

### Example

Here's an example of a complex queue server that lets you create multiple queues and use HTTP polling workers

```js
// use mongo for storing tasks
var katarDb = require('katar-mongodb')('localhost/queue');
// initialise a katar server
var katar = require('katar')({ db: katarDb });
// create a data queue that fetches data from a url
var dataQueue = katar.queue('fetch-data');
// create a youtube queue that downloads videos from youtube
	// this queue is persistent - this means once a task is completed, it is retained in the database for historical reasons
var ytQueue = katar.queue('youtube', { persistent: true });

// insert a data task
dataQueue.insert({
	data: 'http://api.hawktrack.com/countries'
});

// insert a data task with high priority
	// supported values - HIGH, MEDIUM, LOW
dataQueue.insert({
	data: 'http://api.hawktrack.com/carriers',
	priority: katar.constants.priority.HIGH
});

// insert a youtube request with an object data type
	// all data types supported by the data adapter are supported as data is passed straight to the adapter
ytQueue.insert({
	data: {
		url: 'https://www.youtube.com/watch?v=fiJm4Zy8i-U',
		res: '720p'
	}
});

// create a http server that workers can poll and fetch jobs
	// server is a koa-framework object
var workerServer = require('katar-worker-http')({
	katar: katar,
	port: 3000
});

// add any custom routes as needed
	// see koa-framework npm module for usage
workerServer.api.v1.router.get('/hello', function *() {
	this.body = { hello: 'world' };
});
```


Modularity
----------

### Data store

The queue system can be backed by any database. Simply create a data adapter that has the required methods

*Available adapters:*

- MemoryDb `npm install katar-memorydb`
- MongoDb `npm install katar-mongodb`

To simplify the task of creating data adapters, a test suite is published that can be used to test the functionality of the adapter meets the needs of katar.

`npm install katar-db-test`


### Workers

Katar allows workers to subscribe for new jobs, poll the server or push new jobs to the server

#### Pull based

Create a server that listens for worker requests. Workers can poll the server on a timely basis to fetch new jobs and report when jobs have been finished.

*Channels:*

- HTTP: `npm install katar-worker-http`


Changelog
---------

### 0.0.1 - Alpha
- Initial release