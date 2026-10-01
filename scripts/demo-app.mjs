// A private copy of the app for the video and screenshot scripts: the real
// market data, an empty throwaway accounts database (deleted afterwards), no
// background jobs, and a browser signed in as a demo account whose random
// password is never stored anywhere. No real account is touched.
//
// Needs Google Chrome installed and a build (npm run build). playwright-core
// is pinned to 1.52: later releases dropped the video encoder for macOS 13.

import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export const ROOT = process.env.APP_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function startDemoApp({ port = 8791, width = 1280, height = 800, recordVideo = false } = {}) {
  if (!existsSync(join(ROOT, "dist", "index.html"))) throw new Error("Build the app first: npm run build");

  const tmp = mkdtempSync(join(tmpdir(), "stockwise-demo-"));
  const server = spawn(process.execPath, ["--no-warnings", "server/http-server.js"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, PORT: String(port), STOCKWISE_DB: join(tmp, "demo.db"), DATA_JOBS: "off" },
  });
  const stop = () => { server.kill(); rmSync(tmp, { recursive: true, force: true }); };
  process.on("exit", stop);

  const base = `http://localhost:${port}`;
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 100) throw new Error("server didn't start");
    await sleep(200);
  }

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 1, colorScheme: "dark",
    ...(recordVideo && { recordVideo: { dir: tmp, size: { width, height } } }),
  });
  const signup = await context.request.post(`${base}/api/auth/signup`, { data: { email: `demo-${Date.now()}@example.com`, password: randomUUID() } });
  if (!signup.ok()) throw new Error(`demo signup failed: ${signup.status()}`);
  return { base, browser, context, stop };
}
