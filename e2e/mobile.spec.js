// The installed app (17 Oct 2026; replica/test-plan.md "M" cases): the site
// as an app on a phone — installable, opens offline, never serves market data
// from a copy, explains Add to Home Screen on an iPhone, and has buttons big
// enough for a thumb. Phone cases run in the phone project (Pixel 7).
import { test, expect } from "./fixtures.js";
import { test as plain } from "@playwright/test";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("M-H1/H2 installable: manifest, icons and a service worker that takes over @phone", async ({ page, context, baseURL }) => {
  const manifest = await page.request.get(`${baseURL}/manifest.webmanifest`);
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  const m = await manifest.json();
  expect(m).toMatchObject({ name: expect.stringContaining("Jocular Insights"), short_name: "Jocular", start_url: "/", display: "standalone" });
  expect(m.icons.some(i => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
  for (const src of [...m.icons.map(i => i.src), "/apple-touch-icon.png"]) {
    const icon = await page.request.get(baseURL + src);
    expect(icon.status(), src).toBe(200);
  }
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Chrome's own check; a test browser is a private window, which can't install anything
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors.map(e => e.errorId).filter(id => id !== "in-incognito")).toEqual([]);
});

// Offline the browser logs every failed request, which the shared fixture
// counts as errors — so this one runs without it
plain("M-E1/E2 offline: the app's frame opens, market data is never served from a copy @phone", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Jocular Insights" }).first()).toBeVisible();
  // the logo comes from the copy made at install, not a broken image
  expect(await page.locator("img[src='/jocular-insights-mark.svg']").first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  // the API is never answered from a copy: offline it fails, it doesn't go stale
  const api = await page.evaluate(() => fetch("/api/presets").then(r => `answered ${r.status}`, () => "failed"));
  expect(api).toBe("failed");
});

// On a phone the Account menu's items are in the Settings tab (17 Oct 2026)
const settings = page => page.getByRole("navigation", { name: "Pages" }).getByRole("button", { name: "Settings" }).click();

// The phone layout's tests: the phone project only (a computer has no bottom bar)
test.describe("the phone layout", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone layout");

  test.describe("on an iPhone", () => {
    test.use({ userAgent: IPHONE_UA });
    test("M-H3 Settings → Install the app shows the Add to Home Screen steps @phone", async ({ page, account }) => {
      await page.goto("/");
      await settings(page);
      await page.getByRole("button", { name: /Install the app/ }).click();
      await expect(page.getByText("In Safari, tap Share, then Add to Home Screen.")).toBeVisible();
    });
  });

  test("M-E3 buttons a thumb can hit: the bottom tabs and the header's are at least 44 px tall @phone", async ({ page, account }) => {
    await page.goto("/");
    await expect(page.locator(".bottom-tab-bar")).toBeVisible();
    const sizes = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll(".bottom-tab-bar button, .bottom-tab-bar a, header button")]
        .filter(el => el.offsetParent !== null)
        .map(el => { const r = el.getBoundingClientRect(); return { name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; });
      return boxes;
    });
    const small = sizes.filter(s => s.h < 44 || s.w < 44);
    expect(small, JSON.stringify(sizes)).toEqual([]);
  });

  // BUG-005: the Account menu was covered on a phone's Discover. On a phone
  // it's the Settings tab now; signing out from there must work.
  test("BUG-005 Settings → Sign out works on a phone @phone", async ({ page, account }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Strategies" })).toBeVisible();
    await settings(page);
    await page.getByRole("button", { name: "Sign out" }).click({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Sign in", exact: true }).first()).toBeVisible();
  });

  // ── The app on a phone (17 Oct 2026, after the Stock Screeners: India app) ──
  test("M-H4 the bar has five tabs; Settings switches the theme and opens Performance @phone", async ({ page, account }) => {
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Pages" });
    await expect(bar.getByRole("button")).toHaveText(["Discover", "Watchlist", "Portfolio", "Alerts", "Settings"]);
    await settings(page);
    await expect(page.getByRole("heading", { level: 2, name: "Settings" })).toBeVisible();
    const dark = page.getByRole("switch", { name: "Dark mode" });
    const before = await dark.getAttribute("aria-checked");
    await dark.click();
    await expect(dark).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", before === "true" ? "light" : "dark");
    await page.getByRole("button", { name: /Strategy performance/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Strategy performance" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  test("M-H5 strategies: search and the kind chips narrow the cards @phone", async ({ page, account }) => {
    await page.goto("/");
    const cards = page.locator(".ph-card:not(.ph-card-skel)");
    await expect(cards.first()).toBeVisible();
    const all = await cards.count();
    await page.getByRole("button", { name: "Value", exact: true }).click();
    await expect.poll(() => cards.count()).toBeLessThan(all);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search strategies" }).fill("dividend");
    await expect(cards.filter({ hasText: /dividend/i }).first()).toBeVisible();
    expect(await cards.count()).toBe(await cards.filter({ hasText: /dividend/i }).count());
    await page.getByRole("searchbox", { name: "Search strategies" }).fill("zzzz");
    await expect(page.getByText(/No strategy matches/)).toBeVisible();
  });

  test("M-H6 a strategy's stocks: sort chips sort, and tapping again reverses @phone", async ({ page, account }) => {
    await page.goto("/");
    // the card itself (its "+N rules" button names the strategy too)
    await page.getByRole("button", { name: "View matching stocks for High Quality Compounders" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "High Quality Compounders" })).toBeVisible();
    const sort = page.getByRole("group", { name: "Sort by" });
    const prices = () => page.locator(".ph-row-price").allTextContents().then(t => t.map(v => Number(v.replace(/[₹,]/g, ""))).filter(Number.isFinite));
    await sort.getByRole("button", { name: "Sort by Price" }).click();
    await expect.poll(async () => { const p = await prices(); return p.length > 2 && p.every((v, i) => !i || p[i - 1] >= v); }).toBe(true);
    await sort.getByRole("button", { name: /Sorted by Price/ }).click();
    await expect.poll(async () => { const p = await prices(); return p.length > 2 && p.every((v, i) => !i || p[i - 1] <= v); }).toBe(true);
  });

  test("M-E4 ads: none on the website; ?ads=preview shows where they go @phone", async ({ page, account, baseURL }) => {
    // The server's switch is off unless ADS is set, and there's no app-ads.txt without a publisher ID
    const config = await (await page.request.get(`${baseURL}/api/app-config`)).json();
    expect(config.ads.mode).toBe("off");
    expect((await page.request.get(`${baseURL}/app-ads.txt`)).status()).toBe(404);
    await page.goto("/");
    await expect(page.locator(".ph-card").nth(3)).toBeVisible();
    await expect(page.getByRole("note", { name: "Ad space" })).toHaveCount(0);
    await page.goto("/?ads=preview");
    await expect(page.getByRole("note", { name: "Ad space" }).first()).toBeVisible();
  });
});

// BUG-006: the front page counted strategies and filters by hand
test("BUG-006 the front page's counts aren't written in by hand", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "What's inside" }).scrollIntoViewIfNeeded();
  await expect(page.getByText(/\b13 ready-made strategies/)).toHaveCount(0);
  await expect(page.getByText(/\b99 metrics/)).toHaveCount(0);
  await expect(page.getByText(/one of \d+ screens/)).toHaveCount(0);
});

// As in Reddit's app (20 Oct 2026): reading down folds the tab bar into one
// round button, the current tab's; tapping it, or scrolling back up, opens it
test("M-H8 the tab bar folds into one button while reading down @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone's tab bar");
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Pages" });
  await expect(bar.getByRole("button", { name: "Watchlist" })).toBeVisible();
  const readDown = async () => { for (let i = 0; i < 6; i++) { await page.evaluate(() => window.scrollBy(0, 120)); await page.waitForTimeout(60); } };
  await readDown();
  const folded = bar.getByRole("button", { name: "Discover: show all tabs" });
  await expect(folded).toBeVisible();
  await expect(bar.getByRole("button", { name: "Watchlist" })).toHaveCount(0);
  await expect.poll(async () => (await bar.boundingBox()).width).toBeLessThan(80);
  await folded.click();
  await expect(bar.getByRole("button", { name: "Watchlist" })).toBeVisible();
  await readDown();
  await expect(folded).toBeVisible();
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.scrollBy(0, -60)); await page.waitForTimeout(60); }
  await expect(bar.getByRole("button", { name: "Watchlist" })).toBeVisible();
  await bar.getByRole("button", { name: "Watchlist" }).click();
  await expect(bar.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-current", "page");
});
