import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
