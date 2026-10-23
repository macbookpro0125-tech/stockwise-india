// The Explore page (23 Oct 2026): the indices at their last close, each
// opening in full, and the news under them.
import { test, expect, openPage } from "./fixtures.js";

test("X-H1 the indices: cards with the day's change; one opens with its year, returns and valuation; Back returns @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Explore");
  const market = page.getByRole("region", { name: "Market" });
  const nifty = market.getByRole("button", { name: /^NIFTY 50: [\d,]+\.\d\d, (up|down) [\d.]+% on / });
  await expect(nifty).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("region", { name: "Sectors" }).getByRole("button", { name: /^IT: / })).toBeVisible();
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

test("X-H2 a sector opens with its companies' biggest moves", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Explore");
  const it = page.getByRole("region", { name: "Sectors" }).getByRole("button", { name: /^IT: / });
  await expect(it).toBeVisible({ timeout: 45_000 });
  await it.click();
  const index = page.getByRole("article", { name: "IT" });
  await expect(index.getByRole("region", { name: "Biggest moves" })).toContainText("Information Technology companies");
  await index.getByRole("button", { name: /Explore/ }).click();
  await expect(it).toBeVisible();
});

test("X-H3 the heat map: an index's companies by size and move; another index, period and the sectors; a box opens its company @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Explore");
  const heat = page.getByRole("region", { name: "Heat map" });
  const tiles = heat.locator(".ex-tile");
  await expect(tiles.first()).toBeVisible({ timeout: 45_000 });
  expect(await tiles.count()).toBeGreaterThan(40);
  await expect(heat).toContainText(/Size: market value/);
  // the largest company's box is the biggest
  const areas = await tiles.evaluateAll(els => els.map(e => e.offsetWidth * e.offsetHeight));
  expect(areas[0]).toBe(Math.max(...areas));
  // nothing spills out of the map
  const spill = await heat.locator(".ex-heat").evaluate(box => [...box.children].filter(c => c.classList.contains("ex-tile")).some(t => t.offsetLeft + t.offsetWidth > box.clientWidth + 1 || t.offsetTop + t.offsetHeight > box.clientHeight + 1));
  expect(spill).toBe(false);
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "Bank Nifty" }).click();
  await expect.poll(() => tiles.count()).toBeLessThan(20);
  await heat.getByRole("group", { name: "Over" }).getByRole("button", { name: "1W" }).click();
  await expect(heat).toContainText("over the week");
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "Sectors" }).click();
  await expect(heat).toContainText("Each sector's index");
  await heat.getByRole("group", { name: "Which companies" }).getByRole("button", { name: "NIFTY 50" }).click();
  await tiles.first().click();
  await expect(page).toHaveURL(/\/stock\//);
});

// 23 Oct 2026: "when I click a stock in the heat map and press Back, it goes
// to the main page, not back to the heat map"
test("X-H4 Back from a company opened in the heat map returns to the heat map as it was @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Explore");
  const heat = page.getByRole("region", { name: "Heat map" });
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
  await openPage(page, "Explore");
  const heat = page.getByRole("region", { name: "Heat map" });
  await expect(heat.locator(".ex-tile").first()).toBeVisible({ timeout: 45_000 });
  await heat.locator(".ex-tile").first().click();
  const back = page.getByRole("button", { name: /^Back to Explore/ }).first();
  await expect(back).toBeVisible();
  const box = await back.boundingBox();
  expect(box.height, "a button, not a line of text").toBeGreaterThanOrEqual(40);
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/\/stock\//);
  await expect(heat).toBeInViewport();
});

test("X-H6 top movers by day, week or month, and the week's results by day @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Explore");
  const movers = page.getByRole("region", { name: "Top movers" });
  const rows = movers.locator(".ex-movers-list li");
  await expect(rows.first()).toBeVisible({ timeout: 45_000 });
  const changes = async () => (await movers.locator(".ex-pill").allTextContents()).map(t => Number(t.replace("−", "-").replace(/[+%]/g, "")));
  const up = await changes();
  expect(up.every(v => v > 0) && up.every((v, i) => i === 0 || v <= up[i - 1]), "gainers, largest first").toBe(true);
  await movers.getByRole("button", { name: "Losers" }).click();
  await expect.poll(async () => (await changes()).every(v => v < 0)).toBe(true);
  await movers.getByRole("button", { name: "1W" }).click();
  await expect(movers).toContainText("over the week");
  await rows.first().getByRole("button").click();
  await expect(page).toHaveURL(/\/stock\//);
  await page.goBack();
  const results = page.getByRole("region", { name: "Results this week" });
  await expect(results.or(page.getByText("never shown")).first()).toBeAttached();
  if (await results.count()) await expect(results.locator(".ex-day").first()).toContainText(/compan/);
});
