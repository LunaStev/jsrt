// Permanent regressions for the implementation audit. Run only with jsrt/JSC.
function check(value, message) {
    if (!value) {
        throw new Error(message);
    }
}
function throws(run, message) {
    let rejected = false;
    try {
        run();
    } catch (error) {
        rejected = error instanceof TypeError;
    }
    check(rejected, message);
}
const tick = () => new Promise(resolve => setTimeout(resolve, 1));
async function main() {
    for (const ctor of [Blob, Request, Response, FormData, TextEncoder, TextDecoder, Event, EventTarget, DOMException,
        ReadableStream, WritableStream, TransformStream]) {
        check(typeof ctor === 'function', 'Web constructor function type: ' + ctor.name);
        throws(() => ctor(), 'Web constructor requires new: ' + ctor.name);
    }
    const request = new Request('https://example.invalid/');
    const cookieValues = ['first=1; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/', 'second=2; Path=/'];
    const cookieHeaders = new Headers([
        ['Set-Cookie', cookieValues[0]], ['set-cookie', cookieValues[1]],
        ['X-Duplicate', 'one'], ['x-duplicate', 'two']
    ]);
    const cookieCopy = cookieHeaders.getSetCookie();
    cookieCopy[0] = 'changed';
    cookieCopy.push('third=3');
    check(JSON.stringify(cookieHeaders.getSetCookie()) === JSON.stringify(cookieValues), 'cookie inspection returns an independent array');
    check(cookieHeaders.get('set-cookie') === cookieValues.join(', '), 'combined cookie getter preserves Expires commas');
    check(cookieHeaders.get('x-duplicate') === 'one, two', 'ordinary duplicate header combination');
    check(JSON.stringify(new Headers(cookieHeaders).getSetCookie()) === JSON.stringify(cookieValues), 'Headers copy preserves separate cookies');
    const cookieResponse = new Response('body', {headers: cookieHeaders});
    check(JSON.stringify(cookieResponse.clone().headers.getSetCookie()) === JSON.stringify(cookieValues), 'Response clone preserves separate cookies');
    const entries = [...cookieHeaders];
    check(entries.length === 3 && entries[0][0] === 'set-cookie' && entries[0][1] === cookieValues[0] &&
        entries[1][0] === 'set-cookie' && entries[1][1] === cookieValues[1], 'cookie iteration keeps rows separate and ordered');
    entries[0][1] = 'changed';
    check(cookieHeaders.getSetCookie()[0] === cookieValues[0], 'iterator pairs cannot change private cookies');
    const liveCookies = new Headers([['set-cookie', 'a=1']]);
    const visitedCookies = [];
    liveCookies.forEach((value, name) => {
        visitedCookies.push(value);
        if (value === 'a=1') {
            liveCookies.append(name, 'b=2');
        }
    });
    check(visitedCookies.join('|') === 'a=1|b=2', 'cookie forEach observes appended rows');
    liveCookies.set('Set-Cookie', 'replacement=1');
    check(JSON.stringify(liveCookies.getSetCookie()) === '["replacement=1"]', 'set replaces every cookie row');
    liveCookies.delete('set-cookie');
    check(liveCookies.getSetCookie().length === 0 && !liveCookies.has('set-cookie'), 'delete removes every cookie row');
    throws(() => Headers.prototype.getSetCookie.call({}), 'cookie inspection validates receiver');
    const boundedCookies = new Headers();
    for (let i = 0; i < 64; i++) {
        boundedCookies.append('set-cookie', '');
    }
    let cookieLimit = false;
    try {
        boundedCookies.append('set-cookie', 'overflow=1');
    } catch (error) {
        cookieLimit = error instanceof RangeError;
    }
    check(cookieLimit && boundedCookies.getSetCookie().length === 64, 'cookie row limit preserves previous state');
    const byteBoundedCookies = new Headers([['set-cookie', 'a'.repeat(16370)]]);
    let cookieByteLimit = false;
    try {
        byteBoundedCookies.append('set-cookie', '');
    } catch (error) {
        cookieByteLimit = error instanceof RangeError;
    }
    check(cookieByteLimit && byteBoundedCookies.getSetCookie().length === 1 &&
        byteBoundedCookies.getSetCookie()[0].length === 16370, 'cookie byte limit includes each repeated header name');
    const conversionFailure = Error('cookie conversion');
    try {
        cookieHeaders.append('set-cookie', {toString() { throw conversionFailure; }});
    } catch (error) {
        check(error === conversionFailure, 'cookie conversion preserves original failure');
    }
    check(JSON.stringify(cookieHeaders.getSetCookie()) === JSON.stringify(cookieValues), 'failed cookie conversion leaves private rows intact');
    const copy = new Request(request);
    check(copy.method === 'GET' && copy.body === null, 'bodyless GET copy');
    check(request.signal instanceof AbortSignal && !request.signal.aborted, 'default Request signal');
    check(request.clone().signal !== request.signal, 'clone dependent signal');
    const controller = new AbortController();
    const dependent = new Request('https://example.invalid/', {signal: controller.signal});
    const reason = {cancel: true};
    check(dependent.signal !== controller.signal, 'dependent signal identity');
    controller.abort(reason);
    check(dependent.signal.aborted && dependent.signal.reason === reason, 'dependent signal reason');
    try {
        await fetch(request, {signal: controller.signal});
    } catch (error) {
        check(error === reason, 'pre-aborted fetch reason');
    }
    check(!request.bodyUsed, 'bodyless fetch disturbance');
    throws(() => new Request('https://user:password@example.invalid/'), 'Request credentials');
    const empty = new Response(null);
    check(empty.body === null && !empty.bodyUsed, 'null Response body');
    check(await empty.text() === '' && await empty.text() === '', 'null body repeat consumption');
    check(!empty.bodyUsed, 'null body stays undisturbed');
    const response = new Response('x', {status: 201});
    response.status = 599;
    check(response.status === 201, 'readonly status');
    throws(() => Blob.prototype.slice.call(response), 'Blob slice receiver');
    throws(() => Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get.call(response), 'Blob size receiver');
    throws(() => Response.prototype.clone.call(new Blob()), 'Response clone receiver');
    throws(() => Request.prototype.clone.call(response), 'Request clone receiver');
    const failed = new Response('must not revive');
    const failure = Error('body failed');
    failed.body.on('error', () => {});
    failed.body.destroy(failure);
    const failedCopy = failed.clone();
    let propagated = false;
    try {
        await failedCopy.text();
    } catch (error) {
        propagated = error === failure;
    }
    check(propagated && failedCopy.body.destroyed, 'errored body clone');
    const raw = new Uint8Array([0, 97, 98, 99, 0]);
    const view = new DataView(raw.buffer, 1, 3);
    check(await new Blob([view]).text() === 'abc', 'DataView offset and size');
    const words = new Uint16Array([258]);
    const binary = await new Blob([words]).bytes();
    check(binary.length === 2 && binary[0] === new Uint8Array(words.buffer)[0], 'typed array raw bytes');
    check(await new Blob(new Set(['a', 'b'])).text() === 'ab', 'iterable Blob');
    check(Object.prototype.toString.call(new Blob()) === '[object Blob]', 'Blob tag');
    let closed = false;
    const oversized = {
        *[Symbol.iterator]() {
            try {
                for (let i = 0; i < 65537; i++) {
                    yield 'x';
                }
            } finally {
                closed = true;
            }
        }
    };
    try {
        new Blob(oversized);
    } catch (error) {
        check(error instanceof RangeError, 'iterable bound');
    }
    check(closed, 'iterator closed on limit');
    check(new Headers(new Map([['x', 'y']])).get('x') === 'y', 'iterable Headers');
    const data = new FormData();
    data.append('a', 'x'.repeat(8192));
    check(data.get('a').length === 8192, 'FormData field budget');
    const iterator = data.keys();
    check(iterator.next().value === 'a', 'FormData first entry');
    data.append('b', 'y');
    check(iterator.next().value === 'b', 'FormData live iterator');
    iterator.next();
    data.append('c', 'z');
    check(iterator.next().done, 'FormData exhausted iterator');
    let receiver;
    data.forEach(function() {
        'use strict';
        receiver = this;
    }, 7);
    check(receiver === 7, 'forEach primitive thisArg');
    const stream = require('stream');
    class DerivedWritable extends stream.Writable {}
    const both = new stream.Duplex();
    check(both instanceof stream.Writable && !(both instanceof DerivedWritable), 'Duplex Writable instance semantics');
    check(Object.create(stream.Writable.prototype) instanceof stream.Writable, 'Writable prototype instance fallback');
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
    await tick();
    check(duplex.writableFinished && duplex.destroyed, 'half-open and automatic destruction');
    const readable = new stream.Readable({
        encoding: 'utf8',
        read() {
            this.push(Buffer.from([0xED, 0x95]));
            this.push(Buffer.from([0x9C]));
            this.push(null);
        }
    });
    let output = '';
    readable.on('readable', () => {
        let chunk;
        while ((chunk = readable.read()) !== null) {
            check(typeof chunk === 'string', 'constructor encoding');
            output += chunk;
        }
    });
    await tick();
    check(output === '한' && readable.destroyed, 'readable event and UTF-8 carry');
    const encoder = new TextEncoder();
    check(encoder.encoding === 'utf-8', 'encoder encoding');
    const encoded = encoder.encode('A😀한\uD800');
    check(encoded instanceof Uint8Array && !Buffer.isBuffer(encoded), 'encoder Uint8Array');
    check(new TextDecoder().decode(encoded) === 'A😀한�', 'codec round trip');
    const destination = new Uint8Array(4);
    const progress = encoder.encodeInto('A😀', destination);
    check(progress.read === 1 && progress.written === 1 && destination[0] === 65, 'encodeInto scalar boundary');
    const decoder = new TextDecoder(' UTF-8 ');
    check(decoder.decode(new Uint8Array([239, 187]), {stream: true}) === '', 'split BOM prefix');
    check(decoder.decode(new Uint8Array([191, 237, 149]), {stream: true}) === '', 'BOM and partial scalar');
    check(decoder.decode(new DataView(new Uint8Array([156]).buffer)) === '한', 'incremental DataView decoding');
    check(new TextDecoder('utf8', {ignoreBOM: true}).decode(new Uint8Array([239, 187, 191])) === '\uFEFF', 'ignoreBOM');
    check(new TextDecoder().decode(new Uint8Array([224, 128, 65])) === '��A', 'invalid UTF-8 replacement');
    const fatal = new TextDecoder('utf8', {fatal: true});
    throws(() => fatal.decode(new Uint8Array([255])), 'fatal UTF-8');
    check(fatal.decode(encoder.encode('recovered')) === 'recovered', 'decoder recovers after fatal error');
    throws(() => TextDecoder.prototype.decode.call(encoder), 'decoder receiver');
    const target = new EventTarget();
    check(new Event('\uD800').type === '\uD800' && new DOMException('\uD800').message === '\uD800', 'DOMString preserves UTF-16 units');
    const event = new Event('x', {cancelable: true, bubbles: true});
    const calls = [];
    const removed = () => calls.push('removed');
    target.addEventListener('x', function(e) {
        check(this === target && e.target === target && e.currentTarget === target, 'Event receiver and target');
        check(e.eventPhase === Event.AT_TARGET && e.composedPath()[0] === target, 'Event phase and path');
        calls.push('once');
        target.removeEventListener('x', removed);
        e.preventDefault();
    }, {once: true});
    target.addEventListener('x', removed);
    target.addEventListener('x', {handleEvent(e) {
        check(this.handleEvent instanceof Function && e.type === 'x', 'object listener');
        calls.push('object');
    }});
    check(!target.dispatchEvent(event), 'cancelable dispatch result');
    check(calls.join(',') === 'once,object' && event.defaultPrevented, 'once and removal during dispatch');
    check(event.currentTarget === null && event.eventPhase === 0 && event.composedPath().length === 0, 'dispatch cleanup');
    target.dispatchEvent(new Event('x'));
    check(calls.join(',') === 'once,object,object', 'once removed before next dispatch');
    const passive = new Event('p', {cancelable: true});
    target.addEventListener('p', e => e.preventDefault(), {passive: true});
    check(target.dispatchEvent(passive) && !passive.defaultPrevented, 'passive listener');
    let stopped = false;
    target.addEventListener('s', e => e.stopImmediatePropagation());
    target.addEventListener('s', () => {
        stopped = true;
    });
    target.dispatchEvent(new Event('s'));
    check(!stopped, 'immediate propagation stop');
    const cancellation = new AbortController();
    let cancelledListener = false;
    target.addEventListener('cancel', () => {
        cancelledListener = true;
    }, {signal: cancellation.signal});
    cancellation.abort();
    target.dispatchEvent(new Event('cancel'));
    check(!cancelledListener, 'listener cancellation');
    check(cancellation.signal instanceof EventTarget, 'AbortSignal EventTarget inheritance');
    let synthetic = false;
    EventTarget.prototype.addEventListener.call(cancellation.signal, 'custom', () => {
        synthetic = true;
    });
    cancellation.signal.dispatchEvent(new Event('custom'));
    check(synthetic, 'generic EventTarget methods on AbortSignal');
    const aborting = new AbortController();
    aborting.signal.addEventListener('abort', e => {
        check(e instanceof Event && e.target === aborting.signal, 'abort Event class');
    });
    aborting.abort();
    const domError = new DOMException('stopped', 'AbortError');
    check(domError instanceof Error && domError.name === 'AbortError' && domError.code === 20, 'DOMException');
    throws(() => EventTarget.prototype.dispatchEvent.call({}, event), 'EventTarget receiver');
    const original = {encode: encoder.encode, decode: decoder.decode};
    globalThis.ArrayBuffer = null;
    globalThis.DataView = null;
    globalThis.TextEncoder = null;
    check(original.decode.call(decoder, original.encode.call(encoder, 'captured')) === 'captured', 'captured codec intrinsics');
    console.log('Web correctness checks passed');
}
main().catch(error => {
    console.error(String(error));
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
