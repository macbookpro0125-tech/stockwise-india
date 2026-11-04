// Screen builder has its own address on a computer (4 Nov 2026): a reload or
// a link opens it again, and leaving it takes the address back to "/"
import { test, expect, openStocks, openPage } from "./fixtures.js";

test("B-1 Screen builder is at /builder: a reload stays, another page goes back to /", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "a phone keeps both steps on /");
  await page.goto("/");
  await openStocks(page);
  await expect(page).toHaveURL(/\/builder$/);
  const rail = page.locator("nav.side-rail");

  // a reload stays in the builder
  await page.reload();
  await page.locator(".app-header").first().waitFor();
  await expect(page.locator(".screen-count b").first()).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveURL(/\/builder$/);

  // another page: the address is "/" again, and a reload doesn't bring the builder back
  await openPage(page, "Explore");
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await page.locator(".app-header").first().waitFor();
  await expect(rail.getByRole("button", { name: /^Screen builder/ })).not.toHaveAttribute("aria-current", "page");

  // the browser's Back from the builder returns to the screeners at "/"
  await page.goto("/");
  await openStocks(page);
  await expect(page).toHaveURL(/\/builder$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  // and /builder typed or shared opens it
  await page.goto("/builder");
  await expect(page.locator(".screen-count b").first()).toBeVisible({ timeout: 45_000 });
});
