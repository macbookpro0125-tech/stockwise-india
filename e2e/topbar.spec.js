// A computer's top bar (TopBar.jsx, 5 Nov 2026): the pages in a tray, the
// current one lit; the rest in the account menu; a backing once the page
// scrolls; no bar down the left
// except on a company's page, for its chapters
import { test, expect } from "./fixtures.js";

const shots = process.env.SHOTS;

test("TB-1 the top bar: pages in the tray, the rest under the account, a backing once scrolled, a search button on a narrow window", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "a phone has its own bars");
  await page.goto("/");
  const bar = page.locator(".tb");
  const tray = bar.getByRole("navigation", { name: "Pages" });
  await expect(tray.getByRole("button", { name: "Screeners" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("nav.side-rail")).toHaveCount(0);
  if (shots) await page.screenshot({ path: `${shots}/tb-top.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } });
  // everything fits, from a small laptop to a wide screen
  for (const width of [900, 1100, 1280, 1440, 1680]) {
    await page.setViewportSize({ width, height: 860 });
    expect(await bar.evaluate(b => b.scrollWidth - b.clientWidth), `nothing cut off at ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Account", exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1280, height: 860 });
  await tray.getByRole("button", { name: "Markets" }).click();
  await expect(tray.getByRole("button", { name: "Markets" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".mk").first()).toBeVisible();
  // the account menu has the pages that aren't in the tray
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Performance" }).click();
  await expect(tray.locator("[aria-current=page]")).toHaveCount(0);
  // the bell opens Alerts
  await bar.getByRole("button", { name: /^Alerts/ }).click();
  await expect(bar.getByRole("button", { name: /^Alerts/ })).toHaveClass(/on/);
  // straight on the page at the top; a quiet backing once the page scrolls under it
  await tray.getByRole("button", { name: "Screeners" }).click();
  await expect(bar).not.toHaveClass(/tb-scrolled/);
  await page.mouse.move(640, 600);
  await page.mouse.wheel(0, 1600);
  await expect(bar).toHaveClass(/tb-scrolled/);
  if (shots) await page.screenshot({ path: `${shots}/tb-scrolled.png`, clip: { x: 0, y: 0, width: 1280, height: 120 } });
  // a narrow window: the search is a button that opens the field, focused
  await page.setViewportSize({ width: 1000, height: 860 });
  await bar.getByRole("button", { name: "Search stocks" }).click();
  await expect(page.locator(".tb-search input")).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 860 });
  // a company's page keeps its chapters down the left
  await page.goto("/stock/TCS");
  await expect(page.getByRole("navigation", { name: "Parts of this page" })).toBeVisible();
});
