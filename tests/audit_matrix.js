// Permanent diagnostic inventory. Gaps are findings, not conformance passes.
// Execute only with jsrt/JSC: ./target/native/jsrt tests/audit_matrix.js
const rows = [];
function record(id, area, target, matches, observed, priority = 'P2') {
    rows.push({id, area, priority, target, status: matches ? 'confirmed' : 'gap', observed});
}
async function behavior(id, area, target, run, priority = 'behavior') {
    try {
        const result = await run();
        record(id, area, target, result.matches, result.observed, priority);
    } catch (error) {
        record(id, area, target, false, {error: String(error)}, priority);
    }
}
function methods(id, name, owner, names, priority = 'P2') {
    const missing = names.filter(key => typeof owner[key] !== 'function');
    record(id, name, names.join(', '), missing.length === 0, {missing}, priority);
}
async function main() {
    const globals = ['ReadableStream', 'WritableStream', 'TransformStream', 'TextEncoder', 'TextDecoder',
        'TextEncoderStream', 'TextDecoderStream', 'File', 'Event', 'EventTarget', 'DOMException',
        'CompressionStream', 'DecompressionStream', 'MessageChannel', 'MessagePort', 'WebSocket',
        'performance', 'crypto', 'setImmediate', 'clearImmediate', 'atob', 'btoa'];
    for (const name of globals) {
        const actual = typeof globalThis[name];
        record('global.' + name, 'globals', 'global available', actual !== 'undefined', actual);
    }
    const modules = ['stream/web', 'timers/promises', 'net', 'tls', 'dns', 'dns/promises', 'http2',
        'zlib', 'async_hooks', 'perf_hooks', 'readline', 'tty', 'module', 'test'];
    for (const name of modules) {
        try {
            require('node:' + name);
            record('module.' + name, 'modules', 'builtin available', true, 'available');
        } catch (error) {
            record('module.' + name, 'modules', 'builtin available', false, error.code || String(error));
        }
    }
    const fs = require('fs');
    const stream = require('stream');
    const crypto = require('crypto');
    const http = require('http');
    const worker = require('worker_threads');
    methods('fs.sync', 'fs', fs, ['openSync', 'closeSync', 'readSync', 'writeSync', 'copyFileSync',
        'cpSync', 'rmSync', 'chmodSync', 'chownSync', 'mkdtempSync', 'readlinkSync', 'symlinkSync', 'watch']);
    methods('fs.promises', 'fs/promises', fs.promises, ['copyFile', 'cp', 'rm', 'chmod', 'chown',
        'mkdtemp', 'readlink', 'symlink', 'watch', 'realpath']);
    methods('fs.callbacks', 'fs', fs, ['readFile', 'writeFile', 'stat', 'readdir', 'open', 'close']);
    methods('stream.readable', 'stream', stream.Readable, ['from', 'fromWeb', 'toWeb']);
    methods('stream.prototype', 'stream', stream.Readable.prototype, ['unshift', 'isPaused', 'wrap', 'iterator', 'map']);
    methods('crypto.functions', 'crypto', crypto, ['pbkdf2', 'scrypt', 'generateKeyPair', 'createSign',
        'createVerify', 'createCipheriv', 'createDecipheriv', 'createSecretKey', 'getHashes']);
    record('crypto.webcrypto', 'crypto', 'subtle Web Crypto', !!(crypto.webcrypto && crypto.webcrypto.subtle),
        typeof crypto.webcrypto);
    methods('util.functions', 'util', require('util'), ['format', 'inspect', 'callbackify', 'deprecate']);
    methods('assert.functions', 'assert', require('assert'), ['deepStrictEqual', 'notDeepStrictEqual', 'rejects', 'doesNotReject', 'match']);
    methods('path.functions', 'path', require('path'), ['toNamespacedPath', 'matchesGlob']);
    methods('url.functions', 'url', require('url'), ['fileURLToPath', 'pathToFileURL', 'domainToASCII', 'domainToUnicode']);
    methods('os.functions', 'os', require('os'), ['cpus', 'networkInterfaces', 'userInfo', 'availableParallelism']);
    methods('process.functions', 'process', process, ['exit', 'chdir', 'hrtime', 'uptime', 'memoryUsage', 'kill']);
    methods('http.functions', 'http', http, ['Agent', 'Server', 'ServerResponse', 'IncomingMessage']);
    methods('worker.functions', 'worker_threads', worker, ['MessageChannel', 'MessagePort', 'markAsUntransferable']);
    methods('querystring.functions', 'querystring', require('querystring'), ['stringify', 'escape', 'unescape']);
    methods('buffer.functions', 'buffer', Buffer.prototype, ['swap16', 'swap32', 'swap64', 'compare', 'toJSON']);
    methods('headers.functions', 'Headers', Headers.prototype, ['getSetCookie']);
    methods('response.functions', 'Response', Response.prototype, ['blob', 'bytes', 'formData']);
    methods('response.static', 'Response', Response, ['error', 'redirect']);
    methods('blob.functions', 'Blob', Blob.prototype, ['stream']);
    record('stream.asyncIterator', 'stream', 'Symbol.asyncIterator',
        typeof stream.Readable.prototype[Symbol.asyncIterator] === 'function',
        typeof stream.Readable.prototype[Symbol.asyncIterator]);
    record('util.promisify.custom', 'util', 'custom promisify symbol', typeof require('util').promisify.custom === 'symbol',
        typeof require('util').promisify.custom);

    await behavior('json.reviverSource', 'JSON behavior', 'reviver receives original primitive source', () => {
        let actual;
        JSON.parse('9007199254740993', function(key, value, context) {
            if (key === '') {
                actual = context && context.source;
            }
            return value;
        });
        return {matches: actual === '9007199254740993', observed: actual === undefined ? 'undefined' : actual};
    });
    await behavior('response.nullBody', 'Web behavior', 'null body remains null and reusable', async () => {
        const response = new Response(null);
        const before = response.body === null;
        await response.text();
        let twice = false;
        try {
            twice = await response.text() === '';
        } catch (_) {
        }
        return {matches: before && !response.bodyUsed && twice,
            observed: {nullBody: before, bodyUsed: response.bodyUsed, repeatConsumption: twice}};
    });
    await behavior('request.defaultSignal', 'Web behavior', 'every Request has an AbortSignal', () => {
        const request = new Request('https://example.invalid/');
        return {matches: request.signal instanceof AbortSignal, observed: typeof request.signal};
    });
    await behavior('request.followSignal', 'Web behavior', 'Request has a dependent signal', () => {
        const controller = new AbortController();
        const request = new Request('https://example.invalid/', {signal: controller.signal});
        const dependent = request.signal !== controller.signal;
        controller.abort('reason');
        return {matches: dependent && request.signal.aborted && request.signal.reason === 'reason',
            observed: {dependent, aborted: request.signal.aborted}};
    });
    await behavior('request.noBodyGet', 'Web behavior', 'copy a GET Request without fabricating a body', () => {
        const source = new Request('https://example.invalid/');
        const copy = new Request(source);
        return {matches: copy.method === 'GET', observed: copy.method};
    });
    await behavior('response.readonlyStatus', 'Web behavior', 'Response metadata is read-only', () => {
        const response = new Response('x', {status: 201});
        try {
            response.status = 599;
        } catch (_) {
        }
        return {matches: response.status === 201, observed: response.status};
    });
    await behavior('request.credentials', 'Web behavior', 'Request rejects URL credentials', () => {
        let rejected = false;
        try {
            new Request('https://user:password@example.invalid/');
        } catch (_) {
            rejected = true;
        }
        return {matches: rejected, observed: {rejected}};
    });
    await behavior('request.emptyGetFetch', 'Web behavior', 'fetching a body-less GET does not mark a body as consumed', async () => {
        const request = new Request('https://example.invalid/');
        const reason = {};
        const controller = new AbortController();
        controller.abort(reason);
        let aborted = false;
        try {
            await fetch(request, {signal: controller.signal});
        } catch (error) {
            aborted = error === reason;
        }
        return {matches: aborted && !request.bodyUsed, observed: {aborted, bodyUsed: request.bodyUsed}};
    });
    await behavior('web.toStringTag', 'Web behavior', 'Blob brand tag', () => {
        const actual = Object.prototype.toString.call(new Blob());
        return {matches: actual === '[object Blob]', observed: actual};
    });
    await behavior('blob.dataView', 'Web behavior', 'Blob accepts ArrayBufferView including DataView', async () => {
        const buffer = new ArrayBuffer(3);
        new Uint8Array(buffer).set([97, 98, 99]);
        const actual = await new Blob([new DataView(buffer)]).text();
        return {matches: actual === 'abc', observed: actual};
    });
    await behavior('blob.typedView', 'Web behavior', 'Blob copies the bytes of non-U8 typed views', () => {
        const actual = new Blob([new Uint16Array([258])]).size;
        return {matches: actual === 2, observed: actual};
    });
    await behavior('blob.iterable', 'Web behavior', 'Blob accepts general iterable parts', async () => {
        const actual = await new Blob(new Set(['a', 'b'])).text();
        return {matches: actual === 'ab', observed: actual};
    });
    await behavior('web.receiverBrands', 'Web behavior', 'Web getters and methods reject unrelated branded receivers', () => {
        const response = new Response('x');
        const blob = new Blob(['x']);
        let rejected = 0;
        for (const run of [
            () => Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get.call(response),
            () => Blob.prototype.slice.call(response),
            () => Response.prototype.clone.call(blob)
        ]) {
            try {
                run();
            } catch (error) {
                if (error instanceof TypeError) {
                    rejected++;
                }
            }
        }
        return {matches: rejected === 3, observed: {rejected, required: 3}};
    });
    await behavior('response.cloneError', 'Web behavior', 'cloning an errored body does not revive buffered content', async () => {
        const response = new Response('x');
        const reason = new Error('body failure');
        response.body.on('error', () => {});
        response.body.destroy(reason);
        try {
            const value = await response.clone().text();
            return {matches: false, observed: {revived: value}};
        } catch (error) {
            return {matches: error === reason, observed: {preservedError: error === reason}};
        }
    });
    await behavior('headers.iterable', 'Web behavior', 'Headers accepts general iterable pairs', () => {
        const actual = new Headers(new Map([['x', 'y']])).get('x');
        return {matches: actual === 'y', observed: actual};
    });
    await behavior('headers.liveIterator', 'Web behavior', 'Headers iterator observes mutations', () => {
        const headers = new Headers({a: '1'});
        const iterator = headers.keys();
        iterator.next();
        headers.append('b', '2');
        const result = iterator.next();
        return {matches: !result.done && result.value === 'b', observed: result};
    });
    await behavior('formData.liveIterator', 'Web behavior', 'FormData iterator observes mutations', () => {
        const form = new FormData();
        form.append('a', '1');
        const iterator = form.keys();
        iterator.next();
        form.append('b', '2');
        const result = iterator.next();
        return {matches: !result.done && result.value === 'b', observed: result};
    });
    await behavior('formData.thisArg', 'Web behavior', 'forEach preserves a primitive thisArg', () => {
        const form = new FormData();
        form.append('a', '1');
        let actual;
        form.forEach(function () {
            'use strict';
            actual = this;
        }, 7);
        return {matches: actual === 7, observed: typeof actual === 'number' ? actual : typeof actual};
    });
    await behavior('formData.fieldSize', 'Web behavior', 'field text can use the documented multipart buffer budget', () => {
        const form = new FormData();
        form.append('field', 'x'.repeat(8192));
        const actual = form.get('field').length;
        return {matches: actual === 8192, observed: actual};
    });
    await behavior('stream.halfOpen', 'stream behavior', 'allowHalfOpen:false ends the writable side', async () => {
        const duplex = new stream.Duplex({
            allowHalfOpen: false,
            read() {
                this.push(null);
            },
            write(chunk, encoding, done) {
                done();
            }
        });
        duplex.resume();
        await new Promise(resolve => setTimeout(resolve, 2));
        const actual = duplex.writableFinished;
        duplex.destroy();
        return {matches: actual, observed: {writableFinished: actual}};
    });
    await behavior('stream.autoDestroy', 'stream behavior', 'Writable auto-destroys after finish by default', async () => {
        const writable = new stream.Writable({
            write(chunk, encoding, done) {
                done();
            }
        });
        writable.end();
        await new Promise(resolve => setTimeout(resolve, 2));
        const actual = writable.destroyed;
        writable.destroy();
        return {matches: actual, observed: actual};
    });
    await behavior('stream.readableEvent', 'stream behavior', 'readable event drives paused consumption', async () => {
        const readable = new stream.Readable({
            read() {
                this.push('x');
                this.push(null);
            }
        });
        let called = false;
        readable.on('readable', () => {
            called = true;
            readable.read();
        });
        await new Promise(resolve => setTimeout(resolve, 2));
        readable.destroy();
        return {matches: called, observed: called};
    });
    await behavior('stream.duplexInstance', 'stream behavior', 'Duplex is recognized as Writable', () => {
        const actual = new stream.Duplex() instanceof stream.Writable;
        return {matches: actual, observed: actual};
    });
    await behavior('stream.encodingOption', 'stream behavior', 'Readable encoding option selects UTF-8 strings', async () => {
        const readable = new stream.Readable({
            encoding: 'utf8',
            read() {
                this.push('x');
                this.push(null);
            }
        });
        let actual;
        readable.on('data', value => {
            actual = typeof value;
        });
        await new Promise(resolve => setTimeout(resolve, 2));
        return {matches: actual === 'string', observed: actual};
    });
    await behavior('timer.ref', 'event loop', 'timer handles implement ref/unref', () => {
        const timer = setTimeout(() => {}, 50);
        const actual = {type: typeof timer, unref: typeof timer.unref, ref: typeof timer.ref};
        clearTimeout(timer);
        return {matches: actual.unref === 'function' && actual.ref === 'function', observed: actual};
    });
    await behavior('url.dotSegments', 'URL behavior', 'encoded dot path segments normalize', () => {
        const actual = new URL('https://example.invalid/a/%2e%2e/b').pathname;
        return {matches: actual === '/b', observed: actual};
    });
    await behavior('url.file', 'URL behavior', 'URL can represent file: URLs', () => {
        const actual = new URL('file:///tmp/a').protocol;
        return {matches: actual === 'file:', observed: actual};
    });
    await behavior('querystring.stringifyAlias', 'querystring', 'Node-style stringify is available', () => {
        const actual = require('querystring').stringify({a: 'x'});
        return {matches: actual === 'a=x', observed: actual};
    });
    await behavior('control.blobSnapshot', 'implemented control', 'Blob snapshots mutable input', async () => {
        const bytes = Buffer.from('abc');
        const blob = new Blob([bytes]);
        bytes[0] = 122;
        const actual = await blob.text();
        return {matches: actual === 'abc', observed: actual};
    }, 'control');
    await behavior('control.responseOneShot', 'implemented control', 'non-null body rejects repeat consumption', async () => {
        const response = new Response('x');
        const value = await response.text();
        let rejected = false;
        try {
            await response.text();
        } catch (_) {
            rejected = true;
        }
        return {matches: value === 'x' && rejected, observed: {value, rejected}};
    }, 'control');
    await behavior('control.nextTick', 'implemented control', 'nextTick runs before jobs from a host callback', () => new Promise(resolve => {
        setTimeout(() => {
            const order = [];
            process.nextTick(() => order.push('tick'));
            Promise.resolve().then(() => order.push('promise'));
            setTimeout(() => resolve({matches: order.join(',') === 'tick,promise', observed: order}), 1);
        }, 1);
    }), 'control');
    await behavior('control.abortOrder', 'implemented control', 'constructor signal destroys before user abort listeners', () => {
        const controller = new AbortController();
        const writable = new stream.Writable({
            signal: controller.signal,
            write(chunk, encoding, done) {
                done();
            }
        });
        writable.on('error', () => {});
        let actual = false;
        controller.signal.addEventListener('abort', () => {
            actual = writable.destroyed;
        });
        controller.abort();
        return {matches: actual, observed: actual};
    }, 'control');
    for (const row of rows) {
        console.log(JSON.stringify(row));
    }
    const gaps = rows.filter(row => row.status === 'gap');
    const controls = rows.filter(row => row.priority === 'control');
    const summary = {audit: 'implementation inventory', engine: process.versions.jsc, total: rows.length,
        confirmed: rows.length - gaps.length, gaps: gaps.length,
        controlFailures: controls.filter(row => row.status !== 'confirmed').length};
    console.log(JSON.stringify(summary));
    if (summary.controlFailures) {
        process.exitCode = 1;
    }
}
main().catch(error => {
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
