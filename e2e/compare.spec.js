// Compare from anywhere, with the prices on one chart; and the portfolio
// against the market (31 Oct 2026)
import { test, expect, openPage, openChapter } from "./fixtures.js";

const shots = process.env.SHOTS;

test("C-1 the watchlist compares the companies picked, their prices on one chart @phone", async ({ page, account, baseURL }) => {
  const req = page.context().request;
  for (const t of ["TCS", "INFY", "HCLTECH"]) expect((await req.post(`${baseURL}/api/watchlist`, { data: { ticker: t } })).ok()).toBeTruthy();
  await page.goto("/");
  await openPage(page, "Watchlist");
  await page.getByRole("button", { name: "Compare…" }).click();
  const picker = page.getByRole("dialog", { name: "Compare" });
  await expect(picker.getByRole("checkbox")).toHaveCount(3);
  await picker.getByRole("button", { name: /^Compare 3$/ }).click();
  const chart = page.getByRole("region", { name: "How their prices moved" });
  await expect(chart.getByRole("img", { name: /^Price moves from / })).toBeVisible({ timeout: 45_000 });
  // a line for each, and the Nifty 500 beside them
  await expect(chart.locator(".cc-legend li").filter({ hasText: /TCS|INFY|HCLTECH|Nifty 500/ })).toHaveCount(4);
  await chart.getByRole("button", { name: "5Y" }).click();
  await expect(chart.getByRole("img", { name: /^Price moves from / })).toBeVisible({ timeout: 45_000 });
  if (shots) await page.screenshot({ path: `${shots}/compare-${test.info().project.name}.png` });
});

test("C-2 a company's peers open in Compare with it", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the computer's chapters");
  await page.goto("/stock/TCS");
  await openChapter(page, "Value");
  const btn = page.getByRole("button", { name: /^Compare with its top \d peers$/ });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await expect(page.getByRole("heading", { name: /^Compare stocks \(\d\)$/ })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("region", { name: "How their prices moved" })).toBeVisible();
});

test("P-1 the portfolio against the Nifty 500 @phone", async ({ page, account, baseURL }) => {
  const req = page.context().request;
  expect((await req.post(`${baseURL}/api/portfolio`, { data: { ticker: "TCS", qty: 10, buyPrice: 3000, buyDate: "2026-03-02" } })).ok()).toBeTruthy();
  expect((await req.post(`${baseURL}/api/portfolio`, { data: { ticker: "SBIN", qty: 50, buyPrice: 800, buyDate: "2026-06-01" } })).ok()).toBeTruthy();
  await page.goto("/");
  await openPage(page, "Portfolio");
  const box = page.getByRole("region", { name: "You against the market" });
  await expect(box).toContainText(/holdings are worth ₹[\d,]+\. The same money in the Nifty 500/, { timeout: 45_000 });
  await expect(box).toContainText(/ahead by|behind by|level with the market/);
  await expect(box.getByRole("img")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/portfolio-${test.info().project.name}.png`, fullPage: false });
});
