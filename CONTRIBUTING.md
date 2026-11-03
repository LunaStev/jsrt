# Contributing to jsrt

Send issues and pull requests to [potatosl/jsrt](https://github.com/potatosl/jsrt).
For bug reports, include a minimal reproducer, your operating system, and the
output of `jsrt --version` and `jsrt --info` when available.

## Development setup

Development currently targets Linux x86_64. Install the dependencies needed for
your work:

| Task | Requirements |
| --- | --- |
| Wave source checks | `wavec` and its matching `std` library |
| Native build | C11 and C++20 compilers, CMake, Make, libcurl >= 8.13.0 with TLS and asynchronous DNS, OpenSSL 3, and libarchive development files |
| JavaScriptCore build | Ninja, curl, tar, patch, sha256sum, Ruby 3, and ICU development files |
| Integration tests | Go for the HTTPS test peer; network access for TCP/TLS and public npm checks |
| Optional diagnostics | Valgrind for Worker lifecycle checks; actionlint for workflow validation |

libuv, llhttp, and wjson are included in `vendor/`.

The build tools use `wavec`, `cc`, and `c++` from `PATH`. Override them with
`JSRT_WAVEC`, `CC`, and `CXX`. Set `JSRT_STD_ROOT` if the matching standard library
is not in the `std` directory beside `wavec`; set `JSRT_GO` to select a Go compiler.

**The public repository currently omits `test.wave` and `tests/`.** The standard
build, test, and release commands require these sources, including for the initial
build check. A full runtime build therefore requires a working tree containing
the test suite. Source checks and documentation work can use the public checkout.

## Source checks

Run these commands from the repository root:

```sh
wavec check runtime/main.wave --dep=wjson=vendor/wjson
wavec check build.wave
```

If the compiler cannot locate its standard library, pass
`--std-root=/path/to/wave/std` to `wavec`.

## Building and testing

jsrt uses a patched JavaScriptCore based on WebKitGTK 2.54.1. Build it with:

```sh
./bootstrap.sh engine-build
```

The command verifies the upstream archive, applies the project patches, and
prints a `Candidate engine:` path. Set `JSRT_JSC_LIBRARY` to that path, then build
and run the regression suite in a working tree containing the test sources:

```sh
export JSRT_JSC_LIBRARY=/path/to/libJavaScriptCore.so
./bootstrap.sh build --require-tcp --probe-worker-termination
./bootstrap.sh test --require-tcp --probe-worker-termination
./target/native/jsrt --info
```

The build publishes `target/native/jsrt` only after validation succeeds.
`--require-tcp` makes unavailable live socket checks fail rather than skip.
`--probe-worker-termination` also runs the isolated Worker termination diagnostic.

Additional checks are available when relevant to a change:

```sh
./bootstrap.sh test-npm --require-tcp
./bootstrap.sh worker-leaks 256
```

See [engine source and patches](docs/engine-source.md) for engine details and
[distribution](docs/distribution.md) for release and deployment commands.

## Project layout

| Directory | Purpose |
| --- | --- |
| `runtime/` | Wave host APIs, module loading, event loop, and resource management |
| `tools/` | Build, validation, and deployment tools |
| `native/` | JavaScriptCore and native library ABI adapters and engine patches |
| `vendor/` | Third-party sources with their upstream notices and licenses |

See [Architecture](docs/architecture.md) for module boundaries. Use the existing
code style and [`.clang-format`](.clang-format) for C and C++ changes.

## Documentation

The English Markdown files in `docs/` are the site source. The site uses Jekyll
with the Just the Docs theme; no runtime toolchain is needed to edit or build it.
With Ruby 3.4 and Bundler installed:

```sh
cd docs
bundle install
bundle exec jekyll serve
```

Open `http://localhost:4000/jsrt/`. Use `bundle exec jekyll build` for a static
build in `docs/_site/`. Keep instructions about current behavior in the guide;
record change discussions and validation results in issues and pull requests.

The documentation workflow builds pull requests on a GitHub-hosted runner and
deploys the default branch to Pages. For the first deployment, a repository
maintainer must select **Settings > Pages > Source > GitHub Actions**. The site
uses `/jsrt` as its base path. Update `docs/_config.yml` if the repository name
or the canonical Pages URL changes.

`docs/distribution.md` and `docs/engine-source.md` are also included in release
bundles. Preserve these paths when reorganizing the site.

## Releases and runtime CI

Release tooling requires the test sources and selected engine described above.
The `Release artifact:` line identifies the archive produced by that invocation;
use that path for signing and host checks rather than picking an older archive
from `target/dist/`.

```sh
./bootstrap.sh release
./bootstrap.sh linux-check --archive /path/to/release.tar.gz --image 26.04
./bootstrap.sh sign-release --archive /path/to/release.tar.gz --key /path/to/private.pem --output /path/to/new-signatures
./bootstrap.sh verify-release --archive /path/to/release.tar.gz --public-key /path/to/trusted-public.pem --signature-directory /path/to/new-signatures
```

Signing uses Ed25519 over the archive's SHA-256 followed by a newline. Keep the
private key outside the checkout and supply the trusted verification key
independently of the archive. Host checks are described in
[Installation](docs/distribution.md).

The runtime's release, compatibility, and stability workflows are manual and
require a prepared self-hosted runner labeled `linux`, `x64`, and `jsrt-wave-jsc`,
including the test suite. Configure `JSRT_JSC_LIBRARY` for release/stability,
`JSRT_BASELINE_JSC_LIBRARY` and `JSRT_CANDIDATE_JSC_LIBRARY` for the compatibility
matrix, and optionally `JSRT_WAVEC` for the compiler. The release workflow can use
`JSRT_RELEASE_SIGNING_KEY_PATH` to select a separately managed signing key.

## Pull requests

Create a branch in your fork and target `main` in `potatosl/jsrt`. Keep each pull
request focused on one change. Describe the problem, the resulting behavior, and
the checks you ran, including any checks you could not run and why.

For runtime behavior changes, include a reproducer and regression coverage where
the test suite is available. Update the compatibility guide when supported APIs
or behavior change. For documentation changes, check links and examples.
