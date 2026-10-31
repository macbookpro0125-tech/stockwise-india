// The Desk, a page of its own (31 Oct 2026): a list, the company picked
// charted beside its business and price, moved with a click or ↑/↓
import { test, expect, openPage } from "./fixtures.js";

test("D-1 the Desk walks a ready-made screen; a click and the arrow keys move the chart and the company together", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the desk is a computer's");
  await page.goto("/");
  await openPage(page, "Desk");
  await page.getByRole("combobox", { name: "List" }).selectOption({ label: "High Quality Compounders" });
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
  if (process.env.DESK_SHOT) { await views.getByRole("button", { name: /^All/ }).click(); await page.waitForTimeout(1500); await page.screenshot({ path: process.env.DESK_SHOT }); }

});
