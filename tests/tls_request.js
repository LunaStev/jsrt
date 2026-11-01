// Automated local TLS fixture. Wave owns the isolated peer process and CA files.
const https = require('https');
const port = process.argv[2], caFile = process.argv[3];
function check(value) { if (!value) throw Error('TLS integration assertion'); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stats(url, caFile) {
    const fields = (await (await fetch(url + 'stats', {caFile})).text()).split(' ').map(Number);
    return {received: fields[0], aborted: fields[1]};
}
async function until(predicate) {
    for (let i = 0; i < 600; i++) {
        if (await predicate()) {
            return true;
        }
        await sleep(10);
    }
    return false;
}
async function rejection(promise) {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    return null;
}
// An upload is cancelled after the server has read part of its body. The peer
// counts transport-level aborts, so a rejected Promise alone is not enough.
// Counted cases use endless streams: a finite body that fits in loopback socket
// buffers (Blob and BufferSource are limited to 4 MiB) can be fully sent before
// the abort and then ends in a clean EOF, which is a race rather than a failure.
const endlessBody = () => new ReadableStream({
    pull(controller) {
        controller.enqueue(new Uint8Array(65536).fill(1));
    }
});
async function abortedUploads(url, caFile) {
    const start = await stats(url, caFile);
    let expectedAborts = start.aborted;
    let pulls = 0;
    let cancelled = null;
    const slow = new ReadableStream({
        pull(controller) {
            pulls++;
            return sleep(2).then(() => controller.enqueue(new Uint8Array(4096).fill(7)));
        },
        cancel(reason) {
            cancelled = reason;
        }
    });
    const first = new AbortController();
    const firstReason = Error('slow upload aborted');
    const firstFetch = fetch(url + 'hold-upload', {method: 'POST', body: slow, signal: first.signal, caFile});
    check(await until(async () => (await stats(url, caFile)).received > start.received + 8192));
    first.abort(firstReason);
    check((await rejection(firstFetch)) === firstReason);
    expectedAborts++;
    check(await until(async () => (await stats(url, caFile)).aborted === expectedAborts));
    check(cancelled !== null && pulls > 1);
    // A fast stream keeps socket buffers full, so the peer is still consuming when aborted.
    const fast = new AbortController();
    const fastReason = Error('fast upload aborted');
    const mark = (await stats(url, caFile)).received;
    const fastFetch = fetch(url + 'hold-upload', {method: 'POST', body: endlessBody(), signal: fast.signal, caFile});
    check(await until(async () => (await stats(url, caFile)).received > mark + 65536));
    fast.abort(fastReason);
    check((await rejection(fastFetch)) === fastReason);
    expectedAborts++;
    check(await until(async () => (await stats(url, caFile)).aborted === expectedAborts));
    // Each cancellation must return its client slot: 24 exceeds the 16 slot limit.
    for (let i = 0; i < 24; i++) {
        const controller = new AbortController();
        const reason = Error('repeat ' + i);
        const before = (await stats(url, caFile)).received;
        const pending = fetch(url + 'hold-upload', {method: 'POST', body: endlessBody(), signal: controller.signal,
            caFile});
        check(await until(async () => (await stats(url, caFile)).received > before));
        controller.abort(reason);
        check((await rejection(pending)) === reason);
        expectedAborts++;
        check(await until(async () => (await stats(url, caFile)).aborted === expectedAborts));
    }
    // Completed and aborted uploads run together without crossing results.
    const payload = Buffer.alloc(256 * 1024, 9);
    const controllers = [0, 1, 2].map(() => new AbortController());
    const hold = controllers.map(controller => fetch(url + 'hold-upload', {method: 'POST', body: endlessBody(),
        signal: controller.signal, caFile}));
    const complete = [0, 1, 2].map(() => fetch(url + 'echo', {method: 'POST', body: payload, caFile})
        .then(response => response.arrayBuffer()));
    const concurrentMark = (await stats(url, caFile)).received;
    check(await until(async () => (await stats(url, caFile)).received > concurrentMark + 3 * 65536));
    const reasons = controllers.map((_, index) => Error('concurrent ' + index));
    controllers.forEach((controller, index) => controller.abort(reasons[index]));
    const outcomes = await Promise.all(hold.map(rejection));
    check(outcomes.every((error, index) => error === reasons[index]));
    for (const buffer of await Promise.all(complete)) {
        check(Buffer.from(buffer).equals(payload));
    }
    expectedAborts += 3;
    check(await until(async () => (await stats(url, caFile)).aborted === expectedAborts));
    // A fixed-size Blob is cancelled last: whether the peer sees a truncated body
    // depends on socket buffering, so only the rejection and slot reuse are checked.
    const blobAbort = new AbortController();
    const blobReason = Error('blob upload aborted');
    const blobMark = (await stats(url, caFile)).received;
    const blobFetch = fetch(url + 'hold-upload-slow', {method: 'POST', body: new Blob([new Uint8Array(4 * 1024 * 1024)]),
        signal: blobAbort.signal, caFile});
    check(await until(async () => (await stats(url, caFile)).received > blobMark + 65536));
    blobAbort.abort(blobReason);
    check((await rejection(blobFetch)) === blobReason);
    const after = await fetch(url, {caFile});
    check((await after.text()) === 'TLS peer ready');
}
async function run() {
    const url = 'https://localhost:' + port + '/';
    let response = await fetch(url, {caFile});
    check(response.status === 200 && (await response.text()).length > 0);
    const bytes = Buffer.from([0, 255, 128, 195, 40, 10]);
    response = await fetch(url + 'echo', {method: 'POST', body: bytes, caFile});
    check(Buffer.from(await response.arrayBuffer()).equals(bytes));
    const blob = new Blob([bytes], {type: 'application/octet-stream'});
    response = await fetch(url + 'echo', {method: 'POST', body: blob, caFile});
    check(response.headers.get('x-upload-type') === blob.type);
    check(Buffer.from(await response.arrayBuffer()).equals(bytes));
    const request = new Request(url + 'echo', {method: 'POST', body: blob});
    const requestCopy = request.clone();
    for (const input of [request, requestCopy]) {
        response = await fetch(input, {caFile});
        check(Buffer.from(await response.arrayBuffer()).equals(bytes) && input.bodyUsed);
    }
    const form = new FormData();
    form.append('field', '한글');
    form.append('field', 'second');
    form.append('file', blob, 'bytes.bin');
    response = await fetch(url + 'echo', {method: 'POST', body: form, caFile});
    const contentType = response.headers.get('x-upload-type');
    check(contentType && contentType.startsWith('multipart/form-data; boundary='));
    const boundary = contentType.slice('multipart/form-data; boundary='.length);
    const multipart = Buffer.concat([
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="field"\r\n\r\n한글\r\n'),
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="field"\r\n\r\nsecond\r\n'),
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="bytes.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'),
        bytes,
        Buffer.from('\r\n--' + boundary + '--\r\n')
    ]);
    check(Buffer.from(await response.arrayBuffer()).equals(multipart));
    let produced = 0;
    const upload = new ReadableStream({pull(controller) {
        if (produced++ < 128) {
            controller.enqueue(new Uint8Array(4096).fill(42));
        } else {
            controller.close();
        }
    }});
    response = await fetch(url + 'slow', {method: 'POST', body: upload, caFile});
    const streamed = Buffer.from(await response.arrayBuffer());
    check(streamed.length === 128 * 4096 && streamed.every(value => value === 42) && !upload.locked);
    const abort = new AbortController();
    response = await fetch(url + 'stall-response', {signal: abort.signal, caFile});
    const abortReason = Error('TLS body cancelled');
    const pendingBody = response.text();
    abort.abort(abortReason);
    let bodyCancelled = false;
    try {
        await pendingBody;
    } catch (error) {
        bodyCancelled = error === abortReason;
    }
    check(bodyCancelled);
    await abortedUploads(url, caFile);
    let downgradeRejected = false;
    try {
        await fetch(url + 'downgrade', {caFile});
    } catch (error) {
        downgradeRejected = error.curlCode === 1;
    }
    check(downgradeRejected);
    // More than the client slot limit proves rejected remote headers release ownership.
    for (let i = 0; i < 20; i++) {
        let headerRejected = false;
        try {
            await fetch(url + 'oversized-headers', {caFile});
        } catch (error) {
            headerRejected = error instanceof TypeError || error instanceof RangeError;
        }
        check(headerRejected);
    }
    await new Promise((resolve, reject) => {
        https.get(url + 'oversized-headers', {caFile}, () => reject(Error('oversized headers accepted')))
            .on('error', error => {
                if (error instanceof TypeError || error instanceof RangeError) {
                    resolve();
                } else {
                    reject(error);
                }
            });
    });
    response = await fetch(url, {caFile});
    check((await response.text()) === 'TLS peer ready');
    let rejected = false;
    try { await fetch(url); } catch (error) { rejected = error.curlCode === 60; } check(rejected);
    rejected = false;
    try { await fetch('https://127.0.0.1:' + port + '/', {caFile}); } catch (error) { rejected = error.curlCode === 60; } check(rejected);
    await new Promise((resolve, reject) => {
        https.get(url, {caFile}, incoming => {
            check(incoming.statusCode === 200); let n = 0;
            incoming.on('data', chunk => n += chunk.length); incoming.on('error', reject);
            incoming.on('end', () => { check(n > 0); resolve(); });
        }).on('error', reject);
    });
    console.log('TLS integration passed');
}
run();
