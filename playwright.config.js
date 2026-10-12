// End-to-end tests (npm run e2e): a private copy of the app on 127.0.0.1:8793
// with the real market data, a throwaway accounts database, no background
// jobs, and system Chrome (playwright is pinned to 1.52 — see demo-app.mjs).
// TRUST_PROXY=1 lets each test's sign-up come from its own forwarded
// address, so the 10-sign-ups-an-hour limit isn't what's being tested.
import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8793;
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "chrome",
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 860 } } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" }, grep: /@phone/ },
  ],
  webServer: {
    command: `node --no-warnings server/http-server.js`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT), STOCKWISE_DB: join(tmpdir(), `stockwise-e2e-${process.pid}.db`), DATA_JOBS: "off", TRUST_PROXY: "1", TELEGRAM_BOT_TOKEN: "", RESEND_API_KEY: "" },
  },
});
