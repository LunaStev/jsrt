---
title: Getting started
nav_order: 2
---

# Getting started

jsrt currently targets Linux x86_64. There are no public release bundles yet.
If a maintainer has supplied a bundle, follow [Installation](distribution.md).
Building from source is covered in the
[contributor guide](https://github.com/potatosl/jsrt/blob/main/CONTRIBUTING.md);
the standard build currently requires test sources omitted from the public tree.

## Run JavaScript

Save this as `hello.js`:

```js
console.log('Hello from jsrt');
```

Run the file, or evaluate a short expression directly:

```sh
jsrt hello.js
jsrt -e "console.log(1 + 1)"
```

`jsrt run hello.js` is an alternative form of the file command. Arguments after
the file name are passed to the script; `--` can separate script arguments:

```sh
jsrt hello.js -- first second
```

## Modules

CommonJS files can use `require`, `module.exports`, and supported Node.js built-in
modules. Use `.cjs` to explicitly select CommonJS.

Use `.mjs`, or `.js` in a package with `"type": "module"`, for ES modules:

```js
import path from 'node:path';

console.log(path.join('hello', 'world'));
```

The [compatibility guide](compatibility.md#modules) describes module-loading
restrictions. Install project dependencies with [the package installer](packages.md).

## CLI reference

| Command | Purpose |
| --- | --- |
| `jsrt app.js [--] [args...]` | Execute a file |
| `jsrt run app.js [--] [args...]` | Execute a file using the explicit subcommand |
| `jsrt -e '<script>' [--] [args...]` | Evaluate a script |
| `jsrt --check app.js` | Check syntax without executing the module body |
| `jsrt test [--] <file.js>...` | Run explicit files sequentially in separate processes |
| `jsrt --version` | Print the runtime version |
| `jsrt --info` | Print engine, native-library, ABI, and compiled-limit information |
| `jsrt --help` | Print command help |

The `test` subcommand runs files you supply; it is separate from the runtime's
own regression suite. There is no interactive REPL.

## Memory limits

The optional prefix `--memory-limit-mb` sets the process address-space soft limit:

```sh
jsrt --memory-limit-mb 4096 app.js
```

This limit includes JavaScriptCore's virtual address reservations. It is not an
RSS or JavaScript heap limit, and a low value can prevent engine initialization.
There is no JavaScript execution-time limit. See [Security](security.md).
