# Security

jsrt is experimental. JavaScript, Workers, child processes, and native add-ons
run with the host process's permissions. There is no built-in process sandbox or
JavaScript execution-time limit.

The `--memory-limit-mb` option limits process address space, including engine
virtual reservations. Host buffer and queue limits do not bound the entire
JavaScript heap or process memory.

Read [Security and execution boundaries](docs/security.md) before running code or
exposing a server. It covers file and process access, network verification,
package integrity, resource limits, and release verification.

Dependencies have their own security-update requirements. Use `jsrt --info` to
inspect the engine and native-library versions in the runtime you are using.
