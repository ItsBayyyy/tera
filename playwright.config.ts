import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env.local")) loadEnvFile(".env.local");

const PORT = 3100;
export const MOCK_AI_URL = "http://127.0.0.1:8010";
const SERVICE_KEY = "e2e-service-key";

/**
 * Runs against a production build with the mock AI service (e2e/mock-ai-server.mjs) and the local
 * Supabase stack. Tests switch the mock between "up" and "down", so they run serially.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
  },
  webServer: [
    {
      command: "node e2e/mock-ai-server.mjs",
      url: `${MOCK_AI_URL}/health`,
      env: { MOCK_AI_PORT: "8010", AI_SERVICE_KEY: SERVICE_KEY },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/darurat`,
      env: { AI_SERVICE_URL: MOCK_AI_URL, AI_SERVICE_KEY: SERVICE_KEY, JOBS_SECRET: "e2e-jobs-secret" },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
