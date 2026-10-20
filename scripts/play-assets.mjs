// The Play Store listing's pictures (19 Oct 2026): phone screenshots at
// 1080 × 1920 (Play turns down anything over 2:1, so not the emulator's
// 1080 × 2400), the 1024 × 500 feature graphic and the 512 × 512 icon.
//
//   npm run build && node scripts/play-assets.mjs
//
// Runs its own copy of the app (a throwaway accounts database, no data jobs,
// no Telegram or email keys) on the real market data, signs in with a made-up
// local account, and writes into replica/launch/play/.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "replica/launch/play");
mkdirSync(OUT, { recursive: true });

const port = await new Promise(res => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = `http://127.0.0.1:${port}`;
const server = spawn("node", ["--no-warnings", "server/http-server.js"], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(port), STOCKWISE_DB: join(tmpdir(), `play-assets-${Date.now()}.db`), DATA_JOBS: "off", TRUST_PROXY: "1", TELEGRAM_BOT_TOKEN: "", RESEND_API_KEY: "" },
  stdio: "ignore",
});
process.on("exit", () => server.kill());
for (let i = 0; i < 200; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

const browser = await chromium.launch({ channel: "chrome" });
// 360 × 640 CSS pixels at 3× = 1080 × 1920
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "dark", extraHTTPHeaders: { "x-forwarded-for": "10.77.1.1" } });
await ctx.addInitScript(() => { try { localStorage.setItem("stockwise-india-theme", "dark"); } catch {} });
// a throwaway database each run, so a plain address (it shows on Settings)
const email = "you@example.com";
const signup = await ctx.request.post(`${base}/api/auth/signup`, { data: { email, password: randomUUID() } });
const { userId } = await signup.json();
await ctx.addInitScript(o => { try { localStorage.setItem("stockwise-tours", JSON.stringify({ [o]: { app: true, stock: true } })); } catch {} }, `${userId}:${email}`);
// a few saved companies, so Watchlist isn't empty
for (const t of ["TCS", "HDFCBANK", "ASIANPAINT", "INFY"]) await ctx.request.post(`${base}/api/watchlist`, { data: { ticker: t } });

const page = await ctx.newPage();
const settle = async (ms = 1500) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(ms); };
const shot = async name => { await page.screenshot({ path: join(OUT, name) }); console.log(`  ${name}`); };

await page.goto(`${base}/`); await page.locator(".ph-card").first().waitFor(); await settle(2500);
await shot("1-strategies.png");
// a name short enough to fit the wheel on a phone
await page.goto(`${base}/?strategy=dividend_aristocrats`); await page.locator('[data-tour="row"]').first().waitFor(); await settle();
await shot("2-strategy-stocks.png");
await page.goto(`${base}/stock/TCS`); await page.getByRole("heading", { level: 2 }).first().waitFor(); await settle(3000);
await shot("3-company.png");
// a phone shows one tab of the company page at a time (20 Oct 2026); the
// scorecard, not the valuation tab — its price levels open on a warning
// ("below the stop-loss level") that reads as a trade call in a store
await page.getByRole("navigation", { name: "Parts of this page" }).getByRole("button", { name: "Scorecard" }).click(); await settle(1500);
await shot("4-scorecard.png");
await page.goto(`${base}/`); await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Watchlist" }).click(); await settle(2500);
await shot("5-watchlist.png");
await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Settings" }).click(); await settle();
await shot("6-settings.png");

// The feature graphic: the mark, the name and one line, on the app's sky
const art = join(tmpdir(), `play-feature-${Date.now()}.html`);
writeFileSync(art, `<!doctype html><html><body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:-apple-system,'Inter',Segoe UI,Roboto,sans-serif;background:radial-gradient(120% 120% at 70% 20%, #1b2550 0%, #0b0d1c 55%, #080810 100%);color:#F4F4FF;display:flex;align-items:center;gap:44px;padding:0 84px;box-sizing:border-box">
<img src="file://${join(ROOT, "public/jocular-insights-icon.svg")}" style="width:168px;height:168px;border-radius:38px;box-shadow:0 18px 50px rgba(0,0,0,.45)">
<div><div style="font-size:66px;font-weight:750;letter-spacing:-2px;line-height:1">Jocular <span style="color:#6FA0FF">Insights</span></div>
<div style="margin-top:18px;font-size:30px;color:#A8A8C0;line-height:1.3">NSE stock research from each company's own filings</div>
<div style="margin-top:22px;font-size:22px;color:#00E0BE;font-weight:600">Strategies · Quality scores · Fair values</div></div></body></html>`);
const fg = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await fg.goto(`file://${art}`); await fg.waitForTimeout(800);
await fg.screenshot({ path: join(OUT, "feature-graphic.png") }); console.log("  feature-graphic.png");
copyFileSync(join(ROOT, "public/icons/icon-512.png"), join(OUT, "icon-512.png")); console.log("  icon-512.png");

await browser.close();
process.exit(0);
