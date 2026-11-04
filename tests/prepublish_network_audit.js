// Permanent diagnostic inventory. Gaps are reported separately from failed controls.
// Run on jsrt in a socket-capable environment; this is not the main regression suite.
'use strict';

const http = require('http');
const results = [];

function report(id, expected, observed, control = false) {
    const matches = JSON.stringify(expected) === JSON.stringify(observed);
    const status = matches ? 'confirmed' : (control ? 'control-failure' : 'gap');
    results.push({id, status, expected, observed});
    console.log(JSON.stringify(results[results.length - 1]));
}

function getHeaders(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, response => {
            response.on('error', reject);
            response.on('end', () => resolve(response.headers));
            response.resume();
        });
        request.on('error', reject);
    });
}

async function run() {
    const server = http.createServer((request, response) => {
        request.on('error', () => {});
        response.on('error', () => {});
        if (request.url === '/headers') {
            response.setHeader('Set-Cookie', ['first=1; Path=/', 'second=2; Path=/']);
            response.setHeader('X-Audit', ['one', 'two']);
            response.setHeader('X-Control', 'present');
            request.resume();
            response.end('ok');
            return;
        }
        if (request.url === '/redirect303' || request.url === '/redirect307') {
            request.resume();
            response.statusCode = request.url === '/redirect303' ? 303 : 307;
            response.setHeader('Location', '/seen');
            response.end();
            return;
        }
        const chunks = [];
        request.on('data', chunk => chunks.push(chunk));
        request.on('end', () => {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({method: request.method, body: Buffer.concat(chunks).toString()}));
        });
    });
    await new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    try {
        const base = 'http://127.0.0.1:' + server.address().port;
        const headers = await getHeaders(base + '/headers');
        report('http.singleHeader', 'present', headers['x-control'], true);
        report('http.duplicateSetCookie', ['first=1; Path=/', 'second=2; Path=/'], headers['set-cookie']);
        report('http.duplicateCustomHeader', 'one, two', headers['x-audit']);
        const response = await fetch(base + '/headers');
        report('fetch.bodyControl', 'ok', await response.text(), true);
        report('fetch.duplicateCustomHeader', 'one, two', response.headers.get('x-audit'));
        for (const status of [303, 307]) {
            const redirected = await fetch(base + '/redirect' + status, {method: 'POST', body: 'payload'});
            const expected = status === 303 ? {method: 'GET', body: ''} : {method: 'POST', body: 'payload'};
            report('fetch.postRedirect' + status, expected, await redirected.json(), true);
        }
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
    const gaps = results.filter(result => result.status === 'gap').length;
    const controlFailures = results.filter(result => result.status === 'control-failure').length;
    console.log(JSON.stringify({audit: 'prepublish network', total: results.length, gaps, controlFailures}));
    if (controlFailures > 0) {
        process.exitCode = 1;
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
