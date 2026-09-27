// Records the "How it works" video (public/how-it-works.webm) by driving the
// real app in Chrome with captions, a visible pointer and highlights: pick a
// strategy, adjust a filter, read the table, compare, export, open a stock,
// watchlist, alert, portfolio, performance, search. It runs on a private copy
// of the app (demo-app.mjs), so no real account is touched.
//
// Run: npm run build && npm run video   (needs Google Chrome installed)

import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { startDemoApp, ROOT, sleep } from "./demo-app.mjs";

const OUT = process.env.VIDEO_OUT ?? join(ROOT, "public", "how-it-works.webm");

// ── Overlays drawn into the page: title card, caption, highlight, pointer ──
function overlay() {
  const ACCENT = "#00E0BE";
  const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
  // This runs before the page has any elements at all — wait for them, and
  // paint the page dark and show the title card the moment they exist, so
  // the video doesn't open on a white flash.
  const whenReady = (test, fn) => {
    if (test()) return fn();
    const obs = new MutationObserver(() => { if (test()) { obs.disconnect(); fn(); } });
    obs.observe(document, { childList: true, subtree: true });
  };
  whenReady(() => document.documentElement, () => { document.documentElement.style.background = "#07070E"; });
  const div = css => { const el = document.createElement("div"); el.style.cssText = css; return el; };
  const text = (tag, content, css) => { const el = document.createElement(tag); el.textContent = content; el.style.cssText = css; return el; };
  const p = {};

  function fillCard(title, lines) {
    p.card.replaceChildren();
    const h = document.createElement("div");
    h.style.cssText = "font-size:54px;font-weight:800;letter-spacing:-0.04em";
    h.append("Stock", text("span", "wise", `color:${ACCENT}`), text("span", " India", "color:#8A8FA3;font-weight:600"));
    p.card.append(h);
    if (title) p.card.append(text("div", title, "font-size:26px;font-weight:600;color:#fff;letter-spacing:-0.02em"));
    for (const l of lines) p.card.append(text("div", l, "font-size:17px;color:#8A8FA3"));
  }

  function mount() {
    p.spot = div(`position:fixed;left:0;top:0;width:0;height:0;border:3px solid ${ACCENT};border-radius:12px;box-shadow:0 0 0 6px rgba(0,224,190,0.18),0 0 32px rgba(0,224,190,0.35);z-index:2147483644;pointer-events:none;opacity:0;transition:all 450ms cubic-bezier(0.16,1,0.3,1)`);
    p.caption = div(`position:fixed;left:50%;bottom:30px;transform:translate(-50%,14px);max-width:900px;width:max-content;display:flex;align-items:center;padding:14px 24px;border-radius:16px;background:rgba(7,7,14,0.94);border:1px solid rgba(0,224,190,0.55);box-shadow:0 14px 44px rgba(0,0,0,0.55);color:#fff;font:600 20px/1.4 ${FONT};letter-spacing:-0.01em;z-index:2147483645;opacity:0;transition:opacity 350ms,transform 350ms;pointer-events:none`);
    p.cursor = div(`position:fixed;left:${innerWidth / 2}px;top:${innerHeight / 2}px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,0.95);border:2px solid ${ACCENT};box-shadow:0 2px 12px rgba(0,0,0,0.6);z-index:2147483646;pointer-events:none;opacity:0;transition:left 650ms cubic-bezier(0.16,1,0.3,1),top 650ms cubic-bezier(0.16,1,0.3,1),opacity 300ms`);
    p.card = div(`position:fixed;inset:0;z-index:2147483647;background:#07070E;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:${FONT};color:#fff;transition:opacity 700ms;pointer-events:none`);
    fillCard("How it works", ["In under two minutes"]);
    document.body.append(p.spot, p.caption, p.cursor, p.card);
  }
  whenReady(() => document.body, mount);

  window.__demo = {
    card(title, ...lines) { fillCard(title, lines); p.card.style.opacity = "1"; },
    hideCard() { p.card.style.opacity = "0"; },
    showCursor() { p.cursor.style.opacity = "1"; },
    hideCursor() { p.cursor.style.opacity = "0"; },
    caption(n, words) {
      p.caption.replaceChildren();
      if (n != null) p.caption.append(text("span", String(n), `display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;padding:0 8px;border-radius:16px;background:${ACCENT};color:#07070E;font-weight:800;font-size:16px;margin-right:14px;flex-shrink:0`));
      p.caption.append(text("span", words, ""));
      p.caption.style.opacity = "1";
      p.caption.style.transform = "translate(-50%,0)";
    },
    hideCaption() { p.caption.style.opacity = "0"; p.caption.style.transform = "translate(-50%,14px)"; },
    spot(x, y, w, h) { Object.assign(p.spot.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, opacity: "1" }); },
    hideSpot() { p.spot.style.opacity = "0"; },
    cursorTo(x, y, instant = false) {
      if (instant) p.cursor.style.transition = "opacity 300ms";
      p.cursor.style.left = `${x}px`;
      p.cursor.style.top = `${y}px`;
      if (instant) { p.cursor.offsetWidth; p.cursor.style.transition = ""; }
    },
    ripple() {
      const r = div(`position:fixed;left:${p.cursor.style.left};top:${p.cursor.style.top};width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid ${ACCENT};z-index:2147483646;pointer-events:none`);
      document.body.append(r);
      r.animate([{ transform: "scale(0.3)", opacity: 1 }, { transform: "scale(1.6)", opacity: 0 }], { duration: 550, easing: "ease-out" }).onfinish = () => r.remove();
    },
  };
}

const { base: BASE, browser, context } = await startDemoApp({ recordVideo: true });
await context.addInitScript(overlay);
const page = await context.newPage();

// ── Helpers ──
const demo = (fn, ...args) => page.evaluate(([f, a]) => window.__demo[f](...a), [fn, args]);
const headerH = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0);
async function scrollToEl(locator, gap = 16) {
  const top = await locator.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate(y => window.scrollTo({ top: y, behavior: "smooth" }), Math.max(0, top - (await headerH()) - gap));
  await sleep(1100);
}
async function scrollBy(dy, wait = 1400) {
  await page.evaluate(d => window.scrollBy({ top: d, behavior: "smooth" }), dy);
  await sleep(wait);
}
async function pointAt(locator) {
  const b = await locator.boundingBox();
  await demo("showCursor");
  await demo("cursorTo", b.x + b.width / 2, b.y + b.height / 2);
  await sleep(750);
}
async function click(locator, after = 900) {
  await pointAt(locator);
  await demo("ripple");
  await locator.click();
  await sleep(after);
}
async function spot(locator, pad = 6) {
  const b = await locator.boundingBox();
  await demo("spot", b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
}
// Highlight something and bring the pointer to it
async function show(locator, pad = 6) {
  await spot(locator, pad);
  await pointAt(locator);
}
async function drag(slider, fromVal, toVal, min, max) {
  const b = await slider.boundingBox();
  const xAt = v => b.x + 9 + ((v - min) / (max - min)) * (b.width - 18);
  const y = b.y + b.height / 2;
  await demo("showCursor");
  await demo("cursorTo", xAt(fromVal), y);
  await sleep(800);
  await page.mouse.move(xAt(fromVal), y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    const x = xAt(fromVal + ((toVal - fromVal) * i) / 14);
    await page.mouse.move(x, y);
    await demo("cursorTo", x, y, true);
    await sleep(55);
  }
  await page.mouse.up();
  await sleep(700);
}
// A live-price hiccup shows a warning on the stock page — fine in the app,
// wrong in a demo. Stop so the take can be re-run instead of kept.
async function cleanTake() {
  await sleep(600);
  const warning = page.getByText("Couldn't fetch a live price");
  if (await warning.count()) {
    throw new Error(`A live price didn't load during this take — run it again for a clean video. The page said: ${await warning.first().textContent()}`);
  }
}
// Yahoo sometimes drops requests when many arrive together, as they do while
// recording. Fetching a stock page's price ahead of time, quietly retrying,
// puts it in the server's 15-minute cache before the camera gets there.
async function warmQuote(symbol) {
  for (let i = 0; i < 4; i++) {
    const res = await context.request.get(`${BASE}/api/stock/${symbol}`).catch(() => null);
    if ((await res?.json().catch(() => null))?.quote) return;
    await sleep(1500);
  }
}
const tab = name => page.locator(".discovery-tabs button", { hasText: name });
const rows = () => page.locator("table.data-table tbody tr");

// ── The walkthrough ──
const SEARCHED = "TITAN"; // the stock found by search at the end
const HOLDING = "ICICIBANK"; // the sample purchase in the portfolio step
// Slow first-time lookups, done now so the camera never waits on them: the
// two stocks' prices, and NSE's company list (search, and the name a new
// holding gets)
const warmSearched = warmQuote(SEARCHED);
const warmHolding = warmQuote(HOLDING);
const warmList = context.request.get(`${BASE}/api/search?q=${SEARCHED}`).catch(() => null);
await page.goto(BASE, { waitUntil: "networkidle" });
const strategy = page.getByRole("button", { name: /Buffett-style/ });
await strategy.waitFor();
await sleep(2400);
await demo("hideCard");
await sleep(1000);

await demo("caption", 1, "Pick a strategy — 13 ready-made ways to screen the market");
await spot(strategy);
await sleep(1800);
await click(strategy, 600);
await rows().first().waitFor();
await demo("hideSpot");

await demo("caption", 2, "Each strategy is a set of filters — change any of them");
const roce = page.getByText("Min ROCE", { exact: true }).locator("xpath=../../input[@type='range']");
await scrollToEl(page.getByText("Business Quality", { exact: true }), 60);
await spot(roce.locator("xpath=.."), 4);
await drag(roce, 20, 30, 0, 50);
await demo("hideSpot");
const find = page.getByRole("button", { name: "Find Stocks" });
await scrollToEl(find, 200);
await click(find, 1500);

// Step 6 compares the top three by ROCE and step 8 opens the first of them:
// fetch their technicals and price now, while steps 3–5 play, so the camera
// doesn't sit on "loading…" if Yahoo is slow (the server keeps both cached)
const byRoce = await page.$$eval("table.data-table tbody tr", trs => trs.map(tr => ({
  symbol: tr.querySelector("td:nth-child(2) span")?.textContent.trim(),
  roce: parseFloat(tr.querySelector("td:nth-child(6)")?.textContent),
})));
const topThree = byRoce.filter(r => r.symbol).sort((a, b) => (b.roce || -Infinity) - (a.roce || -Infinity)).slice(0, 3).map(r => r.symbol);
const warmAhead = Promise.all([
  warmQuote(topThree[0]),
  ...topThree.map(s => context.request.get(`${BASE}/api/stock/${s}/technicals`).catch(() => null)),
]);

await scrollToEl(page.getByRole("button", { name: "Export Excel" }), 20);
await demo("caption", 3, "Each company gets a quality score from 10 checks on its latest NSE filings");
await show(rows().first().locator("td").nth(2));
await sleep(2600);

await demo("caption", 4, "Buy phases: three prices below fair value — ✓ means today's price is at or under it");
await show(rows().first().locator("td").nth(10));
await sleep(3600);
await demo("hideSpot");

await demo("caption", 5, "Sort by any column — here, highest return on capital first");
await click(page.locator("table.data-table thead th", { hasText: "ROCE %" }), 1800);
const firstSymbol = (await rows().first().locator("td").nth(1).locator("span").first().textContent()).trim();
if (firstSymbol !== topThree[0]) throw new Error(`Expected ${topThree[0]} first after sorting by ROCE, got ${firstSymbol}`);

await demo("caption", 6, "Tick up to 4 companies to compare them side by side");
for (const i of [0, 1, 2]) await click(page.locator("table.data-table tbody input[type=checkbox]").nth(i), 350);
const compare = page.getByRole("button", { name: /^Compare \d$/ });
await spot(compare);
await sleep(900);
await demo("hideSpot");
await click(compare, 300);
await page.waitForFunction(() => document.body.innerText.includes("Compare Stocks") && !document.body.innerText.includes("loading…"), null, { timeout: 30000 });
await sleep(2600);
await page.locator("h2", { hasText: "Compare Stocks" }).evaluate(h => h.closest('div[style*="position: fixed"]').scrollTo({ top: 460, behavior: "smooth" }));
await sleep(2800);
await click(page.getByRole("button", { name: "✕ Close" }), 500);
await click(page.getByRole("button", { name: "Clear", exact: true }), 400);

await demo("caption", 7, "Download the whole list to Excel, with a summary dashboard");
const excel = page.getByRole("button", { name: "Export Excel" });
await spot(excel);
await sleep(600);
await click(excel, 1800);
await demo("hideSpot");

await demo("caption", 8, "Open any company for the full picture");
await warmAhead;
const firstName = rows().first().locator("td").nth(1).locator("div").first();
await click(firstName, 1200);
await page.getByText("Price Ladder").waitFor();
await cleanTake();
await sleep(1200);
await demo("caption", 8, "Buy ladder, fair value, a 10-point checklist, charts, shareholding and results");
await demo("hideCursor"); // it would sit over whatever scrolls past
for (let i = 0; i < 5; i++) await scrollBy(560, 1500);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
await sleep(1300);

await demo("caption", 9, "Star it to your watchlist, or set a price alert");
await click(page.getByRole("button", { name: /^Watch$/ }).filter({ visible: true }).first(), 1200);
await click(page.getByRole("button", { name: /^Alert$/ }).filter({ visible: true }).first(), 1400);
await demo("caption", 9, "Pick a price — here its Phase 2 level — and create the alert");
const pick = page.locator("button", { hasText: /^Phase 2 ₹/ });
if (!(await pick.count())) throw new Error("no Phase 2 button in the alert popup — the caption would be wrong");
await click(pick.first(), 1300);
await click(page.getByRole("button", { name: "Create alert" }), 1500);

await demo("caption", 10, "Your watchlist shows how each stock has moved since you starred it");
await click(tab("Watchlist"), 3600);

// A sample purchase 10% under today's price, worked out before the form opens
await Promise.all([warmHolding, warmList]);
const quote = await (await context.request.get(`${BASE}/api/stock/${HOLDING}`)).json().catch(() => null);
const buyAt = quote?.metrics?.cmp ? String(Math.round(quote.metrics.cmp * 0.9)) : "1200";

await demo("caption", 11, "Record what you own in Portfolio — see profit and where each holding sits on its ladder");
await click(tab("Portfolio"), 900);
await click(page.getByRole("button", { name: "+ Add Holding" }), 700);
await page.getByPlaceholder("e.g. TCS").pressSequentially(HOLDING, { delay: 110 });
await page.getByPlaceholder("0.00").pressSequentially(buyAt, { delay: 90 });
await page.getByPlaceholder("0", { exact: true }).pressSequentially("10", { delay: 110 });
await sleep(400);
await click(page.getByRole("button", { name: "Add to Portfolio" }), 4200);

await demo("caption", 12, "Performance: how each strategy's picks have done since they were picked");
await click(tab("Performance"), 3800);

await demo("caption", 13, "Search any NSE company by name or symbol");
await warmSearched;
const search = page.getByPlaceholder("Search any stock by name or symbol…");
await click(search, 300);
await search.pressSequentially("Titan", { delay: 140 });
await sleep(1500);
await search.press("Enter");
await page.getByText("Price Ladder").waitFor();
await cleanTake();
await sleep(2600);

await demo("hideCaption");
await demo("hideSpot");
await demo("card", "Find quality Indian companies and the prices where they turn good value", "Data from NSE filings · Educational use only — not investment advice");
await sleep(4200);

const video = page.video();
await context.close();
copyFileSync(await video.path(), OUT);
await browser.close();
console.log(`Saved ${OUT}`);
// The server copy keeps Node running otherwise
process.exit(0);
