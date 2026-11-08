// The Explore page (23 Oct 2026): the indices at their last close, each
// opening in full, and the news under them. Since 6 Nov 2026 a computer's
// Explore is the news alone ("News" in the top bar; the market is on Markets);
// a phone keeps the market's indices, the map and the way to Markets above it.
import { test, expect, openPage, openStocks, openChapter } from "./fixtures.js";

test("X-H1 the indices: cards with the day's change; one opens with its year, returns and valuation; Back returns @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "a computer's indices are on Markets (6 Nov 2026)");
  await page.goto("/");
  await openPage(page, "Explore");
  const market = page.getByRole("region", { name: "Market", exact: true });
  const nifty = market.getByRole("button", { name: /^NIFTY 50: [\d,]+\.\d\d, (up|down) [\d.]+% on / });
  await expect(nifty).toBeVisible({ timeout: 45_000 });
  // the news is below them
  await expect(page.getByRole("group", { name: "Kinds of news" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await nifty.click();
  const index = page.getByRole("article", { name: "NIFTY 50" });
  await expect(index.getByRole("heading", { name: "NIFTY 50" })).toBeVisible();
  await expect(index.getByRole("region", { name: "Returns" })).toContainText("1 year");
  await expect(index.getByRole("region", { name: "Valuation" })).toContainText("P/E");
  await index.getByRole("button", { name: "6M" }).click();
  await expect(index.getByRole("button", { name: "6M" })).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(index).toHaveCount(0);
  await expect(nifty).toBeVisible();
});

test("X-H2 a sector opens with its companies' biggest moves; a computer's News page has no market board", async ({ page, account }) => {
  await page.goto("/");
  // a computer: the news alone, under the top bar's News
  await openPage(page, "Explore");
  await expect(page.getByRole("heading", { name: "News", level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Market", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Top movers" })).toHaveCount(0);
  // a sector from the price strip opens in full
  const strip = page.getByRole("region", { name: /^Closing prices/ });
  const itBtn = strip.getByRole("button", { name: /^NIFTY IT/ }).first();
  await expect(itBtn).toBeAttached({ timeout: 30_000 });
  await itBtn.dispatchEvent("click");
  const index = page.getByRole("article", { name: "IT" });
  await expect(index.getByRole("region", { name: "Biggest moves" })).toContainText("Information Technology companies", { timeout: 45_000 });
  await index.getByRole("button", { name: "Back" }).click();
  await expect(index).toHaveCount(0);
});

test("X-H3 the heat map: an index's companies by size and move; another index, period and the sectors; a box opens its company @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Market map");
  const heat = page.getByRole("region", { name: "Market map" });
  const tiles = heat.locator(".ex-tile");
  await expect(tiles.first()).toBeVisible({ timeout: 45_000 });
  expect(await tiles.count()).toBeGreaterThan(40);
  await expect(heat).toContainText(/Size: market value/);
  // the largest company's box (first, in the largest sector) is bigger than the smallest's
  const areas = await tiles.evaluateAll(els => els.map(e => e.offsetWidth * e.offsetHeight));
  expect(areas[0]).toBeGreaterThan(Math.min(...areas));
  // nothing spills out of the map
  const spill = await heat.locator(".ex-heat").evaluate(box => [...box.children].filter(c => c.classList.contains("ex-tile")).some(t => t.offsetLeft + t.offsetWidth > box.clientWidth + 1 || t.offsetTop + t.offsetHeight > box.clientHeight + 1));
  expect(spill).toBe(false);
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "Bank Nifty" }).click();
  await expect.poll(() => tiles.count()).toBeLessThan(20);
  await heat.getByRole("group", { name: "Over" }).getByRole("button", { name: "1W" }).click();
  await expect(heat).toContainText("over the week");
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "Sectors" }).click();
  await expect(heat).toContainText("Each sector's index");
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "Nifty 50", exact: true }).click();
  await tiles.first().click();
  await expect(page).toHaveURL(/\/stock\//);
});

// 31 Oct 2026, "have you seen Finviz's maps": sectors in blocks, the whole
// market, equal boxes, a sector on its own, the whole screen
test("X-H6 the heat map groups by sector; All NSE, equal boxes, one sector, and full screen @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Market map");
  const heat = page.getByRole("region", { name: "Market map" });
  const tiles = heat.locator(".ex-tile");
  await expect(tiles.first()).toBeVisible({ timeout: 45_000 });
  await expect(heat.locator(".ex-heat-head").first()).toBeVisible();
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "All NSE" }).click();
  await expect.poll(() => tiles.count(), { timeout: 20_000 }).toBeGreaterThan(500);
  await expect(heat).toContainText(/companies over ₹500 cr/);
  // a sector's heading opens it on its own; Back to all sectors
  const first = heat.locator(".ex-heat-head").first();
  const sector = (await first.locator(".ex-heat-head-name").textContent()).trim();
  await first.click();
  // the sector is a filter now, under the Filters button (8 Nov 2026)
  await expect(heat.getByRole("button", { name: /^Filters/ })).toContainText("1");
  await heat.getByRole("button", { name: /^Filters/ }).click();
  await expect(heat.getByRole("combobox", { name: "Sector" })).toHaveValue(sector);
  await heat.getByRole("button", { name: /^Filters/ }).click();
  const few = await tiles.count();
  expect(few).toBeLessThan(500);
  await heat.getByRole("button", { name: "All sectors" }).click();
  await expect.poll(() => tiles.count()).toBeGreaterThan(few);
  // equal boxes: all about the same size within a block
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "Nifty 50", exact: true }).click();
  await heat.getByRole("group", { name: "Box size" }).getByRole("button", { name: "Equal" }).click();
  await expect(heat).toContainText("Size: all the same");
  // a longer period
  await heat.getByRole("group", { name: "Over" }).getByRole("button", { name: "1Y" }).click();
  await expect(heat).toContainText("over the year");
  // the whole screen, and Esc back
  await page.getByRole("button", { name: "Full screen" }).click();
  await expect(page.locator(".ex-heat-fullscreen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave full screen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".ex-heat-fullscreen")).toHaveCount(0);
});

// 31 Oct 2026: "I want this map in a separate page, not in Explore"
test("X-H9 the map is a page of its own; Explore's card opens it @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "a computer has Map in its top bar");
  await page.goto("/");
  await openPage(page, "Explore");
  await expect(page.locator(".ex-tile")).toHaveCount(0);
  await page.locator(".ex-map-link:not(.ex-markets-link)").click();
  const map = page.getByRole("region", { name: "Market map" });
  await expect(map.locator(".ex-tile").first()).toBeVisible({ timeout: 45_000 });
});

// 31 Oct 2026: colour by more than the move; how many rose and fell; your
// own watchlist and portfolio as maps
test("X-H10 the map: colour by, rises and falls, my watchlist and my portfolio @phone", async ({ page, account, baseURL }) => {
  const req = page.context().request;
  for (const t of ["TCS", "INFY", "SBIN"]) expect((await req.post(`${baseURL}/api/watchlist`, { data: { ticker: t } })).ok()).toBeTruthy();
  expect((await req.post(`${baseURL}/api/portfolio`, { data: { ticker: "TCS", qty: 10, buyPrice: 2000 } })).ok()).toBeTruthy();
  expect((await req.post(`${baseURL}/api/portfolio`, { data: { ticker: "SBIN", qty: 100, buyPrice: 900 } })).ok()).toBeTruthy();
  await page.goto("/");
  await openPage(page, "Market map");
  const map = page.getByRole("region", { name: "Market map" });
  const tiles = map.locator(".ex-tile");
  await expect(tiles.first()).toBeVisible({ timeout: 45_000 });
  // how many rose and fell, adding up to the companies shown
  const strip = await map.locator(".mm-breadth").getAttribute("aria-label");
  const [, up, down, flat] = strip.match(/(\d+) rose, (\d+) fell, (\d+) unchanged/).map(Number);
  expect(up + down + flat).toBe(await tiles.count());
  // coloured by the distance from the 52-week high: the boxes say it
  await map.getByRole("combobox", { name: "Colour by" }).selectOption("high");
  await expect(map).toContainText("how far below its 52-week high");
  await expect(tiles.first().locator(".ex-tile-chg")).toHaveText(/^(−\d+%|At high)$/);
  // the watchlist: its three companies
  await map.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "My watchlist" }).click();
  await expect.poll(() => tiles.count()).toBe(3);
  // the portfolio: its two, and the gain on what was paid to colour by
  await map.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "My portfolio" }).click();
  await expect.poll(() => tiles.count()).toBe(2);
  await expect(map).toContainText("what your holding is worth");
  await map.getByRole("combobox", { name: "Colour by" }).selectOption("gain");
  await expect(map).toContainText("your gain or loss on what you paid");
});

// 31 Oct 2026: find a company, F&O / PSU / theme filters, results-week marks
test("X-H11 the map: find a company, filter to F&O or a theme, and results marks @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Market map");
  const map = page.getByRole("region", { name: "Market map" });
  const tiles = map.locator(".ex-tile");
  await map.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "All NSE" }).click();
  await expect.poll(() => tiles.count(), { timeout: 45_000 }).toBeGreaterThan(500);
  const all = await tiles.count();
  // find: the match lit, the rest dimmed; Esc clears it
  const find = map.getByRole("searchbox", { name: "Find a company on the map" });
  // the symbol, and the companies whose names have it (Reliance Power and the rest)
  await find.fill("RELIANCE");
  await expect(map.locator(".ex-tile.hit").filter({ has: page.locator(".ex-tile-name", { hasText: /^RELI/ }) }).first()).toBeVisible();
  await expect(map.locator(".ex-heat.finding")).toHaveCount(1);
  await expect(map).toContainText(/is lit|companies match/);
  await find.press("Escape");
  await expect(map.locator(".ex-tile.hit")).toHaveCount(0);
  await find.fill("zzzz");
  await expect(map).toContainText("Nothing here matches");
  await find.fill("");
  // F&O only: fewer boxes; a theme: fewer still
  await map.getByRole("button", { name: /^Filters/ }).click();
  const show = map.getByRole("combobox", { name: "Show" });
  await show.selectOption("fno");
  await expect.poll(() => tiles.count()).toBeLessThan(all);
  await show.selectOption({ label: "Defence" });
  await expect.poll(() => tiles.count()).toBeLessThan(60);
  await show.selectOption("");
  await expect.poll(() => tiles.count()).toBe(all);
});

// 31 Oct 2026: a screen's companies as a map, from the Workspace
test("X-H12 the Workspace's Show as map draws the screen's companies on the market map", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the Workspace is a computer's");
  await page.goto("/");
  await openStocks(page);
  const count = page.locator(".screen-count b");
  await expect(count).toBeVisible({ timeout: 45_000 });
  const matched = Number((await count.textContent()).replace(/,/g, ""));
  await page.getByRole("button", { name: "Show as map" }).click();
  const map = page.getByRole("region", { name: "Market map" });
  await expect(map.getByRole("button", { name: /^Screen: / })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => map.locator(".ex-tile").count(), { timeout: 45_000 }).toBeGreaterThan(0);
  expect(await map.locator(".ex-tile").count()).toBeLessThanOrEqual(Math.min(matched, 600));
});

// 31 Oct 2026: "it should be a real zoom: details not shown should show when I zoom in"
test("X-H13 zooming the map in names more boxes; Fit shows the whole map again @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Market map");
  const map = page.getByRole("region", { name: "Market map" });
  await map.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "All NSE" }).click();
  await expect.poll(() => map.locator(".ex-tile").count(), { timeout: 45_000 }).toBeGreaterThan(500);
  const zoom = map.getByRole("group", { name: "Zoom" });
  await expect(zoom.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  // the share of drawn boxes with a name: more of them once zoomed in
  const named = () => map.locator(".ex-heat").evaluate(b => b.querySelectorAll(".ex-tile .ex-tile-name").length / Math.max(1, b.querySelectorAll(".ex-tile").length));
  const before = await named();
  for (let i = 0; i < 3; i++) await zoom.getByRole("button", { name: "Zoom in" }).click();
  await expect(zoom).toContainText("4.1×");
  expect(await named()).toBeGreaterThan(before);
  await zoom.getByRole("button", { name: "Fit the whole map" }).click();
  await expect(zoom).toContainText("1×");
});

// 31 Oct 2026: a sector opened on the map has its brief under it
test("X-H14 a sector opened on the map: its rises and falls, its P/E by year, results due @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Market map");
  const map = page.getByRole("region", { name: "Market map" });
  await map.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "All NSE" }).click();
  await expect.poll(() => map.locator(".ex-tile").count(), { timeout: 45_000 }).toBeGreaterThan(500);
  await map.getByRole("button", { name: /^Filters/ }).click();
  await map.getByRole("combobox", { name: "Sector" }).selectOption("Information Technology");
  const brief = page.getByRole("region", { name: "Information Technology in brief" });
  await expect(brief).toContainText(/\d+ companies, worth ₹/);
  await expect(brief.getByRole("heading", { name: "Rose most over the day" })).toBeVisible();
  await expect(brief.getByRole("img", { name: /^Middle P\/E: / })).toBeVisible();
  await brief.locator(".mm-brief-co").first().click();
  await expect(page).toHaveURL(/\/stock\//);
});

// 31 Oct 2026: a company page's map of its industry, and the way to the market map
test("X-H15 a company page maps its industry, outlines the company, and opens the market map at it", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the computer's chapters");
  await page.goto("/stock/TCS");
  await openChapter(page, "Price");
  const ask = page.getByText("Did it move alone, or with its industry?").first();
  if (!(await page.locator(".im").count())) await ask.click();
  const im = page.getByRole("region", { name: /^Its (industry|sector): / });
  await expect(im.locator(".ex-tile.im-me")).toHaveCount(1, { timeout: 45_000 });
  await expect(im).toContainText(/rose and .* fell of \d+/);
  await im.getByRole("button", { name: "See it on the market map ›" }).click();
  const map = page.getByRole("region", { name: "Market map" });
  await expect(map.getByRole("searchbox", { name: "Find a company on the map" })).toHaveValue("TCS");
  await expect(map.locator(".ex-tile.hit").first()).toBeVisible({ timeout: 45_000 });
});

// 23 Oct 2026: "when I click a stock in the heat map and press Back, it goes
// to the main page, not back to the heat map"
test("X-H4 Back from a company opened in the heat map returns to the heat map as it was @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Market map");
  const heat = page.getByRole("region", { name: "Market map" });
  await expect(heat.locator(".ex-tile").first()).toBeVisible({ timeout: 45_000 });
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "Bank Nifty" }).click();
  await heat.getByRole("group", { name: "Over" }).getByRole("button", { name: "1W" }).click();
  await expect(heat).toContainText("over the week");
  for (const how of ["the page's Back", "the browser's Back"]) {
    const tile = heat.locator(".ex-tile").first();
    await tile.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await tile.click();
    await expect(page).toHaveURL(/\/stock\//);
    if (how === "the page's Back") await page.getByRole("button", { name: /^Back/ }).first().click();
    else await page.goBack();
    await expect(page).not.toHaveURL(/\/stock\//);
    await expect(heat, how).toBeInViewport();
    await expect(heat.getByRole("button", { name: "Bank Nifty" }), how).toHaveAttribute("aria-pressed", "true");
    await expect(heat.getByRole("button", { name: "1W" }), how).toHaveAttribute("aria-pressed", "true");
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - before), how).toBeLessThan(40);
  }
});

// 23 Oct 2026: "the back button is hard to find on the desktop"
test("X-H5 a computer's company page names where Back goes, and Esc goes back", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "a computer's Back");
  await page.goto("/");
  await openPage(page, "Market map");
  const heat = page.getByRole("region", { name: "Market map" });
  await expect(heat.locator(".ex-tile").first()).toBeVisible({ timeout: 45_000 });
  await heat.locator(".ex-tile").first().click();
  const back = page.getByRole("button", { name: /^Back to Market map/ }).first();
  await expect(back).toBeVisible();
  const box = await back.boundingBox();
  expect(box.height, "a button, not a line of text").toBeGreaterThanOrEqual(40);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/\/stock\//);
  await expect(heat).toBeInViewport();
});

test("X-H6 the biggest moves and the week's results are on Markets; a phone's Explore leads there @phone", async ({ page, account, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await openPage(page, "Explore");
    await page.getByRole("button", { name: /^Markets/ }).click();
  } else await openPage(page, "Markets");
  await expect(page.getByRole("heading", { name: "Markets", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Biggest moves" })).toBeVisible({ timeout: 45_000 });
});

// 23 Oct 2026: "when I press on NIFTY 50 or another Nifty, it should open that"
test("X-H7 an index in the price strip opens it on Explore (a computer; a phone has no strip)", async ({ page, account }) => {
  await page.goto("/");
  const strip = page.getByRole("region", { name: /^Closing prices/ });
  const bank = strip.getByRole("button", { name: /^NIFTY Bank/ }).first();
  await expect(bank).toBeAttached({ timeout: 30_000 });
  await bank.dispatchEvent("click"); // the strip scrolls; the press itself is what's tested
  const index = page.getByRole("article", { name: "Bank Nifty" });
  await expect(index.getByRole("heading", { name: "NIFTY Bank" })).toBeVisible({ timeout: 45_000 });
  await expect(index.getByRole("region", { name: "Returns" })).toBeVisible();
});

test("X-H8 a phone shows the first few news, and See all opens the rest as a page; Back returns @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "a computer shows the news whole");
  await page.goto("/");
  await openPage(page, "Explore");
  await expect(page.locator(".ex-map-link").first()).toBeVisible();
  // the news: four, then all of it
  const news = page.locator(".nw-page");
  await expect(news.locator(".nw-row").first()).toBeVisible({ timeout: 45_000 });
  expect(await news.locator(".nw-row").count()).toBeLessThanOrEqual(4);
  await page.getByRole("button", { name: "See all the news" }).click();
  await expect(page.locator(".ex-full .nw-row").nth(4)).toBeVisible();
  await expect(page.locator(".ex-map-link").first()).toBeHidden();
  await page.locator(".ex-full").getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator(".ex-map-link").first()).toBeVisible();
});
