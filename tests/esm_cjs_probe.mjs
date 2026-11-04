// Permanent regression for deferred CommonJS default evaluation.
import dependency from './worker_dependency.cjs';

console.log(dependency.marker);
const builtin = await import('node:fs');
console.log(typeof builtin.readFileSync);
