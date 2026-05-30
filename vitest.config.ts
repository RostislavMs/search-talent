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
      include: [
        "src/lib/articles.ts",
        "src/lib/auth/validation.ts",
        "src/lib/cookie-consent.ts",
        "src/lib/leaderboards.ts",
        "src/lib/moderation.ts",
        "src/lib/profile-completeness.ts",
        "src/lib/profile-presentation.ts",
        "src/lib/profile-sections.ts",
        "src/lib/project-media.ts",
        "src/lib/projects.ts",
        "src/lib/rate-limit.ts",
        "src/lib/rich-text.ts",
        "src/lib/seo.ts",
        "src/lib/validation/**/*.ts",
      ],
      exclude: ["src/lib/**/*.d.ts"],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 80,
        statements: 70,
      },
    },
  },
});
