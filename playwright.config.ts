import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:4000",
    screenshot: "only-on-failure",
    trace: "off",
  },

  outputDir: "e2e/screenshots",

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  webServer: {
    command: "npx tsx src/api/start.ts",
    port: 4000,
    reuseExistingServer: !process.env.CI,
    env: { PORT: "4000" },
    timeout: 30_000,
  },
});
