---
title: Home
nav_order: 1
---

# jsrt documentation

jsrt is an experimental JavaScript runtime written in Wave and powered by
JavaScriptCore. It includes CommonJS and ES modules, selected Node.js and Web
APIs, and a package installer.

## Start here

- [Getting started](getting-started.md): run scripts and use the CLI.
- [Installation](distribution.md): verify and install a Linux release bundle.
- [Packages](packages.md): install dependencies and manage a project lockfile.
- [Compatibility](compatibility.md): check supported APIs and behavior differences.
- [Security](security.md): understand execution permissions and resource limits.

## Contribute

See the [contributor guide](https://github.com/potatosl/jsrt/blob/main/CONTRIBUTING.md)
for source checks, build requirements, and pull requests. The
[architecture](architecture.md) and [engine reference](engine-source.md) describe
how the host and JavaScriptCore fit together.

jsrt is under active development. Applications need to be checked against its
supported API subset. Scripts, Workers, and native add-ons run with the host
process's permissions.
