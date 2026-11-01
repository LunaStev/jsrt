// Permanent Worker regression input. Every JS handle belongs to this realm.
const { parentPort, workerData, threadId, isMainThread } = require('node:worker_threads');
const { marker } = require('./worker_dependency.cjs');

parentPort.postMessage({ ready: true, data: workerData, threadId, isMainThread, marker });
parentPort.on('message', value => {
    parentPort.postMessage(value);
    if (value && value.done) {
        parentPort.close();
    }
});
