/**
 * Compatibility entry.
 *
 * `package.json` points `exports["."]` at `./host.js`; this file only exists so
 * a stale reference to `index.js` from an older install still resolves.
 */
export { apply, inject, name } from './host.js';
