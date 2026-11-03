# JavaScriptCore ABI

`engine.h` declares the 64-bit Linux C ABI consumed by the Wave host.
`engine_jsc.c` forwards those calls directly to JavaScriptCore C APIs and the
explicitly listed WebKit SPI below.
JavaScriptCore is the only execution and validation engine.

Context, value and string pointers represent JSC handles. Values retained
across JS calls are protected/unprotected by Wave; owned JSC strings are
released after use. JS contexts are released after host callbacks, timers
and captured JSON intrinsics have been cleaned up.

The C adapter contains no CLI, filesystem, timer scheduling or JSON policy.
Those functions live in Wave. Function pointer and argc/argv forwarding use
the small C adapters in `bridge.c` and `args.c`. The bounded Node-API adapter uses C++20;
it does not own the host loop or runtime policy.
Opaque pthread mutex/condition sizes and Wave callback addresses are adapted
in C; the queue, worker loop, file operations and cleanup policy stay in Wave.

CommonJS bodies use `JSObjectMakeFunction` with five parameter names and a
source URL. Resolution, realpath cache, cycles, JSON modules and scope metadata
are Wave policies. Promise file APIs use `JSObjectMakeDeferredPromise`.
These signatures follow WebKit's [JSObjectRef.h](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/API/JSObjectRef.h).

`JSGlobalContextSetUnhandledRejectionCallback` is WebKit SPI rather than
public stable C API, documented in
[JSContextRefPrivate.h](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/API/JSContextRefPrivate.h).
The build checks this export before compilation. Missing symbols fail the
build rather than disabling rejection reporting.
The rejection hook must receive a callable; passing NULL is unsafe. Wave disables
monitoring during shutdown and lets the context own the callback until release.

File worker threads never access a JSC context or JSValue. Completed results
are converted and promises are settled on the context's main thread. Shutdown
joins workers before freeing their native memory or the engine context.

The default global is created with a JSC class supporting opaque private data.
JSObjectGetPrivate/JSObjectSetPrivate forward this storage through the C adapter.
context_state.wave allocates and releases the native slot table in Wave.
JSON intrinsics, value helpers, collections, Buffer and EventEmitter state are
now separate for each context. Their protected handles must be released by the
matching shutdown functions before the JSC context is released.
The table is not a JS property and contains no handles from another context.
These modules are tested with interleaved contexts and independent teardown;
the full host is also tested on independent owning threads. Public Worker policy,
message graphs and queue ownership now live in Wave. The native shared link contains
no JS values; the receiving owner reconstructs its own values. A retained context
group permits an explicit termination request. Worker ABI v2 revokes that reference
under the shared mutex and releases it on the owning Worker thread before context
disposal. After the final VM release, Wave requests one nonblocking engine RunLoop
cycle through `JSRTDrainOwnerRunLoop`, draining the engine's deferred timer disposal
before the thread exits. The parent joins before freeing the shared native link.

JavaScriptCore owns Promise jobs and their engine checkpoints. The timer
module invokes captured Promise/bind/apply intrinsics directly from Wave.
A bound native dispatcher retains each queued callback through engine-owned
references. Its private ready promise has an own, immutable undefined
constructor so user constructor/species changes cannot hijack scheduling.
Wave catches callback exceptions and keeps the first failure until reporting.
No JavaScript bootstrap is evaluated for timers, microtasks or wjson JSON.

The default version policy requires JSC 2.54.1 or newer. Older engines require
an explicitly labelled compatibility build.

## Byte storage ABI

Buffer uses JSC's public typed-array and ArrayBuffer C APIs, declared in
[JSTypedArray.h](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/API/JSTypedArray.h).
JSC owns allocation and collection. Wave implements branding with captured WeakSet
methods, codecs, view ranges and copying. The C layer only forwards engine calls.
`JSObjectGetTypedArrayBytesPtr` exposes the backing-store base, so Wave adds the
view's `JSObjectGetTypedArrayByteOffset`. This temporary pointer is consumed by an
immediate native copy without further JSC calls. No worker keeps a JSC byte pointer.
SharedArrayBuffer and resizable/growable storage are not promised by this API subset.

Numeric Buffer methods are Wave callbacks. Fixed-width integers/floats/BigInts use
captured public DataView methods over the actual view range; Wave checks bounds and
BigInt decimal range before writes. Variable 1..6-byte integers and linear-time KMP
search consume copied or transient byte storage without invoking JS while a pointer
is in use. No private JSC heap or typed-array layout is used for these operations.
Implicit numeric conversions use a captured one-argument Math.min intrinsic in
values.wave. This applies ECMAScript ToNumber exactly once, including rejecting
BigInt returned by valueOf; this JSC build's JSValueToNumber accepts BigInt.
The numeric primitive result alone is read through JSValueToNumber. No JS bootstrap
or parallel numeric parser is installed.

`JSObjectMakeConstructor` uses a new `JSClassCreate(kJSClassDefinitionEmpty)` class
for its isolated automatic prototype; a NULL class would expose Object.prototype.
The temporary class reference is released after JSC retains it. The build checks
these symbols and all additional typed-array exports before compilation.

## Events and stream ABI

EventEmitter and byte streams use the same public JSC function/constructor API.
bridge.c forwards constructor and method callback addresses only. Listener lists,
snapshots, once guards, high-water marks, queue bounds, pipe flow, callback errors
and teardown are Wave policies. Captured WeakMap methods retain state through the
engine's GC graph. Pure in-memory stream/listener state does not permanently root its owners.
Active file/socket operations retain their owners until completion or resource cleanup.

Deferred read/write/completion/close callbacks are bound using captured Function.bind
and submitted through the captured existing queueMicrotask entry point. JSC owns
the scheduled closure and its references. There is no stream-specific host job queue
and no evaluated JavaScript bootstrap. Stream state roots are released before the
collections helpers, Buffer and shared value intrinsics during context shutdown.

## Network ABI

The build statically links pinned libuv 1.53.0 and llhttp 9.4.3 from vendor.
network_abi.c adapts uv_buf_t, sockaddr_in, native handle sizes and callback
addresses. http_parser_abi.c initializes llhttp settings and forwards spans and
parser metadata to Wave. Neither file implements JS API or HTTP policy.

libuv callbacks only manipulate native Wave records and buffers. JS request,
listen and close callbacks run on the context's main thread, outside uv_run,
through dispatch_http. HTTP objects, handlers and pending callbacks stay rooted
until their native work or lifetime ends. Close and cancelled-write completions
are drained before endpoint records or the JSC context are freed.

The parser pauses at message completion. Connection: close is the default;
explicit keepAlive enables state recycling and queues bounded subsequent bytes.
All llhttp leniency settings stay disabled.

File streams submit open, bounded read/write and close work to the existing Wave
worker queue. Workers do not touch JSC. Open-result descriptors transfer to the
main-thread resource record; queued/in-flight close work owns its descriptor until
completion or shutdown cleanup. Workers join before remaining resources are freed.
HTTP request streams dispatch after headers and pause native reads under pressure.
Response stream callbacks complete outside uv_run after uv_write and close events.

## Client ABI

curl_abi.c adapts libcurl variadic setopt/getinfo, CURLMsg, curl_waitfd and the fixed
prefix of curl_version_info_data, plus callback addresses. These are the stable
64-bit Linux C ABI; no C++ or custom TLS/protocol implementation is added.
The runtime requires libcurl >= 8.13.0, TLS and asynchronous resolver support.
The installed libcurl is dynamically linked; its actual version and TLS backend
are exposed in --info. It is not represented as a pinned vendored dependency.

URL validation, method/header policies, TLS option selection, redirect rules,
buffer bounds and stream/Promise dispatch are Wave. Transfer callbacks only copy
native bytes or return the documented pause marker. curl_multi_perform returns
before any JS dispatch; curl_multi_poll waits for curl, libuv and file completion
descriptors together. Cleanup removes easy handles before freeing native storage.
Body JSON parsing invokes the captured Wave/wjson callback, never engine JSON.
Streaming uploads use CURLOPT_READFUNCTION/READDATA and return CURL_READFUNC_PAUSE
until the main thread supplies another copied chunk or marks EOF. Send and receive
pause bits are maintained independently; callbacks never execute JS. Request writes
complete on the main thread after curl has consumed their native byte buffer.
Abort subscriptions are private engine-owned records, detached before native slot reuse.
Connection and transfer deadlines use libcurl; server deadlines use monotonic Wave
timestamps merged with the event loop's timer deadline. No CPU watchdog is installed.

## Cryptographic ABI

Crypto links system `libcrypto.so.3` explicitly. Wave calls the OpenSSL EVP digest
API and `CRYPTO_memcmp` directly; `bridge.c` only supplies the JS callback address.
EVP and EVP_MAC contexts survive updates in a private engine-owned ArrayBuffer,
using JSObjectMakeArrayBufferWithBytesNoCopy and JSObjectGetArrayBufferBytesPtr.
The build probes both exports. Digest frees the context immediately; the Wave
deallocator releases unfinished contexts without touching JS or engine handles.
It is safe to invoke on a GC thread. The deallocator is also called by JSC when
external-buffer construction throws, so Wave must not free that input twice.
Each update/key is buffer-bounded; aggregate bytes/chunks are not retained or capped.
OS entropy comes from Wave std random_fill, without a pseudorandom fallback.
The linked OpenSSL version is reported by `--info` and crypto.opensslVersion.

## Module-loading constraint

CommonJS `.node` loading now delegates from the Wave resolver/cache to the bounded
C++ Node-API adapter. It uses the public C bridge, not internal JSC C++ object layouts.
Only implemented `napi_*` symbols are exported from the runtime. RTLD_NOW rejects
unknown symbols; registration/version checks reject unsupported interfaces. Libraries
remain loaded through context disposal, including failed initializers whose callbacks
escaped into JS. See [Node-API subset](NODE_API.md) for supported APIs and ownership.

Host state now belongs to individual JSC globals. C keeps only a thread-local active
context binding for callbacks without a context argument; module structures and
allocation/cleanup policy remain in Wave. Evaluation, function calls and constructors
save/restore this binding. I/O dispatch and host setup/shutdown bind explicitly.
The engine-version formatting buffer is thread-local too. Host regression tests run
two complete hosts both on separate pthreads and interleaved on one thread.

The selected library exports JSContextGroupSetExecutionTimeLimit but this host does
not enable it: CPU execution limits remain disabled. Its presence is not treated as
a general cross-thread cancellation API. The [upstream implementation](https://github.com/WebKit/WebKit/blob/main/Source/JavaScriptCore/API/JSContextRef.cpp)
also acquires a VM lock when configuring its watchdog. This upstream reference is
not a substitute for matching headers and an interrupt bridge for the selected build.
The optional same-source bridge provides the bounded native termination and
constructor adaptation used by the Wave public Worker host.

The matching bridge exports `JSRTPrepareWorkerTermination` and
`JSRTRequestTermination`. Preparation takes the VM lock on its owning thread,
initializes the engine's termination exception and forbids execution after
termination, following the matching WebCore worker controller. A concurrent request
only calls `VM::notifyNeedTermination` on a retained group. It adds no watchdog or
CPU deadline. The stable C evaluate API does not enforce the forbidden flag:
Wave must prepare each worker entry and stop dispatch when preparation returns
false. The isolated probe exercises infinite loops in try/catch/finally,
refusal to prepare another entry, context release and thread join. A passing primitive
does not replace validation of the public construction, clone and lifecycle policies.

`JSRTWorkerABIVersion` (2) and `JSRTCloneABIVersion` (1) advertise the matching ABI.
Worker v1 is not accepted for this host's public Worker API. The original JSC
2.54.1 engine candidates remain separate and are never overwritten.
`JSRTMakeConstructor` adapts the callable/constructable host class and instanceof;
`JSRTIsProxy` checks the actual engine type without invoking user traps. Clone
traversal, native graph storage, limits and reconstruction remain in Wave.

The selected JSC 2.54.1 shared library exports program evaluation and function
compilation APIs, but no C module-loader/evaluate-module surface used by this host.
JSC's engine module loader exists internally; that does not make it callable through
the present stable C adapter. Apple Objective-C module-loader SPI is not a Linux C API.
The optional module-enabled 2.54.1 engine compiles `jsc_module_api.cpp` inside the
matching WebKit source tree. A versioned C boundary forwards synchronous Wave
resolve/source/meta callbacks to engine-owned module graphs and Promise evaluation.
The normal system engine is not assumed to export this boundary. Runtime detection
is reported as `engine.moduleHostABI`. No import/export rewriting or host JS parser
is used. `JSRTModuleInstallV2` adds a Wave value-descriptor callback and is advertised
by `JSRTSyntheticABIVersion` / `engine.syntheticModuleHostABI`. The matching patch
uses engine-owned synthetic bindings and promise fetch handoffs, including the
top-level dynamic-import path. CJS evaluation is deferred until linking succeeds;
its callback and first thrown value are engine-rooted. Wave still owns CJS/cache,
file URL policy and the wjson JSON-module path. No JS source wrapper is generated.
See upstream discussion: https://bugs.webkit.org/show_bug.cgi?id=191121

CommonJS package exports/imports mapping stays in Wave. It reads package.json
through captured wjson and selects require/node/default conditions in property order.
Local targets are validated before exact-file resolution; package encapsulation is
not a filesystem sandbox and symlinks retain the documented process permissions.
Pattern ordering, fallback arrays, self references and external imports are Wave policy.

URL parsing calls libcurl's URL API directly from Wave and releases every handle
within the operation. URLSearchParams form codecs and live JS state remain in Wave.
The HTTP(S) subset and divergences from WHATWG are documented in the
[compatibility guide](../docs/compatibility.md).

Package installation links system libarchive.so.13. Wave drives its tar/gzip reader,
validates paths/types/byte limits and controls descriptor-relative writes and rollback.
openat/mkdirat/unlinkat/renameat2 are direct libc ABIs for operations not exposed by
current Wave std; reads, writes and hashing reuse std/OpenSSL.
The download callback address is adapted in C. No shell/package script is invoked by install.
filesystem_abi.c copies opaque POSIX directory-entry names; recursive traversal,
flock lifetime, wjson recovery journal, fsync ordering and publication decisions
are Wave policies in package_transaction.wave. Ownership proofs use hard links
to prevent inode reuse from confusing a replaced lock or dependency tree with
the interrupted install. The two published paths are recoverable, not atomic together.
