import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Allow-list of instrumented modules. Keep this to code that has real
      // test coverage so the aggregate threshold stays meaningful — do NOT add
      // broad globs over untested IO (e.g. all of src/lib/db/**), that would
      // dilute the gate. Security-adjacent modules get a per-file floor below.
      include: [
        "src/lib/articles.ts",
        "src/lib/auth/validation.ts",
        "src/lib/auto-moderation.ts",
        "src/lib/co-authors.ts",
        "src/lib/cookie-consent.ts",
        "src/lib/feed.ts",
        "src/lib/leaderboards.ts",
        "src/lib/moderation.ts",
        "src/lib/notifications-presentation.ts",
        "src/lib/plain-text.ts",
        "src/lib/profile-completeness.ts",
        "src/lib/profile-presentation.ts",
        "src/lib/profile-sections.ts",
        "src/lib/project-media.ts",
        "src/lib/projects.ts",
        "src/lib/rate-limit.ts",
        "src/lib/related.ts",
        "src/lib/rich-text.ts",
        "src/lib/search-ranking.ts",
        "src/lib/seo.ts",
        "src/lib/url-validation.ts",
        "src/lib/ai/github-draft-prompt.ts",
        "src/lib/ai/profile-summary-prompt.ts",
        "src/lib/integrations/github-mapping.ts",
        "src/lib/validation/**/*.ts",
      ],
      exclude: ["src/lib/**/*.d.ts"],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 80,
        statements: 70,
        // Per-file floors for security-adjacent modules: a regression that
        // strips their tests (dropping coverage toward 0) fails CI even if the
        // aggregate stays green. Floors sit ~10pt below current to allow churn.
        "src/lib/rich-text.ts": { lines: 75, functions: 90, branches: 70, statements: 75 },
        "src/lib/auto-moderation.ts": {
          lines: 85,
          functions: 85,
          branches: 75,
          statements: 85,
        },
        "src/lib/url-validation.ts": {
          lines: 80,
          functions: 90,
          branches: 80,
          statements: 80,
        },
      },
    },
  },
});
