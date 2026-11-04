// Permanent default-stream lifecycle and backpressure regressions for jsrt/JSC.
function check(value, message) {
    if (!value) {
        throw Error(message);
    }
}
async function rejects(promise, reason, message) {
    let caught = false;
    try {
        await promise;
    } catch (error) {
        caught = error === reason || (reason === TypeError && error instanceof TypeError);
    }
    check(caught, message);
}
const tick = () => new Promise(resolve => setTimeout(resolve, 1));
async function main() {
    const web = require('node:stream/web');
    check(web === require('stream/web') && web.ReadableStream === ReadableStream, 'builtin identity');
    let controller;
    const source = new ReadableStream({start(c) {
        controller = c;
        c.enqueue('a');
        c.enqueue('b');
        c.close();
    }});
    const reader = source.getReader();
    check(source.locked && controller instanceof ReadableStreamDefaultController, 'reader lock and controller');
    check((await reader.read()).value === 'a' && (await reader.read()).value === 'b', 'read FIFO');
    check((await reader.read()).done, 'queued close');
    await reader.closed;
    reader.releaseLock();
    check(!source.locked, 'release reader');
    await rejects(reader.read(), TypeError, 'released reader rejection');
    let rejectedLock = false;
    const pendingSource = new ReadableStream();
    const pendingReader = pendingSource.getReader();
    try {
        pendingSource.getReader();
    } catch (error) {
        rejectedLock = error instanceof TypeError;
    }
    check(rejectedLock, 'duplicate reader lock');
    await rejects(pendingSource.cancel(), TypeError, 'locked cancel rejection');
    const pendingRead = pendingReader.read();
    pendingReader.releaseLock();
    await rejects(pendingRead, TypeError, 'release pending read');
    let cancelReason;
    const cancellable = new ReadableStream({cancel(reason) {
        cancelReason = reason;
        return Promise.resolve();
    }});
    const reason = {cancel: true};
    await cancellable.cancel(reason);
    check(cancelReason === reason && (await cancellable.getReader().read()).done, 'cancel propagation');
    const failure = Error('source');
    const failed = new ReadableStream({start(c) {
        c.error(failure);
    }}).getReader();
    await rejects(failed.read(), failure, 'read error identity');
    await rejects(failed.closed, failure, 'reader closed rejection');
    let pulls = 0;
    const pulled = new ReadableStream({pull(c) {
        c.enqueue(++pulls);
        if (pulls === 3) {
            c.close();
        }
    }}, {highWaterMark: 1});
    await tick();
    check(pulls === 1, 'readable high-water mark');
    const pulledReader = pulled.getReader();
    check((await pulledReader.read()).value === 1 && (await pulledReader.read()).value === 2, 'pull scheduling');
    check((await pulledReader.read()).value === 3 && (await pulledReader.read()).done, 'pull close');
    const writes = [];
    let releaseWrite;
    const sink = new WritableStream({write(chunk) {
        writes.push(chunk);
        if (chunk === 'a') {
            return new Promise(resolve => {
                releaseWrite = resolve;
            });
        }
    }, close() {
        writes.push('closed');
    }});
    const writer = sink.getWriter();
    check(sink.locked && writer.desiredSize === 1, 'writer lock and capacity');
    const first = writer.write('a');
    const second = writer.write('b');
    let ready = false;
    writer.ready.then(() => {
        ready = true;
    });
    await tick();
    check(writes.join(',') === 'a' && !ready && writer.desiredSize === -1, 'serialized writes and pressure');
    releaseWrite();
    await first;
    await second;
    await writer.ready;
    await writer.close();
    await writer.closed;
    check(writes.join(',') === 'a,b,closed' && ready, 'write close order');
    writer.releaseLock();
    check(!sink.locked, 'release writer');
    await rejects(writer.write('late'), TypeError, 'released writer rejection');
    let abortReason;
    let nativeController;
    let finishInflight;
    const aborting = new WritableStream({start(c) {
        nativeController = c;
    }, write() {
        return new Promise(resolve => {
            finishInflight = resolve;
        });
    }, abort(reason) {
        abortReason = reason;
    }}).getWriter();
    const inflight = aborting.write('x');
    await tick();
    const abortPromise = aborting.abort(reason);
    check(nativeController.signal.aborted && nativeController.signal.reason === reason, 'writer controller signal');
    check(abortReason === undefined, 'abort waits for in-flight sink');
    finishInflight();
    await inflight;
    await abortPromise;
    check(abortReason === reason, 'sink abort reason');
    await rejects(aborting.closed, reason, 'aborted writer closed');
    let listenerAbortReached = false;
    const listenerFailure = Error('abort listener');
    const listenerSink = new WritableStream({start(c) {
        c.signal.addEventListener('abort', () => {
            throw listenerFailure;
        });
    }, abort() {
        listenerAbortReached = true;
    }}).getWriter();
    await rejects(listenerSink.abort(reason), listenerFailure, 'abort listener first error');
    check(listenerAbortReached, 'abort listener cannot prevent sink cleanup');
    const transformed = new TransformStream({transform(chunk, c) {
        c.enqueue(chunk.toUpperCase());
    }, flush(c) {
        c.enqueue('END');
    }});
    const transformWriter = transformed.writable.getWriter();
    const transformReader = transformed.readable.getReader();
    let transformedWrite = false;
    const writePromise = transformWriter.write('hello').then(() => {
        transformedWrite = true;
    });
    await tick();
    check(!transformedWrite, 'transform waits for demand');
    check((await transformReader.read()).value === 'HELLO', 'transform output');
    await writePromise;
    const closePromise = transformWriter.close();
    check((await transformReader.read()).value === 'END', 'transform flush');
    await closePromise;
    check((await transformReader.read()).done, 'transform EOF');
    const throwing = new TransformStream({transform() {
        throw failure;
    }});
    const badWriter = throwing.writable.getWriter();
    const badReader = throwing.readable.getReader();
    const badRead = badReader.read();
    const badWrite = badWriter.write('x');
    await rejects(badRead, failure, 'transform readable error');
    await rejects(badWrite, failure, 'transform writable error');
    let unsupported = 0;
    for (const run of [() => new ReadableStream({type: 'bytes'}), () => new ReadableStream().getReader({mode: 'byob'})]) {
        try {
            run();
        } catch (error) {
            if (error instanceof TypeError) {
                unsupported++;
            }
        }
    }
    check(unsupported === 2, 'explicit unsupported byte modes');
    const piped = [];
    const pipeSource = new ReadableStream({start(c) {
        c.enqueue(1);
        c.enqueue(2);
        c.close();
    }});
    const pipeSink = new WritableStream({write(chunk) {
        piped.push(chunk);
    }, close() {
        piped.push('closed');
    }});
    await pipeSource.pipeTo(pipeSink);
    check(piped.join(',') === '1,2,closed' && !pipeSource.locked && !pipeSink.locked, 'pipeTo and release');
    let sourceCancelled;
    let sinkAborted;
    const pipeController = new AbortController();
    const stalled = new ReadableStream({cancel(reason) {
        sourceCancelled = reason;
    }});
    const stalledSink = new WritableStream({abort(reason) {
        sinkAborted = reason;
    }});
    const pipePromise = stalled.pipeTo(stalledSink, {signal: pipeController.signal});
    pipeController.abort(reason);
    await rejects(pipePromise, reason, 'pipe signal reason');
    check(sourceCancelled === reason && sinkAborted === reason && !stalled.locked && !stalledSink.locked, 'pipe cancels both sides');
    let cancelOnFailure;
    const waiting = new ReadableStream({cancel(reason) {
        cancelOnFailure = reason;
    }});
    let destinationController;
    const dying = new WritableStream({start(c) {
        destinationController = c;
    }});
    const monitoredPipe = waiting.pipeTo(dying);
    destinationController.error(failure);
    await rejects(monitoredPipe, failure, 'destination error while source waits');
    check(cancelOnFailure === failure && !waiting.locked, 'closed monitoring');
    const pair = new ReadableStream({start(c) {
        c.enqueue('tee');
        c.close();
    }}).tee();
    const left = pair[0].getReader();
    const right = pair[1].getReader();
    check((await left.read()).value === 'tee' && (await right.read()).value === 'tee', 'tee branches');
    check((await left.read()).done && (await right.read()).done, 'tee close');
    let combined;
    const cancelPair = new ReadableStream({cancel(reason) {
        combined = reason;
    }}).tee();
    await Promise.all([cancelPair[0].cancel('left'), cancelPair[1].cancel('right')]);
    check(combined[0] === 'left' && combined[1] === 'right', 'tee cancellation reasons');
    let pressureCancelled = false;
    let generated = 0;
    const pressurePair = new ReadableStream({pull(c) {
        c.enqueue(++generated);
    }, cancel() {
        pressureCancelled = true;
    }}).tee();
    const fast = pressurePair[0].getReader();
    let boundedFailure;
    try {
        for (let i = 0; i < 1500; i++) {
            await fast.read();
        }
    } catch (error) {
        boundedFailure = error;
    }
    check(boundedFailure instanceof RangeError && pressureCancelled, 'tee slow branch bound and source cancellation');
    await rejects(pressurePair[1].getReader().read(), boundedFailure, 'tee bound errors both branches');
    let iterCancel;
    const iterable = new ReadableStream({start(c) {
        c.enqueue('first');
        c.enqueue('second');
    }, cancel(reason) {
        iterCancel = reason;
    }});
    for await (const chunk of iterable) {
        check(chunk === 'first', 'async iteration chunk');
        break;
    }
    check(!iterable.locked && iterCancel === undefined, 'async iteration cancel and release');
    const through = new ReadableStream({start(c) {
        c.enqueue('a');
        c.close();
    }}).pipeThrough(new TransformStream({transform(chunk, c) {
        c.enqueue(chunk + '!');
    }}));
    const throughReader = through.getReader();
    check((await throughReader.read()).value === 'a!' && (await throughReader.read()).done, 'pipeThrough');
    const node = require('stream');
    const reusable = new ReadableStream();
    try {
        node.Readable.fromWeb(reusable, {highWaterMark: -1});
    } catch (error) {
        check(error instanceof RangeError, 'adapter options failure');
    }
    check(!reusable.locked, 'adapter construction failure releases reader');
    const nodeInput = new node.Readable({read() {
        this.push('adapter');
        this.push(null);
    }});
    const adapted = node.Readable.toWeb(nodeInput).getReader();
    check((await adapted.read()).value.toString() === 'adapter' && (await adapted.read()).done, 'host to Web adapter');
    const webInput = new ReadableStream({start(c) {
        c.enqueue(new TextEncoder().encode('한'));
        c.close();
    }});
    const nodeOutput = node.Readable.fromWeb(webInput, {encoding: 'utf8'});
    let adaptedText = '';
    await new Promise((resolve, reject) => {
        nodeOutput.on('data', chunk => {
            adaptedText += chunk;
        });
        nodeOutput.on('end', resolve);
        nodeOutput.on('error', reject);
    });
    await tick();
    check(adaptedText === '한' && !webInput.locked && nodeOutput.destroyed, 'Web to host adapter and cleanup');
    let adapterCancel;
    const webWaiting = new ReadableStream({cancel(reason) {
        adapterCancel = reason;
    }});
    const nodeWaiting = node.Readable.fromWeb(webWaiting);
    nodeWaiting.on('error', () => {});
    const nodeClosed = new Promise(resolve => nodeWaiting.on('close', resolve));
    nodeWaiting.destroy(failure);
    await nodeClosed;
    check(adapterCancel === failure && !webWaiting.locked, 'adapter cancellation ownership');
    const preAborted = new AbortController();
    preAborted.abort(reason);
    const unusedUpload = new ReadableStream();
    await rejects(fetch('https://example.invalid/', {method: 'POST', body: unusedUpload, signal: preAborted.signal}), reason, 'Web upload pre-abort');
    check(!unusedUpload.locked, 'pre-aborted upload does not retain a reader');
    console.log('Web Streams checks passed');
}
main().catch(error => {
    console.error(String(error));
    console.error(error && error.stack || error);
    process.exitCode = 1;
});
