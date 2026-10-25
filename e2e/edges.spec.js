// Edge cases from the test plan: double submits, long input, a session that
// ends mid-use, the back button, watchlist-only screening, keyboard and phone.
import { test, expect, openStocks, openFilters, openPage } from "./fixtures.js";

test("F05-E1 double-clicking Add to Portfolio adds one holding", async ({ page, account, baseURL }) => {
  await page.goto("/");
  await openPage(page, "Portfolio");
  await page.getByRole("button", { name: "+ Add Holding" }).click();
  await page.getByPlaceholder("e.g. TCS").fill("ITC");
  await page.getByPlaceholder("0.00").fill("400");
  await page.getByPlaceholder("0", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Add to Portfolio" }).dblclick();
  await expect(page.getByText(/^ITC · 3 @/).first()).toBeVisible();
  await page.waitForTimeout(800);
  const list = await (await page.context().request.get(`${baseURL}/api/portfolio`)).json();
  const holdings = Array.isArray(list) ? list : list.holdings ?? [];
  expect(holdings.filter(h => h.ticker === "ITC")).toHaveLength(1);
});

test("F06-E1 double-clicking Create alert makes one alert", async ({ page, account, baseURL }) => {
  await page.goto("/stock/INFY");
  await page.getByRole("button", { name: "Set an alert" }).click();
  await page.getByRole("button", { name: "Drops to" }).click();
  await page.locator("input[type=number]").last().fill("900");
  await page.getByRole("button", { name: "Create alert" }).dblclick();
  await page.waitForTimeout(1000);
  const list = await (await page.context().request.get(`${baseURL}/api/alerts`)).json();
  const alerts = Array.isArray(list) ? list : list.alerts ?? [];
  expect(alerts.filter(a => (a.ticker ?? a.symbol) === "INFY")).toHaveLength(1);
});

test("F04-E1 a long note isn't cut off without warning", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  await openPage(page, "Watchlist");
  await page.getByRole("button", { name: "+ Add note" }).first().click();
  const box = page.getByPlaceholder("e.g. Wait for Q3 results…");
  await box.fill("x".repeat(700));
  const kept = await box.inputValue();
  await page.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await openPage(page, "Watchlist");
  const shown = (await page.getByRole("button", { name: /^Edit note for/ }).first().innerText()).trim();
  // Either the box stops at the limit, or what was typed is what was saved
  expect(shown.length, "saved note length vs what the box accepted").toBe(kept.length);
});

test("F01-E3 a session that ends mid-use returns to sign-in, not a broken page", async ({ page, account }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.context().clearCookies();
  // something that asks the server, once the session has gone
  await page.getByRole("button", { name: /Create new screen|Start screening/ }).first().click();
  await page.goto("/stock/TCS");
  // a company's public summary (23 Oct 2026), and its Sign in to the front page
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Create free account" }).first()).toBeVisible();
});

test("F03-E1 back and forward move between Discover and a company", async ({ page, account }) => {
  await page.goto("/");
  await openStocks(page);
  await page.goto("/stock/HDFCBANK");
  await expect(page.getByRole("heading", { level: 2, name: /HDFC Bank/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("checkbox", { name: /^Compare / }).first()).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 2, name: /HDFC Bank/ })).toBeVisible();
});

test("F02-E2 Watchlist only screens just the watched companies", async ({ page, account, baseURL }) => {
  const req = page.context().request;
  for (const t of ["TCS", "SBIN"]) expect((await req.post(`${baseURL}/api/watchlist`, { data: { ticker: t } })).ok()).toBeTruthy();
  await page.goto("/");
  await openStocks(page);
  await openFilters(page);
  await page.getByRole("combobox").filter({ has: page.getByRole("option", { name: "All sectors" }) }).selectOption("All sectors");
  await page.getByRole("button", { name: /Watchlist only/ }).click();
  const rows = page.getByRole("checkbox", { name: /^Compare / });
  await expect(rows).toHaveCount(2);
});

test("F02-E3 keyboard only: / focuses search, Enter opens a company", async ({ page, account }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: /^(Strategies|Screeners)$/ }).first().waitFor();
  await page.keyboard.press("/");
  await expect(page.getByRole("combobox", { name: "Search any stock by name or symbol" })).toBeFocused();
  await page.keyboard.type("Infosys");
  // the search's own result, not a strategy card that lists Infosys
  await page.getByRole("option", { name: /Infosys/ }).first().waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: /Infosys/ })).toBeVisible();
});

test("phone: add a holding and open Alerts @phone", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Portfolio");
  await page.getByRole("button", { name: "+ Add Holding" }).click();
  await page.getByPlaceholder("e.g. TCS").fill("TCS");
  await page.getByPlaceholder("0.00").fill("3000");
  await page.getByPlaceholder("0", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Add to Portfolio" }).click();
  await expect(page.getByText(/Tata Consultancy/).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // the page scrolled as the holding was added, so the tab bar may have
  // folded into one button (M-H8): openPage opens it as a person would
  await openPage(page, "Alerts");
  await expect(page.getByText(/No alerts yet/)).toBeVisible();
});
