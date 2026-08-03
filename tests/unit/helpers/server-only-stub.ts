/**
 * Stub for the `server-only` marker package.
 *
 * `import "server-only"` is a build-time guard: Next resolves it to a module
 * that throws if a client bundle ever pulls it in. The package is not a runtime
 * dependency, so under Vitest the import fails to resolve and any test that
 * reaches a server module (`src/lib/db/*`) dies at collection time. Aliasing it
 * here (see `vitest.config.ts`) lets those modules be unit-tested directly
 * instead of only through a mock, and takes nothing away from the real build —
 * Next still resolves the genuine package there.
 */
export {};
