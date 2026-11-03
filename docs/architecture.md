---
title: Architecture
nav_order: 7
---

# Architecture

Wave owns the runtime's host APIs, module resolution, event loop, resource
policies, package installation, and build orchestration. JavaScriptCore owns
JavaScript parsing, execution, garbage collection, JIT compilation, and Promise
jobs. C and C++ connect native ABIs.

## Execution flow

`runtime/main.wave` calls `app.wave`, which handles the CLI and starts a session.
`session.wave` creates a context, installs the host APIs, selects evaluation,
CommonJS, or ES module execution, runs the event loop, reports errors, and
shuts down the host.

`host.wave` owns API installation and teardown order. `event_loop.wave` coordinates
timers, filesystem completions, network activity, child processes, Workers,
process signals, and engine checkpoints.

## Module boundaries

| Area | Main modules |
| --- | --- |
| CommonJS | `modules`, `module_state`, `module_resolver`, `module_files`, `module_packages`, `module_compile` |
| ES modules | `esm`, `esm_interop`, `esm_files`, and the matching JSC module bridge |
| JSON | `json`, `json_parse`, `json_stringify`, `json_source`, `wjson_text` |
| Node-style streams | `streams`, `stream_state`, `stream_operations`, readable/writable/lifecycle modules, and `stream_utils` |
| Web streams | `web_stream_core`, `web_readable`, `web_writable`, `web_transform`, and adapters |
| Files | `system`, `fs_sync`, `async_fs`, file jobs, FileHandles, and file streams |
| HTTP | Server, client, parser, header, response, connection, and deadline modules |
| Cancellation | `abort`, `web_events`, and shared `abort_state` |
| Workers | `workers`, `worker_state`, `worker_run`, and `clone` |
| Packages | Graph, version/semver selection, cache, workspace, transaction, and replacement modules |

## Ownership and threads

Each JSC context has one owning thread. `context_state.wave` attaches separate
host state to each global through private data. Delayed JavaScript values remain
rooted for the lifetime of their operation; private object state uses captured
engine-owned WeakMap/WeakSet graphs.

File workers operate on native byte data and descriptors. They do not access JSC
handles. The owner thread converts completed results and settles Promises.
Shutdown joins workers before releasing resources that they might still use.

Public Workers reconstruct cloned values in their receiving context. Shared
links contain native graphs, not handles from another JavaScript context.
The Worker owner releases the final VM reference and drains deferred engine
RunLoop cleanup before the parent joins and frees the link.

libuv and libcurl callbacks update native records. User callbacks are dispatched
by Wave on the owner thread after native polling returns.

## Lifecycle rules

- Reserve resource slots before invoking option getters, which may re-enter the host.
- Preserve the first exception while cleaning up failed or cancelled operations.
- Keep shared HTTP socket lifetime separate from request EOF and response finish.
- Keep Promise scheduling in JSC and nextTick scheduling in the Wave host.
- Release captured intrinsics and context slots after dependent resources close.

The native contracts are documented in the
[engine ABI](https://github.com/potatosl/jsrt/blob/main/native/ENGINE_ABI.md) and
[Node-API subset](https://github.com/potatosl/jsrt/blob/main/native/NODE_API.md).
See the [contributor guide](https://github.com/potatosl/jsrt/blob/main/CONTRIBUTING.md)
for build and validation commands.
