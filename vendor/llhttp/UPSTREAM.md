# llhttp

- Repository: https://github.com/nodejs/llhttp
- Release: 9.4.3 (`release/v9.4.3`), published 2026-07-30; checked 2026-10-20.
- Pinned commit: `0e815792b167a9bd8ace259b95b7da953776c288`.
- License: MIT; retain LICENSE and LICENSE-MIT.

The nine fetched upstream files have their original Git blob hashes recorded in
`UPSTREAM-BLOBS`; all were compared using `git hash-object`. No upstream source
is modified. The release contains generated C, so the build directly compiles
src/api.c, src/http.c and src/llhttp.c without Node, TypeScript or npm.

native/http_parser_abi.c adapts struct layouts and callback signatures. Wave
stores request bytes, applies limits and checks the supported protocol subset.
All leniency switches remain disabled.

Known compatibility limitation observed in tests: this release's strict
Transfer-Encoding state machine rejects HTAB following the chunked token.
The adapter preserves that behavior (400) and tests both split and contiguous
input. Ordinary trailing spaces and case-insensitive chunked tokens are tested
as accepted. This is not presented as full HTTP syntax compatibility.
