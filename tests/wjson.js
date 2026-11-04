// Actual JavaScript API tests. The implementation under test is entirely Wave.
'use strict';
let checks = 0;
function check(ok, name) { ++checks; if (!ok) throw new Error('wjson: ' + name); }
function equal(actual, expected, name) { check(Object.is(actual, expected), name + ': ' + String(actual)); }
function throws(fn, Type, name, fragment) {
    let caught;
    try { fn(); } catch (error) { caught = error; }
    check(caught instanceof Type && (!fragment || caught.message.includes(fragment)), name);
}
equal(JSON.parse.name, 'parse', 'parse name');
equal(JSON.stringify.name, 'stringify', 'stringify name');
equal(JSON.parse.length, 2, 'parse arity');
equal(JSON.stringify.length, 3, 'stringify arity');
check(!Object.keys(JSON).includes('parse'), 'non-enumerable method');
throws(() => new JSON.parse('0'), TypeError, 'parse not constructible');
throws(() => new JSON.stringify(0), TypeError, 'stringify not constructible');
for (const [source, expected] of [['true', true], ['false', false], ['null', null], ['-0', -0], ['1e400', Infinity], ['-1e-4000', -0], ['9007199254740993', 9007199254740992]]) {
    equal(JSON.parse(source), expected, 'parse primitive ' + source);
}
equal(JSON.parse(42), 42, 'ToString input');
equal(JSON.parse({toString() { return '123'; }}), 123, 'input coercion');
throws(() => JSON.parse(Symbol()), TypeError, 'symbol coercion');
throws(() => JSON.parse(), SyntaxError, 'missing input');
for (const source of ['', '[1,]', '{"a":1,}', '01', '1.', '+1', 'NaN', 'Infinity', 'true false', '/*x*/0', '"\n"', '"\\x41"', '"\\uZZZZ"', '\ufeff0', '"ok"\0']) {
    throws(() => JSON.parse(source), SyntaxError, 'strict syntax ' + source);
}
throws(() => JSON.parse('[1,]'), SyntaxError, 'wjson parser dispatched', 'unexpected');
const object = JSON.parse('{"__proto__":{"polluted":true},"constructor":3,"a":1,"a":2,"k\\u0000x":7,"k":8}');
equal(Object.getPrototypeOf(object), Object.prototype, 'ordinary object prototype');
check(Object.hasOwn(object, '__proto__'), 'own __proto__');
equal(object.__proto__.polluted, true, '__proto__ data');
equal({}.polluted, undefined, 'no prototype pollution');
equal(object.a, 2, 'duplicate last wins');
equal(object['k\0x'], 7, 'NUL key');
equal(object.k, 8, 'NUL key distinct');
equal(JSON.stringify(JSON.parse('{"z":0,"a":1,"z":2,"a":null}')), '{"z":2,"a":null}', 'duplicate insertion order');
equal(JSON.parse('{"🌊":1,"\\ud83c\\udf0a":2,"🌊":3}')['🌊'], 3, 'duplicate Unicode aliases');
const duplicateSource = '{' + '"a":0,'.repeat(1000) + '"a":[' + '0,'.repeat(999) + '0]}';
equal(JSON.parse(duplicateSource).a.length, 1000, 'duplicate large final value');
equal(JSON.stringify(object), '{"__proto__":{"polluted":true},"constructor":3,"a":2,"k\\u0000x":7,"k":8}', 'key preservation');
const strings = ['한글 🌊', '\0\b\f\n\r\t"\\/', '\u007f', '\ud800', '\udfff', '\ud800x\udfff', '\ue000', '\ue000\ue100', '\ue000\ue000', '\ue100', '\ue8ff', '\udbff\udfff', '\ud800\udc00'];
for (const s of strings) equal(JSON.parse(JSON.stringify(s)), s, 'UTF-16 round trip');
equal(JSON.stringify('\ud800'), '"\\ud800"', 'well-formed surrogate output');
equal(JSON.stringify('\u007f'), '"\u007f"', 'DEL literal output');
equal(JSON.stringify('\\u007f'), '"\\\\u007f"', 'literal escape unchanged');
equal(JSON.parse('"\\ud800"'), '\ud800', 'escaped surrogate');
equal(JSON.parse('"' + '\ud800' + '"'), '\ud800', 'literal surrogate');
equal(JSON.parse('"\\ud83c\\udf0a"'), '🌊', 'escaped pair');
equal(JSON.parse('"\\ud83c' + '\udf0a' + '"'), '🌊', 'mixed pair');
equal(JSON.parse('"\\ue000\\ue100"'), '\ue000\ue100', 'escaped transport collision');
equal(JSON.parse('{"🌊":1,"\\ud83c\\udf0a":2}')['🌊'], 2, 'equivalent key spelling');
for (const [v, expected] of [[undefined, undefined], [Symbol(), undefined], [() => {}, undefined], [NaN, 'null'], [Infinity, 'null'], [-0, '0'], [1e-7, '1e-7'], [1e-6, '0.000001'], [1e20, '100000000000000000000'], [1e21, '1e+21'], [1000000000000000100, '1000000000000000100']]) {
    equal(JSON.stringify(v), expected, 'stringify primitive ' + String(v));
}
equal(JSON.stringify({a:undefined, b:Symbol(), c(){}, d:NaN}), '{"d":null}', 'omitted values');
equal(JSON.stringify([undefined, Symbol(), () => {}, , NaN]), '[null,null,null,null,null]', 'array nulls');
equal(JSON.stringify({10:1, 2:2, z:3, a:4}), '{"2":2,"10":1,"z":3,"a":4}', 'property order');
equal(JSON.stringify([new Number(2), new String('x'), new Boolean(false)]), '[2,"x",false]', 'boxed primitives');
throws(() => JSON.stringify(1n), TypeError, 'BigInt error');
throws(() => JSON.stringify(Object(1n)), TypeError, 'boxed BigInt error');
const cycle = {}; cycle.self = cycle;
throws(() => JSON.stringify(cycle), TypeError, 'cycle error', 'wjson');
equal(JSON.stringify({a:cycle}, (k,v) => k === 'a' ? 1 : v), '{"a":1}', 'replacer removes cycle');
const shared = {v:1};
equal(JSON.stringify([shared, shared]), '[{"v":1},{"v":1}]', 'shared references allowed');
const trace = [];
const result = JSON.stringify({item:{toJSON(k) { trace.push('to:' + k); return {v:2}; }}}, function(k,v) { trace.push('replace:' + k); if(k === 'v') check(this.v === 2, 'replacer receiver'); return v; });
equal(result, '{"item":{"v":2}}', 'toJSON before replacer');
equal(trace.join(','), 'replace:,to:item,replace:item,replace:v', 'callback order');
equal(JSON.stringify({a:1, b:2}, ['b', 'a', 'b', new String('a'), true]), '{"b":2,"a":1}', 'property list order and dedupe');
const inherited = Object.create({a:7}); inherited.b = 8;
equal(JSON.stringify(inherited), '{"b":8}', 'own keys');
equal(JSON.stringify(inherited, ['a']), '{"a":7}', 'property list includes inherited values');
equal(JSON.stringify({a:[1,{}]}, null, 2), '{\n  "a": [\n    1,\n    {}\n  ]\n}', 'pretty indent');
equal(JSON.stringify({a:1}, null, 'abcdefghijk'), '{\nabcdefghij"a": 1\n}', 'string gap clamped');
equal(JSON.stringify([1], null, new Number(2.9)), '[\n  1\n]', 'boxed numeric gap');
equal(JSON.stringify([1], null, new String('\t')), '[\n\t1\n]', 'boxed string gap');
equal(JSON.stringify([1], null, Infinity), '[\n          1\n]', 'infinite gap');
equal(JSON.stringify({s:'[],{}:"\\'}, null, 1), String.raw`{
 "s": "[],{}:\"\\"
}`, 'format string punctuation');
const reviverTrace = [];
const revived = JSON.parse('{"a":[1,2],"drop":3}', function(k,v) { reviverTrace.push(k); if(k === 'drop' || k === '0') return undefined; if(k === '1') { check(Array.isArray(this), 'reviver receiver'); return v*2; } return v; });
equal(reviverTrace.join(','), '0,1,a,drop,', 'reviver postorder');
check(!(0 in revived.a) && revived.a[1] === 4 && !('drop' in revived), 'reviver deletion');
equal(JSON.parse('1', () => undefined), undefined, 'root reviver deletion');
equal(JSON.parse('1', function(k,v) { return k === '' ? v+1 : v; }), 2, 'root reviver replacement');
const frozen = JSON.parse('{"a":1,"b":2}', function(k,v) { if(k === 'a') Object.freeze(this); return typeof v === 'number' ? 9 : v; });
equal(frozen.a, 1, 'reviver define failure ignored');
const exception = new Error('callback error');
for (const f of [() => JSON.parse('1', () => {throw exception;}), () => JSON.stringify({get x(){throw exception;}}), () => JSON.stringify(1, () => {throw exception;}), () => JSON.stringify({toJSON(){throw exception;}})]) {
    let caught; try { f(); } catch(e) { caught=e; } equal(caught, exception, 'original exception retained');
}
equal(JSON.stringify({a:1}, function(k,v) { if(k === 'a') return JSON.parse('2'); return v; }), '{"a":2}', 'reentrant parse');
equal(JSON.stringify({toJSON(){return JSON.stringify([1,2]);}}), '"[1,2]"', 'reentrant stringify');
const originalBigIntJSON = BigInt.prototype.toJSON;
BigInt.prototype.toJSON = function() { 'use strict'; check(typeof this === 'bigint', 'primitive BigInt receiver'); return String(this); };
equal(JSON.stringify(123n), '"123"', 'BigInt toJSON');
if (originalBigIntJSON === undefined) delete BigInt.prototype.toJSON; else BigInt.prototype.toJSON = originalBigIntJSON;
if (typeof JSON.rawJSON === 'function') equal(JSON.stringify({v:JSON.rawJSON('9007199254740993')}), '{"v":9007199254740993}', 'rawJSON precision');
// Reviver source contexts preserve spelling and ignore values changed by callbacks.
equal(JSON.parse('9007199254740993', (key, value, context) => BigInt(context.source)), 9007199254740993n, 'reviver numeric source');
equal(JSON.parse(' 1.2300e+2 ', (key, value, context) => context.source), '1.2300e+2', 'reviver exponent spelling');
equal(JSON.parse('"\\u0041"', (key, value, context) => context.source), '"\\u0041"', 'reviver escape spelling');
equal(JSON.parse('"\\uD800"', (key, value, context) => context.source), '"\\uD800"', 'reviver surrogate spelling');
const contexts = [];
JSON.parse('{"a":1,"b":2,"z":-0}', function(key, value, context) {
    contexts.push(context);
    if (key === 'a') {
        this.b = 9;
        this.z = 0;
    }
    if (key === 'b' || key === 'z' || key === '') {
        check(!Object.hasOwn(context, 'source'), 'reviver omits changed or object source');
    }
    return value;
});
check(new Set(contexts).size === contexts.length, 'reviver contexts are fresh');
let sourceCoercions = 0;
JSON.parse({toString() {
    sourceCoercions++;
    return '{"a":{"evil":0},"a":{"b":1}}';
}}, function(key, value, context) {
    if (key === 'b') {
        equal(context.source, '1', 'duplicate member source');
    }
    return value;
});
equal(sourceCoercions, 1, 'source context converts input once');
// JSON creation must bypass setters, even after the engine prototypes change.
let setterCalls = 0;
Object.defineProperty(Object.prototype, 'danger', {set(){++setterCalls;}, configurable:true});
Object.defineProperty(Array.prototype, '0', {set(){++setterCalls;}, configurable:true});
try {
    const parsed = JSON.parse('{"danger":1,"a":[2]}');
    check(parsed.danger === 1 && parsed.a[0] === 2 && setterCalls === 0, 'parse bypasses inherited setters');
} finally { delete Object.prototype.danger; delete Array.prototype[0]; }
const oldKeys = Object.keys, oldApply = Reflect.apply, oldDefine = Reflect.defineProperty, oldIsArray = Array.isArray;
try {
    Object.keys = Reflect.apply = Reflect.defineProperty = Array.isArray = () => {throw new Error('mutated intrinsic');};
    equal(JSON.stringify(JSON.parse('{"a":[1]}', (k,v) => v)), '{"a":[1]}', 'captured intrinsics');
} finally { Object.keys=oldKeys; Reflect.apply=oldApply; Reflect.defineProperty=oldDefine; Array.isArray=oldIsArray; }
// Dispatch evidence: these bounded host policies are not the engine JSON path.
throws(() => JSON.parse('['.repeat(129) + '0' + ']'.repeat(129)), RangeError, 'parse depth policy');
let deep = {}; for (let i=0;i<129;i++) deep={a:deep};
throws(() => JSON.stringify(deep), RangeError, 'stringify depth policy');
throws(() => JSON.stringify(new Array(131073)), RangeError, 'collection policy');
throws(() => JSON.parse('"' + 'x'.repeat(4194304) + '"'), RangeError, 'input length policy');
// Failures must release all per-call native resources and leave later calls usable.
for (let i=0;i<100;i++) { try { JSON.stringify(cycle); } catch {} try { JSON.parse('['); } catch {} }
equal(JSON.stringify(JSON.parse('{"recovered":true}')), '{"recovered":true}', 'recovery after failure');
console.log('wjson JS API:', checks, 'checks passed');
