// Automated local TLS fixture. Wave owns the isolated peer process and CA files.
const https = require('https');
const port = process.argv[2], caFile = process.argv[3];
function check(value) { if (!value) throw Error('TLS integration assertion'); }
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
