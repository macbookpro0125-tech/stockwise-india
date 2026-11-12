// 4 Nov 2026, the owner's phone list: the home's Market summary, the overall
// score in In short, what a company does in words, the quarters at a glance
import { test, expect } from "./fixtures.js";

test("PD-1 a phone's home: favourites as one line, then the Market summary @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "a phone's home");
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Star a screener to keep it here/ })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Market summary" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("region", { name: "The market" })).toBeVisible();
});

test("PD-2 a company on a phone: the overall score, what it does, the quarters @phone", async ({ page, account, isMobile }) => {
  test.skip(!isMobile, "a phone's company page");
  await page.goto("/stock/TCS");
  const short = page.getByRole("region", { name: "In short" });
  await expect(short.getByLabel(/^Overall score \d+ of 100/)).toBeVisible({ timeout: 45_000 });
  await expect(short).toContainText(/Data confidence: (High|Medium|Low)/);
  const about = page.getByRole("region", { name: "What it does" });
  await expect(about).toContainText(/TCS|Tata Consultancy/);
  await expect(about).toContainText(/Sales in the year to/);

  await page.getByRole("tab", { name: "Growth" }).or(page.getByRole("button", { name: /^Growth$/ })).first().click();
  await page.getByRole("button", { name: "Quarterly", exact: true }).first().click();
  await expect(page.getByText(/^Latest quarter, to /)).toBeVisible();
  await expect(page.getByText("Sales, quarter by quarter")).toBeVisible();
  // a tapped bar shows its figure; no "a year over N years" for quarters
  const bar = page.locator(".qp .trend-col").nth(3);
  await bar.click();
  await expect(bar.locator(".trend-val")).toBeVisible();
  await expect(page.locator(".qp")).not.toContainText(/a year over \d+ years/);
});
