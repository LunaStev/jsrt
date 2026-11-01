// Automated local TCP client/server integration, launched by the Wave harness.
const http = require('http');
const fs = require('fs');
const {Readable, Writable, pipeline} = require('stream');
Object.defineProperty(Readable.prototype, 'method', {set() { throw Error('inherited request setter'); }, configurable: true});
Object.defineProperty(Writable.prototype, 'statusCode', {set() { throw Error('inherited response setter'); }, configurable: true});
const promises = require('stream/promises');
const path = process.argv[2] + '/stream-download';
function check(value, message) { if (!value) throw Error(message || 'network integration assertion'); }
const stalledCloses = [];
const server = http.createServer({timeout: 0}, (req, res) => {
    req.on('error', () => {});
    res.on('error', () => {});
    if (req.url === '/json') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({wave: '한글', n: 42}));
    } else if (req.url === '/headers') {
        res.setHeader('Set-Cookie', ['first=1; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/', 'second=2; Path=/']);
        res.setHeader('X-Duplicate', ['one', 'two']);
        res.setHeader('Cookie', ['a=1', 'b=2']);
        res.setHeader('Age', ['1', '2']);
        req.resume();
        res.end('headers');
    } else if (req.url === '/echo') {
        check(req.method === 'POST');
        if (req.headers['content-type']) {
            res.setHeader('X-Upload-Type', req.headers['content-type']);
        }
        pipeline(req, res, error => { if (error) throw error; });
    } else if (req.url === '/count') {
        let size = 0;
        req.on('data', b => { check(b[0] === 42 && b[b.length - 1] === 42); size += b.length; });
        req.on('end', () => res.end(String(size)));
    } else if (req.url === '/stall') {
        stalledCloses.push(new Promise(resolve => res.once('close', resolve)));
        req.resume();
    } else if (req.url === '/redirect') {
        res.statusCode = 303;
        res.setHeader('Location', '/json');
        res.end('redirecting');
    } else if (req.url === '/large') {
        let n = 0;
        const source = new Readable({read() { if (n++ < 96) this.push(Buffer.alloc(65536, 42)); else this.push(null); }});
        pipeline(source, res, error => { if (error) throw error; });
    } else if (req.url === '/file') {
        pipeline(fs.createReadStream(path, {highWaterMark: 8192}), res, error => { if (error) throw error; });
    } else if (req.url === '/pieces') {
        res.write('a');
        setTimeout(() => { res.write(Buffer.from([0,255])); res.end('b'); }, 1);
    } else { res.statusCode = 404; res.end('missing'); }
});
server.listen(0, '127.0.0.1', () => {
    const base = 'http://127.0.0.1:' + server.address().port;
    async function run() {
        const expectedCookies = ['first=1; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/', 'second=2; Path=/'];
        await new Promise((resolve, reject) => {
            const request = http.get(base + '/headers', incoming => {
                incoming.on('error', reject);
                incoming.on('end', () => resolve());
                check(JSON.stringify(incoming.headers['set-cookie']) === JSON.stringify(expectedCookies), 'Node response preserves cookie rows');
                check(incoming.headers['x-duplicate'] === 'one, two', 'Node response combines ordinary duplicate rows');
                check(incoming.headers.cookie === 'a=1; b=2', 'Node response combines Cookie with semicolons');
                check(incoming.headers.age === '1', 'Node singleton headers retain the first value');
                incoming.resume();
            });
            request.on('error', reject);
        });
        const cookieResponse = await fetch(base + '/headers');
        check(JSON.stringify(cookieResponse.headers.getSetCookie()) === JSON.stringify(expectedCookies), 'fetch preserves cookie rows');
        check(cookieResponse.headers.get('x-duplicate') === 'one, two' && cookieResponse.headers.get('age') === '1, 2', 'fetch combines duplicates independently of Node singleton policy');
        const cookiePairs = [...cookieResponse.headers].filter(pair => pair[0] === 'set-cookie');
        check(JSON.stringify(cookiePairs.map(pair => pair[1])) === JSON.stringify(expectedCookies), 'network cookie iteration preserves Expires commas');
        const receivedCookies = cookieResponse.headers.getSetCookie();
        receivedCookies[0] = 'changed';
        check(cookieResponse.headers.getSetCookie()[0] === expectedCookies[0], 'network cookie snapshots cannot mutate private rows');
        let immutableCookies = false;
        try {
            cookieResponse.headers.append('set-cookie', 'forbidden=1');
        } catch (error) {
            immutableCookies = error instanceof TypeError;
        }
        check(immutableCookies && await cookieResponse.text() === 'headers', 'network response headers remain immutable');
        let response = await fetch(new URL(base + '/json'));
        check(response.status === 200 && response.ok && !response.bodyUsed);
        check(response.headers.get('CONTENT-TYPE') === 'application/json' && response.headers.has('content-type'));
        try { response.headers.get.call({}, 'x'); throw Error('bad Headers receiver accepted'); } catch (error) { check(error instanceof TypeError); }
        const parse = JSON.parse; JSON.parse = null;
        const value = await response.json(); JSON.parse = parse;
        check(value.wave === '한글' && value.n === 42 && response.bodyUsed);
        let twice = false; try { await response.text(); } catch (error) { twice = error instanceof TypeError; } check(twice);
        const body = Buffer.from([0,255,128,195,40]);
        response = await fetch(base + '/echo', {method: 'POST', body});
        check(Buffer.from(await response.arrayBuffer()).equals(body));
        const blob = new Blob([new DataView(body.buffer, body.byteOffset, body.byteLength)], {
            type: 'application/octet-stream'
        });
        response = await fetch(base + '/echo', {method: 'POST', body: blob});
        check(response.headers.get('x-upload-type') === 'application/octet-stream', 'Blob upload content type');
        check(Buffer.from(await response.arrayBuffer()).equals(body), 'Blob upload preserves every byte');
        const request = new Request(base + '/echo', {method: 'POST', body: blob});
        const requestCopy = request.clone();
        for (const input of [request, requestCopy]) {
            response = await fetch(input);
            check(Buffer.from(await response.arrayBuffer()).equals(body), 'Request clone uploads independently');
            check(input.bodyUsed, 'fetch consumes Request body');
        }
        const form = new FormData();
        form.append('field', '한글');
        form.append('field', 'second');
        form.append('file', blob, 'bytes.bin');
        response = await fetch(base + '/echo', {method: 'POST', body: form});
        const contentType = response.headers.get('x-upload-type');
        check(contentType && contentType.startsWith('multipart/form-data; boundary='), 'multipart upload content type');
        const boundary = contentType.slice('multipart/form-data; boundary='.length);
        const multipart = Buffer.concat([
            Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="field"\r\n\r\n한글\r\n'),
            Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="field"\r\n\r\nsecond\r\n'),
            Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="bytes.bin"\r\nContent-Type: application/octet-stream\r\n\r\n'),
            body,
            Buffer.from('\r\n--' + boundary + '--\r\n')
        ]);
        check(Buffer.from(await response.arrayBuffer()).equals(multipart), 'multipart framing Unicode duplicate fields and binary upload');
        const webUpload = new ReadableStream({start(controller) {
            controller.enqueue(new TextEncoder().encode('Web 한글'));
            controller.close();
        }});
        response = await fetch(base + '/echo', {method: 'POST', body: webUpload});
        check(await response.text() === 'Web 한글' && !webUpload.locked, 'Web stream upload and reader release');
        const adaptedResponse = await fetch(base + '/pieces');
        const webReader = Readable.toWeb(adaptedResponse.body).getReader();
        const webChunks = [];
        while (true) {
            const next = await webReader.read();
            if (next.done) {
                break;
            }
            webChunks.push(next.value);
        }
        check(Buffer.concat(webChunks).toString('hex') === '6100ff62', 'network body Web adapter');
        response = await fetch(base + '/redirect'); check(response.redirected && response.url.endsWith('/json')); check((await response.json()).n === 42);
        response = await fetch(base + '/redirect', {redirect: 'manual'}); check(response.status === 303); await response.text();
        let redirectError = false; try { await fetch(base + '/redirect', {redirect: 'error'}); } catch { redirectError = true; } check(redirectError);
        response = await fetch(base + '/missing'); check(response.status === 404 && !response.ok && await response.text() === 'missing');
        response = await fetch(base + '/pieces'); check(Buffer.from(await response.arrayBuffer()).toString('hex') === '6100ff62');
        response = await fetch(base + '/large');
        await promises.pipeline(response.body, fs.createWriteStream(path, {highWaterMark: 4096}));
        let length = 0;
        response = await fetch(base + '/file');
        await promises.pipeline(response.body, new Writable({highWaterMark: 4096, write(chunk, encoding, done) {
            check(chunk[0] === 42 && chunk[chunk.length - 1] === 42); length += chunk.length; setTimeout(done, 1);
        }}));
        check(length === 96 * 65536);
        response = await fetch(base + '/count', {method: 'POST', body: fs.createReadStream(path, {highWaterMark: 8192})});
        check(await response.text() === String(96 * 65536), 'large streamed fetch upload');
        await new Promise((resolve, reject) => {
            const request = http.request(base + '/count', {method: 'POST'}, incoming => {
                incoming.on('error', reject); const chunks = [];
                incoming.on('data', b => chunks.push(b));
                incoming.on('end', () => { check(Buffer.concat(chunks).toString() === String(96 * 65536)); resolve(); });
            });
            request.on('error', reject);
            pipeline(fs.createReadStream(path), request, error => { if (error) reject(error); });
        });
        let timedOut = false;
        try { await fetch(base + '/stall', {timeout: 30}); } catch (error) { timedOut = error.code === 'ETIMEDOUT' && error.curlCode === 28; }
        check(timedOut, 'transfer timeout');
        const controller = new AbortController(), reason = Error('cancel pending headers');
        const pending = fetch(base + '/stall', {signal: controller.signal});
        setTimeout(() => controller.abort(reason), 5);
        let aborted = false; try { await pending; } catch (error) { aborted = error === reason; }
        check(aborted, 'active transfer abort');
        check(stalledCloses.length === 2, 'both stalled requests reached the server');
        // Peer timeout/abort must release the server even with idle expiry off.
        await Promise.all(stalledCloses);
        await new Promise((resolve, reject) => {
            const c = new AbortController(), why = Error('abort in response callback');
            const request = http.get(base + '/json', {signal: c.signal}, incoming => {
                let ended = false;
                incoming.on('end', () => { ended = true; });
                incoming.on('error', error => { check(error === why, 'body abort reason'); });
                incoming.on('close', () => { check(!ended, 'cancelled response emitted end'); resolve(); });
                c.abort(why); incoming.resume();
            });
            request.on('error', error => { if (error.name !== 'AbortError') reject(error); });
        });
        await new Promise((resolve, reject) => {
            const request = http.request(base + '/echo', {method: 'POST'}, incoming => {
                check(incoming.statusCode === 200);
                const chunks = []; incoming.on('data', b => chunks.push(b)); incoming.on('error', reject);
                incoming.on('end', () => { check(Buffer.concat(chunks).equals(body)); resolve(); });
            });
            request.on('error', reject); request.write(body.subarray(0,2)); request.end(body.subarray(2));
        });
        server.close(() => console.log('network integration passed'));
    }
    run().catch(error => { server.close(); throw error; });
});
