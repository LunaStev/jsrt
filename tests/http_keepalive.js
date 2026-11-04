// Automated fixture: two pipelined requests must share one transport.
const http = require('http');
const fs = require('fs');
let first;
let count = 0;
const server = http.createServer({keepAlive: true, keepAliveTimeout: 1000}, (req, res) => {
    req.resume();
    count++;
    if (count === 1) {
        first = res;
        res.end('/one');
    } else {
        let rejected = false;
        try { first.write('stale'); } catch { rejected = true; }
        if (!rejected) throw Error('stale response retained a reused connection');
        server.close(() => console.log('keep-alive fixture closed'));
        res.end('/two');
    }
});
server.listen(0, '127.0.0.1', () => fs.writeFileSync(process.argv[2], String(server.address().port)));
