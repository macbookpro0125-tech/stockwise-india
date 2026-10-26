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
  // the logo comes from the copy made at install, not a broken image (the
  // header's is a picture since 21 Oct 2026: site.jsx BrandMark)
  expect(await page.locator(".brand-mark img").filter({ visible: true }).first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  // the API is never answered from a copy: offline it fails, it doesn't go stale
  const api = await page.evaluate(() => fetch("/api/presets").then(r => `answered ${r.status}`, () => "failed"));
  expect(api).toBe("failed");
});

// On a phone the Account menu's items are in Settings (17 Oct 2026), which
// the top bar's menu button opens from the left (26 Oct 2026)
const settings = page => page.getByRole("button", { name: /^Settings/ }).first().click();
// A screener, from Screeners' "All screeners" (PhoneScreens.jsx, 26 Oct 2026)
const openScreener = async (page, name) => {
  await page.getByRole("button", { name: "See all" }).click();
  await page.locator(".ps-row-open", { hasText: name }).first().click();
};

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
    await expect(page.getByRole("heading", { name: "Screeners" })).toBeVisible();
    await settings(page);
    await page.getByRole("button", { name: "Sign out" }).click({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Sign in", exact: true }).first()).toBeVisible();
  });

  // ── The app on a phone (17 Oct 2026, after the Stock Screeners: India app) ──
  test("M-H4 the bar has four tabs; Settings, from the menu, switches the theme and opens Performance @phone", async ({ page, account }) => {
    await page.goto("/");
    const bar = page.getByRole("navigation", { name: "Pages" });
    await expect(bar.getByRole("button")).toHaveText(["Discover", "Watchlist", "Explore", "Portfolio"]);
    await settings(page);
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    const dark = page.getByRole("switch", { name: "Dark mode" });
    const before = await dark.getAttribute("aria-checked");
    await dark.click();
    await expect(dark).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", before === "true" ? "light" : "dark");
    await page.getByRole("button", { name: /Strategy performance/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Strategy performance" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
  });

  test("M-H23 Screeners: a star puts a screener in Favourites, and + offers what can be made @phone", async ({ page, account }) => {
    await page.goto("/");
    await expect(page.getByText("Keep your screeners here")).toBeVisible();
    await page.getByRole("button", { name: "Add Defensive Bluechips to favourites" }).click();
    await expect(page.getByRole("group", { name: "Your favourite screeners" }).getByText("Defensive Bluechips")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("group", { name: "Your favourite screeners" }).getByText("Defensive Bluechips"), "kept with the account").toBeVisible();
    await page.getByRole("button", { name: "Create" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Create" });
    for (const name of ["New screener", "Price alert", "Add to watchlist", "Add a holding", "Import from your broker"]) await expect(sheet.getByRole("button", { name: new RegExp(name) })).toBeVisible();
    await page.goBack();
    await expect(sheet).toHaveCount(0);
  });

  test("M-H5 All screeners: search and the group tabs narrow the list @phone", async ({ page, account }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "See all" }).click();
    const rows = page.locator(".ps-row");
    await expect(rows.first()).toBeVisible();
    const all = await rows.count();
    await page.getByRole("group", { name: "Show one group" }).getByRole("button", { name: "Value", exact: true }).click();
    await expect.poll(() => rows.count()).toBeLessThan(all);
    await page.getByRole("group", { name: "Show one group" }).getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search screeners" }).fill("dividend");
    await expect(rows.filter({ hasText: /dividend/i }).first()).toBeVisible();
    // (a screener whose description says dividends is found too)
    await expect.poll(() => rows.count()).toBeLessThan(all);
    await page.getByRole("searchbox", { name: "Search screeners" }).fill("zzzz");
    await expect(page.getByText(/No screener matches/)).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { level: 2, name: "Screeners" }), "Back returns to Screeners").toBeVisible();
  });

  test("M-H6 a strategy's stocks: sort chips sort, and tapping again reverses @phone", async ({ page, account }) => {
    await page.goto("/");
    await openScreener(page, "High Quality Compounders");
    await expect(page.getByRole("heading", { level: 2, name: "High Quality Compounders" })).toBeVisible();
    const sort = page.getByRole("group", { name: "Sort by" });
    const prices = () => page.locator(".ph-row-price").allTextContents().then(t => t.map(v => Number(v.replace(/[₹,]/g, ""))).filter(Number.isFinite));
    await sort.getByRole("button", { name: "Sort by Price" }).click();
    await expect.poll(async () => { const p = await prices(); return p.length > 2 && p.every((v, i) => !i || p[i - 1] >= v); }).toBe(true);
    await sort.getByRole("button", { name: /Sorted by Price/ }).click();
    await expect.poll(async () => { const p = await prices(); return p.length > 2 && p.every((v, i) => !i || p[i - 1] <= v); }).toBe(true);
  });

  // 22 Oct 2026: "a strategy where I can see the highest gained stock — 1
  // year, 6 months, 1 week or 1 day" (and 3 and 5 years). Biggest gain first, the gain on each
  // card, and the period switch keeping its order (1 week → 1 day fell back
  // to Quality once: the old period's column went away)
  test("M-H20 Top Gainers: biggest gain first, over the period picked @phone", async ({ page, account }) => {
    await page.goto("/");
    await openScreener(page, "Top Gainers");
    await expect(page.getByRole("heading", { level: 2, name: "Top Gainers" })).toBeVisible();
    const periods = page.getByRole("group", { name: "Biggest gain over" });
    const gains = label => page.locator(".ph-row-group").evaluateAll((rows, label) => rows.map(r => [...r.querySelectorAll(".ph-stat")].find(st => st.querySelector(".ph-stat-k")?.textContent === label)?.querySelector(".ph-stat-v")?.textContent).filter(Boolean).map(t => Number(t.replace(/[+%,]/g, ""))), label);
    for (const [name, short] of [["1 year", "1Y"], ["5 years", "5Y"], ["1 week", "1W"], ["1 day", "1D"]]) {
      if (name !== "1 year") await periods.getByRole("button", { name }).click();
      await expect(periods.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("group", { name: "Sort by" }).getByRole("button", { name: new RegExp(`Sorted by ${short}`) })).toBeVisible();
      await expect.poll(async () => { const g = await gains(short); return g.length > 2 && g.every((v, i) => v >= 0 && (!i || g[i - 1] >= v)); }, { message: `${name}: each card shows its gain, biggest first` }).toBe(true);
    }
  });

  test("M-E4 ads: none on the website; ?ads=preview shows where they go @phone", async ({ page, account, baseURL }) => {
    // The server's switch is off unless ADS is set, and there's no app-ads.txt without a publisher ID
    const config = await (await page.request.get(`${baseURL}/api/app-config`)).json();
    expect(config.ads.mode).toBe("off");
    expect((await page.request.get(`${baseURL}/app-ads.txt`)).status()).toBe(404);
    await page.goto("/");
    await expect(page.locator(".ps-row").nth(3)).toBeVisible();
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
  // a page long enough to read down: every screener (Screeners itself is short for a new account)
  await page.getByRole("button", { name: "See all" }).click();
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

// A phone's stock list (20 Oct 2026): clean — the strategy wheel as its
// title, no count or dates; ⓘ opens a page with everything about the
// strategy, and Back closes it
test("M-H9 the stock list's title is the strategy wheel, its detail on an ⓘ page @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.goto("/");
  await openScreener(page, "High Quality Compounders");
  const wheel = page.getByRole("listbox", { name: "Strategy" });
  await expect(wheel.getByRole("option", { selected: true })).toHaveText("High Quality Compounders");
  await expect(page.getByText(/stocks of [\d,]+/)).toHaveCount(0);
  await expect(page.getByText(/Prices as of/)).toHaveCount(0);
  await page.getByRole("button", { name: "About this strategy" }).click();
  const info = page.getByRole("dialog", { name: "High Quality Compounders" });
  await expect(info.getByRole("heading", { name: "What it looks for" })).toBeVisible();
  await expect(info.getByText(/companies pass today/)).toBeVisible();
  await page.goBack();
  await expect(info).toHaveCount(0);
  await expect(wheel).toBeVisible();
});

// A phone's company page (20 Oct 2026, "congested and not understandable" —
// 25 screens in one scroll): its tabs are pages, one tab's parts at a time,
// and a jump to a part on another tab switches to that tab
test("M-H10 a company's tabs are pages of their own on a phone @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.goto("/stock/TCS");
  await expect(page.locator("#sec-overview")).toBeVisible();
  await expect(page.locator("#sec-scores")).toBeHidden();
  await expect(page.locator("#sec-levels")).toBeHidden();
  const tabs = page.getByRole("navigation", { name: "Parts of this page" });
  await tabs.getByRole("button", { name: "Valuation" }).click();
  await expect(page.locator("#sec-levels")).toBeVisible();
  await expect(page.locator("#sec-overview")).toBeHidden();
  await expect(tabs.getByRole("button", { name: "Valuation" })).toHaveAttribute("aria-current", "true");
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height, "a tab is a few screens, not the whole page").toBeLessThan(12000);
  // the investment case's "See Financial health" opens the Financials tab
  await tabs.getByRole("button", { name: "Scorecard" }).click();
  await page.getByRole("button", { name: "See Financial health" }).first().click();
  await expect(page.locator("#sec-health")).toBeInViewport();
  await expect(tabs.getByRole("button", { name: "Financials" })).toHaveAttribute("aria-current", "true");
});

// 21 Oct 2026, seen in the Play Store pictures: a card's figures were cut
// off on a small phone ("qual…" for an unrated research score, "71.…" for a
// promoters' holding). Every figure on a card fits, at 360 wide.
test("M-H11 a stock card's figures fit a small phone @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/?strategy=dividend_aristocrats");
  await expect(page.getByRole("option", { name: "Dividend Aristocrats", selected: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const values = page.locator(".ph-stat-v");
  await expect(values.first()).toBeVisible();
  const cut = await values.evaluateAll(els => els.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
  expect(await values.count()).toBeGreaterThan(5);
  expect(cut, "figures cut off").toEqual([]);
});

// 21 Oct 2026, seen in the Play Store pictures: a long name ("Tata
// Consultancy Services Limited") pushed the price out of the company page's
// top bar, leaving a stray "₹". The name shortens; the price stays.
test("M-H12 the company page's top bar keeps its price in view @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/stock/TCS");
  const bar = page.locator(".sd-bar-name");
  const price = bar.locator("b");
  await expect(price).toBeVisible();
  const [b, p] = [await bar.boundingBox(), await price.boundingBox()];
  expect(p.x + p.width, "the price ends inside the bar").toBeLessThanOrEqual(b.x + b.width + 1);
});

// 21 Oct 2026, on an iPhone: the company page's tab row moved up and down
// under a finger ("they go down, not stable") — the lit tab's line hung a
// pixel below the row, so the row scrolled up and down as well as across.
test("M-H13 the company page's tab row only scrolls across @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.goto("/stock/TCS");
  const row = page.getByRole("navigation", { name: "Parts of this page" });
  await expect(row).toBeVisible();
  const { overflowY, scrollHeight, clientHeight } = await row.evaluate(el => ({ overflowY: getComputedStyle(el).overflowY, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  expect(overflowY).toBe("hidden");
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
});

// 21 Oct 2026: each tab ends by pointing on to the next one ("go forward and
// check all other things"), not Back to Discover; the last tab ends plainly.
// And no wide empty band under the footer: the page keeps only the tab bar's
// room below it.
test("M-H14 each company tab ends with the next one, and no empty band below @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.goto("/stock/TCS");
  const tabs = page.getByRole("navigation", { name: "Parts of this page" });
  await expect(page.getByRole("button", { name: /Back to Discover/ })).toHaveCount(0);
  // the Overview ends with its Go deeper list instead (M-H15)
  await expect(page.getByRole("region", { name: "Go deeper" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Next:/ })).toHaveCount(0);
  await tabs.getByRole("button", { name: "Scorecard" }).click();
  const next = page.getByRole("button", { name: /^Next: Valuation/ });
  await expect(next).toBeVisible();
  await next.click();
  await expect(tabs.getByRole("button", { name: "Valuation" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator("#sec-valuation")).toBeInViewport();
  await expect(page.getByRole("button", { name: /^Next: Financials/ })).toBeAttached();
  // the last tab (Around the web, after News & filings since 25 Oct 2026)
  await tabs.getByRole("button", { name: "Around the web" }).click();
  await expect(page.getByRole("button", { name: /^Next:/ })).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(600);
  const gap = await page.evaluate(() => document.querySelector(".bottom-tab-bar").getBoundingClientRect().top - document.querySelector("footer nav").getBoundingClientRect().bottom);
  expect(gap, "the footer clears the tab bar").toBeGreaterThanOrEqual(8);
  expect(gap, "no wide empty band").toBeLessThanOrEqual(48);
});

// 22 Oct 2026: "I can't see the details of the peer companies on the phone,
// and when I expand them they're totally gone" — full names on one line
// pushed every figure off the screen. The name column is narrow, the
// comparing figures come first, and the company itself is always listed.
test("M-H19 the peers table keeps its figures on a phone's screen @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.goto("/stock/TCS");
  await page.getByRole("navigation", { name: "Parts of this page" }).getByRole("button", { name: "Peers" }).click();
  const table = page.locator(".peers-table");
  await expect(table).toBeVisible();
  expect((await table.locator("thead th").allTextContents()).slice(0, 4)).toEqual(["Company", "Mkt Cap", "P/E", "ROCE"]);
  const figuresOnScreen = () => page.evaluate(() => [...document.querySelectorAll(".peers-table tbody tr")].every(tr => {
    const name = tr.children[0].getBoundingClientRect(), first = tr.children[1].getBoundingClientRect();
    return name.width <= window.innerWidth * 0.5 && first.right <= window.innerWidth;
  }));
  expect(await figuresOnScreen()).toBe(true);
  await expect(table.locator(".peers-this")).toHaveCount(1);
  const all = page.getByRole("button", { name: /^Show all/ });
  if (await all.count()) {
    await all.click();
    expect(await figuresOnScreen(), "after Show all too").toBe(true);
  }
});

// 21 Oct 2026: "how will people know they need the scorecard or valuation
// or the others?" — the Overview says which tab answers which question, in
// plain words, and each row opens its tab. The Next cards ask the same.
test("M-H15 the Overview says what each tab answers @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone layout");
  await page.goto("/stock/TCS");
  const guide = page.getByRole("region", { name: "Go deeper" });
  await expect(guide).toBeVisible();
  // 22 Oct 2026: "this should be at the bottom" — after the company's own
  // overview (the chart, At a glance, its numbers, what changed), not before
  const below = async sel => page.evaluate(([a, b]) => document.querySelector(a).getBoundingClientRect().top > document.querySelector(b).getBoundingClientRect().bottom, [".sd-guide", sel]);
  for (const part of ["#sec-overview", "#sec-about"]) expect(await below(part), `Go deeper comes after ${part}`).toBe(true);
  for (const [question, tab] of [["Is it a good business?", "Scorecard"], ["Is the price fair for what it earns?", "Valuation"], ["What has it told NSE lately?", "News & filings"]]) {
    await expect(guide.getByRole("button", { name: `${question} ${tab}` })).toBeVisible();
  }
  await expect(guide.getByRole("button", { name: /Overview$/ })).toHaveCount(0);
  await guide.getByRole("button", { name: "Is the price fair for what it earns? Valuation" }).click();
  const tabs = page.getByRole("navigation", { name: "Parts of this page" });
  await expect(tabs.getByRole("button", { name: "Valuation" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator("#sec-valuation")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Next: Financials. Is it growing, and can it carry its debt?" })).toBeAttached();
});

// 21 Oct 2026: "glass movement when I click on another" — one glass lens
// under the tabs slides from the current tab to the one tapped (it starts on
// the press), instead of each tab lighting up on its own.
test("M-H16 the tab bar's glass slides to the tab tapped @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone's tab bar");
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Pages" });
  const glass = bar.locator(".btb-lens");
  const centre = async loc => { const b = await loc.boundingBox(); return b.x + b.width / 2; };
  await expect(glass).toBeVisible();
  await expect.poll(async () => Math.abs(await centre(glass) - await centre(bar.getByRole("button", { name: "Discover" })))).toBeLessThan(3);
  const watchlist = bar.getByRole("button", { name: "Watchlist" });
  await watchlist.click();
  await expect(watchlist).toHaveAttribute("aria-current", "page");
  await expect.poll(async () => Math.abs(await centre(glass) - await centre(watchlist))).toBeLessThan(3);
  expect(await glass.getAttribute("aria-hidden")).toBe("true");
});

// 21 Oct 2026, on an iPhone: the header's logo was blurry (Safari draws an
// SVG's lighting effects at low resolution and stretches them) and a dark
// tile in the light theme. It's a sharp picture now, drawn at several times
// its size, and the light theme has a light one.
test("M-H17 the header logo is sharp, with a light one for the light theme @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone's header");
  await page.goto("/");
  const shown = () => page.locator(".brand-mark img").filter({ visible: true }).first();
  await expect(shown()).toBeVisible();
  const check = async name => {
    const img = shown();
    await expect(img).toHaveAttribute("src", new RegExp(`jocular-insights-${name}\\.png$`));
    const { natural, drawn } = await img.evaluate(el => ({ natural: el.naturalWidth, drawn: el.getBoundingClientRect().width }));
    expect(natural, "drawn from a picture at least 3× its size").toBeGreaterThanOrEqual(drawn * 3);
  };
  // and big enough to read on a phone: in the search since 26 Oct 2026, as
  // Reddit's is, a 30 px circle
  expect((await shown().boundingBox()).width, "the header's logo on a phone").toBeGreaterThanOrEqual(30);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await check("dark");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await check("light");
});

// 21 Oct 2026: "when we change in between it gives a small vibration" — a
// light tick when the tab changes (Chrome on Android: vibrate()); none for a
// tap on the tab already open
test("M-H18 switching tabs gives a small tick @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone's tab bar");
  await page.addInitScript(() => { window.__ticks = []; navigator.vibrate = ms => { window.__ticks.push(ms); return true; }; });
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Pages" });
  await bar.getByRole("button", { name: "Discover" }).click();
  expect(await page.evaluate(() => window.__ticks.length), "the tab already open").toBe(0);
  await bar.getByRole("button", { name: "Watchlist" }).click();
  await expect(bar.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-current", "page");
  const ticks = await page.evaluate(() => window.__ticks);
  expect(ticks).toHaveLength(1);
  expect(ticks[0]).toBeLessThanOrEqual(15);
});

// 23 Oct 2026, from another app: "when I press and move" — the tab bar's glass
// can be held and slid; letting go opens the tab under it
test("M-H21 the tab bar's glass slides under a finger and opens the tab it's let go on @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "the phone's tab bar");
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Pages" });
  await expect(bar.getByRole("button", { name: "Discover" })).toHaveAttribute("aria-current", "page");
  const box = await bar.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  for (let x = box.x + 40; x <= box.x + box.width * 0.55; x += 12) await page.mouse.move(x, y);
  // held, the lens is a clear drop (liquidLens.js, 26 Oct 2026); let go, the capsule again
  const clear = () => page.locator(".btb-lens-glass").evaluate(e => Number(getComputedStyle(e).opacity));
  await expect.poll(clear).toBeGreaterThan(0.9);
  await expect(bar.locator(".btb-tab.lit")).toHaveText(/Explore/);
  await page.mouse.up();
  await expect(bar.getByRole("button", { name: "Explore" })).toHaveAttribute("aria-current", "page");
  await expect.poll(clear).toBeLessThan(0.05);
  // a tap still opens its tab
  await bar.getByRole("button", { name: "Watchlist" }).click();
  await expect(bar.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-current", "page");
});

// 23 Oct 2026: "the cards' movement is not smooth" — cards that swipe scroll
// natively (momentum, snapping); since 26 Oct 2026 they're the favourites
test("M-H22 the favourite screeners swipe natively and snap @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "a phone's rail");
  await page.goto("/");
  await page.getByRole("button", { name: "Add High Quality Compounders to favourites" }).click();
  // the next from All screeners: with a favourite, Screeners' own list has no stars
  await page.getByRole("button", { name: "See all" }).click();
  await page.getByRole("button", { name: "Add Dividend Aristocrats to favourites" }).click();
  await page.goBack();
  const rail = page.getByRole("group", { name: "Your favourite screeners" });
  await expect(rail.getByRole("button")).toHaveCount(2);
  expect(await rail.evaluate(r => getComputedStyle(r).scrollSnapType)).toMatch(/x mandatory/);
  await rail.evaluate(r => r.scrollBy({ left: 200 }));
  await expect.poll(() => rail.evaluate(r => r.scrollLeft)).toBeGreaterThan(0);
});
