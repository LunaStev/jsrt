---
title: Compatibility
nav_order: 5
---

# Compatibility

jsrt implements selected Node.js and Web APIs. API presence does not imply full
Node.js, Bun, npm, or WHATWG compatibility. Check the behavior your application
uses, particularly stream adapters, native add-ons, and package installation.

## Modules

CommonJS supports relative and package resolution, `require`, caching, package
`main`, and supported `exports` and `imports` mappings. ES modules use the
JavaScriptCore module loader with Wave resolution and CommonJS, built-in, and
JSON interop. Relative dynamic imports from CommonJS support paths containing
spaces, percent signs, hashes, and Unicode.

`require(ESM)` and inference of named exports from CommonJS are not supported.
The public `URL` API supports HTTP(S); `url.fileURLToPath` and `pathToFileURL`
are not available.

## Core APIs

| Area | Available subset |
| --- | --- |
| Globals | `console`, `Buffer`, `global`, `performance.now` and `timeOrigin`, `atob`, `btoa` |
| Utilities | `util.inspect`, `format`, `inherits`, `promisify`, `callbackify`, `deprecate`, `isDeepStrictEqual` |
| Assertions | Strict equality and deep strict comparison, with negated forms |
| Modules | Selected `events`, `path`, `os`, `url`, and `querystring` APIs |
| Files | Synchronous, Promise, and callback operations; partial FileHandle and file streams |
| Cryptography | Hashes, HMAC, and operating-system random bytes |
| Networking | HTTP server/client APIs, HTTPS client, and `fetch` |

### Utilities and assertions

`util.inspect` accepts `depth`, `breakLength`, `maxArrayLength`, and
`maxStringLength`. Other options, including colors, sorting, and hidden fields,
are ignored. Proxy targets, Promise state, and WeakMap/WeakSet contents are not
exposed; proxies print as `Proxy(<target unavailable>)`.

`util.deprecate` warns once per wrapper to stderr. It does not provide
`process.emitWarning`, warning events, code-level deduplication, or
`--no-deprecation`; constructor wrapping with `new` is not specially handled.
`util.promisify.custom` uses `Symbol.for('nodejs.util.promisify.custom')`.

`assert.deepStrictEqual` and `util.isDeepStrictEqual` compare prototypes, enumerable
own string and Symbol keys, and supported built-in structures. Cycles are
supported. Comparison is bounded to depth 64 and two million steps.
WeakMap and Promise contents are not inspected. `assert.equal` and `deepEqual`
use strict semantics; they are not Node.js's loose comparison variants.

`querystring.parse`/`decode` and `stringify`/`encode` support the default separators.
Custom separators and options are not supported. Parsing is limited to 8,191
input bytes and 1,024 pairs; serialization follows the URL pair budget.

### JSON

`JSON.parse` and `JSON.stringify` use wjson, including reviver, replacer, and
`toJSON` handling. A reviver receives a fresh context object with `source` for
unchanged primitive values; objects and values changed by callbacks have no
source field. Host limits apply to input size, depth, and collection size.

## Timers and process

Timeout objects support `ref`, `unref`, `hasRef`, `refresh`, `close`, and numeric
conversion. Unreferenced timers do not keep the event loop alive. `setImmediate`
uses the timer store and does not guarantee Node.js's check-phase ordering.

`timers/promises` provides `setTimeout`, `setImmediate`, `scheduler.wait`, and
`scheduler.yield`. Options such as `signal` and `ref` are rejected; the
`setInterval` async iterator is not implemented.

`process.nextTick` runs before Promise jobs on ordinary host entry returns.
Ticks scheduled by a Promise job run after the current engine checkpoint.

`process` includes identification fields (`version`, `title`, `argv0`, `execArgv`, `release`), environment and arguments, `cwd`,
`chdir`, exit handling, `hrtime`, `uptime`, `memoryUsage`, and selected process
events. `process.version` and `versions.jsrt` identify jsrt; `versions.node` is
absent. `memoryUsage` reports RSS, with JavaScript heap and external-memory fields
set to zero. Exit codes are integers from 0 through 255.

`SIGINT`, `SIGTERM`, `beforeExit`, and `exit` have partial support. Signal
subscriptions alone do not keep the process alive. Worker signal subscriptions,
`process.chdir`, and `process.exit` are rejected. The working directory is shared
by the process: changing it can affect already queued relative file operations.

stdout and stderr are synchronous Writable streams. stdin is a host Readable
using Linux procfs, with UTF-8 decoding. TTY/raw mode, Worker stdin, IPC, and
`process.kill` are not implemented.

`child_process.spawn` requires an absolute executable path and explicit
`stdio: 'inherit'` or `'pipe'`. Shell execution, PATH lookup, stdio arrays,
custom environment or working directory, and IPC are not supported.

## Files and Node.js streams

Callback forms exist for `readFile`, `writeFile`, `stat`, `lstat`, `access`,
`mkdir`, `unlink`, `rmdir`, `rename`, and `readdir`. Completion uses `nextTick`.
Callback `open`, `close`, `read`, `write`, and `appendFile`, file watching,
and further FileHandle overloads are missing.

Synchronous path functions: `appendFileSync`, `copyFileSync`, `rmSync`,
`mkdtempSync`, `chmodSync`, `truncateSync`, `symlinkSync`, `readlinkSync`,
`realpathSync` (with `.native`), and `utimesSync`. Descriptor functions:
`openSync`, `closeSync`, `readSync`, `writeSync`, `fstatSync`, `fsyncSync`,
`fdatasyncSync`, and `ftruncateSync`. Errors carry `code`, `errno`, and `syscall`;
descriptor errors have an empty `path`. `fs.constants` includes `COPYFILE_*`,
`O_*`, and `S_IF*` values.

`closeSync` only closes descriptors opened by `openSync` (at most 256, then
`EMFILE`); descriptors left open are closed when the context shuts down. Descriptors
0, 1, and 2 can be read, written, and stat'ed but never closed. All descriptors
use `O_CLOEXEC`. Limits: appended and written data up to 4 MiB, `rmSync`
recursion depth 32 with 4 KiB paths, UTF-8 only for `writeSync` strings, numeric
modes only for `chmodSync`. `COPYFILE_FICLONE` falls back to a plain copy,
`COPYFILE_FICLONE_FORCE` fails with `ENOTSUP`, and copying a file onto itself does
nothing. Promise and callback forms of the descriptor functions, `opendir`, `watch`,
`cp`, `glob`, `readv`/`writev`, the `Stats`, `ReadStream`, and `WriteStream` class
exports, and `rmSync` retry options are not implemented.

`chmod`, `truncate`, `symlink`, `readlink`, `realpath`, `mkdtemp`, `utimes`,
`copyFile`, `appendFile`, and `rm` also exist in `fs.promises` and as callback
forms. They run the synchronous implementation on the calling thread and then
settle the Promise, so large copies or removals block the event loop; they are
not backed by the file work queue. Argument errors reject instead of throwing,
and callbacks are delivered with `process.nextTick`.

Readable, Writable, Duplex, Transform, and PassThrough support bounded byte or
object queues, cancellation signals, corking, `_writev`, and partial lifecycle
options. `setEncoding` supports only UTF-8 in byte mode; string queue lengths and
`read(n)` use UTF-16 code units.

Node.js `Readable.from`, async iteration, iterable pipelines, and Writable Web
adapters are not implemented. `Readable.toWeb` and `Readable.fromWeb` are explicit
adapters. `fromWeb` supports encoding, high-water mark, object mode, and signal
options. Avoid consuming a stream through both APIs at once.

## Web APIs

`TextEncoder` supports UTF-8 `encode` and `encodeInto`. `TextDecoder` supports
UTF-8, incremental input, byte views, BOM handling, `fatal`, and `ignoreBOM`.
Other encodings and TextEncoderStream/TextDecoderStream are not implemented.

Event, EventTarget, DOMException, AbortController, and AbortSignal provide a
subset of Web event and cancellation behavior. There is no DOM tree or complete
DOM event dispatch implementation. EventTarget listener errors are reported
through the engine's microtask error path. AbortSignal retains synchronous first
exception propagation; private cancellation runs before user abort listeners.

ReadableStream, WritableStream, and TransformStream provide default
readers/writers/controllers, backpressure, cancellation, piping, teeing, and async
iteration. They are also exposed through `node:stream/web`. Byte/BYOB mode,
stream transfer, and additional queuing-strategy classes are not implemented.
A tee branch that exceeds its queue limit errors both branches and cancels the
source.

### Fetch and bodies

| API | Supported behavior and restrictions |
| --- | --- |
| `Blob` | Copies string, Blob, ArrayBuffer, and view inputs; supports `size`, `type`, `text`, `arrayBuffer`, `bytes`, and `slice`; no `stream` method |
| `Request` | HTTP(S) URL or Request input, method, headers, signal, and buffered body; rejects GET/HEAD bodies and unsupported methods; no streaming constructor body |
| `Response` | Buffered construction, `text`, `json`, `arrayBuffer`, and clone before consumption; status 200–599; rejects bodies for 204/205/304 and custom `statusText` |
| `FormData` | Field access, mutation, and live iteration; Blob values remain Blobs; no HTML form constructor, File class, or multipart parsing |
| `Headers` | Iterable pairs, live sorted iteration, and `getSetCookie`; network response headers are immutable |
| `fetch` | Request inputs and string, byte, Blob, FormData, or Web ReadableStream uploads; partial Fetch options |

A non-null `Response.body` is a Node-style host Readable. Convert explicitly with
`Readable.toWeb` for Web consumption. Network Response cloning is not supported.
Buffered bodies have a 4 MiB budget; FormData allows up to 1,024 fields.

## HTTP and networking

HTTP response headers support lookup, removal, string arrays, and raw-array
`writeHead` input. Header arrays are copied, unlike Node.js's reference behavior.
Numeric header values, custom reason phrases, and user-managed framing headers
are not supported. `STATUS_CODES` contains a small subset of common codes.

Client headers preserve repeated Set-Cookie rows, combine ordinary duplicates,
and apply singleton rules. Fetch exposes separate cookies through
`Headers.getSetCookie()`. Response headers share a 16 KiB and 64-row budget.

HTTP(S) clients use system libcurl. TLS peer and hostname verification are always
required. HTTPS-to-HTTP redirects, URL credentials, and automatic environment
proxies are rejected. Server TLS, protocol upgrades, WebSocket, standalone
`net`/`tls`/`dns`, and general proxy support are not implemented.

## Workers and native add-ons

Workers use separate owning threads and contexts with bounded message cloning.
MessageChannel, transferable objects, and additional structured-clone types
are not supported.

Native add-ons expose a synchronous Node-API v1 subset. This is not full v1
conformance or the Node.js SDK. See the
[Node-API reference](https://github.com/potatosl/jsrt/blob/main/native/NODE_API.md)
for available calls and unsupported functionality.

## Other missing APIs and tools

Missing modules include `zlib`, `readline`, `tty`, `vm`, `async_hooks`,
`perf_hooks`, and `module`. `crypto.subtle`, a REPL, watch mode, source maps,
a debugger, profiling tools, and type declarations are not provided.

For installer-specific restrictions, see [Packages](packages.md).
