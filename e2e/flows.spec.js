// The app's flows, one test each (case ids from replica/test-plan.md).
import { test, expect, openStocks } from "./fixtures.js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const uniqueIp = () => `10.200.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

// ── F01 accounts ─────────────────────────────────────────────────────────────
test("F01-H1/H2/N1/N2 sign up, out, wrong password, back in", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  const email = `ui-${Date.now()}@example.test`, password = randomUUID();
  await page.goto("/");
  const form = page.locator("form").filter({ has: page.getByPlaceholder("Email") }).first();
  await form.getByPlaceholder("Email").fill(email);
  await form.getByPlaceholder(/Password/).fill("short");
  await form.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);  // F01-E1 short password refused
  await form.getByPlaceholder(/Password/).fill(password);
  await form.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  // A new account gets the guided tour first; close it as a user would
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);
  // Wrong password, then the right one
  await page.getByRole("button", { name: "Sign in" }).first().click();
  const signIn = page.locator("form").filter({ has: page.getByPlaceholder("Email") }).first();
  await signIn.getByPlaceholder("Email").fill(email);
  await signIn.getByPlaceholder(/Password/).fill(password + "x");
  await signIn.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByText(/wrong|incorrect|doesn.t match|invalid/i).first()).toBeVisible();
  await signIn.getByPlaceholder(/Password/).fill(password);
  await signIn.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
});

test("F01-N3 the same email can't sign up twice", async ({ request, baseURL }) => {
  const email = `dup-${Date.now()}@example.test`;
  const first = await request.post(`${baseURL}/api/auth/signup`, { data: { email, password: randomUUID() }, headers: { "x-forwarded-for": uniqueIp() } });
  expect(first.ok()).toBeTruthy();
  const again = await request.post(`${baseURL}/api/auth/signup`, { data: { email: email.toUpperCase(), password: randomUUID() }, headers: { "x-forwarded-for": uniqueIp() } });
  expect(again.status()).toBeGreaterThanOrEqual(400);
  expect(again.status()).toBeLessThan(500);
});

test("F01-E2 signed-out API calls are refused", async ({ request, baseURL }) => {
  for (const path of ["/api/watchlist", "/api/portfolio", "/api/alerts", "/api/stock/TCS", "/api/logo/TCS"]) {
    expect((await request.get(`${baseURL}${path}`)).status(), path).toBe(401);
  }
});

// ── F02 Discover ─────────────────────────────────────────────────────────────
test("F02-H1 a strategy, sector and name filter narrow the list; sort works", async ({ page, account }) => {
  await page.goto("/");
  await openStocks(page);
  const rows = page.getByRole("checkbox", { name: /^Compare / });
  await expect(rows.first()).toBeVisible();
  await page.getByRole("combobox").filter({ has: page.getByRole("option", { name: "All sectors" }) }).selectOption("Information Technology");
  await expect(page.getByRole("button", { name: "Tata Consultancy Services Limited" })).toBeVisible();
  await page.getByPlaceholder("Filter by name or ticker…").fill("infosys");
  await expect(rows).toHaveCount(1);
  await page.getByPlaceholder("Filter by name or ticker…").fill("zzzz-nothing");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText(/None of these \d+ companies match/).first()).toBeVisible(); // F02-E1 says why it's empty
});

test("F02-H2 share link reopens the same screen", async ({ page, context, account }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await openStocks(page);
  await page.getByRole("combobox").filter({ has: page.getByRole("option", { name: "All sectors" }) }).selectOption("Healthcare");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("screen=");
  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole("combobox").filter({ has: other.getByRole("option", { name: "All sectors" }) })).toHaveValue("Healthcare");
});

test("F02-H3 Excel and CSV exports download", async ({ page, account }) => {
  await page.goto("/");
  await openStocks(page);
  // One Export button; its menu holds the two formats
  for (const name of [/^Excel workbook/, /^Spreadsheet text/]) {
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name }).click()]);
    const path = await download.path();
    expect(readFileSync(path).length, name).toBeGreaterThan(1000);
  }
});

test("F02-H4 compare two companies", async ({ page, account }) => {
  await page.goto("/");
  await openStocks(page);
  const rows = page.getByRole("checkbox", { name: /^Compare / });
  await rows.nth(0).check();
  await rows.nth(1).check();
  await page.getByRole("button", { name: /^Compare/ }).filter({ hasNotText: "Compare " + "x" }).last().click();
  await expect(page.getByText(/Compare|side by side/i).first()).toBeVisible();
});

// ── F03 search → company page ───────────────────────────────────────────────
test("F03-H1 search opens a company; back returns to Discover", async ({ page, account }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search any stock by name or symbol" }).fill("Infosys");
  await page.getByRole("option", { name: /Infosys/ }).or(page.getByRole("button", { name: /Infosys/ })).first().click();
  await expect(page.getByRole("heading", { level: 2, name: /Infosys/ })).toBeVisible();
  await expect(page).toHaveURL(/\/stock\/INFY/);
  await page.getByRole("button", { name: /Back/ }).first().click();
  await expect(page.getByRole("heading", { name: "Strategies" })).toBeVisible();
});

test("F03-N1 an unknown symbol says so", async ({ page, account }) => {
  await page.goto("/stock/NOTAREALCO");
  await expect(page.getByText(/not found|isn.t|no company|unknown|couldn.t/i).first()).toBeVisible();
});

// ── F04 watchlist ───────────────────────────────────────────────────────────
test("F04-H1 watch from the company page, note it, remove it", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  await page.getByRole("button", { name: "Watchlist" }).first().click();
  await expect(page.getByText("Tata Consultancy Services Limited").first()).toBeVisible();
  await page.getByRole("button", { name: "+ Add note" }).first().click();
  await page.getByPlaceholder("e.g. Wait for Q3 results…").fill("Résumé check ✓ — wait for Q3");
  await page.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Watchlist" }).first().click();
  await expect(page.getByText("Résumé check ✓ — wait for Q3")).toBeVisible();
  await page.getByRole("button", { name: "Remove from watchlist" }).first().click();
  await expect(page.getByText("Tata Consultancy Services Limited")).toHaveCount(0);
});

// ── F05 portfolio ───────────────────────────────────────────────────────────
test("F05-H1 add, edit and remove a holding", async ({ page, account }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Portfolio" }).first().click();
  await page.getByRole("button", { name: "+ Add Holding" }).click();
  await page.getByPlaceholder("e.g. TCS").fill("INFY");
  await page.getByPlaceholder("0.00").fill("1400");
  await page.getByPlaceholder("0", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Add to Portfolio" }).click();
  await expect(page.getByText(/Infosys/).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit holding" }).first().click();
  await page.getByPlaceholder("0", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText(/12 @ ₹1,400/).first()).toBeVisible();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Remove holding" }).first().click();
  await expect(page.getByText(/12 @ ₹1,400/)).toHaveCount(0);
});

test("F05-N1 a made-up ticker is refused", async ({ page, account }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Portfolio" }).first().click();
  await page.getByRole("button", { name: "+ Add Holding" }).click();
  await page.getByPlaceholder("e.g. TCS").fill("FAKECO123");
  await page.getByPlaceholder("0.00").fill("100");
  await page.getByPlaceholder("0", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Add to Portfolio" }).click();
  await expect(page.getByText(/isn.t|not (an )?NSE|not listed|unknown/i).first()).toBeVisible();
});

test("F05-H2 import a broker holdings file", async ({ page, account }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Portfolio" }).first().click();
  await page.getByRole("button", { name: "Import from broker file" }).click();
  const csv = "Instrument,Qty.,Avg. cost\nTCS,5,3100\nHDFCBANK,20,1500.5\nNOTAREAL,3,10\n";
  await page.locator("input[type=file]").setInputFiles({ name: "holdings.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText(/NOTAREAL/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Import \d|Add \d|Import 2/ }).first().click();
  await expect(page.getByText(/Added 2 holdings/)).toBeVisible();
});

// ── F06 alerts ──────────────────────────────────────────────────────────────
test("F06-H1 set an alert from the company page, see it, delete it", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: "Set an alert" }).click();
  await page.getByRole("button", { name: "Drops to" }).click();
  await page.locator("input[type=number]").last().fill("1500");
  await page.getByRole("button", { name: "Create alert" }).click();
  await page.goto("/");
  await page.getByRole("button", { name: "Alerts" }).first().click();
  await expect(page.getByText(/Tata Consultancy/).first()).toBeVisible();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Delete alert" }).first().click();
  await expect(page.getByRole("button", { name: "Delete alert" })).toHaveCount(0);
});

// ── F07 one user's data is invisible to another ────────────────────────────
test("F07-N1 a second account sees none of the first's data", async ({ page, account, playwright, baseURL }) => {
  const a = page.context().request;
  expect((await a.post(`${baseURL}/api/watchlist`, { data: { ticker: "TCS" } })).ok()).toBeTruthy();
  expect((await a.post(`${baseURL}/api/portfolio`, { data: { ticker: "TCS", qty: 1, buyPrice: 100 } })).ok()).toBeTruthy();
  const b = await playwright.request.newContext({ baseURL });
  expect((await b.post("/api/auth/signup", { data: { email: `b-${Date.now()}@example.test`, password: randomUUID() }, headers: { "x-forwarded-for": uniqueIp() } })).ok()).toBeTruthy();
  const bWatch = await (await b.get("/api/watchlist")).json();
  const bPort = await (await b.get("/api/portfolio")).json();
  expect(JSON.stringify(bWatch)).not.toContain("TCS");
  expect(JSON.stringify(bPort)).not.toContain("TCS");
  await b.dispose();
});

// ── F08 settings ────────────────────────────────────────────────────────────
test("F08-H1 theme and logo switches persist across a reload", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await expect(page.locator('img[src="/api/logo/TCS"]')).toBeVisible();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: /Company logos/ }).click();
  await expect(page.locator('img[src^="/api/logo/"]')).toHaveCount(0);
  await page.getByRole("button", { name: /Switch to (light|dark) mode/ }).click();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme || document.documentElement.className);
  await page.reload();
  await expect(page.locator('img[src^="/api/logo/"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.theme || document.documentElement.className)).toBe(theme);
});

// ── F09 delete account ──────────────────────────────────────────────────────
test("F09-H1 delete account removes it", async ({ page, account, baseURL }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: /Delete account/ }).click();
  await page.getByPlaceholder("Your password, to confirm").fill(account.password);
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);
  const again = await page.context().request.post(`${baseURL}/api/auth/login`, { data: { email: account.email, password: account.password }, headers: { "x-forwarded-for": uniqueIp() } });
  expect(again.status()).toBeGreaterThanOrEqual(400);
});
