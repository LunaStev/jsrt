// Permanent regressions for util.inspect/format, timer handles and the small
// process, clock and base64 globals. Run only with jsrt/JSC.
const util = require('util');
function check(value, message) {
    if (!value) {
        throw new Error(message);
    }
}
function equal(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message + '\n  expected: ' + JSON.stringify(expected) + '\n  actual:   ' + JSON.stringify(actual));
    }
}
function rejects(run, name, message) {
    let seen = null;
    try {
        run();
    } catch (error) {
        seen = error;
    }
    check(seen !== null && seen.name === name, message + ' (got ' + (seen && seen.name) + ')');
}
const inspect = value => util.inspect(value);

function inspectCases() {
    equal(inspect({a: 1, b: [1, 'x', {c: null}]}), "{ a: 1, b: [ 1, 'x', { c: null } ] }", 'plain object');
    equal(inspect([1, 2, 3]), '[ 1, 2, 3 ]', 'array');
    equal(inspect('it\'s'), '"it\'s"', 'quote selection');
    equal(inspect('a\nb'), "'a\\nb'", 'newline escape');
    equal(inspect(-0), '-0', 'negative zero');
    equal(inspect(10n), '10n', 'bigint');
    equal(inspect(Symbol('s')), 'Symbol(s)', 'symbol');
    equal(inspect(undefined), 'undefined', 'undefined');
    equal(inspect([, , 1]), '[ <2 empty items>, 1 ]', 'sparse array');
    equal(inspect(new Map([[1, {a: 2}]])), 'Map(1) { 1 => { a: 2 } }', 'map');
    equal(inspect(new Set([1, 'a'])), "Set(2) { 1, 'a' }", 'set');
    equal(inspect(function f() {}), '[Function: f]', 'function');
    equal(inspect(class A {}), '[class A]', 'class');
    equal(inspect(class B extends Array {}), '[class B extends Array]', 'derived class');
    equal(inspect(async () => {}), '[AsyncFunction (anonymous)]', 'async function');
    equal(inspect(Object.assign(function named() {}, {y: 2})), '[Function: named] { y: 2 }', 'function with property');
    equal(inspect(Object.create(null)), '[Object: null prototype] {}', 'null prototype');
    equal(inspect(new (class Foo { constructor() { this.a = 1; } })()), 'Foo { a: 1 }', 'class instance');
    equal(inspect(new Date(0)), '1970-01-01T00:00:00.000Z', 'date');
    equal(inspect(/re/g), '/re/g', 'regexp');
    equal(inspect(new Boolean(true)), '[Boolean: true]', 'boxed boolean');
    equal(inspect(new String('s')), "[String: 's']", 'boxed string omits index keys');
    equal(inspect(Buffer.from('hello')), '<Buffer 68 65 6c 6c 6f>', 'buffer');
    equal(inspect(new Float64Array([1.5, 2])), 'Float64Array(2) [ 1.5, 2 ]', 'typed array uses element count');
    equal(inspect({get g() { return 1; }, set s(v) {}, get gs() { return 1; }, set gs(v) {}}),
        '{ g: [Getter], s: [Setter], gs: [Getter/Setter] }', 'accessors are not invoked');
    equal(inspect({'a-b': 1, [Symbol('k')]: 2}), "{ 'a-b': 1, Symbol(k): 2 }", 'quoted and symbol keys');
    const cyclic = {name: 'o'};
    cyclic.self = cyclic;
    equal(inspect(cyclic), "<ref *1> { name: 'o', self: [Circular *1] }", 'circular reference');
    equal(util.inspect({a: {b: {c: {d: 1}}}}, {depth: 0}), '{ a: [Object] }', 'depth option');
    equal(util.inspect({a: {b: {c: {d: 1}}}}), '{ a: { b: { c: [Object] } } }', 'default depth');
    equal(util.inspect(Array(200).fill(1), {maxArrayLength: 3}), '[ 1, 1, 1, ... 197 more items ]', 'array limit');
    equal(util.inspect(['a'.repeat(10)], {maxStringLength: 3}), "[ 'aaa'... 7 more characters ]", 'string limit');
    check(inspect(Array.from({length: 120}, (_, i) => i)).includes('... 20 more items'), 'default array limit');
    const hook = {[util.inspect.custom]: () => 'CUSTOM'};
    equal(inspect(hook), 'CUSTOM', 'custom inspect hook');
    equal(inspect([hook]), '[ CUSTOM ]', 'nested custom inspect hook');
    equal(typeof util.inspect.custom, 'symbol', 'custom symbol');
    equal(util.inspect.custom, Symbol.for('nodejs.util.inspect.custom'), 'custom symbol is registered');
    const trap = {toString() { throw new Error('must not run'); }, get boom() { throw new Error('getter must not run'); }};
    equal(inspect(trap), '{ toString: [Function: toString], boom: [Getter] }', 'inspection never runs user code');
    check(/^Error: boom\n    at /.test(inspect(new Error('boom'))), 'error includes frames');
    check(inspect(new RangeError('bad')).startsWith('RangeError: bad'), 'error name');
    equal(inspect(Object.create({[Symbol.toStringTag]: 'T'})), 'Object [T] {}', 'inherited toStringTag');
    equal(inspect(new (class X { get [Symbol.toStringTag]() { return 'Y'; } })()), 'X [Y] {}', 'class toStringTag');
    equal(inspect({get [Symbol.toStringTag]() { return 'Own'; }}), '{ Symbol(Symbol.toStringTag): [Getter] }',
        'own enumerable toStringTag is a plain property');
    // JSC's C API cannot identify Proxy objects, so traps are observable; a
    // transparent Proxy must still print its target's contents and prototype.
    check(inspect(new Proxy({a: 1}, {})).includes('{ a: 1 }'), 'transparent proxy');
    check(!inspect(new Proxy(new Map(), {})).includes('null prototype'), 'proxy prototype is read through Reflect');
}

function formatCases() {
    equal(util.format('%s:%d:%i:%f:%j:%%', 'x', '3.5', '3.9', '1.5', {a: 1}, 'extra'), 'x:3.5:3:1.5:{"a":1}:% extra', 'placeholders');
    equal(util.format('a', 'b', 3), 'a b 3', 'string first without placeholders');
    equal(util.format(1, 2, 'x'), '1 2 x', 'non-string first');
    equal(util.format('%s %s', 'a'), 'a %s', 'missing argument keeps placeholder');
    equal(util.format('%s', 5n, -0), '5n -0', 'bigint and negative zero');
    equal(util.format('%d', 1n), '1n', 'bigint %d');
    equal(util.format('%s', {a: {b: {c: 1}}}), '{ a: [Object] }', 'object %s uses depth zero');
    equal(util.format('%s', function f() {}), 'function f() {}', 'function %s uses source');
    equal(util.format('%j', {toJSON() { return 'tj'; }}), '"tj"', '%j');
    const loop = {};
    loop.me = loop;
    equal(util.format('%j', loop), '[Circular]', '%j circular');
    equal(util.format('%c styled', 'color:red'), ' styled', '%c consumes its argument');
    equal(util.format('100%', 'x'), '100% x', 'trailing percent');
    equal(util.format('%s', {toString() { return 'custom'; }}), 'custom', 'user toString is called by %s');
    const reason = new Error('format failure');
    let seen = null;
    try {
        util.format('%s', {toString() { throw reason; }});
    } catch (error) {
        seen = error;
    }
    check(seen === reason, 'first thrown conversion error is preserved');
    equal(util.format(), '', 'no arguments');
}

function base64Cases() {
    equal(btoa('hello'), 'aGVsbG8=', 'btoa');
    equal(btoa(''), '', 'btoa empty');
    equal(btoa('\xff\xfe'), '//4=', 'btoa latin1');
    equal(atob('aGVsbG8='), 'hello', 'atob');
    equal(atob(' aGVs bG8 '), 'hello', 'atob ignores ASCII whitespace');
    equal(atob('YQ'), 'a', 'atob accepts missing padding');
    equal(atob(btoa('\x00\x01\x80\xff')), '\x00\x01\x80\xff', 'binary round trip');
    for (const bad of ['a', 'a===', 'ab$d', 'YQ=a']) {
        rejects(() => atob(bad), 'InvalidCharacterError', 'atob rejects ' + bad);
    }
    rejects(() => btoa('€'), 'InvalidCharacterError', 'btoa rejects non-Latin1');
    check((() => { try { atob('a'); } catch (error) { return error instanceof DOMException; } })(), 'DOMException type');
    rejects(() => atob(), 'TypeError', 'atob requires an argument');
}

function processCases() {
    check(global === globalThis, 'global alias');
    const start = process.hrtime();
    check(Array.isArray(start) && start.length === 2, 'hrtime pair');
    const delta = process.hrtime(start);
    check(delta[0] >= 0 && delta[1] >= 0, 'hrtime delta');
    equal(typeof process.hrtime.bigint(), 'bigint', 'hrtime.bigint');
    check(process.hrtime.bigint() >= process.hrtime.bigint() - 1000000000n, 'hrtime.bigint is monotonic enough');
    rejects(() => process.hrtime(5), 'TypeError', 'hrtime rejects non-arrays');
    rejects(() => process.hrtime([-1, 0]), 'RangeError', 'hrtime rejects negative parts');
    check(process.uptime() >= 0 && process.uptime() < 60, 'uptime');
    const first = performance.now();
    check(first >= 0 && performance.now() >= first, 'performance.now is monotonic');
    check(Math.abs(performance.timeOrigin + performance.now() - Date.now()) < 5000, 'timeOrigin');
    const usage = process.memoryUsage();
    check(usage.rss > 1000000, 'rss is measured');
    for (const key of ['heapTotal', 'heapUsed', 'external', 'arrayBuffers']) {
        equal(typeof usage[key], 'number', 'memoryUsage field ' + key);
    }
    check(process.memoryUsage.rss() > 1000000, 'memoryUsage.rss');
    check(process.pid > 0 && process.ppid > 0, 'pid and ppid');
    rejects(() => process.exit('1'), 'TypeError', 'exit code type');
    rejects(() => process.exit(256), 'RangeError', 'exit code range');
    rejects(() => process.exit(1.5), 'RangeError', 'exit code integer');
}

async function timerCases() {
    const order = [];
    const timeout = setTimeout(() => order.push('timeout'), 5);
    equal(typeof timeout, 'object', 'timer handle is an object');
    check(timeout.hasRef(), 'new timers are ref\'d');
    check(timeout.unref() === timeout && !timeout.hasRef(), 'unref returns the handle');
    check(timeout.ref() === timeout && timeout.hasRef(), 'ref returns the handle');
    check(+timeout > 0 && `${timeout}` === String(+timeout), 'handle converts to its numeric identifier');
    check(Object.keys(timeout).length === 0, 'handle exposes no enumerable internals');
    const cleared = setTimeout(() => order.push('WRONG'), 1);
    clearTimeout(+cleared);
    const clearedByHandle = setTimeout(() => order.push('WRONG'), 1);
    clearTimeout(clearedByHandle);
    clearTimeout(undefined);
    clearTimeout({});
    const immediate = setImmediate((a, b) => order.push('immediate' + a + b), 1, 2);
    const droppedImmediate = setImmediate(() => order.push('WRONG'));
    clearImmediate(droppedImmediate);
    check(immediate.hasRef(), 'immediate is ref\'d');
    let ticks = 0;
    const interval = setInterval(() => {
        order.push('interval');
        if (++ticks === 2) {
            clearInterval(interval);
        }
    }, 2);
    let refreshed = false;
    const delayed = setTimeout(() => { refreshed = true; }, 20);
    delayed.refresh();
    await new Promise(resolve => setTimeout(resolve, 80));
    check(refreshed, 'refreshed timer fired');
    check(order.includes('timeout') && order.includes('immediate12') && ticks === 2, 'timers fired: ' + order.join(','));
    check(!order.includes('WRONG'), 'cleared timers did not fire');
    check(order.indexOf('immediate12') < order.indexOf('timeout'), 'immediate runs before a 5ms timeout');
    const closed = setTimeout(() => order.push('WRONG'), 1);
    closed.close();
    await new Promise(resolve => setTimeout(resolve, 10));
    check(!order.includes('WRONG'), 'close cancels a timer');
    // An unref'd timer must not keep the process alive: the parent process of
    // this test would hang otherwise, so a leftover long timer proves the rule.
    setTimeout(() => { throw new Error('unref\'d timer fired'); }, 600000).unref();
}

async function main() {
    inspectCases();
    formatCases();
    base64Cases();
    processCases();
    await timerCases();
    console.log('Core global checks passed');
}
main().catch(error => {
    console.error(String(error));
    process.exitCode = 1;
});
