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
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// PLAY_TALL=1: iPhone-shaped shots (360 × 736: an iPhone screen under its status bar) for the framed pictures, scripts/play-frames.mjs (14 Nov 2026)
const TALL = process.env.PLAY_TALL === "1";
// PLAY_THEME=light: the app in its light theme (14 Nov 2026, owner: "show me in light mode")
const THEME = process.env.PLAY_THEME === "light" ? "light" : "dark";
const OUT = join(ROOT, TALL ? `replica/launch/play/tall${THEME === "light" ? "-light" : ""}` : "replica/launch/play");
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
const ctx = await browser.newContext({ viewport: { width: 360, height: TALL ? 736 : 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: THEME, extraHTTPHeaders: { "x-forwarded-for": "10.77.1.1" } });
// Company logos off (the app's own setting): each company shows its letters,
// so the store listing carries no other company's logo (22 Oct 2026)
await ctx.addInitScript(t => { try { localStorage.setItem("stockwise-india-theme", t); localStorage.setItem("stockwise-india-logos", "off"); } catch {} }, THEME);
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

// (14 Nov 2026) the home is now Screeners: star two first, so Favourites shows cards
await page.goto(`${base}/`); await page.getByRole("heading", { name: "Screeners" }).waitFor(); await settle();
await page.locator(".ps-fav-hint").click(); await settle(800);
for (let i = 0; i < 2; i++) { await page.locator('[aria-label^="Add "][aria-label$="to favourites"]').first().click(); await page.waitForTimeout(400); }
await page.getByRole("button", { name: "Screeners" }).first().click(); await page.getByRole("heading", { name: "Screeners", exact: true }).waitFor(); await settle(2500);
await shot("1-screeners.png");
// (14 Nov 2026, owner: the news instead of a screener's stocks) Explore → the news in full
await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Explore" }).click(); await settle(2500);
// the news on its "Results" tab: companies' own announcements only, no outside headlines
await page.locator(":text-is(\"In the news\"):visible").first().scrollIntoViewIfNeeded(); await settle(1500);
await page.locator("button:text-is(\"Results\"):visible").first().click().catch(() => {}); await settle(4000);
await page.locator(":text-is(\"In the news\"):visible").first().evaluate(e => { const y = e.getBoundingClientRect().top + scrollY - 250; scrollTo(0, y); }); await settle(2000);
await shot("2-news.png");
// (14 Nov 2026) a company up over the year with a strong overall score (SBIN: 71, +13.2% at the 13 Nov close), so the store doesn't open on a fall
await page.goto(`${base}/stock/SBIN`); await page.getByRole("heading", { level: 2 }).first().waitFor(); await settle(3000);
await shot("3-company.png");
// (14 Nov 2026) the page's tabs are Summary, Business, Growth, Safety…: the
// summary's score card, further down (not valuation: its price levels read as a trade call)
await page.locator(":text-matches('^in short$', 'i'):visible").first().evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY - 240)); await settle(1500);
await shot("4-scorecard.png");
// (14 Nov 2026) the market map itself, full screen: every sector and company coloured by its move
await page.goto(`${base}/`); await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Explore" }).click(); await settle(3000);
await page.locator(":text-is('Market map'):visible").first().click(); await settle(4000);
// its 1-month view (a period the map offers; shown on the map), full screen
await page.locator("button:text-is('1M'):visible").first().click(); await settle(2500);
await page.getByRole("button", { name: "Full screen" }).click(); await settle(3000);
await shot("5-explore.png");
await page.getByRole("button", { name: "Leave full screen" }).click().catch(() => {});
await page.goto(`${base}/`); await settle(1500);
await page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Watchlist" }).click(); await settle(2500);
await shot("6-watchlist.png");

// The feature graphic: the mark, the name and one line, on the app's sky
const art = join(tmpdir(), `play-feature-${Date.now()}.html`);
writeFileSync(art, `<!doctype html><html><body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:-apple-system,'Inter',Segoe UI,Roboto,sans-serif;background:radial-gradient(120% 120% at 70% 20%, #1b2550 0%, #0b0d1c 55%, #080810 100%);color:#F4F4FF;display:flex;align-items:center;gap:44px;padding:0 84px;box-sizing:border-box">
<img src="file://${join(ROOT, "public/jocular-insights-icon.svg")}" style="width:168px;height:168px;border-radius:38px;box-shadow:0 18px 50px rgba(0,0,0,.45)">
<div><div style="font-size:66px;font-weight:750;letter-spacing:-2px;line-height:1">Jocular <span style="color:#6FA0FF">Insights</span></div>
<div style="margin-top:18px;font-size:27px;color:#A8A8C0;line-height:1.3;white-space:nowrap">Research for the Indian stock market, from company filings</div>
<div style="margin-top:22px;font-size:22px;color:#00E0BE;font-weight:600">Strategies · Quality scores · Fair values</div></div></body></html>`);
const fg = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await fg.goto(`file://${art}`); await fg.waitForTimeout(800);
await fg.screenshot({ path: join(OUT, "feature-graphic.png") }); console.log("  feature-graphic.png");
// The store icon: the white logo, as the app's own icon (scripts/android-
// assets.mjs, 23 Oct 2026) — the owner's artwork on white, edge to edge
// (Play rounds the corners itself)
await fg.setViewportSize({ width: 512, height: 512 });
await fg.setContent(`<body style="margin:0;width:512px;height:512px;background:#fff;display:grid;place-items:center"><img src="data:image/png;base64,${readFileSync(join(ROOT, "scripts/brand/ji-original.png")).toString("base64")}" style="width:410px;height:410px"></body>`);
await fg.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
await fg.screenshot({ path: join(OUT, "icon-512.png") }); console.log("  icon-512.png");

await browser.close();
process.exit(0);
