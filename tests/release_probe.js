// Permanent installed-runtime regression; it must work from outside the checkout.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const {Readable} = require('stream');
const {Worker} = require('worker_threads');
async function run() {
    assert.strictEqual(JSON.parse(JSON.stringify({n: 42})).n, 42);
    assert.strictEqual(crypto.createHash('sha256').update('abc').digest('hex'),
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const file = await require('fs/promises').open(__filename);
    try {
        assert.strictEqual((await file.stat()).isFile(), true);
        assert.strictEqual((await file.readFile('utf8')).includes('Permanent installed-runtime'), true);
    } finally {
        await file.close();
    }
    const esm = await import('./probe.mjs');
    assert.strictEqual(esm.marker, 42);
    assert.strictEqual(esm.url.startsWith('file:'), true);
    await new Promise((resolve, reject) => {
        let received = false;
        const w = new Worker("require('worker_threads').parentPort.postMessage(42)", {eval: true});
        w.on('message', n => {
            assert.strictEqual(n, 42);
            received = true;
        });
        w.on('error', reject);
        w.on('exit', code => {
            if (code === 0 && received) {
                resolve();
            } else {
                reject(Error('installed worker failed'));
            }
        });
    });
    await new Promise(resolve => {
        const r = new Readable();
        r.setEncoding('utf8');
        let s = '';
        r.on('data', value => s += value);
        r.on('end', () => {
            assert.strictEqual(s, '한글');
            resolve();
        });
        for (const b of Buffer.from('한글')) {
            r.push(Buffer.from([b]));
        }
        r.push(null);
    });
    console.log('release probe ok');
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
