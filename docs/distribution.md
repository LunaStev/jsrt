---
title: Installation
nav_order: 3
---

# Install a Linux release bundle

A jsrt release bundle contains the runtime, deployment tool, and a matching
JavaScriptCore library. Installation targets Linux x86_64 and does not require
the Wave compiler.

## Verify the archive

Compare the archive's SHA-256 with a value obtained from a trusted source before
extracting it. A checksum delivered alongside an archive detects corruption;
it does not authenticate the publisher.

If the maintainer provides an Ed25519 signature, verify it before extracting or
running code. Obtain the trusted public key through a separate trusted channel.
The contributor guide describes the signing and verification commands.

## Install

From the extracted bundle directory, run:

```sh
./bin/jsrt-deploy verify --bundle "$PWD"
./bin/jsrt-deploy install --bundle "$PWD" --prefix "$HOME/jsrt"
"$HOME/jsrt/bin/jsrt" --info
```

The prefix's parent directory must already exist. `verify` checks the bundle's
fixed file list and checksums. `install` also checks that the runtime and its
required libraries execute on the host before activating the installation.

Add the installed `bin` directory to your shell's `PATH` to use `jsrt` directly:

```sh
export PATH="$HOME/jsrt/bin:$PATH"
```

## Update, roll back, or uninstall

Install a new bundle with the same prefix to update. The deployment tool creates
a complete release generation and switches `current`; the previous generation
remains available through `previous`.

```sh
"$HOME/jsrt/bin/jsrt-deploy" rollback --prefix "$HOME/jsrt"
"$HOME/jsrt/bin/jsrt-deploy" recover --prefix "$HOME/jsrt"
"$HOME/jsrt/bin/jsrt-deploy" uninstall --prefix "$HOME/jsrt"
```

The tool verifies management markers, ownership, file types, and checksums before
changing an existing installation. Unexpected files or ownership conflicts cause
it to refuse the operation. Recovery checks generation identity before removing
staging data. `install` and `rollback` perform recovery first.

Each active-link replacement is atomic, but changes to `current` and `previous`
are not guaranteed to be atomic together across power loss.

## System dependencies

The bundle includes JavaScriptCore in `lib/` and uses a relative
`$ORIGIN/../lib` runtime search path. Compatible system libraries are still needed:

- libcurl >= 8.13.0 with TLS and asynchronous DNS support
- OpenSSL 3 (`libcrypto.so.3`) and libarchive (`libarchive.so.13`)
- libstdc++, glibc, and the ICU ABI required by the bundled engine
- `/usr/bin/sha256sum` for the deployment tool

Consult `runtime-info.json` for the bundle's library versions and use
`jsrt --info` to inspect the installed runtime. Bundles are dynamically linked;
they are not portable to every Linux distribution. A build against ICU 78, for
example, needs a compatible ICU 78 installation.

## Check a host

The deployment tool can verify a bundle and exercise installation, reinstallation,
runtime execution, and removal in a temporary prefix:

```sh
./bin/jsrt-deploy check --bundle "$PWD"
```

For source builds, release creation, and signing, see
[CONTRIBUTING.md](https://github.com/potatosl/jsrt/blob/main/CONTRIBUTING.md).
