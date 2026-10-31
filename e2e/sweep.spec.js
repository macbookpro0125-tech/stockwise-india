// A sweep of every screen: each tab and one company page per valuation model
// loads without console errors or server failures, says what it should, and
// gets an accessibility scan (written to test-results/axe.txt, not failed on).
import { test, expect, axeCheck, openStocks, openPage, openChapter } from "./fixtures.js";
import { appendFileSync, mkdirSync } from "node:fs";

const axeLog = lines => { mkdirSync("test-results", { recursive: true }); if (lines.length) appendFileSync("test-results/axe.txt", lines.join("\n") + "\n"); };
const nav = page => page.getByRole("navigation").first();

test("every tab opens", async ({ page, account }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account" })).toBeVisible();
  // a computer's pages are in the bar down the left on every page (26 Oct
  // 2026), not the Account menu; the header has no tab row
  const rail = page.locator("nav.side-rail");
  await expect(rail).toBeVisible();
  await expect(page.locator(".discovery-tabs")).toBeHidden();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /^Watchlist/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await openStocks(page);
  await expect(page.locator("table, [role=table]").first()).toBeVisible();
  // the Workspace gives the table the width: the bar is tucked behind ☰
  await expect(page.getByRole("button", { name: "Show the pages" }), "a stock list has the bar behind ☰").toBeVisible();
  axeLog(await axeCheck(page, "Discover"));
  for (const tab of ["Explore", "Momentum", "Watchlist", "Portfolio", "Performance", "Alerts"]) {
    await openPage(page, tab);
    await page.waitForLoadState("networkidle");
    await expect(rail, "the other pages keep the bar").toBeVisible();
    await expect(rail.getByRole("button", { name: new RegExp(`^${tab}`) })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading").first()).toBeVisible();
    axeLog(await axeCheck(page, tab));
  }
});

const MODELS = [
  ["HDFCBANK", /bank/i, /justified P\/B/i],
  ["JSWSTEEL", /cyclical/i, /mid-cycle/i],
  ["INDIGO", /loss-maker/i, /no earnings to value|made a loss/i],
  ["NESTLEIND", /short filing history/i, /A fair value needs 5/i],
  ["BAJFINANCE", /NBFC/i, /Stage 3/i],
  ["BAJAJHLDNG", /holding company/i, /sum-of-the-parts/i],
  ["HAL", /re-rated/i, /P\/E/i],
  ["RELIANCE", /steady earner/i, /P\/E/i],
];
for (const [sym, as, says] of MODELS) {
  test(`company page: ${sym}`, async ({ page, account, isMobile }) => {
    await page.goto(`/stock/${sym}`);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    // the model's name is in the Value tab on a computer
    if (!isMobile) await openChapter(page, "Value");
    await expect(page.getByText(as).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(says).first()).toBeAttached();
    await page.waitForLoadState("networkidle");
    axeLog(await axeCheck(page, `stock ${sym}`));
  });
}

test("legal pages @phone", async ({ page }) => {
  for (const path of ["/privacy", "/disclaimer"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
  }
});

// 22 Oct 2026: company logos are shown to identify each company; the
// Disclaimer says whose they are and how a company asks for one to go, and
// every page's footer links to it (26 Oct 2026: the footer shortened to one line)
test("company names and logos are credited to their owners", async ({ page }) => {
  await page.goto("/disclaimer");
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Disclaimer" })).toBeVisible();
  await expect(footer.getByText(/Not investment advice/)).toBeVisible();
  await expect(page.getByText(/trademarks belong to their owners/i)).toBeVisible();
  await expect(page.getByText(/doesn.t mean a company endorses/i)).toBeVisible();
  await expect(page.getByText(/ask us to remove its logo/i)).toBeVisible();
});

test("phone: tabs and a company page fit the screen @phone", async ({ page, account }) => {
  await page.goto("/");
  // The account: Settings from the top bar's menu on a phone (26 Oct 2026), the Account menu on a computer
  await expect(page.getByRole("button", { name: /^Settings/ }).or(page.getByRole("button", { name: "Account" })).first()).toBeVisible();
  for (const path of ["/", "/stock/HDFCBANK", "/stock/TCS"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
  }
});
