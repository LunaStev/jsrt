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

    equal(util.isDeepStrictEqual({a: [1, {b: 2}]}, {a: [1, {b: 2}]}), true, 'isDeepStrictEqual equal');
    equal(util.isDeepStrictEqual({a: 1}, {a: '1'}), false, 'isDeepStrictEqual is strict');
    equal(util.isDeepStrictEqual(NaN, NaN), true, 'isDeepStrictEqual NaN');
    equal(util.isDeepStrictEqual(0, -0), false, 'isDeepStrictEqual -0');
    equal(util.isDeepStrictEqual(new Map([[1, {a: 1}]]), new Map([[1, {a: 1}]])), true, 'isDeepStrictEqual Map');
    equal(util.isDeepStrictEqual([1, 2], [1, 3]), false, 'isDeepStrictEqual arrays differ');
    equal(util.isDeepStrictEqual({[Symbol.for('deepeq')]: 1}, {[Symbol.for('deepeq')]: 2}), false, 'isDeepStrictEqual symbol keys');
}

function processIdentityCases() {
    // Shapes shared with Node.
    equal(typeof process.version, 'string', 'process.version is a string');
    equal(process.version[0], 'v', 'process.version starts with v');
    equal(typeof process.title, 'string', 'process.title is a string');
    equal(typeof process.argv0, 'string', 'process.argv0 is a string');
    equal(Array.isArray(process.execArgv), true, 'execArgv is an array');
    equal(typeof process.release, 'object', 'process.release is an object');
    equal(typeof process.release.name, 'string', 'process.release.name is a string');
    // jsrt reports its own identity and never pretends to be Node.
    if (process.versions.jsrt !== undefined) {
        equal(process.title, 'jsrt', 'jsrt title');
        equal(process.release.name, 'jsrt', 'jsrt release name');
        equal(process.argv0, process.argv[0], 'argv0 is the original argv[0]');
        equal(process.execArgv.length, 0, 'execArgv is empty');
        equal(process.versions.node, undefined, 'no fake node version');
        equal(process.version, 'v' + process.versions.jsrt, 'version follows versions.jsrt');
    }
}

function fsMoreCases() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'jsrt-fsmore-'));
    try {
        equal(path.dirname(base), os.tmpdir(), 'mkdtempSync creates inside the prefix directory');
        equal(fs.statSync(base).isDirectory(), true, 'mkdtempSync creates a directory');
        const file = path.join(base, 'a.txt');

        // appendFileSync creates, then appends strings and bytes.
        fs.appendFileSync(file, 'one');
        fs.appendFileSync(file, '-two');
        fs.appendFileSync(file, Buffer.from('-three'));
        equal(fs.readFileSync(file, 'utf8'), 'one-two-three', 'appendFileSync');
        throws(() => fs.appendFileSync(file, 5), error => error instanceof TypeError, 'append rejects numbers');
        throws(() => fs.appendFileSync(path.join(base, 'no', 'dir.txt'), 'x'), error => error.code === 'ENOENT', 'append missing directory');

        // copyFileSync copies, honors COPYFILE_EXCL and tolerates copying onto itself.
        const copy = path.join(base, 'b.txt');
        fs.copyFileSync(file, copy);
        equal(fs.readFileSync(copy, 'utf8'), 'one-two-three', 'copyFileSync content');
        throws(() => fs.copyFileSync(file, copy, fs.constants.COPYFILE_EXCL), error => error.code === 'EEXIST', 'COPYFILE_EXCL');
        fs.copyFileSync(file, file);
        equal(fs.readFileSync(file, 'utf8'), 'one-two-three', 'copy onto itself keeps the data');
        throws(() => fs.copyFileSync(path.join(base, 'missing'), copy), error => error.code === 'ENOENT', 'copy missing source');

        // truncateSync and chmodSync.
        fs.truncateSync(copy, 3);
        equal(fs.readFileSync(copy, 'utf8'), 'one', 'truncateSync shortens');
        fs.truncateSync(copy);
        equal(fs.statSync(copy).size, 0, 'truncateSync defaults to zero');
        fs.chmodSync(copy, 0o600);
        equal(fs.statSync(copy).mode & 0o777, 0o600, 'chmodSync');
        throws(() => fs.chmodSync(path.join(base, 'missing'), 0o600), error => error.code === 'ENOENT', 'chmod missing');
        throws(() => fs.chmodSync(copy, 'rw'), error => error instanceof TypeError || error instanceof RangeError, 'chmod rejects text');

        // symlinkSync, readlinkSync, realpathSync.
        const link = path.join(base, 'link');
        fs.symlinkSync(file, link);
        equal(fs.readlinkSync(link), file, 'readlinkSync');
        equal(fs.lstatSync(link).isSymbolicLink(), true, 'symlink is a link');
        equal(fs.realpathSync(link), fs.realpathSync(file), 'realpathSync follows links');
        equal(typeof fs.realpathSync.native, 'function', 'realpathSync.native');
        throws(() => fs.readlinkSync(file), error => error.code === 'EINVAL', 'readlink of a regular file');
        throws(() => fs.realpathSync(path.join(base, 'missing')), error => error.code === 'ENOENT', 'realpath missing');
        throws(() => fs.symlinkSync(file, link), error => error.code === 'EEXIST', 'symlink exists');

        // utimesSync takes seconds or Dates.
        fs.utimesSync(file, 1000, 2000);
        equal(Math.floor(fs.statSync(file).mtimeMs / 1000), 2000, 'utimesSync seconds');
        fs.utimesSync(file, new Date(5000000), new Date(6000000));
        equal(Math.floor(fs.statSync(file).mtimeMs / 1000), 6000, 'utimesSync Dates');

        // Descriptor operations.
        const data = path.join(base, 'fd.bin');
        const fd = fs.openSync(data, 'w+');
        equal(typeof fd, 'number', 'openSync returns a descriptor');
        equal(fs.writeSync(fd, 'hello world'), 11, 'writeSync string');
        equal(fs.writeSync(fd, Buffer.from('!!'), 0, 2, 11), 2, 'writeSync buffer at a position');
        equal(fs.fstatSync(fd).size, 13, 'fstatSync size');
        const out = Buffer.alloc(5);
        equal(fs.readSync(fd, out, 0, 5, 0), 5, 'readSync at a position');
        equal(out.toString(), 'hello', 'readSync content');
        equal(fs.readSync(fd, out, {position: 6, length: 3}), 3, 'readSync with options');
        equal(out.toString('utf8', 0, 3), 'wor', 'readSync options content');
        equal(fs.readSync(fd, out, 0, 5, 100), 0, 'readSync past the end');
        fs.ftruncateSync(fd, 5);
        equal(fs.fstatSync(fd).size, 5, 'ftruncateSync');
        fs.fsyncSync(fd);
        fs.fdatasyncSync(fd);
        fs.closeSync(fd);
        throws(() => fs.closeSync(fd), error => error.code === 'EBADF', 'double close');
        throws(() => fs.fstatSync(fd), error => error.code === 'EBADF', 'fstat after close');
        throws(() => fs.readSync(fd, Buffer.alloc(1), 0, 1, 0), error => error.code === 'EBADF', 'read after close');
        throws(() => fs.openSync(path.join(base, 'missing'), 'r'), error => error.code === 'ENOENT', 'open missing');
        throws(() => fs.openSync(file, 'bogus'), error => error instanceof TypeError, 'open rejects unknown flags');
        throws(() => fs.openSync(data, 'wx'), error => error.code === 'EEXIST', 'open wx on existing file');
        const append = fs.openSync(data, 'a');
        fs.writeSync(append, '++');
        fs.closeSync(append);
        equal(fs.readFileSync(data, 'utf8'), 'hello++', 'append mode');
        throws(() => fs.closeSync(-1), error => error instanceof RangeError || error instanceof TypeError, 'negative descriptor');

        // rmSync handles files, directories, missing paths and trees.
        throws(() => fs.rmSync(path.join(base, 'missing')), error => error.code === 'ENOENT', 'rm missing');
        fs.rmSync(path.join(base, 'missing'), {force: true});
        const tree = path.join(base, 'tree');
        fs.mkdirSync(path.join(tree, 'deep', 'er'), {recursive: true});
        fs.writeFileSync(path.join(tree, 'deep', 'er', 'f.txt'), 'x');
        fs.writeFileSync(path.join(tree, 'top.txt'), 'y');
        throws(() => fs.rmSync(tree), error => error.code === 'ERR_FS_EISDIR' || error.code === 'EISDIR', 'rm directory needs recursive');
        fs.rmSync(tree, {recursive: true});
        equal(fs.existsSync(tree), false, 'rm recursive removes the tree');
        fs.rmSync(link);
        equal(fs.existsSync(file), true, 'rm of a link keeps the target');
        fs.rmSync(file);
        equal(fs.existsSync(file), false, 'rm removes a file');
    } finally {
        fs.rmSync(base, {recursive: true, force: true});
    }
    equal(fs.existsSync(base), false, 'cleanup removed the temp directory');
}

async function rejects(promise, check, message) {
    let seen = null;
    try {
        await promise;
    } catch (error) {
        seen = error;
    }
    if (seen === null || !check(seen)) {
        throw new Error(message + ' (got ' + (seen && (seen.name + ': ' + seen.message)) + ')');
    }
}

async function fsPromisesCases() {
    const fsp = fs.promises;
    const util = require('util');
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'jsrt-fsp-'));
    try {
        const file = path.join(base, 'a.txt');
        const pending = fsp.appendFile(file, 'one');
        equal(pending instanceof Promise, true, 'promise forms return a Promise');
        equal(await pending, undefined, 'appendFile resolves with undefined');
        await fsp.appendFile(file, '-two');
        equal(fs.readFileSync(file, 'utf8'), 'one-two', 'promises.appendFile');

        const copy = path.join(base, 'b.txt');
        await fsp.copyFile(file, copy);
        equal(fs.readFileSync(copy, 'utf8'), 'one-two', 'promises.copyFile');
        await rejects(fsp.copyFile(file, copy, fs.constants.COPYFILE_EXCL), error => error.code === 'EEXIST', 'copyFile EXCL rejects');
        await rejects(fsp.copyFile(path.join(base, 'missing'), copy), error => error.code === 'ENOENT', 'copyFile missing rejects');

        await fsp.truncate(copy, 3);
        equal(fs.readFileSync(copy, 'utf8'), 'one', 'promises.truncate');
        await fsp.chmod(copy, 0o640);
        equal(fs.statSync(copy).mode & 0o777, 0o640, 'promises.chmod');
        await rejects(fsp.chmod(path.join(base, 'missing'), 0o600), error => error.code === 'ENOENT', 'chmod missing rejects');

        const link = path.join(base, 'link');
        await fsp.symlink(file, link);
        equal(await fsp.readlink(link), file, 'promises.readlink');
        equal(await fsp.realpath(link), fs.realpathSync(file), 'promises.realpath');
        await rejects(fsp.readlink(file), error => error.code === 'EINVAL', 'readlink of a file rejects');
        await fsp.utimes(file, 1000, 3000);
        equal(Math.floor(fs.statSync(file).mtimeMs / 1000), 3000, 'promises.utimes');

        // Argument errors reject instead of throwing.
        let threw = false;
        let rejected = null;
        try {
            rejected = fsp.chmod(12345, 0o600);
        } catch (error) {
            threw = true;
        }
        equal(threw, false, 'argument errors do not throw synchronously');
        await rejects(rejected, error => error instanceof TypeError, 'argument errors reject with TypeError');

        // Callback forms are wrapped from the promise forms and report through nextTick.
        let sync = true;
        const order = [];
        const done = new Promise(resolve => {
            fs.appendFile(file, '!', error => {
                order.push(sync ? 'sync' : 'async');
                resolve(error);
            });
        });
        sync = false;
        equal(await done, null, 'callback success passes null');
        equal(order[0], 'async', 'callback runs asynchronously');
        equal(fs.readFileSync(file, 'utf8'), 'one-two!', 'fs.appendFile callback');
        const missing = await new Promise(resolve => fs.rm(path.join(base, 'missing'), error => resolve(error)));
        equal(missing.code, 'ENOENT', 'fs.rm callback error');
        equal(await util.promisify(fs.mkdtemp)(path.join(base, 'tmp-')) !== undefined, true, 'promisify(fs.mkdtemp)');
        equal(await util.promisify(fs.realpath)(link), fs.realpathSync(file), 'promisify(fs.realpath)');
        equal(typeof fs.copyFile, 'function', 'fs.copyFile exists');
        equal(typeof fs.chmod, 'function', 'fs.chmod exists');

        const tree = path.join(base, 'tree');
        fs.mkdirSync(path.join(tree, 'x'), {recursive: true});
        fs.writeFileSync(path.join(tree, 'x', 'f'), '1');
        await rejects(fsp.rm(tree), error => error.code === 'ERR_FS_EISDIR' || error.code === 'EISDIR', 'rm directory needs recursive');
        await fsp.rm(tree, {recursive: true});
        equal(fs.existsSync(tree), false, 'promises.rm recursive');
        await fsp.rm(path.join(base, 'missing'), {force: true});
    } finally {
        await fsp.rm(base, {recursive: true, force: true});
    }
    equal(fs.existsSync(base), false, 'promises cleanup');
}

async function eventsOnceCases() {
    const EventEmitter = require('events');
    equal(typeof EventEmitter.once, 'function', 'events.once exists');
    equal(EventEmitter.once, require('events').once, 'events.once is a module property');

    const emitter = new EventEmitter();
    const pending = EventEmitter.once(emitter, 'ready');
    equal(pending instanceof Promise, true, 'once returns a Promise');
    equal(emitter.listenerCount('ready'), 1, 'once registers a listener');
    equal(emitter.listenerCount('error'), 1, 'once registers an error listener');
    emitter.emit('ready', 1, 'two', {three: 3});
    const values = await pending;
    equal(Array.isArray(values), true, 'resolves with an array');
    equal(JSON.stringify(values), '[1,"two",{"three":3}]', 'resolves with the event arguments');
    equal(emitter.listenerCount('ready'), 0, 'listener removed after the event');
    equal(emitter.listenerCount('error'), 0, 'error listener removed after the event');
    equal(emitter.emit('ready'), false, 'later emits find no listener');

    // An 'error' event rejects and cleans up both listeners.
    const failing = EventEmitter.once(emitter, 'never');
    emitter.emit('error', new RangeError('boom'));
    await rejects(failing, error => error instanceof RangeError && error.message === 'boom', 'error event rejects');
    equal(emitter.listenerCount('never'), 0, 'value listener removed after rejection');
    equal(emitter.listenerCount('error'), 0, 'error listener removed after rejection');

    // Waiting for 'error' itself resolves with the arguments.
    const waitError = EventEmitter.once(emitter, 'error');
    equal(emitter.listenerCount('error'), 1, 'only one listener when waiting for error');
    emitter.emit('error', new Error('x'));
    const errorArgs = await waitError;
    equal(errorArgs[0].message, 'x', 'error resolves with its arguments');

    // Only the first emit counts; an emit after settling does not throw for other names.
    const first = EventEmitter.once(emitter, 'tick');
    emitter.emit('tick', 'a');
    emitter.emit('tick', 'b');
    equal((await first)[0], 'a', 'only the first event is used');

    // Symbol names and listener ordering with existing listeners.
    const sym = Symbol('event');
    const order = [];
    emitter.on(sym, () => order.push('regular'));
    const bySymbol = EventEmitter.once(emitter, sym);
    emitter.emit(sym, 7);
    equal((await bySymbol)[0], 7, 'symbol event names');
    equal(order.join(','), 'regular', 'existing listeners still run');

    // Bad arguments reject instead of throwing.
    await rejects(EventEmitter.once(5, 'x'), error => error instanceof TypeError, 'non-object emitter rejects');
    // jsrt only accepts string and symbol event names; Node would wait forever on other names.
    if (process.versions.jsrt !== undefined) {
        await rejects(EventEmitter.once(emitter), error => error instanceof TypeError, 'missing name rejects');
        await rejects(EventEmitter.once(emitter, 42), error => error instanceof TypeError, 'numeric name rejects');
    }
    equal(EventEmitter.listenerCount(emitter, sym), 1, 'static listenerCount');
}

function assertMatcherCases() {
    // throws with a class, RegExp, object, validator and message.
    assert.throws(() => { throw new TypeError('bad'); }, TypeError);
    assert.throws(() => { throw new TypeError('bad'); }, Error);
    assert.throws(() => { throw new Error('abc'); }, /ab/);
    assert.throws(() => { throw new Error('abc'); }, /^Error: abc$/);
    assert.throws(() => { throw Object.assign(new Error('m'), {code: 'X'}); }, {message: 'm', code: 'X'});
    assert.throws(() => { throw new Error('hello world'); }, {message: /world/});
    assert.throws(() => { throw new Error('v'); }, error => error.message === 'v');
    assert.throws(() => { throw new Error('v'); }, TypeError === undefined ? Error : Error, 'with message');
    throws(() => assert.throws(() => { throw new Error('a'); }, RangeError), error => error.code === 'ERR_ASSERTION', 'class mismatch is an AssertionError');
    throws(() => assert.throws(() => { throw new Error('a'); }, RangeError), error => error.message.split('\n')[0] === 'The error is expected to be an instance of "RangeError". Received "Error"', 'class mismatch message');
    throws(() => assert.doesNotThrow(() => { throw new Error('x'); }, 'why'), error => error.message.split('\n')[0] === 'Got unwanted exception: why', 'doesNotThrow message');
    throws(() => assert.throws(() => { throw new Error('abc'); }, /zzz/), error => error.code === 'ERR_ASSERTION', 'RegExp mismatch');
    throws(() => assert.throws(() => { throw new Error('m'); }, {message: 'n'}), error => error.code === 'ERR_ASSERTION', 'object mismatch');
    throws(() => assert.throws(() => { throw new Error('v'); }, () => false), error => error.code === 'ERR_ASSERTION', 'validator returning false');
    throws(() => assert.throws(() => {}, TypeError), error => error.code === 'ERR_ASSERTION', 'missing exception with a matcher');
    throws(() => assert.throws(() => {}), error => error.code === 'ERR_ASSERTION' && error.operator === 'throws', 'missing exception');
    throws(() => assert.throws(() => {}, 'custom text'), error => error.message === 'Missing expected exception: custom text', 'missing exception message');
    throws(() => assert.throws(() => {}, TypeError, 'custom 2'), error => error.message === 'Missing expected exception (TypeError): custom 2', 'matcher then message');
    throws(() => assert.throws(() => { throw new Error('x'); }, 5), error => error instanceof TypeError, 'bad matcher type');
    // doesNotThrow wraps errors, except ones that do not match the given matcher.
    assert.doesNotThrow(() => 1);
    throws(() => assert.doesNotThrow(() => { throw new Error('x'); }), error => error.code === 'ERR_ASSERTION' && error.operator === 'doesNotThrow', 'doesNotThrow wraps');
    throws(() => assert.doesNotThrow(() => { throw new Error('x'); }, TypeError), error => error.code === undefined && error.message === 'x', 'unmatched error propagates');
    throws(() => assert.doesNotThrow(() => { throw new TypeError('x'); }, TypeError), error => error.code === 'ERR_ASSERTION', 'matched error is wrapped');
    // ok() and generatedMessage fields.
    throws(() => assert.ok(false, 'msg'), error => error.expected === true && error.operator === '==' && error.generatedMessage === false, 'ok fields');
    throws(() => assert.strictEqual(1, 2), error => error.generatedMessage === true, 'generatedMessage without a message');
    throws(() => assert.strictEqual(1, 2, 'm'), error => error.generatedMessage === false, 'generatedMessage with a message');
}

function eventEmitterCases() {
    const EventEmitter = require('events');
    const e = new EventEmitter();
    const seen = [];
    e.on('newListener', (name, fn) => seen.push('new:' + String(name) + ':' + typeof fn));
    e.on('removeListener', (name, fn) => seen.push('remove:' + String(name) + ':' + typeof fn));
    const handler = () => {};
    e.on('a', handler);
    e.off('a', handler);
    equal(seen.join(','), 'new:removeListener:function,new:a:function,remove:a:function', 'newListener and removeListener events');
    // newListener runs before the listener is added.
    const order = [];
    const f = new EventEmitter();
    f.on('newListener', name => {
        if (name === 'x') {
            order.push('count before add: ' + f.listenerCount('x'));
        }
    });
    f.on('x', () => {});
    equal(order[0], 'count before add: 0', 'newListener fires before adding');
    // Max listeners.
    equal(EventEmitter.defaultMaxListeners, 10, 'defaultMaxListeners');
    equal(e.getMaxListeners(), 10, 'default getMaxListeners');
    equal(e.setMaxListeners(0), e, 'setMaxListeners returns the emitter');
    equal(e.getMaxListeners(), 0, 'getMaxListeners after set');
    e.setMaxListeners(Infinity);
    equal(e.getMaxListeners(), Infinity, 'Infinity is allowed');
    throws(() => e.setMaxListeners(-1), error => error instanceof RangeError, 'negative max');
    throws(() => e.setMaxListeners('3'), error => error instanceof TypeError || error instanceof RangeError, 'string max');
    equal(typeof e.rawListeners, 'function', 'rawListeners exists');
    const g = new EventEmitter();
    g.on('y', handler);
    equal(g.rawListeners('y')[0], handler, 'rawListeners returns the listener');
}

function bufferWriteCases() {
    const b = Buffer.alloc(6);
    equal(b.write('héllo', 1), 5, 'write at an offset returns the byte count');
    equal(JSON.stringify([...b]), '[0,104,195,169,108,108]', 'write at an offset stores UTF-8');
    const h = Buffer.alloc(4);
    equal(h.write('ffee', 'hex'), 2, 'write with an encoding');
    equal(JSON.stringify([...h]), '[255,238,0,0]', 'hex write');
    const c = Buffer.alloc(4);
    equal(c.write('abcdef', 1, 2), 2, 'write with offset and length');
    equal(c.toString('latin1'), '\u0000ab\u0000', 'only the requested length is written');
    equal(Buffer.alloc(4).write('aGk=', 0, 4, 'base64'), 2, 'offset, length and encoding');
    // A multi-byte character that does not fit is not split.
    const s = Buffer.alloc(3);
    equal(s.write('a€'), 1, 'partial UTF-8 character is dropped');
    equal(Buffer.alloc(3).write('ab', 'utf16le'), 2, 'UTF-16 write keeps whole code units');
    equal(Buffer.alloc(2).write('x', 2), 0, 'write at the end writes nothing');
    throws(() => Buffer.alloc(2).write('x', 3), error => error instanceof RangeError, 'offset past the end');
    throws(() => Buffer.alloc(2).write(5), error => error instanceof TypeError, 'non-string data');
    throws(() => Buffer.alloc(2).write('x', 'nope'), error => error instanceof TypeError, 'unknown encoding');
}

function urlCases() {
    equal(new URL('', 'http://a.com/b?c#d').href, 'http://a.com/b?c', 'empty reference drops the fragment');
    equal(new URL('?q', 'http://a.com/b#d').href, 'http://a.com/b?q', 'query reference');
    const a = new URL('http://a.com/');
    a.search = '?a=é';
    equal(a.href, 'http://a.com/?a=%C3%A9', 'search setter uses uppercase escapes');
    const b = new URL('http://a.com/');
    b.search = '?a=%c3%a9';
    equal(b.href, 'http://a.com/?a=%c3%a9', 'search setter keeps given escapes');
    const c = new URL('http://a.com/');
    c.pathname = '/é x';
    equal(c.pathname, '/%C3%A9%20x', 'pathname setter');
    const d = new URL('http://a.com/');
    d.hash = '#é';
    equal(d.hash, '#%C3%A9', 'hash setter');
    const e = new URL('http://a.com/?a=1');
    e.searchParams.set('a', 'é');
    equal(e.href, 'http://a.com/?a=%C3%A9', 'searchParams update');
    throws(() => new URL('nope'), error => error instanceof TypeError && error.code === 'ERR_INVALID_URL', 'invalid URL code');
}

// Regressions for issues #4-#7 (rmSync options, utimesSync validation, copyFileSync permissions and
// readSync positions). Expected values come from Node.
function fsIssueCases() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jsrt-fsissue-'));
    const outcome = run => {
        try {
            return 'ok:' + run();
        } catch (error) {
            return error.name + ':' + error.code;
        }
    };
    try {
        const tree = path.join(root, 'tree');
        fs.mkdirSync(tree);
        fs.writeFileSync(path.join(tree, 'keep'), 'k');
        for (const value of ['false', 1, 0, null, undefined]) {
            equal(outcome(() => fs.rmSync(tree, {recursive: value})), 'TypeError:ERR_INVALID_ARG_TYPE', 'rm recursive ' + JSON.stringify(value));
        }
        equal(fs.existsSync(path.join(tree, 'keep')), true, 'rejected options keep the tree');
        for (const value of ['false', 1, null]) {
            equal(outcome(() => fs.rmSync(path.join(root, 'missing'), {force: value})), 'TypeError:ERR_INVALID_ARG_TYPE', 'rm force ' + JSON.stringify(value));
        }
        fs.rmSync(tree, {recursive: true});
        equal(fs.existsSync(tree), false, 'boolean recursive still works');

        const file = path.join(root, 't');
        fs.writeFileSync(file, 'x');
        for (const value of [NaN, Infinity, -Infinity]) {
            equal(outcome(() => fs.utimesSync(file, value, value)), 'TypeError:ERR_INVALID_ARG_TYPE', 'utimes ' + value);
        }
        equal(outcome(() => fs.utimesSync(file, 1e300, 1e300)), 'Error:EINVAL', 'utimes out of range');
        equal(outcome(() => { fs.utimesSync(file, 1.5, 1.5); return Math.round(fs.statSync(file).mtimeMs); }), 'ok:1500', 'utimes fractional seconds');
        equal(outcome(() => { fs.utimesSync(file, '100', '100'); return Math.round(fs.statSync(file).mtimeMs); }), 'ok:100000', 'utimes numeric string');
        fs.utimesSync(file, -1, -1);
        equal(Math.abs(fs.statSync(file).mtimeMs - Date.now()) < 60000, true, 'negative utimes means now');

        const source = path.join(root, 'src');
        const dest = path.join(root, 'dst');
        fs.writeFileSync(source, 'private');
        fs.writeFileSync(dest, 'old');
        fs.chmodSync(source, 0o600);
        fs.chmodSync(dest, 0o644);
        fs.copyFileSync(source, dest);
        equal((fs.statSync(dest).mode & 0o777).toString(8), '600', 'copyFile applies source permissions to an existing file');
        equal(fs.readFileSync(dest, 'utf8'), 'private', 'copyFile replaced the content');

        const fd = fs.openSync(file, 'r');
        const bytes = new Uint8Array(1);
        try {
            const cases = [[-2, 'RangeError:ERR_OUT_OF_RANGE'], [-1, 'ok:1'], [null, 'ok:0'], [-1.5, 'RangeError:ERR_OUT_OF_RANGE'], [0, 'ok:1'], [1.5, 'RangeError:ERR_OUT_OF_RANGE'], [2n, 'ok:0'], ['0', 'TypeError:ERR_INVALID_ARG_TYPE']];
            for (const [position, expected] of cases) {
                equal(outcome(() => fs.readSync(fd, bytes, 0, 1, position)), expected, 'readSync position ' + String(position));
            }
            equal(outcome(() => fs.readSync(fd, bytes, {position: -2})), 'RangeError:ERR_OUT_OF_RANGE', 'readSync options position -2');
            equal(outcome(() => fs.readSync(fd, bytes, {position: 1.5})), 'RangeError:ERR_OUT_OF_RANGE', 'readSync options position 1.5');
        } finally {
            fs.closeSync(fd);
        }
        const out = fs.openSync(path.join(root, 'w'), 'w');
        try {
            equal(outcome(() => fs.writeSync(out, 'a', -2)), 'ok:1', 'writeSync keeps accepting negative positions');
        } finally {
            fs.closeSync(out);
        }
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
}

// Regressions for issues #16-#20 in deep strict equality. Expected values come from Node.
function deepIssueCases() {
    const differs = (a, b, label) => throws(() => assert.deepStrictEqual(a, b), error => error.code === 'ERR_ASSERTION', label);
    differs(new Array(3), new Array(4), 'sparse arrays with different lengths');
    differs([1, , ], [1], 'trailing hole changes the length');
    assert.deepStrictEqual(new Array(3), new Array(3));
    differs(new DataView(new Uint8Array([1, 2]).buffer), new DataView(new Uint8Array([1, 3]).buffer), 'DataView bytes');
    differs(new DataView(new ArrayBuffer(2)), new DataView(new ArrayBuffer(3)), 'DataView length');
    assert.deepStrictEqual(new DataView(new Uint8Array([1, 2]).buffer), new DataView(new Uint8Array([1, 2]).buffer));
    assert.deepStrictEqual(new DataView(new Uint8Array([9, 1, 2]).buffer, 1), new DataView(new Uint8Array([1, 2]).buffer));
    const withProperty = new ArrayBuffer(2);
    withProperty.x = 1;
    differs(withProperty, new ArrayBuffer(2), 'ArrayBuffer own properties');
    differs(new Uint8Array([1]).buffer, new Uint8Array([2]).buffer, 'ArrayBuffer bytes');
    differs(new Error('a', {cause: 1}), new Error('a', {cause: 2}), 'Error cause values');
    differs(new Error('a', {cause: undefined}), new Error('a'), 'Error cause presence');
    assert.deepStrictEqual(new Error('a', {cause: {x: 1}}), new Error('a', {cause: {x: 1}}));
    differs(new AggregateError([1], 'm'), new AggregateError([2], 'm'), 'AggregateError errors');
    assert.deepStrictEqual(new AggregateError([1], 'm'), new AggregateError([1], 'm'));
    const first = new Set([1]);
    const second = new Set([2]);
    first[Symbol.iterator] = second[Symbol.iterator] = function* () {
        yield 1;
    };
    differs(first, second, 'Set storage, not the overridden iterator');
}

// Regression for issue #8: refresh() reactivates a timeout during or after its callback.
async function timeoutRefreshCases() {
    let during = 0;
    const self = setTimeout(() => {
        during += 1;
        if (during === 1) {
            self.refresh();
        }
    }, 1);
    let after = 0;
    const finished = setTimeout(() => {
        after += 1;
    }, 1);
    await new Promise(resolve => setTimeout(resolve, 20));
    equal(after, 1, 'timeout ran once before refresh');
    equal(finished.refresh(), finished, 'refresh returns the handle');
    await new Promise(resolve => setTimeout(resolve, 40));
    equal(during, 2, 'refresh inside the callback runs it again');
    equal(after, 2, 'refresh after completion runs it again');
    // A cleared pending timeout stays cleared, and refresh on a pending one only moves the deadline.
    let pending = 0;
    const moved = setTimeout(() => {
        pending += 1;
    }, 30);
    moved.refresh();
    await new Promise(resolve => setTimeout(resolve, 60));
    equal(pending, 1, 'refresh of a pending timeout does not duplicate it');
}

// Regressions for issues #15, #21-#24 and #26. Expected values come from Node.
function miscIssueCases() {
    // #23 path.basename suffix boundaries.
    equal(path.basename('/a/b.js', 'b.js'), 'b.js', 'suffix equal to the whole name keeps it');
    equal(path.basename('/a/.js', '.js'), '.js', 'suffix equal to a dotfile name keeps it');
    equal(path.basename('js', 'js'), '', 'suffix equal to the whole path is empty');
    equal(path.basename('/a/b', 'b'), 'b', 'single-segment name equal to the suffix');
    equal(path.basename('a.js', '.js'), 'a', 'shorter suffix is removed');
    equal(path.basename('/x/aaa', 'a'), 'aa', 'only one suffix is removed');
    equal(path.basename('/x/file.js/', '.js'), 'file', 'trailing slash is ignored');

    // #24 util.format %j only treats the engine cycle error as [Circular].
    const util = require('util');
    throws(() => util.format('%j', {toJSON() { throw new Error('bicyclic thing'); }}), error => error.message === 'bicyclic thing', 'unrelated error mentioning cycli propagates');
    const cycle = {};
    cycle.self = cycle;
    equal(util.format('%j', cycle), '[Circular]', 'real cycles print [Circular]');

    // #15 Blob endings: native.
    equal(new Blob(['a\r\nb\rc\n'], {endings: 'native'}).size, 6, 'native endings normalize string parts');
    equal(new Blob(['a\r\nb'], {endings: 'transparent'}).size, 4, 'transparent endings keep bytes');
    equal(new Blob([new Blob(['a\r\nb'])], {endings: 'native'}).size, 4, 'Blob parts are not normalized');
    equal(new Blob([new TextEncoder().encode('a\r\nb')], {endings: 'native'}).size, 4, 'byte parts are not normalized');

    // #21 JSON.stringify rejects BigInt in implicit numeric conversions.
    throws(() => JSON.stringify(Object(1n)), error => error instanceof TypeError, 'boxed BigInt');
    throws(() => JSON.stringify(new Proxy([1], {get: (target, key) => key === 'length' ? 1n : target[key]})), error => error instanceof TypeError, 'BigInt array length');
    equal(JSON.stringify({a: 1}, null, 2n), '{"a":1}', 'primitive BigInt space is ignored');

    // #22 rawJSON keeps its source text.
    if (typeof JSON.rawJSON === 'function') {
        equal(JSON.stringify({a: JSON.rawJSON('"\\u0041\\n"')}), '{"a":"\\u0041\\n"}', 'rawJSON keeps escapes');
        equal(JSON.stringify([JSON.rawJSON('1e1000')]), '[1e1000]', 'rawJSON keeps number spelling');
    }

    // #26 structuredClone skips keys deleted by an earlier getter.
    const source = {get a() { delete this.b; return 1; }, b: 2};
    const copy = structuredClone(source);
    equal(JSON.stringify(Object.keys(copy)), '["a"]', 'deleted key is not cloned');
    equal('b' in copy, false, 'deleted key is absent in the clone');
}

// Regressions for issue #30: structuredClone of Map, Set, RegExp, Error, boxed primitives and class
// instances. Expected values come from Node.
function structuredCloneExtensionCases() {
    const map = structuredClone(new Map([[1, {a: 1}], ['k', [1, 2]]]));
    equal(map instanceof Map && JSON.stringify([...map]), '[[1,{"a":1}],["k",[1,2]]]', 'Map entries');
    const keyObject = {id: 1};
    const keyed = structuredClone(new Map([[keyObject, 'v']]));
    const clonedKey = [...keyed.keys()][0];
    equal(clonedKey !== keyObject && clonedKey.id === 1 && keyed.get(clonedKey) === 'v', true, 'object Map keys are cloned');
    const set = structuredClone(new Set([1, 'a', {b: 2}]));
    equal(set instanceof Set && JSON.stringify([...set]), '[1,"a",{"b":2}]', 'Set elements');
    const cycle = new Map();
    cycle.set('self', cycle);
    const clonedCycle = structuredClone(cycle);
    equal(clonedCycle.get('self') === clonedCycle, true, 'cyclic Map');
    const shared = {n: 1};
    const sharedCopy = structuredClone({a: shared, b: shared});
    equal(sharedCopy.a === sharedCopy.b, true, 'shared references stay shared');
    const extra = new Map([[1, 2]]);
    extra.extra = 1;
    equal(Object.keys(structuredClone(extra)).length, 0, 'extra Map properties are dropped');

    const regexp = structuredClone(/a+b/gi);
    equal(regexp instanceof RegExp && regexp.source === 'a+b' && regexp.flags === 'gi' && regexp.lastIndex === 0, true, 'RegExp source and flags');
    const advanced = /x/g;
    advanced.lastIndex = 3;
    equal(structuredClone(advanced).lastIndex, 0, 'RegExp lastIndex is reset');

    const error = structuredClone(new RangeError('boom'));
    equal(error instanceof RangeError && error.name === 'RangeError' && error.message === 'boom' && typeof error.stack === 'string', true, 'Error type, message and stack');
    equal(JSON.stringify(structuredClone(new Error('m', {cause: {x: 1}})).cause), '{"x":1}', 'Error cause');
    const odd = new Error('m');
    odd.name = 'Weird';
    equal(structuredClone(odd).name, 'Error', 'unknown error names become Error');

    const number = structuredClone(new Number(3));
    equal(typeof number === 'object' && number.valueOf() === 3, true, 'boxed Number');
    const string = structuredClone(new String('s'));
    equal(typeof string === 'object' && string.valueOf() === 's', true, 'boxed String');
    equal(structuredClone(new Boolean(false)).valueOf(), false, 'boxed Boolean');
    equal(String(structuredClone(Object(5n)).valueOf()), '5', 'boxed BigInt');

    class Point {
        constructor() {
            this.x = 1;
        }
        get double() {
            return this.x * 2;
        }
    }
    const point = structuredClone(new Point());
    equal(point.x === 1 && !(point instanceof Point) && Object.getPrototypeOf(point) === Object.prototype && !('double' in point), true, 'class instances become plain records');

    for (const [label, value] of [['Symbol wrapper', Object(Symbol())], ['WeakMap', new WeakMap()], ['WeakSet', new WeakSet()], ['Promise', Promise.resolve()], ['function in an object', {f() {}}], ['Symbol value', {s: Symbol()}]]) {
        throws(() => structuredClone(value), error => error.name === 'DataCloneError', label + ' is not cloneable');
    }
}

// Regressions for issue #30, part two: ArrayBuffer, typed arrays and DataView. Expected values come from Node.
function structuredCloneBufferCases() {
    const source = new Uint8Array([1, 2, 3]).buffer;
    const buffer = structuredClone(source);
    equal(buffer instanceof ArrayBuffer && buffer !== source && JSON.stringify([...new Uint8Array(buffer)]), '[1,2,3]', 'ArrayBuffer bytes');
    equal(structuredClone(new ArrayBuffer(0)).byteLength, 0, 'empty ArrayBuffer');
    for (const View of [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array]) {
        const clone = structuredClone(new View([1, 2]));
        equal(clone.constructor === View && JSON.stringify([...clone]), '[1,2]', View.name + ' clone');
    }
    equal(String(structuredClone(new BigInt64Array([5n]))[0]), '5', 'BigInt64Array');
    equal(String(structuredClone(new BigUint64Array([7n]))[0]), '7', 'BigUint64Array');
    equal(Object.is(structuredClone(new Float32Array([-0]))[0], -0), true, 'negative zero survives');

    // A view clones its whole backing buffer and remembers where it starts.
    const window = structuredClone(new Float64Array([1.5, 2.5]).subarray(1));
    equal(window.length === 1 && window.byteOffset === 8 && window.buffer.byteLength === 16 && window[0] === 2.5, true, 'subarray keeps its buffer and offset');

    // Views that shared a buffer still share the cloned one.
    const backing = new ArrayBuffer(8);
    const shared = structuredClone({narrow: new Uint8Array(backing, 2, 3), whole: new Int8Array(backing), backing});
    equal(shared.narrow.buffer === shared.backing && shared.whole.buffer === shared.backing, true, 'shared buffer identity');
    equal(shared.narrow.byteOffset === 2 && shared.narrow.length === 3 && shared.backing.byteLength === 8, true, 'shared view geometry');
    const pair = structuredClone({x: new Uint8Array(new ArrayBuffer(4))});
    pair.x[0] = 9;
    equal(pair.x.buffer.byteLength, 4, 'a lone view owns a full buffer');

    // A Buffer clones to a plain Uint8Array.
    const plain = structuredClone(Buffer.from('hi'));
    equal(plain.constructor === Uint8Array && !Buffer.isBuffer(plain) && plain.length === 2, true, 'Buffer becomes Uint8Array');

    const view = structuredClone(new DataView(new ArrayBuffer(4), 1, 2));
    equal(view instanceof DataView && view.byteLength === 2 && view.byteOffset === 1 && view.buffer.byteLength === 4, true, 'DataView geometry');
    equal([...structuredClone(new Map([[1, new Int32Array([4])]])).values()][0][0], 4, 'typed array inside a Map');
}

// Regressions for issue #33 (part one): hierarchical non-HTTP schemes. Expected values come from Node.
function urlSchemeCases() {
    const parts = url => [url.href, url.protocol, url.host, url.hostname, url.port, url.pathname, url.search, url.hash, url.origin].join('|');
    equal(JSON.stringify(parts(new URL('file:///a/b')).split('|')), JSON.stringify(['file:///a/b', 'file:', '', '', '', '/a/b', '', '', 'null']), 'file URL');
    equal(new URL('file:///a/b c').pathname, '/a/b%20c', 'file URL escapes spaces');
    equal(new URL('file:///a/../b').href, 'file:///b', 'file URL normalizes dot segments');
    equal(new URL('file:///').href, 'file:///', 'file URL with only a root path');
    equal(new URL('file://localhost/a').href, 'file:///a', 'localhost host is dropped');
    equal(new URL('file:///a/b?q#h').search + new URL('file:///a/b?q#h').hash, '?q#h', 'file URL query and fragment');
    equal(new URL('file:///a/b').origin, 'null', 'file origin is opaque');
    equal(new URL('../c', 'file:///a/b/d').href, 'file:///a/c', 'relative reference against a file base');

    equal(new URL('ftp://u:p@a:21/b?c#d').href, 'ftp://u:p@a/b?c#d', 'ftp default port is dropped');
    equal(new URL('ftp://a/b').origin, 'ftp://a', 'ftp origin');
    equal(new URL('ws://a:80/b').href, 'ws://a/b', 'ws default port is dropped');
    equal(new URL('wss://a:443/b').href, 'wss://a/b', 'wss default port is dropped');
    equal(new URL('wss://a:9/b?c#d').origin, 'wss://a:9', 'wss origin keeps a non-default port');
    equal(new URL('x://y:99/z').host, 'y:99', 'unknown hierarchical scheme');
    equal(new URL('x://y/z').origin, 'null', 'unknown scheme has an opaque origin');
    equal(URL.canParse('file:///a'), true, 'canParse file');

    const withParams = new URL('ws://a/b');
    withParams.searchParams.set('k', 'v w');
    equal(withParams.href, 'ws://a/b?k=v+w', 'searchParams on a ws URL');
    const edited = new URL('file:///a/b');
    edited.pathname = '/c d';
    edited.hash = 'h';
    equal(edited.href, 'file:///c%20d#h', 'file URL setters');

    // URL objects accept more schemes than the network client, which must stay HTTP(S) only.
    // jsrt rejects these when the Request is built (Node only fails later, in fetch).
    if (process.versions.jsrt !== undefined) {
        for (const target of ['file:///etc/passwd', 'ftp://example.com/x', 'ws://example.com/x']) {
            throws(() => new Request(target), error => error instanceof TypeError, 'Request refuses ' + target);
        }
    }
}

// Regressions for issue #28: brand-based util.types checks, including forged lookalikes.
function utilTypesCases() {
    const types = require('util').types;
    const samples = {
        date: new Date(), re: /x/, map: new Map(), set: new Set(), weakMap: new WeakMap(), weakSet: new WeakSet(),
        promise: Promise.resolve(), error: new TypeError('x'), subError: new (class Custom extends Error {})(),
        number: new Number(1), string: new String('a'), bool: new Boolean(1), symbol: Object(Symbol()), bigint: Object(1n),
        primitive: 1, plain: {}, array: [], nothing: null, fn: () => {},
        fakeMap: Object.create(Map.prototype), fakeDate: Object.create(Date.prototype), fakeNumber: Object.create(Number.prototype),
        taggedMap: {[Symbol.toStringTag]: 'Map'}, taggedError: {[Symbol.toStringTag]: 'Error'}, forgedError: Object.create(Error.prototype)
    };
    const expected = {
        isDate: ['date'], isRegExp: ['re'], isMap: ['map'], isSet: ['set'], isWeakMap: ['weakMap'], isWeakSet: ['weakSet'],
        isPromise: ['promise'], isNativeError: ['error', 'subError'], isNumberObject: ['number'], isStringObject: ['string'],
        isBooleanObject: ['bool'], isBigIntObject: ['bigint'], isSymbolObject: ['symbol'],
        isBoxedPrimitive: ['number', 'string', 'bool', 'symbol', 'bigint']
    };
    for (const [name, wanted] of Object.entries(expected)) {
        const actual = Object.entries(samples).filter(([key, value]) => types[name](value)).map(([key]) => key);
        equal(actual.join(','), wanted.join(','), 'util.types.' + name);
    }
    for (const array of [new Int8Array(1), new Uint8Array(1), new Float64Array(1), new BigInt64Array(1)]) {
        equal(types.isTypedArray(array), true, 'isTypedArray ' + array.constructor.name);
    }
    equal(types.isTypedArray({[Symbol.toStringTag]: 'Uint8Array'}), false, 'forged typed array tag');
    equal(types.isUint8Array(Buffer.alloc(1)), true, 'a Buffer is a Uint8Array');
    equal(types.isArrayBuffer(new ArrayBuffer(1)) && !types.isArrayBuffer(new Uint8Array(1)), true, 'isArrayBuffer');
    equal(types.isProxy(new Proxy({}, {})) && types.isProxy(new Proxy(function () {}, {})) && !types.isProxy({}) && !types.isProxy(null), true, 'isProxy');
}

// Regressions for issues #27, #31, #32 and #34. Expected values come from Node.
function moduleIssueCases() {
    const qs = require('querystring');
    equal(JSON.stringify(qs.parse('k=v;k2=v2', ';')), '{"k":"v","k2":"v2"}', 'parse with a custom separator');
    equal(JSON.stringify(qs.parse('a:1;b:2', ';', ':')), '{"a":"1","b":"2"}', 'parse with separator and equals');
    equal(JSON.stringify(qs.parse('a=1;;b=2', ';;')), '{"a":"1","b":"2"}', 'multi-character separator');
    equal(JSON.stringify(qs.parse('a=1&b=2', '')), '{"a":"1","b":"2"}', 'empty separator means the default');
    equal(qs.stringify({a: 1, b: 2}, ';', ':'), 'a:1;b:2', 'stringify with separators');
    equal(qs.escape('a b&c=d/é'), 'a%20b%26c%3Dd%2F%C3%A9', 'escape');
    equal(qs.unescape('a+b%41%4%zz'), 'a+bA%4%zz', 'unescape keeps plus and malformed escapes');

    const crypto = require('crypto');
    equal(crypto.createHash('sha1').update('abc').digest('hex'), 'a9993e364706816aba3e25717850c26c9cd0d89d', 'sha1');
    equal(crypto.createHash('md5').update('abc').digest('hex'), '900150983cd24fb0d6963f7d28e17f72', 'md5');
    equal(crypto.createHash('SHA-256').update('abc').digest('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'dashed algorithm name');
    equal(crypto.createHmac('sha1', 'key').update('msg').digest('hex'), '102900b72b7bf1031eec76b4804b66052376896b', 'hmac sha1');
    equal(['md5', 'sha1', 'sha256', 'sha384', 'sha512'].every(name => crypto.getHashes().includes(name)), true, 'getHashes lists the supported algorithms');
    equal(crypto.getHashes() !== crypto.getHashes(), true, 'getHashes returns a fresh array');

    equal(JSON.stringify([...Buffer.from([1, 2, 3, 4]).swap16()]), '[2,1,4,3]', 'swap16');
    equal(JSON.stringify([...Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).swap32()]), '[4,3,2,1,8,7,6,5]', 'swap32');
    equal(JSON.stringify([...Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]).swap64()]), '[8,7,6,5,4,3,2,1]', 'swap64');
    throws(() => Buffer.from([1, 2, 3]).swap16(), error => error.code === 'ERR_INVALID_BUFFER_SIZE', 'swap16 needs an even size');
    throws(() => Buffer.alloc(2).readUInt32LE(0), error => error.code === 'ERR_BUFFER_OUT_OF_BOUNDS', 'read past the end');
    throws(() => Buffer.alloc(2).writeUInt8(300, 0), error => error.code === 'ERR_OUT_OF_RANGE', 'value out of range');
    throws(() => new TextDecoder('utf-8', {fatal: true}).decode(new Uint8Array([0xff])), error => error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA', 'fatal TextDecoder code');
    const EventEmitter = require('events');
    throws(() => new EventEmitter().emit('error', 'text'), error => error.code === 'ERR_UNHANDLED_ERROR', 'unhandled error event code');
    throws(() => {
        const hash = crypto.createHash('sha256');
        hash.digest();
        hash.digest();
    }, error => error.code === 'ERR_CRYPTO_HASH_FINALIZED', 'digest called twice');
    throws(() => crypto.timingSafeEqual(Buffer.from('a'), Buffer.from('ab')), error => error.code === 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH', 'timingSafeEqual length');
}

// A promise that never settles lets the process exit with status 0; catch that at exit.
let finished = false;
process.on('exit', code => {
    if (code === 0 && !finished && !process.exitCode) {
        console.error('core module checks did not finish');
        process.exitCode = 1;
    }
});
async function main() {
    querystringCases();
    chdirCases();
    deepCases();
    await timerCases();
    await utilCases();
    processIdentityCases();
    fsMoreCases();
    await fsPromisesCases();
    await eventsOnceCases();
    assertMatcherCases();
    eventEmitterCases();
    bufferWriteCases();
    urlCases();
    fsIssueCases();
    deepIssueCases();
    await timeoutRefreshCases();
    miscIssueCases();
    moduleIssueCases();
    structuredCloneExtensionCases();
    structuredCloneBufferCases();
    utilTypesCases();
    urlSchemeCases();
    finished = true;
    console.log('Core module checks passed');
}
main().catch(error => {
    // JavaScriptCore stacks omit the message, so print it explicitly.
    console.error(String(error && error.message || error));
    console.error(String(error && error.stack || error));
    process.exitCode = 1;
});
