// Permanent regressions for querystring.stringify, process.chdir,
// assert.deepStrictEqual, node:timers/promises, util.deprecate and promisify.custom. The expected values were
// also checked against Node, so the file runs under both runtimes.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const querystring = require('querystring');
const timersPromises = require('timers/promises');

function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message + '\n  expected: ' + JSON.stringify(expected) + '\n  actual:   ' + JSON.stringify(actual));
    }
}
function throws(run, check, message) {
    let seen = null;
    try {
        run();
    } catch (error) {
        seen = error;
    }
    if (seen === null || !check(seen)) {
        throw new Error(message + ' (got ' + (seen && (seen.name + ': ' + seen.message)) + ')');
    }
}

function querystringCases() {
    equal(querystring.stringify({a: 1, b: 'x y'}), 'a=1&b=x%20y', 'space is %20, not +');
    equal(querystring.stringify({a: [1, 2], b: true}), 'a=1&a=2&b=true', 'arrays repeat the key');
    equal(querystring.stringify({a: "!'()*~-._"}), "a=!'()*~-._", 'unreserved punctuation is kept');
    equal(querystring.stringify({'k y': '한&='}), 'k%20y=%ED%95%9C%26%3D', 'UTF-8 and delimiters are escaped');
    equal(querystring.stringify({a: null, b: undefined, c: {}, d: NaN, e: 1n}), 'a=&b=&c=&d=&e=1', 'non-primitive values are empty');
    equal(querystring.stringify({a: []}), '', 'empty array adds nothing');
    equal(querystring.stringify(null), '', 'null input');
    equal(querystring.stringify('text'), '', 'string input');
    equal(querystring.encode({x: 1}), 'x=1', 'encode alias');
    const round = {name: 'a b', list: ['1', '2']};
    equal(JSON.stringify(querystring.parse(querystring.stringify(round))), JSON.stringify(round), 'parse round trip');
}

function chdirCases() {
    const original = process.cwd();
    const directory = path.join(os.tmpdir(), 'jsrt-chdir-' + process.pid + '-' + Date.now());
    fs.mkdirSync(directory);
    try {
        process.chdir(directory);
        equal(path.basename(process.cwd()), path.basename(directory), 'cwd follows chdir');
        fs.writeFileSync('relative.txt', 'ok');
        equal(fs.readFileSync(path.join(directory, 'relative.txt'), 'utf8'), 'ok', 'relative write lands in the new directory');
        throws(() => process.chdir(path.join(directory, 'missing')), error => error instanceof Error, 'missing directory');
        throws(() => process.chdir(path.join(directory, 'missing')), error => error.code === 'ENOENT', 'missing directory code');
        throws(() => process.chdir(path.join(directory, 'relative.txt')), error => error.code === 'ENOTDIR', 'file is not a directory');
        equal(path.basename(process.cwd()), path.basename(directory), 'failed chdir keeps the directory');
        throws(() => process.chdir(), error => error instanceof TypeError, 'path is required');
        throws(() => process.chdir(5), error => error instanceof TypeError, 'path must be a string');
    } finally {
        process.chdir(original);
        fs.unlinkSync(path.join(directory, 'relative.txt'));
        fs.rmdirSync(directory);
    }
    equal(process.cwd(), original, 'cwd restored');
}

function symbolKeyCases() {
    const key = Symbol('k');
    const other = Symbol('other');
    assert.deepStrictEqual({[key]: 1}, {[key]: 1});
    assert.deepStrictEqual({[key]: {inner: [1, 2]}, a: 1}, {a: 1, [key]: {inner: [1, 2]}});
    throws(() => assert.deepStrictEqual({[key]: 1}, {[key]: 2}), error => error.code === 'ERR_ASSERTION', 'symbol value differs');
    throws(() => assert.deepStrictEqual({[key]: 1}, {}), error => error.code === 'ERR_ASSERTION', 'symbol only on the left');
    throws(() => assert.deepStrictEqual({}, {[key]: 1}), error => error.code === 'ERR_ASSERTION', 'symbol only on the right');
    throws(() => assert.deepStrictEqual({[key]: 1}, {[other]: 1}), error => error.code === 'ERR_ASSERTION', 'different symbol keys');
    throws(() => assert.deepStrictEqual({[key]: {a: 1}}, {[key]: {a: 2}}), error => error.code === 'ERR_ASSERTION', 'nested symbol value');
    // Non-enumerable symbols are ignored, matching Node.
    const hidden = {a: 1};
    Object.defineProperty(hidden, key, {value: 1, enumerable: false});
    assert.deepStrictEqual(hidden, {a: 1});
    assert.deepStrictEqual({a: 1}, hidden);
    assert.notDeepStrictEqual({[key]: 1}, {[key]: 2});
    assert.notDeepStrictEqual({[key]: 1}, {});
    const map = new Map([[1, 2]]);
    map[key] = 1;
    throws(() => assert.deepStrictEqual(map, new Map([[1, 2]])), error => error.code === 'ERR_ASSERTION', 'symbol on a Map');
    const array = [1];
    array[key] = 'x';
    throws(() => assert.deepStrictEqual(array, [1]), error => error.code === 'ERR_ASSERTION', 'symbol on an array');
}

function deepCases() {
    symbolKeyCases();
    assert.deepStrictEqual({a: 1, b: [1, 2, {c: 3}]}, {a: 1, b: [1, 2, {c: 3}]});
    assert.deepStrictEqual(new Date(5), new Date(5));
    assert.deepStrictEqual(/a/gi, /a/gi);
    assert.deepStrictEqual(new Map([[{k: 1}, [1]], ['x', 2]]), new Map([['x', 2], [{k: 1}, [1]]]));
    assert.deepStrictEqual(new Set([1, {a: 1}, 'z']), new Set(['z', {a: 1}, 1]));
    assert.deepStrictEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]));
    assert.deepStrictEqual(new ArrayBuffer(2), new ArrayBuffer(2));
    assert.deepStrictEqual(Buffer.from('abc'), Buffer.from('abc'));
    assert.deepStrictEqual(NaN, NaN);
    assert.deepStrictEqual([1, , 3], [1, , 3]);
    assert.deepStrictEqual(new Error('boom'), new Error('boom'));
    const left = {name: 'loop'};
    left.self = left;
    const right = {name: 'loop'};
    right.self = right;
    assert.deepStrictEqual(left, right);
    const shared = () => 1;
    assert.deepStrictEqual({fn: shared}, {fn: shared});

    const unequal = [
        [{a: 1}, {a: 2}],
        [{a: 1}, {a: 1, b: undefined}],
        [[1, 2], [1, 2, 3]],
        [[1, 2], {0: 1, 1: 2}],
        [0, -0],
        [1, '1'],
        [new Date(5), new Date(6)],
        [/a/g, /a/i],
        [new Map([[1, 2]]), new Map([[1, 3]])],
        [new Set([1]), new Set([2])],
        [new Set([1, 2]), new Set([1])],
        [new Uint8Array([1]), new Uint8Array([2])],
        [new Error('a'), new Error('b')],
        [Object.create(null), {}],
        [{fn() {}}, {fn() {}}],
        [new WeakMap(), new WeakMap()],
        [Object(1), Object(2)],
        [{}, []]
    ];
    unequal.forEach((pair, index) => {
        throws(() => assert.deepStrictEqual(pair[0], pair[1]), error => error.code === 'ERR_ASSERTION', 'pair ' + index + ' must differ');
        assert.notDeepStrictEqual(pair[0], pair[1]);
    });
    throws(() => assert.notDeepStrictEqual({a: 1}, {a: 1}), error => error.code === 'ERR_ASSERTION', 'notDeepStrictEqual fails on equal values');

    // A user message replaces the generic one, and getters that throw propagate untouched.
    throws(() => assert.deepStrictEqual(1, 2, 'custom text'), error => error.message.startsWith('custom text'), 'custom message');
    const reason = new Error('getter failure');
    throws(() => assert.deepStrictEqual({get a() { throw reason; }}, {a: 1}), error => error === reason, 'getter error identity');

    // Deep nesting hits the documented depth bound instead of overflowing the stack.
    let deepLeft = {};
    let deepRight = {};
    let cursorLeft = deepLeft;
    let cursorRight = deepRight;
    for (let i = 0; i < 100; i++) {
        cursorLeft.next = {};
        cursorRight.next = {};
        cursorLeft = cursorLeft.next;
        cursorRight = cursorRight.next;
    }
    equal(assert.strict.deepStrictEqual, assert.deepStrictEqual, 'strict assert exposes deepStrictEqual');
    if (process.versions.jsrt) {
        // jsrt-specific bounds and aliasing; Node has no depth limit and a loose deepEqual.
        throws(() => assert.deepStrictEqual(deepLeft, deepRight), error => error instanceof RangeError, 'depth limit');
        equal(assert.deepEqual, assert.deepStrictEqual, 'deepEqual is the strict comparison here');
    }
}

async function timerCases() {
    const started = Date.now();
    equal(await timersPromises.setTimeout(20, 'value'), 'value', 'setTimeout resolves with the value');
    if (Date.now() - started < 15) {
        throw new Error('setTimeout resolved early');
    }
    equal(await timersPromises.setTimeout(1), undefined, 'setTimeout without a value');
    equal(await timersPromises.setImmediate('now'), 'now', 'setImmediate resolves with the value');
    equal(await timersPromises.setImmediate(), undefined, 'setImmediate without a value');
    equal(await timersPromises.scheduler.wait(1), undefined, 'scheduler.wait');
    equal(await timersPromises.scheduler.yield(), undefined, 'scheduler.yield');
    equal(require('timers').promises, timersPromises, 'timers.promises is the same module');
    equal(typeof require('node:timers').setImmediate, 'function', 'timers exposes setImmediate');

    // Ordering: a zero-delay immediate runs before a 30 ms timeout.
    const order = [];
    await Promise.all([
        timersPromises.setTimeout(30).then(() => order.push('timeout')),
        timersPromises.setImmediate().then(() => order.push('immediate'))
    ]);
    equal(order.join(','), 'immediate,timeout', 'immediate before timeout');

    // Replacing the globals must not redirect the module.
    const original = global.setTimeout;
    global.setTimeout = () => { throw new Error('replaced'); };
    try {
        equal(await timersPromises.setTimeout(1, 'safe'), 'safe', 'captured scheduler');
    } finally {
        global.setTimeout = original;
    }
    // Many concurrent timers all settle.
    const results = await Promise.all(Array.from({length: 200}, (_, index) => timersPromises.setTimeout(1 + (index % 5), index)));
    equal(results.reduce((sum, value) => sum + value, 0), 19900, 'concurrent timers');
}

async function utilCases() {
    const util = require('util');
    // Deprecation warnings go to stderr; these checks cover call forwarding.
    const owner = {value: 7};
    function original(a, b) {
        return this.value + a + b;
    }
    const wrapped = util.deprecate(original, 'original is deprecated', 'DEP_TEST');
    equal(typeof wrapped, 'function', 'deprecate returns a function');
    equal(wrapped === original, false, 'deprecate returns a wrapper');
    equal(wrapped.call(owner, 1, 2), 10, 'receiver and arguments are forwarded');
    equal(wrapped.call(owner, 3, 4), 14, 'later calls still forward');
    const failing = util.deprecate(() => { throw new RangeError('inner'); }, 'failing');
    throws(() => failing(), error => error instanceof RangeError && error.message === 'inner', 'errors propagate');
    throws(() => util.deprecate(), error => error instanceof TypeError, 'function is required');
    throws(() => util.deprecate('text', 'message'), error => error instanceof TypeError, 'function type is checked');
    const objectMessage = util.deprecate(() => 1, {toString() { return 'object'; }});
    throws(() => objectMessage(), error => error instanceof TypeError, 'non-string message is rejected on first call');

    const custom = util.promisify.custom;
    equal(typeof custom, 'symbol', 'promisify.custom is a symbol');
    equal(custom, Symbol.for('nodejs.util.promisify.custom'), 'promisify.custom is the registry symbol');
    const special = () => Promise.resolve('special');
    const target = (callback) => callback(null, 'plain');
    target[custom] = special;
    equal(util.promisify(target), special, 'custom implementation is returned as is');
    equal(await util.promisify(target)(), 'special', 'custom implementation runs');
    const broken = () => {};
    broken[custom] = 5;
    throws(() => util.promisify(broken), error => error instanceof TypeError, 'non-function custom is rejected');
    equal(await util.promisify((value, callback) => callback(null, value + 1))(1), 2, 'plain promisify still works');
}

async function main() {
    querystringCases();
    chdirCases();
    deepCases();
    await timerCases();
    await utilCases();
    console.log('Core module checks passed');
}
main().catch(error => {
    console.error(String(error && error.stack || error));
    process.exitCode = 1;
});
