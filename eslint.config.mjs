import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Python service, local data and generated output are not part of the Next.js app.
    "ai-service/**",
    "data/**",
    "playwright-report/**",
    "test-results/**",
    "lib/supabase/database.types.ts",
  ]),
]);

export default eslintConfig;
