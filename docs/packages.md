---
title: Packages
nav_order: 4
---

# Packages

`jsrt install` reads a project's `package.json`, installs dependencies into a
managed `node_modules` tree, and records the resolved graph in `jsrt.lock.wjson`.

## Install dependencies

Run from the project directory:

```sh
jsrt install
```

Use `--project` to select another directory. Production dependencies are installed
by default; `--include-dev` also includes the root project's development dependencies.

```sh
jsrt install --project ./app --include-dev
```

The installer does not run lifecycle scripts or create package `bin` links.
Packages that require either need additional setup outside the installer.

## Lockfiles and updates

| Option | Behavior |
| --- | --- |
| `--frozen-lockfile` | Require an existing lockfile and reject manifest or integrity changes |
| `--offline` | Use a frozen lockfile and verified cached archives, locked local archives, or matching workspaces |
| `--replace` | Replace a previously managed dependency tree using its lockfile |
| `--update` | Resolve versions again and replace the managed tree and lockfile |

```sh
jsrt install --project ./app --frozen-lockfile
jsrt install --project ./app --offline --replace
jsrt install --project ./app --update
```

A normal install does not overwrite an existing `node_modules` directory.
`--replace` and `--update` replace the whole managed tree, including local edits.
`--update` cannot be combined with `--offline` or `--frozen-lockfile`.

The lockfile records the root manifest integrity, the development-dependency
mode, exact package versions and locations, source URLs, SHA-512 integrity, and
omitted optional dependencies. The install mode must match the lockfile.
Missing or corrupt offline inputs cause an error; there is no network fallback.
The installer does not read or write npm lockfiles.

## Version resolution

Supported requirements include exact versions, `^`, `~`, partial and wildcard
versions, comparator intersections, OR groups, hyphen ranges, and explicit
prerelease ranges. Resolution selects the highest matching stable version;
prereleases require an explicit matching prerelease comparator.

`optionalDependencies` take precedence over dependencies with the same name.
Optional installation failures roll back their changes and record the omission;
integrity failures in locked installed packages fail the installation.

Peers are resolved from the requesting package's parent scope. Missing required
peers are selected from the intersection of requirements already recorded in that
scope. An existing incompatible peer causes an error. Graph backtracking and
global hoisting are not implemented.

Dist-tags, Git dependencies, general `file:` dependency specifications, and
private-registry authentication are not supported.

## Workspaces

Use explicit relative paths or a final `/*` pattern in the root `workspaces` array:

```json
{
  "workspaces": ["packages/*"]
}
```

Workspace packages must have unique names and valid versions. Local dependencies
can use `workspace:*`, `workspace:^`, `workspace:~`, a supported `workspace:` range,
or a compatible ordinary SemVer range. A version conflict fails installation.

Workspaces are copied as managed snapshots. They are not symlinks to development
sources. The lockfile covers the manifest and source bytes; frozen and offline
installs reject changed sources. Use `--update` to refresh a snapshot.

Nested workspaces, general glob patterns, parent paths, symlinks, hard links, and
special files are rejected. `.git`, `node_modules`, `.jsrt-cache`, transaction
state, and `jsrt.lock.wjson` are excluded from snapshots. Workspace development
dependencies are not installed.

## Cache

Verified archives are stored in the project's `.jsrt-cache`. The default budget
is 256 MiB and 1,024 entries, with older entries removed first.

```sh
jsrt cache prune --project ./app
jsrt cache prune --project ./app --max-mb 64 --max-entries 128
```

Pruning preserves unrecognized files and does not remove the installed tree.
The cache is bounded storage, so a later offline install can fail if a required
archive has been evicted.

## Integrity and recovery

Downloads require HTTPS verification and matching SHA-512 integrity. Extraction
rejects path traversal, links, duplicate entries, and special files. Installation
uses a project lock, private staging, and a recovery journal. Ownership or external
replacement conflicts preserve the journal and backups and fail the operation.

The dependency tree and lockfile are recoverable but are not published together
as one crash-atomic operation. Filesystem checks do not isolate the installer
from other processes running as the same user. Integrity checks verify bytes;
they do not establish publisher trust or package-code safety.

The installer limits package count to 256, graph depth to 32, archive size to
32 MiB, and combined extracted archive and workspace data to 256 MiB. See
`jsrt --info` for compiled limits and [Security](security.md) for execution boundaries.
