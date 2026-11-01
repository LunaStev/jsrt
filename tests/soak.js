// Permanent mixed-load regression. Wave controls duration through a stop file.
'use strict';
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const streams = require('stream');
const {pipeline} = require('stream/promises');
const {Worker} = require('worker_threads');
const root = process.argv[2];
let batches = 0;
let lanes = 0;
let transferred = 0;
let workers = 0;
let ticks = 0;
let aborts = 0;
let maximumLatencyMs = 0;
const latencyBoundsMs = [1, 5, 10, 50, 250];
const latencyHistogram = [0, 0, 0, 0, 0, 0];
const payload = Buffer.alloc(32768, 42);
const digest = crypto.createHash('sha256').update(payload).digest('hex');
const ticker = setInterval(() => ticks++, 1);
function check(ok, message) {
    if (!ok) {
        throw Error(message);
    }
}
const server = http.createServer({keepAlive: true, timeout: 5000}, (request, response) => {
    request.on('error', () => {});
    response.on('error', () => {});
    if (request.url === '/stall') {
        request.resume();
    } else {
        streams.pipeline(request, response, error => {
            if (error && error.code !== 'ECONNRESET') {
                response.destroy(error);
            }
        });
    }
});

async function lane(index, base) {
    const started = Date.now();
    const path = root + '/lane-' + index;
    const handle = await fs.promises.open(path, 'w+');
    try {
        await handle.writeFile(payload);
        const bytes = Buffer.alloc(payload.length);
        const result = await handle.read(bytes, 0, bytes.length, 0);
        check(result.bytesRead === bytes.length && bytes.equals(payload), 'descriptor data');
        check((await handle.stat()).size === bytes.length, 'descriptor stat');
        if (batches % 50 === 0) {
            await handle.sync();
        }
    } finally {
        await handle.close();
    }
    const response = await fetch(base + '/echo', {method: 'POST', body: fs.createReadStream(path)});
    const received = Buffer.from(await response.arrayBuffer());
    check(received.equals(payload), 'HTTP streamed echo');
    transferred += received.length;
    check(crypto.createHash('sha256').update(received).digest('hex') === digest, 'digest');
    // Abandoned hash state exercises engine-owned native finalization.
    crypto.createHash('sha256').update(received);
    let total = 0;
    const source = new streams.Readable({objectMode: true, read() {
        for (let n = 0; n < 16; n++) {
            this.push(n);
        }
        this.push(null);
    }});
    const transform = new streams.Transform({objectMode: true, highWaterMark: 2,
        transform(value, encoding, done) {
            done(null, value * 2);
        }
    });
    const sink = new streams.Writable({objectMode: true, highWaterMark: 2,
        write(value, encoding, done) {
            total += value;
            done();
        }
    });
    await pipeline(source, transform, sink);
    check(total === 240, 'object pipeline');
    try {
        await fs.promises.open(root + '/absent');
        throw Error('missing path accepted');
    } catch (error) {
        check(error.code === 'ENOENT', 'missing path error');
    }
    await fs.promises.unlink(path);
    lanes++;
    const elapsed = Date.now() - started;
    maximumLatencyMs = Math.max(maximumLatencyMs, elapsed);
    let bucket = latencyBoundsMs.findIndex(bound => elapsed <= bound);
    if (bucket < 0) {
        bucket = latencyBoundsMs.length;
    }
    latencyHistogram[bucket]++;
}

async function workerRound() {
    await new Promise((resolve, reject) => {
        let message = false;
        const w = new Worker("const {parentPort,workerData}=require('worker_threads');parentPort.postMessage(workerData+1)", {
            eval: true, workerData: 41
        });
        w.on('message', value => {
            check(value === 42, 'worker message');
            message = true;
        });
        w.on('error', reject);
        w.on('exit', code => {
            if (code === 0 && message) {
                resolve();
            } else {
                reject(Error('worker exit'));
            }
        });
    });
    workers++;
}

async function run() {
    const base = 'http://127.0.0.1:' + server.address().port;
    const stopped = () => fs.existsSync(root + '/stop');
    async function continuousLane(index) {
        while (!stopped()) {
            await lane(index, base);
            batches = Math.floor(lanes / 4);
        }
    }
    async function cancellationAndWorkers() {
        while (!stopped()) {
            const c = new AbortController();
            const reason = Error('soak abort');
            const pending = fetch(base + '/stall', {signal: c.signal});
            setTimeout(() => c.abort(reason), 2);
            try {
                await pending;
                throw Error('abort accepted');
            } catch (error) {
                check(error === reason, 'abort identity');
            }
            aborts++;
            // Four independent contexts overlap the continuously running I/O lanes.
            await Promise.all([workerRound(), workerRound(), workerRound(), workerRound()]);
            fs.writeFileSync(root + '/checkpoint', String(batches));
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    await Promise.all([continuousLane(0), continuousLane(1), continuousLane(2), continuousLane(3), cancellationAndWorkers()]);
    clearInterval(ticker);
    await new Promise(resolve => server.close(resolve));
    check(batches > 0 && ticks > 0, 'load made no progress');
    const result = {batches, lanes, transferred, workers, aborts, ticks, maximumLatencyMs, latencyBoundsMs, latencyHistogram};
    fs.writeFileSync(root + '/done', JSON.stringify(result));
    console.log(JSON.stringify(result));
    await new Promise(resolve => setTimeout(resolve, 1000));
}
server.on('error', error => {
    clearInterval(ticker);
    console.error(error);
    process.exitCode = 1;
});
server.listen(0, '127.0.0.1', () => {
    run().catch(error => {
        clearInterval(ticker);
        server.closeAllConnections();
        server.close();
        console.error(error);
        process.exitCode = 1;
    });
});
