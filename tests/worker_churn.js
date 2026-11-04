// Permanent bounded Worker lifecycle diagnostic; no generated script or input files.
'use strict';
const {Worker} = require('worker_threads');
const fs = require('fs');
const count = Number(process.argv[2] || 1024);
if (!Number.isInteger(count) || count < 0 || count > 16384) {
    throw Error('worker churn count must be an integer from 0 to 16384');
}
function sample(completed) {
    const status = fs.readFileSync('/proc/self/status', 'utf8');
    const rss = /VmRSS:\s+(\d+)/.exec(status);
    console.log('workers', completed, 'rssKiB', rss && rss[1]);
}
async function run() {
    sample(0);
    for (let completed = 0; completed < count;) {
        const width = Math.min(4, count - completed);
        await Promise.all(Array.from({length: width}, () => new Promise((resolve, reject) => {
            let received = false;
            const worker = new Worker("require('worker_threads').parentPort.postMessage(42)", {eval: true});
            worker.on('message', value => {
                if (value !== 42) {
                    reject(Error('invalid Worker result'));
                }
                received = true;
            });
            worker.on('error', reject);
            worker.on('exit', code => {
                if (code === 0 && received) {
                    resolve();
                } else {
                    reject(Error('invalid Worker shutdown'));
                }
            });
        })));
        completed += width;
        if (completed % 256 === 0 || completed === count) {
            sample(completed);
        }
    }
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
