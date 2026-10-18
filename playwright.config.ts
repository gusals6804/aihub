import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Uses the system Chrome (`channel: "chrome"`) rather than Playwright's bundled
 * Chromium: this machine sits behind a TLS-inspecting proxy that blocks the
 * browser download. On a machine with normal egress, `npx playwright install`
 * plus removing `channel` also works.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // zz-capture* only take screenshots for docs; they assert nothing.
  testIgnore: /zz-capture.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Logs in once and saves the session; per-test logins would hit the
    // (deliberately strict) auth rate limiter.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { channel: "chrome" },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        channel: "chrome",
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // E2E runs against the sample-data path: no provider keys are supplied, so
    // no test ever calls a real external API. serve.mjs retries the flaky
    // AV-corrupted bind (see the script header) instead of failing the suite.
    command: `npm run build && node scripts/serve.mjs ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ANTHROPIC_API_KEY: "",
      FRED_API_KEY: "",
      NAVER_CLIENT_ID: "",
      NAVER_CLIENT_SECRET: "",
      DART_API_KEY: "",
      KAKAO_REST_API_KEY: "",
      DATABASE_URL: "file:./dev.db",
    },
  },
});
