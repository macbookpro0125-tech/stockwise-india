// The Screen builder's desk (31 Oct 2026): the screen's companies, the one
// picked charted beside its business and price, moved with a click or ↑/↓
import { test, expect, openStocks } from "./fixtures.js";

test("D-1 the desk shows the screen's companies; a click and the arrow keys move the chart and the company together", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the desk is a computer's");
  await page.goto("/");
  await openStocks(page);
  await page.getByRole("group", { name: "Show the screen as" }).getByRole("button", { name: "Desk" }).click();
  const list = page.getByRole("listbox", { name: /^Companies/ });
  await expect(list.getByRole("option").first()).toBeVisible({ timeout: 45_000 });
  const first = await list.getByRole("option").first().locator("b").textContent();
  await expect(page.locator(".desk-title span")).toContainText(first);

  await list.getByRole("option").nth(2).click();
  const third = await list.getByRole("option").nth(2).locator("b").textContent();
  await expect(page.locator(".desk-title span")).toContainText(third);
  await list.press("ArrowDown");
  const fourth = await list.getByRole("option").nth(3).locator("b").textContent();
  await expect(page.locator(".desk-title span")).toContainText(fourth);
  await expect(list.getByRole("option").nth(3)).toHaveAttribute("aria-selected", "true");

  // the side's tabs, and a quick view narrows the list
  await page.getByRole("tab", { name: "Price" }).click();
  await expect(page.getByText("Against 200-day average")).toBeVisible();
  await page.getByRole("tab", { name: "Business" }).click();
  await expect(page.getByText("Against fair value").last()).toBeVisible();
  const views = page.getByRole("group", { name: "Quick views" });
  const all = Number((await views.getByRole("button", { name: /^All/ }).locator("span").textContent()).replace(/,/g, ""));
  const value = views.getByRole("button", { name: /^Below fair value/ });
  const n = Number((await value.locator("span").textContent()).replace(/,/g, ""));
  if (n > 0) {
    await value.click();
    await expect(list.getByRole("option")).toHaveCount(n);
    expect(n).toBeLessThanOrEqual(all);
  }
  if (process.env.DESK_SHOT) { await views.getByRole("button", { name: /^All/ }).click(); await page.evaluate(() => window.scrollTo(0, document.querySelector(".desk-switch").getBoundingClientRect().top + window.scrollY - 70)); await page.waitForTimeout(1500); await page.screenshot({ path: process.env.DESK_SHOT }); }

  // and back to the table, remembered
  await page.getByRole("group", { name: "Show the screen as" }).getByRole("button", { name: "Table" }).click();
  await expect(list).toHaveCount(0);
});
