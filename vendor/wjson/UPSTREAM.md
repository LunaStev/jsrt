# Vendored wjson

Source: https://github.com/potatosl/Wjson
Commit: ca2a8cd9f029db5d1d6790342ba507efe0d84d32
Downloaded: 2026-10-20
License: MPL-2.0 (see LICENSE and each source file's SPDX notice).

This is a source subset: the complete `src/` Wave library, `tests/` Wave
tests, upstream readmes, security policy, license, and Vex manifest. The
Rust/C++ reference backends, their tests, installers, and fixtures are not
included or required by the runtime build. Upstream files are unmodified.
Some upstream tests require the omitted reference backends; they are retained
as source, not claimed as executed by this project's integration test command.

The runtime compiler maps `--dep=wjson=vendor/wjson`. The selected backend is
`src/ffi_backend.wave` (Wave), not `src/ffi_rust.wave`. Parsing, DOM operations,
escaping, and numeric conversion use upstream Wave implementations.

The upstream Wave API references `wjn_console_utf8` even on Linux. Our Linux
host supplies its documented no-op behavior as a Wave C ABI export in
`runtime/info.wave`; no native reference library is linked. Revisit that
adapter before adding Windows support.

`jsrt --info` uses the wjson writer. The Wave integration tests parse that
output with the wjson parser. `runtime/json.wave` also replaces JavaScript's
`JSON.parse` and `JSON.stringify` with Wave host callbacks backed by wjson.
The host handles JS callback semantics, ECMAScript number spelling, bounded
traversal, BOM rejection, and UTF-16 transport in `runtime/wjson_text.wave`.
No upstream files were modified for these adaptations. See the root README
for compatibility limits, including the unsupported reviver context.source.
