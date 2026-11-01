# libuv

- Repository: https://github.com/libuv/libuv
- Release: 1.53.0, published 2026-09-24; checked 2026-10-20.
- Pinned commit: `840404ce8ba7cc0204be52389a6cfff9f2c90fb6`.
- License: MIT; retain LICENSE, LICENSE-extra and AUTHORS.

This subset contains upstream headers, sources and files needed by the static
CMake build. Tests and benchmarks are disabled. No upstream source is modified.
`UPSTREAM-BLOBS` records the original Git blob hashes for all 125 fetched files;
each was compared using `git hash-object`. The library is built as position
independent C in target/deps/libuv, then linked into the Wave runtime. The system
libuv shared library is not used.

The libuv event loop handles TCP readiness. Its callbacks enter Wave on the
main thread. Wave owns handles, request policy, JS roots and shutdown.
