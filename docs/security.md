---
title: Security
nav_order: 6
---

# Security and execution boundaries

jsrt runs JavaScriptCore in the host process. Scripts, Workers, and native add-ons
have the process's filesystem, network, and process permissions. Use only code
you trust, or provide isolation outside jsrt appropriate to your environment.

## Execution and memory

There is no JavaScript CPU watchdog or execution-time limit. A script that does
not return can prevent the event loop from processing I/O deadlines.

`--memory-limit-mb` sets the POSIX address-space soft limit (`RLIMIT_AS`). It
includes engine virtual reservations and does not measure RSS or JavaScript heap
usage. jsrt does not raise inherited lower limits or the hard limit.

Most host queues and byte buffers are bounded. These limits do not bound the
entire process, the JavaScript heap, or the memory inside arbitrary queued objects.
Use `jsrt --info` to inspect compiled limits.

| Resource | Default compiled limit |
| --- | --- |
| Source, ordinary file buffers, HTTP bodies, and binary buffers | 4 MiB per bounded operation or object |
| Timers and pending nextTick callbacks | 1,024 each |
| Modules | 1,024 |
| Asynchronous file jobs / file worker threads | 16 / 2 |
| FileHandles / file streams | 32 each |
| Workers / queued messages per link | 8 / 16 |
| Child processes / HTTP clients | 16 each |
| HTTP servers / connections | 16 / 64 |
| HTTP header bytes / rows | 16 KiB / 64 |

## Files, processes, and add-ons

Ordinary file APIs and module loading can access any path permitted to the host
process. Symlink resolution is not a filesystem permission boundary.

Child processes require an absolute executable path and explicit inherited or
piped stdio. Shell execution, PATH lookup, and custom child environment or working
directory options are rejected. jsrt tracks and reaps the children it owns.

Native add-ons are trusted native code. Node-API loading restrictions do not
prevent memory corruption or access to external resources.

## Network connections

The HTTP server listens on `127.0.0.1` by default. Its parser rejects ambiguous
framing, invalid Host headers, folded headers, and CR/LF/NUL header injection.
The default deadlines are 60 seconds for headers, 300 seconds for a request,
30 seconds for idle I/O, and 5 seconds for keep-alive reuse.

Clients require TLS and asynchronous DNS support in libcurl >= 8.13.0. Requests
are limited to HTTP(S); URL credentials and control characters are rejected.
TLS certificate and hostname checks remain enabled, including when callers try
`rejectUnauthorized: false`. Automatic environment proxies and HTTPS-to-HTTP
redirects are not allowed. `caFile` selects an explicit CA file.
Timeout options control I/O, not JavaScript execution.

## Packages and archives

The installer verifies HTTPS connections and SHA-512 integrity. Extraction rejects
path traversal, symlinks, hard links, duplicate entries, and special files. Package
scripts are not executed and `bin` links are not created.

Installation and cache operations check ownership and managed-file identity,
use private staging, and serialize cooperating installers with a project lock.
They do not isolate the project from another malicious process using the same
account. Integrity checks verify content, not publisher identity or code safety.

The tree and lockfile are recoverable through a journal but are not crash-atomic
together. See [Packages](packages.md) for replacement, cache, and workspace behavior.

## Release bundles

A checksum alone does not authenticate a release. Verify signatures with a public
key obtained independently from the archive. The installer checks bundle contents
and refuses unexpected files or ownership conflicts. See
[Installation](distribution.md) for deployment and recovery commands.

## Engine and dependencies

jsrt checks its JavaScriptCore version and required ABI exports. The baseline is
2.54.1 with project patches for modules, Workers, and cloning. Native dependencies
retain their own licenses and security-update requirements; installed versions
are reported by `jsrt --info`.
