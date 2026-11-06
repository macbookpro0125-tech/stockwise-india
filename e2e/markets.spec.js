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
});
