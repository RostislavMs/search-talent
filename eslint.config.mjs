import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // next/og renders these to a PNG on the server, so next/image does not
    // apply. The rule already skips them on Linux (CI) but not on Windows,
    // where the path has backslashes — turn it off explicitly for both.
    files: ["src/app/**/opengraph-image.tsx", "src/app/**/twitter-image.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
]);

export default eslintConfig;
