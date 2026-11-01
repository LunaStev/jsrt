// The same fixtures run in an unmodified JSC context and the Wave host.
// No implementation or fallback code is imported from the native JSON oracle.
function jsonCases() {
    const results = [];
    let seed = 0x12345678;
    function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
    function capture(fn) { try { return ['ok', fn()]; } catch (e) { return ['error', e.name]; } }
    const bytes = new ArrayBuffer(8), view = new DataView(bytes);
    for (let i=0; i<250; i++) {
        view.setUint32(0, random()); view.setUint32(4, random());
        const number = view.getFloat64(0);
        const text = JSON.stringify(number);
        results.push([text, JSON.stringify(JSON.parse(text)), Object.is(JSON.parse(text), number)]);
    }
    for (let i=0; i<80; i++) {
        let text = '';
        for (let j=0; j<12; j++) text += String.fromCharCode(random() & 65535);
        const value = {[text]: ['한글', '\0', text, undefined, NaN, {}, []]};
        const compact = JSON.stringify(value);
        results.push([compact, JSON.stringify(JSON.parse(compact), null, i%4)]);
    }
    const texts = ['-0','-0.0','-1e-400','1e400','-1e400','5e-324','2.2250738585072014e-308',
        '9007199254740993','1000000000000000100','1.00000000000000011102230246251565404236316680908203125',
        '{"a":1,"a":2}','{"2":2,"1":1,"b":3}','"\\ud800"','"\\udc00"','"\\ud800\\udfff"',
        '"\\ue000\\ue100"','{"\\ud800":1,"\\u0000":2}', '[1,]', '01', '\ufeff0','"\\u0000"',
        '"\ud800"','"\\ud800\udfff"','"\\ud800x"','"\\uD800\\uDC00"','"\\ud800\\u0061"',
        '{"🌊":1,"\\ud83c\\udf0a":2,"🌊":3}'];
    for (const text of texts) results.push(capture(() => {
        const value = JSON.parse(text);
        return [JSON.stringify(value), typeof value === 'number' ? [Object.is(value,-0), String(value)] : null];
    }));
    const gaps = [undefined,0,1,2.8,12,-1,NaN,Infinity,'\t','abcdefghijk','\ud800',new Number(2),new String('ab')];
    for (const gap of gaps) results.push(JSON.stringify({a:[1,{},[],{s:'[],{}:"\\\u007f'}]}, null, gap));
    for (const replacer of [undefined, null, [], ['b','a','b'], [new String('a'),new Number(2),'__proto__'], function(k,v) {return typeof v === 'number' ? v*2 : v;}]) {
        results.push(JSON.stringify({a:1,b:2,2:3,nested:{a:4,b:5}, array:[1,undefined]}, replacer, 1));
    }
    results.push(JSON.parse('{"a":[1,2],"b":3}', function(k,v){return k === 'b' ? undefined : v;}));
    results.push(capture(() => JSON.stringify(1n)));
    const cycle = {}; cycle.a=cycle;
    results.push(capture(() => JSON.stringify(cycle)));
    const number = new Number(3); number[Symbol.toPrimitive]=() => 7;
    results.push(JSON.stringify(number));
    const string = new String('a'); string[Symbol.toPrimitive]=() => 'b';
    results.push(JSON.stringify(string));
    const revoked = Proxy.revocable([],{}); revoked.revoke();
    results.push(capture(() => JSON.stringify(revoked.proxy)));
    results.push(capture(() => JSON.stringify({}, revoked.proxy)));
    if (typeof JSON.rawJSON === 'function') {
        for (const raw of ['12345678901234567890', '"\\ud800"', 'true', '-0']) results.push(JSON.stringify([JSON.rawJSON(raw)]));
    }
    return JSON.stringify(results);
}
if (typeof console === 'undefined') jsonCases();
else console.log(jsonCases());
