---
title: Engine reference
nav_order: 8
---

# JavaScriptCore source and patches

jsrt's engine baseline is WebKitGTK 2.54.1. The engine builder obtains the upstream
archive and verifies it before extracting or patching it:

- Source: <https://webkitgtk.org/releases/webkitgtk-2.54.1.tar.xz>
- SHA-256: `ea0bbb02dbdbc596874a4e7ad35b66645b3e0a232bd0e4081de5ed92eb0a397d`
- Digest file: `native/engine/webkitgtk-2.54.1.sha256`

## Build

Run from the project root:

```sh
./bootstrap.sh engine-build
```

The tool builds JSCOnly with CMake and Ninja, then prints a candidate shared-library
path. It preserves existing candidates and refuses unmarked or mismatched cached
sources. The runtime and regression suite are built separately using the selected
candidate. Setup and commands are in
[CONTRIBUTING.md](https://github.com/potatosl/jsrt/blob/main/CONTRIBUTING.md).

## Project patches

The builder applies these files from `native/engine/` with `--fuzz=0`:

| Patch | Purpose |
| --- | --- |
| `webkitgtk-2.54.1.patch` | Connect the matching module, Worker, and clone host ABI |
| `module-output.patch` | Isolate engine module output |
| `synthetic-modules.patch` | Connect built-in, CommonJS, and JSON synthetic modules |

`native/cpp/jsc_module_api.cpp` and `native/include/jsrt_modules.h` are compiled
with the matching WebKit source tree. System JSC libraries are not assumed to
export this private boundary.

## ABI expectations

The bridge connects synchronous Wave resolution, source, metadata, and value
callbacks to engine-owned module graphs and Promise evaluation. It does not
rewrite JavaScript import/export syntax. Runtime detection is reported by
`engine.moduleHostABI` and `engine.syntheticModuleHostABI` in `jsrt --info`.

Public Workers require Worker ABI v2 and clone ABI v1. Worker termination requests
use a retained context group; the final VM reference and deferred RunLoop disposal
are released on the owning Worker thread. `JSRTDrainOwnerRunLoop` performs that
nonblocking cleanup. `JSRTIsProxy` checks engine object type without user traps.
These bridges do not impose a JavaScript CPU deadline.

The [engine ABI reference](https://github.com/potatosl/jsrt/blob/main/native/ENGINE_ABI.md)
describes handle ownership, public JSC calls, and private extensions.

## Distribution

Release bundles retain the engine source information, patches, digest, and
JavaScriptCore's `Source/JavaScriptCore/COPYING.LIB` notice. JavaScriptCore and
other dependencies retain their upstream licenses independently of jsrt's MPL-2.0
license. Follow the source and license information shipped with the exact bundle
when rebuilding its engine.
