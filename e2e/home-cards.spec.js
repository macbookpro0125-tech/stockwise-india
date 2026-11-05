// 5 Nov 2026, "when I click on those cards it's not working": the home's
// Market summary opens what each card shows
import { test, expect } from "./fixtures.js";

test("H-1 the home's cards open their pages: an index, the Nifty 500, the results calendar", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "a computer's home");
  await page.goto("/");
  const indices = page.getByRole("region", { name: "The market" });
  const first = indices.getByRole("button").filter({ hasText: /NIFTY|Nifty/ }).first();
  await expect(first).toBeVisible({ timeout: 45_000 });
  const name = (await first.locator(".td-name").textContent()).trim();
  await first.click();
  await expect(page.getByRole("heading", { name: new RegExp(name.replace(/ /g, "\\s*"), "i") }).first()).toBeVisible({ timeout: 20_000 });

  await page.goto("/");
  const nifty = page.getByRole("link", { name: "Nifty 500" });
  if (await nifty.count()) {
    await nifty.click();
    await expect(page.getByRole("heading", { name: /Nifty 500/i }).first()).toBeVisible({ timeout: 20_000 });
  }

  await page.goto("/");
  const results = page.getByRole("region", { name: "Results coming" }).getByRole("button").first();
  if (await results.count()) {
    await results.click();
    await expect(page).toHaveURL(/results-calendar/);
  }
});
