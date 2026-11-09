// Shared by the tab bar scripts (README.md): a private copy of the app — a
// throwaway accounts database, no data jobs, no Telegram or email keys, as
// .claude/skills/run-stockwise-india/driver.mjs does — and a phone-sized
// Chrome page signed in to a throwaway account, with the guided tours skipped.
// Run `npm run build` first: the server serves dist/.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
// everything a script writes goes here, never into the repo
export const OUT = process.env.OUT || "/tmp/stockwise-tabbar";
export function outDir(...parts) {
  const dir = [OUT, ...parts].join("/");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function startApp() {
  const port = 8800 + Math.floor(Math.random() * 180);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn("node", ["--no-warnings", "server/http-server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), STOCKWISE_DB: `/tmp/tabbar-${Date.now()}-${port}.db`, DATA_JOBS: "off", TRUST_PROXY: "1", TELEGRAM_BOT_TOKEN: "", RESEND_API_KEY: "" },
    stdio: "ignore",
  });
  const stop = () => { try { server.kill(); } catch { /* gone already */ } };
  process.on("exit", stop);
  // the market is built in slices after start: wait for it, not just the port
  for (let i = 0; i < 300; i++) {
    try { const health = await (await fetch(`${base}/api/health`)).json(); if (health.companiesInScreener) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return { base, stop };
}

// --cpu: no WebGL (the rim lens falls back to its pixel loop). Note it also
// changes how Chrome draws the rest of the page, so compare runs made alike.
export const launch = ({ cpu = false } = {}) => chromium.launch({ channel: "chrome", args: cpu ? ["--disable-webgl", "--disable-3d-apis"] : [] });

// A phone: touch, 3x, signed in to a new throwaway account, tours skipped.
// `init` is a list of [function, argument] run in the page before it loads.
export async function phonePage(browser, base, { width = 390, height = 844, theme = "dark", init = [], context = {} } = {}) {
  const ip = () => Math.floor(Math.random() * 250);
  // each context its own address: sign-ups are limited to 10 an hour per address
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, colorScheme: theme, isMobile: true, hasTouch: true, extraHTTPHeaders: { "x-forwarded-for": `10.${ip()}.${ip()}.${ip()}` }, ...context });
  await ctx.addInitScript(t => { try { localStorage.setItem("stockwise-india-theme", t); } catch { /* storage blocked */ } }, theme);
  for (const [fn, arg] of init) await ctx.addInitScript(fn, arg);
  const email = `tabbar-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const { userId } = await (await ctx.request.post(`${base}/api/auth/signup`, { data: { email, password: randomUUID() } })).json();
  await ctx.addInitScript(key => { try { localStorage.setItem("stockwise-tours", JSON.stringify({ [key]: { app: true, stock: true } })); } catch { /* storage blocked */ } }, `${userId}:${email}`);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/status of (400|401)/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await page.goto(base + "/");
  await page.waitForSelector(".bottom-tab-bar .btb-tab");
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

// the bar's strip of the screen at 3x, as the recording was measured (y 2140..2420)
export const BAR_CLIP = { x: 0, y: 2140 / 3, width: 375, height: 280 / 3 };
