import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".next-browser/**",
    "client/**",
    "server/**",
    "drizzle/**",
    "shared/**",
    "dist/**",
    "vite.config.ts",
    "drizzle.config.ts",
    "vitest.config.ts",
    "tsconfig.node.json",
  ]),
]);
