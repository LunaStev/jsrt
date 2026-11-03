# Node-API subset

jsrt provides a synchronous Node-API v1 subset on JavaScriptCore. Wave owns
module resolution, library loading policy, caching, resource limits, and teardown.
The C++ adapter connects handles and callbacks through the JSC C API.

## Registration and supported calls

Add-ons register through `napi_register_module_v1`. If an add-on declares an API
version, only version 1 is accepted. `napi_get_version` returns 1; this does not
mean the full v1 API is implemented. Runtime metadata reports
`Node-API v1 subset`, `complete: false`, and `async: false`.

| Area | Supported subset |
| --- | --- |
| Values | undefined, null, global, booleans, typeof, strict equality |
| Numbers | double/int32/uint32/int64 creation and access |
| Strings | UTF-8, Latin-1, and UTF-16 creation; UTF-8/UTF-16 length and reads; embedded NUL and Unicode |
| Objects and arrays | Creation, length, array checks, named properties, indexed elements |
| Properties | Value, method, getter, and setter descriptors with property attributes |
| Functions | Native callbacks, callback arguments/receiver/data, JavaScript function calls |
| Exceptions | Error, TypeError, RangeError, throw, pending exception access and clearing |
| Handles | Ordinary LIFO handle scopes and per-call protected handles |
| Diagnostics | API version and last-error information |

The exact declarations are in [jsrt_node_api.h](include/jsrt_node_api.h).
It is a partial header rather than the complete Node.js SDK. Add-ons built with
the official SDK must use `NAPI_VERSION=1` and restrict themselves to these calls.
The [Node.js API documentation](https://nodejs.org/api/n-api.html) describes the
upstream interface; it is not a list of APIs supported by jsrt.

## Unsupported functionality

References and weak references, escapable scopes, Buffer and external-memory
APIs, finalizers, wrapping and classes, Promise/deferred APIs, async work,
thread-safe functions, and cleanup hooks are not implemented. Add-ons using V8
or Node.js internal APIs are not supported.

Missing symbols fail immediate dynamic loading with `ERR_DLOPEN_FAILED`.
Unsupported declared versions fail with `ERR_NAPI_VERSION`. JavaScript exceptions
from initialization retain their original identity.

## Ownership and limits

An environment belongs to one context and its owning thread. Handles cannot be
shared with another context or used from a different thread. Initialization and
native callbacks have default handle frames; ordinary scopes close in LIFO order.
Remaining frame handles are released when initialization or a callback returns.

Native callback data and dynamically created functions remain retained for the
environment's lifetime. A failed initializer may have exposed a callback to
JavaScript, so its library remains loaded and counts toward the library limit.

Per-context limits are 64 libraries, 1,024 native functions, 65,536 protected
frame handles, and 128 nested scopes. Input strings are bounded to 4 MiB, or
2 Mi UTF-16 code units. These are not whole-heap limits.

Shutdown releases protected handles and closes the environment, then disposes
the engine context before unloading libraries. Add-ons are trusted native code
with host process privileges. The adapter does not isolate memory or permissions.
