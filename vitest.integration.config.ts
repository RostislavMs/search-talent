import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integration / RLS tests run against a REAL Supabase instance (local stack via
 * the supabase CLI, or a dedicated cloud test project) — never the unit config.
 *
 * They self-skip when the SUPABASE_TEST_* env vars are absent (see
 * tests/integration/helpers/env.ts), so `pnpm test:integration` is safe to run
 * anywhere and stays out of the fast unit `test:coverage` gate. See
 * tests/integration/README.md for how to point it at a database.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/integration/**/*.test.ts"],
    // Network round-trips to Supabase are slower than pure unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Tests share a database; run files serially so seeded rows don't collide.
    fileParallelism: false,
  },
});
