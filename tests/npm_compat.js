// Permanent package regressions. The Wave runner owns installation and cleanup.
'use strict';
const assert = require('assert');
const root = process.argv[2];
const name = process.argv[3];
const load = id => require(root + '/node_modules/' + id);

async function run() {
    switch (name) {
        case 'application': {
            // Package-based API app using the reviewed, pinned dependency graph.
            const fs = require('fs');
            const cookie = load('cookie');
            const app = load('polka')();
            const dataPath = root + '/application-data.json';
            fs.writeFileSync(dataPath, JSON.stringify({message: '한글', items: [1, 2, 3]}));
            app.use((req, res, next) => {
                req.cookies = cookie.parse(req.headers.cookie || '');
                next();
            });
            app.get('/api/data/:id', async (req, res) => {
                try {
                    const data = JSON.parse(await fs.promises.readFile(dataPath, 'utf8'));
                    res.setHeader('Set-Cookie', [cookie.serialize('session', 'ok', {httpOnly: true}), cookie.serialize('view', req.params.id)]);
                    res.writeHead(200, ['Content-Type', 'application/json', 'X-App', 'jsrt']);
                    res.end(JSON.stringify({data, id: req.params.id, session: req.cookies.session, query: req.query.q}));
                } catch (error) {
                    res.statusCode = 500;
                    res.end('application failure');
                }
            });
            await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
            try {
                const base = 'http://127.0.0.1:' + app.server.address().port;
                for (let i = 0; i < 3; i++) {
                    const response = await fetch(base + '/api/data/42?q=hello', {headers: {cookie: 'session=client'}});
                    const body = await response.json();
                    assert.strictEqual(response.status, 200);
                    assert.strictEqual(response.headers.get('x-app'), 'jsrt');
                    assert.strictEqual(JSON.stringify(response.headers.getSetCookie()), JSON.stringify([
                        cookie.serialize('session', 'ok', {httpOnly: true}), cookie.serialize('view', '42')
                    ]));
                    assert.strictEqual(body.data.message, '한글');
                    assert.strictEqual(body.id, '42');
                    assert.strictEqual(body.session, 'client');
                    assert.strictEqual(body.query, 'hello');
                }
                assert.strictEqual((await fetch(base + '/absent')).status, 404);
            } finally {
                await new Promise(resolve => app.server.close(resolve));
                fs.unlinkSync(dataPath);
            }
            break;
        }
        case 'cli-application': {
            const args = load('minimist')(process.argv.slice(4), {boolean: ['pretty']});
            const fs = require('fs');
            const _ = load('lodash');
            const query = load('fast-querystring');
            const input = JSON.parse(fs.readFileSync(args.input, 'utf8'));
            const selected = _.get(input, args.select);
            assert.strictEqual(selected, '한글');
            assert.strictEqual(query.parse(query.stringify({selected})).selected, selected);
            assert.strictEqual(args.pretty, true);
            break;
        }
        case 'polka': {
            const app = load(name)();
            app.use((req, res, next) => {
                res.setHeader('x-middleware', 'yes');
                next();
            });
            app.get('/hello/:name', (req, res) => {
                assert.strictEqual(res.getHeader('X-MIDDLEWARE'), 'yes');
                assert.strictEqual(res.hasHeader('x-middleware'), true);
                const headers = res.getHeaders();
                headers['x-middleware'] = 'changed';
                assert.strictEqual(res.getHeader('x-middleware'), 'yes');
                res.setHeader('x-remove', 'value');
                res.removeHeader('X-REMOVE');
                assert.strictEqual(res.hasHeader('x-remove'), false);
                let invalidHeaders = false;
                try {res.writeHead(200, ['x']);} catch (error) {invalidHeaders = error instanceof TypeError;}
                assert.strictEqual(invalidHeaders, true);
                const marker = Error('header getter');
                let touched = false;
                try {
                    res.writeHead(200, {get one() {throw marker;}, get two() {touched = true;}});
                    throw Error('getter accepted');
                } catch (error) {
                    assert.strictEqual(error, marker);
                }
                assert.strictEqual(touched, false);
                assert.strictEqual(res.headersSent, false);
                assert.strictEqual(res.writeHead(201, {'content-type': 'application/json'}), res);
                assert.strictEqual(res.headersSent, true);
                let rejected = false;
                try {res.removeHeader('content-type');} catch (error) {rejected = true;}
                assert.strictEqual(rejected, true);
                res.end(JSON.stringify({name: req.params.name, query: req.query}));
            });
            await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
            try {
                const base = 'http://127.0.0.1:' + app.server.address().port;
                const response = await fetch(base + '/hello/wave?a=one&a=two&text=%ED%95%9C%EA%B8%80');
                assert.strictEqual(response.status, 201);
                assert.strictEqual(response.headers.get('x-middleware'), 'yes');
                const body = await response.json();
                assert.strictEqual(body.name, 'wave');
                assert.strictEqual(body.query.a.join(','), 'one,two');
                assert.strictEqual(body.query.text, '한글');
                const missing = await fetch(base + '/absent');
                assert.strictEqual(missing.status, 404);
                assert.strictEqual(await missing.text(), 'Not Found');
            } finally {
                await new Promise(resolve => app.server.close(resolve));
            }
            break;
        }
        case 'cookie': {
            const cookie = load(name);
            const parsed = cookie.parse('a=hello%20world; n=42');
            assert.strictEqual(parsed.a, 'hello world');
            assert.strictEqual(parsed.n, '42');
            assert.strictEqual(cookie.serialize('x', 'a b', {httpOnly: true}), 'x=a%20b; HttpOnly');
            break;
        }
        case 'eventemitter3': {
            const Emitter = load(name);
            const e = new Emitter();
            let total = 0;
            e.once('n', n => total += n);
            e.emit('n', 3);
            e.emit('n', 10);
            assert.strictEqual(total, 3);
            break;
        }
        case 'fast-querystring': {
            const query = load(name);
            const value = {text: '한글 & x', list: ['a', 'b'], n: 42};
            const result = query.parse(query.stringify(value));
            assert.strictEqual(result.text, value.text);
            assert.strictEqual(result.list.join(','), 'a,b');
            assert.strictEqual(result.n, '42');
            break;
        }
        case 'get-stream': {
            const getStream = load(name);
            const {Readable} = require('stream');
            const create = () => new Readable({read() {
                this.push('hello ');
                this.push('한글');
                this.push(null);
            }});
            assert.strictEqual(await getStream(create()), 'hello 한글');
            assert.strictEqual((await getStream.buffer(create())).toString(), 'hello 한글');
            break;
        }
        case 'kleur': {
            const kleur = load(name);
            kleur.enabled = false;
            assert.strictEqual(kleur.red().bold('text'), 'text');
            break;
        }
        case 'lodash': {
            const _ = load(name);
            const original = {a: [{n: 1}]};
            const copy = _.cloneDeep(original);
            copy.a[0].n = 2;
            assert.strictEqual(original.a[0].n, 1);
            assert.strictEqual(_.uniq([1, 2, 1]).join(','), '1,2');
            assert.strictEqual(_.get({a: {b: 42}}, 'a.b'), 42);
            break;
        }
        case 'lodash-es': {
            const module = await import(root + '/node_modules/lodash-es/lodash.js');
            assert.strictEqual(module.chunk([1, 2, 3], 2)[1][0], 3);
            assert.strictEqual(module.isEqual({x: [1]}, {x: [1]}), true);
            break;
        }
        case 'minimatch': {
            const {minimatch} = load(name);
            assert.strictEqual(minimatch('src/a.js', 'src/*.{js,ts}'), true);
            assert.strictEqual(minimatch('src/a.css', 'src/*.{js,ts}'), false);
            break;
        }
        case 'minimist': {
            const parsed = load(name)(['--count', '42', '--flag', 'file'], {boolean: ['flag']});
            assert.strictEqual(parsed.count, 42);
            assert.strictEqual(parsed.flag, true);
            assert.strictEqual(parsed._[0], 'file');
            break;
        }
        case 'ms': {
            const ms = load(name);
            assert.strictEqual(ms('2 days'), 172800000);
            assert.strictEqual(ms(3600000), '1h');
            break;
        }
        case 'picomatch': {
            const match = load(name)('src/**/*.{js,ts}');
            assert.strictEqual(match('src/lib/a.ts'), true);
            assert.strictEqual(match('src/a.css'), false);
            break;
        }
        case 'semver': {
            const semver = load(name);
            assert.strictEqual(semver.satisfies('1.2.3', '^1.0.0'), true);
            assert.strictEqual(semver.satisfies('2.0.0', '^1.0.0'), false);
            assert.strictEqual(semver.maxSatisfying(['1.0.0', '1.5.0', '2.0.0'], '^1'), '1.5.0');
            break;
        }
        default:
            throw Error('unknown compatibility case: ' + name);
    }
    console.log('compatible ' + name);
}
run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
