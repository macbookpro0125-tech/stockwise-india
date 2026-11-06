// The Markets page (5 Nov 2026): the indices to pick from, the picked one
// charted, sectors, the market's trend, the biggest moves, the week's results
import { test, expect, openPage } from "./fixtures.js";

test("MK-1 Markets: pick an index and it's charted; the moves open a company", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "a computer's side bar; a phone opens it from Settings");
  await page.goto("/");
  await openPage(page, "Markets");
  await expect(page.getByRole("heading", { name: "Markets", level: 1 })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Pick an index" }).getByRole("tab");
  await expect(tabs.first()).toBeVisible({ timeout: 45_000 });
  const second = tabs.nth(1);
  const name = (await second.locator("b").textContent()).trim();
  await second.click();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".mk-index h3")).toHaveText(name, { timeout: 20_000 });
  await expect(page.getByRole("img", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} over 1Y`) })).toBeVisible();
  await page.getByRole("group", { name: "Range" }).getByRole("button", { name: "3M" }).click();
  await expect(page.getByRole("img", { name: / over 3M$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sectors today" })).toBeVisible();
  const gainer = page.locator(".mk-movers button").first();
  await expect(gainer).toBeVisible({ timeout: 30_000 });
  await gainer.click();
  await expect(page).toHaveURL(/\/stock\//);
});

test("MK-2 See all lists every index; a search narrows it, a click charts it, Back returns", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "a computer's side bar");
  await page.goto("/");
  await openPage(page, "Markets");
  await page.getByRole("button", { name: /^See all \d+/ }).first().click();
  await expect(page.getByRole("heading", { name: "All indices", level: 1 })).toBeVisible();
  const rows = page.locator(".mk-all button");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const total = await rows.count();
  expect(total).toBeGreaterThan(8);
  await page.getByRole("searchbox", { name: "Find an index" }).fill("bank");
  await expect.poll(() => rows.count()).toBeLessThan(total);
  const name = (await rows.first().locator("b").textContent()).trim();
  await rows.first().click();
  await expect(page.getByRole("heading", { name: "Markets", level: 1 })).toBeVisible();
  await expect(page.locator(".mk-index h3")).toHaveText(name, { timeout: 20_000 });
  // and the browser's Back from the list returns to Markets
  await page.getByRole("button", { name: /^See all \d+/ }).first().click();
  await expect(page.getByRole("heading", { name: "All indices", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Markets", level: 1 })).toBeVisible();
  // the days before: results already out, each company's new quarter
  const out = page.getByRole("button", { name: "Already out" });
  if (await out.count()) {
    await out.click();
    await expect(page.getByText(/filed their quarterly results with NSE that day/)).toBeVisible();
    await expect(page.locator(".mk-resday .mk-res-tag.new").first()).toBeVisible();
    // the day at a glance, and sorted by profit growth: largest growth first, none without a figure ahead of one
    await expect(page.getByLabel("The day at a glance")).toContainText(/grew profit/);
    await page.getByLabel("Sort by").selectOption("profit");
    const growth = await page.locator(".mk-resday > li:not(.mk-resday-head)").evaluateAll(rows => rows.map(r => { const t = r.querySelectorAll(".mk-resday-n")[1]?.querySelector("small")?.textContent; return t ? Number(t.replace("−", "-").replace(/[+%,]/g, "")) : null; }));
    const known = growth.filter(v => v != null);
    expect(known.every((v, i) => !i || v <= known[i - 1])).toBe(true);
    expect(growth.slice(0, known.length).every(v => v != null)).toBe(true);
    await page.goBack();
  }
});

// 6 Nov 2026: "when I press, I should see the details on the next page"
test("MK-3 a results day opens as a page: its companies' figures, other days, Back returns @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Markets");
  const more = page.getByRole("button", { name: /See the figures/ }).first();
  await expect(more).toBeVisible({ timeout: 45_000 });
  await more.click();
  await expect(page.getByRole("heading", { name: /^Results on \w+day, \d+ \w+$/, level: 1 })).toBeVisible();
  const rows = page.locator(".mk-resday > li:not(.mk-resday-head)");
  await expect(rows.first()).toBeVisible();
  await expect(rows.first()).toContainText(/₹/);
  // another day from the row of days
  const days = page.getByRole("group", { name: "Day" }).getByRole("button");
  if (await days.count() > 1) { await days.nth(1).click(); await expect(days.nth(1)).toHaveAttribute("aria-pressed", "true"); }
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Markets", level: 1 })).toBeVisible();
  // the days before: results already out, each company's new quarter
  const out = page.getByRole("button", { name: "Already out" });
  if (await out.count()) {
    await out.click();
    await expect(page.getByText(/filed their quarterly results with NSE that day/)).toBeVisible();
    await expect(page.locator(".mk-resday .mk-res-tag.new").first()).toBeVisible();
    // the day at a glance, and sorted by profit growth: largest growth first, none without a figure ahead of one
    await expect(page.getByLabel("The day at a glance")).toContainText(/grew profit/);
    await page.getByLabel("Sort by").selectOption("profit");
    const growth = await page.locator(".mk-resday > li:not(.mk-resday-head)").evaluateAll(rows => rows.map(r => { const t = r.querySelectorAll(".mk-resday-n")[1]?.querySelector("small")?.textContent; return t ? Number(t.replace("−", "-").replace(/[+%,]/g, "")) : null; }));
    const known = growth.filter(v => v != null);
    expect(known.every((v, i) => !i || v <= known[i - 1])).toBe(true);
    expect(growth.slice(0, known.length).every(v => v != null)).toBe(true);
    await page.goBack();
  }
});

// 6 Nov 2026: "how can I see all the watchlist's results — not only on a specific date, previous and future ones"
test("MK-4 the watchlist's results, past and coming, on one page @phone", async ({ page, account }) => {
  await page.goto("/");
  for (const t of ["TCS", "RELIANCE"]) await page.request.post("/api/watchlist", { data: { ticker: t } });
  await openPage(page, "Markets");
  await page.getByRole("button", { name: "My watchlist", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Your watchlist's results", level: 1 })).toBeVisible();
  const rows = page.locator(".mk-resday.mine > li:not(.mk-resday-head)");
  await expect(rows).toHaveCount(2, { timeout: 30_000 });
  await expect(page.locator(".mk-resday.mine").first()).toContainText(/TCS|RELIANCE/);
  await expect(page.getByRole("button", { name: /My watchlist: its results/ })).toHaveAttribute("aria-pressed", "true");
});

// 6 Nov 2026: the biggest moves as a page: every company, earlier days, day/week/month
test("MK-5 the biggest moves open as a page: an earlier day, a week, rose and fell @phone", async ({ page, account }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await openPage(page, "Markets");
  await page.getByRole("button", { name: /earlier days/ }).first().click();
  await expect(page.getByRole("heading", { name: /^Biggest moves on \w+day, \d+ \w+$/, level: 1 })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByLabel("The day at a glance")).toContainText(/\d+ rose · \d+ fell/);
  const days = page.getByRole("group", { name: "Trading day" }).getByRole("button");
  expect(await days.count()).toBeGreaterThan(3);
  const first = await days.first().getAttribute("aria-label");
  await days.first().click();
  await expect(page.locator(".mk-head h1")).toContainText(first.split(",")[1].trim());
  await page.getByRole("group", { name: "Over" }).getByRole("button", { name: "Week" }).click();
  await expect(page.getByRole("heading", { name: /^Biggest moves to /, level: 1 })).toBeVisible({ timeout: 30_000 });
  const gainers = page.locator(".mk-movers > div").first().locator(".mk-chg");
  await expect(gainers.first()).toHaveText(/^\+/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Markets", level: 1 })).toBeVisible();
});
