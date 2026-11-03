# jsrt

A JavaScript runtime written in Wave and powered by JavaScriptCore.

jsrt provides CommonJS and ES modules, selected Node.js and Web APIs,
and a package installer.

**Experimental.** API coverage is incomplete. Check the
[compatibility guide](docs/compatibility.md) before running existing applications.
JavaScript runs with the permissions of the host process.

## Usage

```sh
jsrt app.js
jsrt -e "console.log('Hello from jsrt')"
jsrt --info
```

## Documentation

- [Documentation home](docs/index.md)
- [API compatibility](docs/compatibility.md)
- [Getting started](docs/getting-started.md)
- [Installation](docs/distribution.md)
- [Package installation](docs/packages.md)
- [Security and execution boundaries](docs/security.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, source builds,
testing, and pull requests.

## License

[MPL-2.0](LICENSE). Third-party dependencies retain their own licenses.
