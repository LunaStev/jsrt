// Automated TCP integration fixture, launched and cleaned up by test.wave.
const http = require('node:http');
const fs = require('node:fs');
let count = 0;
function check(value) { if (!value) throw new Error('HTTP fixture assertion failed'); }
const server = http.createServer((req, res) => {
    check(req.headers.host === 'localhost');
    check(req.httpVersion === '1.1');
    check(!res.headersSent);
    if (req.url === '/utf8') {
        check(req.method === 'GET');
        res.statusCode = 201;
        res.setHeader('X-Test', 'one').setHeader('x-test', 'two');
        check(res.getHeader('X-TEST') === 'two');
        check(res.hasHeader('x-test'));
        const snapshot = res.getHeaders();
        check(Object.getPrototypeOf(snapshot) === null);
        snapshot['x-test'] = 'other';
        check(res.getHeader('x-test') === 'two');
        res.setHeader('x-remove', 'value');
        res.removeHeader('X-REMOVE');
        check(!res.hasHeader('x-remove'));
        res.setHeader('x-reused', 'safe');
        check(res.getHeader('x-reused') === 'safe');
        res.removeHeader('x-reused');
        res.setHeader('x-a', 'a');
        res.setHeader('x-b', 'b');
        res.setHeader('x-c', 'c');
        res.removeHeader('X-B');
        check(res.getHeader('x-c') === 'c');
        res.setHeader('x-d', 'd');
        res.removeHeader('x-a');
        check(res.getHeader('x-c') === 'c' && res.getHeader('x-d') === 'd');
        res.removeHeader('x-c');
        res.removeHeader('x-d');
        for (const [name, value] of [['bad\r\nname', 'x'], ['x', 'bad\r\nvalue'], ['Content-Length', '99'], ['Transfer-Encoding', 'chunked']]) {
            let rejected = false;
            try { res.setHeader(name, value); } catch (e) { rejected = e instanceof TypeError; }
            check(rejected);
        }
        res.end('한글');
        check(res.headersSent);
        let rejected = false;
        try { res.end('second'); } catch (e) { rejected = e instanceof Error; }
        check(rejected);
    } else if (req.url === '/chunked') {
        const chunks = [];
        req.on('data', b => chunks.push(b));
        req.on('end', () => { const body = Buffer.concat(chunks); check(req.method === 'POST' && body.toString() === 'abcde'); res.end(body); });
    } else if (req.url === '/head') {
        check(req.method === 'HEAD');
        res.end('한글');
    } else if (req.url === '/empty') {
        res.statusCode = 204;
        res.end('suppressed');
    } else if (req.url === '/reentrant') {
        Object.defineProperty(res, 'statusCode', {get() {
            let rejected = false;
            try { res.end('recursive'); } catch (e) { rejected = e instanceof Error; }
            check(rejected);
            return 202;
        }});
        res.end('outer');
    } else if (req.url === '/async') {
        fs.promises.readFile(__filename, 'utf8').then(text => {
            check(text.includes('Automated TCP integration fixture'));
            setTimeout(() => res.end('async'), 1);
        });
    } else if (req.url === '/binary') {
        const chunks = [];
        req.on('data', b => chunks.push(b));
        req.on('end', () => {
            const body = Buffer.concat(chunks); check(body.toString('hex') === 'ff8000c328');
            const framed = Buffer.concat([Buffer.from([42]), body, Buffer.from([43])]);
            res.end(new Uint8Array(framed.buffer, framed.byteOffset + 1, body.length));
        });
    } else { throw new Error('unexpected request target'); }
    if (++count === 7) {
        server.close(() => console.log('closed after seven requests'));
    }
});
server.listen(0, '127.0.0.1', function () {
    check(this === server && server.listening);
    fs.writeFileSync(process.argv[2], String(server.address().port));
});
