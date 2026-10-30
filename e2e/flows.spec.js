// The app's flows, one test each (case ids from replica/test-plan.md).
import { test, expect, openStocks, openFilters, openPage, openChapter } from "./fixtures.js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const uniqueIp = () => `10.200.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

// ── F01 accounts ─────────────────────────────────────────────────────────────
test("F01-H1/H2/N1/N2 sign up, out, wrong password, back in", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  const email = `ui-${Date.now()}@example.test`, password = randomUUID();
  await page.goto("/");
  // Sign-up and sign-in open a dialog: the ways in first, then email
  await page.getByRole("button", { name: "Create free account" }).first().click();
  const dialog = page.getByRole("dialog");
  const viaEmail = dialog.getByRole("button", { name: "Continue with email" });
  if (await viaEmail.isVisible().catch(() => false)) await viaEmail.click();
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password", { exact: true }).fill("short");
  await dialog.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);  // F01-E1 short password refused
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Create free account" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  // A new account gets the guided tour first; close it as a user would
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);
  // Wrong password, then the right one
  await page.getByRole("button", { name: /^Sign in/ }).first().click();
  const signIn = page.getByRole("dialog");
  const signInEmail = signIn.getByRole("button", { name: "Continue with email" });
  if (await signInEmail.isVisible().catch(() => false)) await signInEmail.click();
  await signIn.getByLabel("Email").fill(email);
  await signIn.getByLabel("Password", { exact: true }).fill(password + "x");
  await signIn.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByText(/wrong|incorrect|doesn.t match|invalid/i).first()).toBeVisible();
  await signIn.getByLabel("Password", { exact: true }).fill(password);
  await signIn.getByRole("button", { name: /^Sign in$/ }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
});

// The front page's film offers a strategy ("Then, choose a strategy"): its
// Open screen button signs you up, then opens that strategy in Discover
test("F01-H3 Open screen on the front page signs up into that strategy", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp() });
  await page.goto("/");
  // scroll the film to the strategy cards and let them settle (once it's drawn:
  // asked the moment the page loaded, it wasn't there yet)
  await page.locator(".sf-track").waitFor({ state: "attached" });
  await page.evaluate(() => { const t = document.querySelector(".sf-track"), s = document.querySelector(".sf-stage"); window.scrollTo(0, t.offsetTop + (t.offsetHeight - s.clientHeight) * 0.84); });
  const open = page.getByRole("button", { name: /^Open (Dividend Aristocrats|High Quality Compounders|Undervalued Growth)$/ });
  await expect(open).toBeVisible();
  await page.waitForTimeout(1200);
  const name = (await open.getAttribute("aria-label")).replace(/^Open /, "");
  await open.click();
  const dialog = page.getByRole("dialog");
  const viaEmail = dialog.getByRole("button", { name: "Continue with email" });
  if (await viaEmail.isVisible().catch(() => false)) await viaEmail.click();
  await dialog.getByLabel("Email").fill(`ui-${Date.now()}-open@example.test`);
  await dialog.getByLabel("Password", { exact: true }).fill(randomUUID());
  await dialog.getByRole("button", { name: "Create free account" }).click();
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.locator(".screen-title")).toHaveText(name);
  expect(new URL(page.url()).searchParams.has("strategy")).toBe(false); // used once, then gone
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
  await openFilters(page);
  await page.getByRole("combobox").filter({ has: page.getByRole("option", { name: "All sectors" }) }).selectOption("Information Technology");
  await expect(page.getByRole("button", { name: "Tata Consultancy Services Limited" })).toBeVisible();
  // "Infosys Limited": HCL Infosystems, also IT (by its own filings since 22 Oct 2026), shares "infosys"
  await page.getByPlaceholder("Filter by name or ticker…").fill("infosys limited");
  await expect(rows).toHaveCount(1);
  await page.getByPlaceholder("Filter by name or ticker…").fill("zzzz-nothing");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText(/None of these \d+ companies match/).first()).toBeVisible(); // F02-E1 says why it's empty
});

test("F02-H5 the curved row of strategies pauses on hover; a card opens its strategy", async ({ page, account }) => {
  await page.goto("/");
  await expect(page.locator(".cr-tile").first()).toBeAttached();
  await expect(page.getByRole("button", { name: "Start screening" })).toBeInViewport(); // the row doesn't push it below the fold
  await page.waitForTimeout(1500); // the band fades in once measured
  // the middle of the card nearest the centre of the screen
  const spot = await page.evaluate(() => {
    let best = null;
    for (const t of document.querySelectorAll(".cr-tile")) {
      if (getComputedStyle(t).visibility !== "visible") continue;
      const r = t.querySelectorAll(".cr-strip")[8].getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2, d = Math.abs(x - innerWidth / 2);
      if (!best || d < best.d) best = { x, y, d };
    }
    return best;
  });
  await page.mouse.move(spot.x, spot.y);
  const states = await page.locator(".cr-tile").evaluateAll(ts => ts.map(t => getComputedStyle(t).animationPlayState));
  expect(new Set(states)).toEqual(new Set(["paused"]));
  const name = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).closest(".cr-tile").querySelector(".rb-card b").textContent, spot);
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator(".screen-title")).toHaveText(name);
});

// Fix plan #5 and #6 (replica/fixes.md): a screen on the banks' own figures,
// and filters that can be put in your own order
test("F02-H6 Sound Banks screens on bad loans and capital; filters move up and down", async ({ page, account }) => {
  await page.goto("/");
  const card = page.locator("button.sc2").filter({ hasText: "Sound Banks" });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page.locator(".screen-title")).toHaveText("Sound Banks");
  await expect(page.getByRole("button", { name: "HDFC Bank Limited" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tata Consultancy Services Limited" })).toHaveCount(0);
  await openFilters(page);
  const drawer = page.locator(".filters-drawer.open");
  const names = () => drawer.locator(".filter-row").evaluateAll(rows => rows.map(r => r.querySelector("[title], div > div")?.textContent ?? "").filter(t => /NPA|CET1|Return on assets/.test(t)).map(t => t.split(" · ")[0]));
  expect(await names()).toEqual(["Gross NPA", "Net NPA", "CET1 capital ratio", "Return on assets"]);
  await expect(drawer.getByRole("button", { name: "Move Gross NPA up" })).toBeDisabled();
  await drawer.getByRole("button", { name: "Move Return on assets up" }).click();
  expect(await names()).toEqual(["Gross NPA", "Net NPA", "Return on assets", "CET1 capital ratio"]);
  await drawer.getByRole("button", { name: "Move Gross NPA down" }).click();
  expect(await names()).toEqual(["Net NPA", "Gross NPA", "Return on assets", "CET1 capital ratio"]);
});

// The strategy wheel beside the screen's name (computer): spinning it
// switches strategy where the stocks are, without going back to the cards
test("F02-H7 the strategy wheel switches strategy from the stock list", async ({ page, account }) => {
  await page.goto("/");
  const card = page.locator("button.sc2").filter({ hasText: "Sound Banks" });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const wheel = page.getByRole("listbox", { name: "Strategy" });
  await expect(wheel.getByRole("option", { selected: true })).toHaveText("Sound Banks");
  // the mouse wheel turns it; it opens the row it settles on
  const box = await wheel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -100);
  await expect(page.locator(".screen-title")).toHaveText("Beating the Market");
  await expect(page.getByRole("button", { name: "HDFC Bank Limited" })).toHaveCount(0);
  // and the keyboard: Home is the whole market
  await wheel.focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".screen-title")).toHaveText("Whole market");
  await expect(wheel.getByRole("option", { selected: true })).toHaveText("Whole market");
  // a strategy card chosen elsewhere turns the wheel to it
  await page.getByRole("button", { name: "Back to all strategies" }).click();
  await page.locator("button.sc2").filter({ hasText: "Sound Banks" }).click();
  await expect(wheel.getByRole("option", { selected: true })).toHaveText("Sound Banks");
});

// The way back from a stock list (computer): a pill pinned under the header
// however far down the list, landing on the strategies — the card you left,
// or the top of the grid — never the intro above them
test("F02-H8 back from a stock list is always in reach and lands on the strategies", async ({ page, account }) => {
  await page.goto("/");
  const card = page.locator("button.sc2").filter({ hasText: "Sound Banks" });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page.locator(".screen-title")).toHaveText("Sound Banks");
  await page.evaluate(() => window.scrollTo(0, 1500));
  const back = page.getByRole("button", { name: "Back to all strategies" });
  await expect(back).toBeInViewport();
  await back.click();
  await expect(card).toBeInViewport();
  // started from the top of Discover: back at the strategies, not the intro
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /Start screening/ }).first().click();
  await expect(page.locator(".screen-title")).toBeVisible();
  await back.click();
  await expect(page.getByRole("heading", { name: /Explore the strategies/ })).toBeInViewport();
  // and the browser's own Back
  await page.locator("button.sc2").filter({ hasText: "Doubled in a Year" }).click();
  await expect(page.locator(".screen-title")).toHaveText("Doubled in a Year");
  await page.goBack();
  await expect(page.locator("button.sc2").filter({ hasText: "Doubled in a Year" })).toBeInViewport();
});

// 22 Oct 2026: Top Gainers on a computer — its card names the biggest gain,
// its table is in order of the gain, and the period switch moves both
test("F02-H12 Top Gainers ranks by the gain over the period picked", async ({ page, account }) => {
  await page.goto("/");
  const card = page.locator("button.sc2").filter({ hasText: "Top Gainers" });
  await expect(card).toContainText(/Biggest gain/);
  await card.click();
  await expect(page.locator(".screen-title")).toHaveText("Top Gainers");
  const column = async short => page.locator("table").first().evaluate((t, short) => {
    const i = [...t.querySelectorAll("thead th")].findIndex(th => th.textContent.trim().startsWith(short));
    return i < 0 ? [] : [...t.querySelectorAll("tbody tr")].map(tr => tr.children[i]?.textContent).filter(v => v && /\d/.test(v)).map(v => Number(v.replace(/[+%,]/g, "")));
  }, short);
  for (const [name, short] of [["1 year", "1Y"], ["3 years", "3Y"], ["6 months", "6M"], ["1 day", "1D"]]) {
    if (name !== "1 year") await page.getByRole("group", { name: "Biggest gain over" }).getByRole("button", { name }).click();
    await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue(`ret${short.toLowerCase()}`);
    await expect.poll(async () => { const g = await column(short); return g.length > 2 && g.every((v, i) => v >= 0 && (!i || g[i - 1] >= v)); }, { message: `${name}: the table in order of the gain` }).toBe(true);
  }
});

// 22 Oct 2026: "a description like why this stock is going up or down" —
// the move against the market and its sector, and what happened around it,
// never a reason of our own
test("F03-H8 the company page says what happened around its latest move", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  const card = page.getByRole("region", { name: "Why is it moving?" });
  await expect(card).toBeVisible();
  await expect(card.locator(".sd-moves-line").first()).toHaveText(/^(Up|Down) [\d.]+% on \d{1,2} \w+|^Little changed on \d{1,2} \w+/);
  await expect(card).toContainText("not a forecast or advice");
});

// On the wheel's pill (computer): every strategy as a list (also a
// double-click), and what this one looks for, rule by rule
test("F02-H9 the strategy list and what a strategy looks for", async ({ page, account }) => {
  await page.goto("/");
  const card = page.locator("button.sc2").filter({ hasText: "Sound Banks" });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.getByRole("button", { name: "About this strategy" }).click();
  const about = page.getByRole("dialog", { name: "Sound Banks" });
  await expect(about.getByText("What it looks for")).toBeVisible();
  await expect(about.getByText("Gross NPA at most 2%")).toBeVisible();
  await expect(about.getByText(/Gross bad loans as a share of all loans/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(about).toHaveCount(0);
  await page.locator(".wheel-title").dblclick();
  // (31 Oct 2026: a search, the recent ones, then every strategy by kind)
  const list = page.getByRole("dialog", { name: "Every strategy" });
  const all = list.locator(".sp-cols");
  await expect(all.getByRole("button", { name: /Sound Banks/ })).toHaveAttribute("aria-current", "true");
  await expect(list.locator(".sp-quick").getByRole("button", { name: "Sound Banks" })).toBeVisible();
  await expect(list.getByText(/OFSS/)).toHaveCount(0);
  await list.getByRole("searchbox", { name: "Find a strategy" }).fill("margins");
  await expect(all.getByRole("button")).toHaveCount(1);
  await all.getByRole("button", { name: /High Margins, Low Debt/ }).click();
  await expect(page.locator(".screen-title")).toHaveText("High Margins, Low Debt");
  await expect(list).toHaveCount(0);
});

test("F02-H2 share link reopens the same screen", async ({ page, context, account }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await openStocks(page);
  await openFilters(page);
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
  // The search's own result — a strategy card can list Infosys among its names too
  await page.getByRole("listbox", { name: "Companies" }).getByRole("option", { name: /Infosys/ }).first().click();
  await expect(page.getByRole("heading", { level: 2, name: /Infosys/ })).toBeVisible();
  await expect(page).toHaveURL(/\/stock\/INFY/);
  await page.getByRole("button", { name: /Back/ }).first().click();
  await expect(page.getByRole("heading", { name: /strategies|screeners/i }).first()).toBeVisible();
});

test("F03-H2 the top answers each chapter in a tile and says what to watch; the six scores and strengths sit under Business", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  // a computer's page (26 Oct 2026): the gist, a tile per chapter, what to watch
  await expect(page.getByText(/^In short\.$/)).toBeVisible();
  const watch = page.getByRole("region", { name: "What to watch" });
  await expect(watch.getByText(/^Results (for|on|today|tomorrow)/)).toBeVisible();
  await expect(watch.getByText(/price alerts? set|alerts? set/i)).toBeVisible();
  const tile = page.getByRole("button", { name: /^Growth: .+\. Go to the chapter$/ });
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(page.locator("#sec-financials")).toBeInViewport();
  await openChapter(page, "Business");
  const glance = page.getByRole("region", { name: "At a glance" });
  await expect(glance.getByRole("img", { name: /Scores out of 100: Business \d+, Earnings \d+/ })).toBeVisible();
  await expect(glance.getByRole("heading", { name: "What stands out" })).toBeVisible();
  // A line opens its check in the scorecard
  const first = glance.getByRole("listitem").first().getByRole("button");
  const group = (await first.locator("b").textContent()).trim();
  await first.click();
  await expect(page.locator("details[open] summary", { hasText: group }).first()).toBeVisible();

  await openChapter(page, "Price");
  const perf = page.getByRole("region", { name: "How the price has done" });
  const table = perf.getByRole("table");
  for (const row of ["TCS", "NIFTY IT", "NIFTY 50"]) await expect(table.getByRole("rowheader", { name: row })).toBeVisible();
  for (const col of ["1W", "3M", "1Y", "3Y", "5Y"]) await expect(table.getByRole("columnheader", { name: col })).toBeVisible();
  await expect(perf.getByText(/^Over the past year its price (rose|fell) [\d.]+%/)).toBeVisible();
  await expect(perf.getByText(/In a typical week its price moves about ±[\d.]+%/)).toBeVisible();
});

test("F03-H3 the company page says when its figures are from; Help explains them; a 3-year chart", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await expect(page.getByText(/^Results to \d+ \w+ \d{4}, filed \d+ \w+ · NSE close of \d+ \w+/)).toBeVisible();
  const dates = page.getByRole("region", { name: "Where these figures come from" });
  for (const term of ["Share price", "Latest quarter", "Latest audited year", "Scores and fair value"]) await expect(dates.getByText(term, { exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Date range" }).getByRole("button", { name: "3Y" }).click();
  await expect(page.getByRole("button", { name: "3Y" })).toHaveAttribute("aria-pressed", "true");
  await dates.getByRole("link", { name: "How the figures work" }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("heading", { level: 1, name: "How the figures work" })).toBeVisible();
  await expect(page.getByRole("link", { name: "jocularinsights@gmail.com" })).toHaveAttribute("href", /^mailto:jocularinsights@gmail\.com\?subject=.*body=.*build/);
});

test("F03-H4 chart indicators: pivot points and their kinds, an oscillator in its own pane", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: /^Indicators/ }).click();
  const menu = page.getByRole("group", { name: "Indicators" });
  await menu.getByLabel("Pivot points").check();
  const pivots = page.getByLabel("Pivot points", { exact: true }).and(page.locator("div"));
  await expect(pivots).toContainText(/Classic pivots, from the last month:/);
  for (const level of ["R3", "R1", "P", "S1", "S3"]) await expect(pivots).toContainText(level);
  const classicR1 = await pivots.locator("span", { hasText: /^R1 / }).textContent();
  await menu.getByRole("button", { name: "Fibonacci" }).click();
  await expect(pivots).toContainText(/Fibonacci pivots/);
  expect(await pivots.locator("span", { hasText: /^R1 / }).textContent()).not.toBe(classicR1);
  await menu.getByRole("button", { name: "From the last year" }).click();
  await expect(pivots).toContainText(/from the last year/);
  await menu.getByLabel("Stochastic (14, 3, 3)").check();
  await expect(page.getByText(/Stoch\s*%K [\d.,]+ %D [\d.,]+/)).toBeVisible();
});

test("F03-H5 the dividends section: yield against other payers, payout, the yearly record", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await openChapter(page, "Owners");
  const div = page.getByRole("region", { name: "Dividends" });
  // the yield is the tile below, so the lead doesn't repeat it
  await expect(div.getByText(/^It paid ₹[\d,.]+ a share over the last 12 months\.$/)).toBeVisible();
  for (const label of ["Yield", "Other payers", "Payout"]) await expect(div.getByText(label, { exact: true })).toBeVisible();
  await expect(div.getByRole("img", { name: /Dividends a share by financial year: FY\d\d/ })).toBeVisible();
  await expect(div.getByText(/^Paid in \d of the last \d financial years/)).toBeVisible();
  // the section bar's Owners (26 Oct 2026) starts at who owns it, dividends next
  await page.getByRole("navigation", { name: "Parts of this page" }).getByRole("button", { name: "Owners" }).click();
  await expect(page.locator("#sec-holding")).toBeInViewport();
});

test("F03-H6 financial health: cover, debt and cash, the yearly chart, the Scorecard's verdict", async ({ page, account }) => {
  await page.goto("/stock/LT");
  await openChapter(page, "Safety");
  const health = page.getByRole("region", { name: "Financial health" });
  await expect(health.getByText(/Its short-term assets cover its short-term liabilities [\d.]+ times/)).toBeVisible();
  await expect(health.getByRole("img", { name: /FY\d\d balance sheet: Short-term assets ₹[\d,]+ Cr/ })).toBeVisible();
  await expect(health.getByRole("img", { name: /debt and cash: Debt ₹[\d,]+ Cr/ })).toBeVisible();
  await expect(health.getByRole("img", { name: /Borrowings to equity by year: FY\d\d/ })).toBeVisible();
  await expect(health.getByText(/Operating profit covers its interest [\d.]+ times/)).toBeVisible();
  await health.getByRole("button", { name: /The Scorecard rates its balance sheet/ }).click();
  await expect(page.locator("details#why-balance[open]")).toBeInViewport();
});

test("F03-H7 against its sector: the sector's middle and how many it beats", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await openChapter(page, "Business");
  const card = page.getByRole("region", { name: "Against its sector" });
  await expect(card.getByText("Return on equity")).toBeVisible();
  await expect(card.getByText(/middle [\d.]+%/).first()).toBeVisible();
  await expect(card.getByText(/^(Higher|Lower) than (all \d+|\d+% of the \d+) others$/).first()).toBeVisible();
  await expect(card.getByText(/^(Cheaper|Dearer) than/)).toBeVisible();
});

test("F03-H8 what changed recently: dated lines above the filings", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await openChapter(page, "News");
  const card = page.getByRole("region", { name: "What changed recently" });
  await expect(card).toBeVisible();
  await expect(card.locator("li time").first().or(card.getByText(/^Nothing new in the last six weeks/))).toBeVisible();
});

test("R-H1 a computer's left bar: Watchlist peeks over the page; Esc closes it; Open, or a second click, goes to the page; a company's page lists its chapters there", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "a phone has its bottom bar");
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  // a company's page: its chapters in the bar, each going to its part
  const parts = page.getByRole("navigation", { name: "Parts of this page" });
  await parts.getByRole("button", { name: "Owners" }).click();
  await expect(page.locator("#sec-holding")).toBeInViewport();
  await page.getByRole("button", { name: /^Back to / }).first().click();
  const rail = page.getByRole("navigation", { name: "Pages" });
  const star = rail.getByRole("button", { name: /^Watchlist/ });
  await star.click();
  const peek = page.getByRole("dialog", { name: "Watchlist" });
  await expect(peek.getByText(/^1 company/)).toBeVisible();
  // (its row; it can be under Needs a look too)
  await expect(peek.getByRole("listitem").filter({ hasText: "Tata Consultancy" }).last()).toBeVisible();
  await expect(star).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await star.click();
  await peek.getByRole("button", { name: "Open Watchlist →" }).click();
  await expect(star).toHaveAttribute("aria-current", "page");
  // a second click on a peek's icon goes straight to its page
  const alerts = rail.getByRole("button", { name: /^Alerts/ });
  await alerts.click();
  await expect(page.getByRole("dialog", { name: "Alerts" })).toBeVisible();
  await alerts.click();
  await expect(alerts).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("dialog", { name: "Alerts" })).toBeHidden();
});

test("F03-H9 what to review in the next filing: questions without figures, each linking to its section", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  const list = page.getByText("What to review in the next filing").locator("xpath=following-sibling::ul[1]");
  await expect(list.locator("li").first()).toBeVisible();
  await expect(list).not.toContainText(/\d+(\.\d+)?%|₹|\d×/);
  await list.getByRole("button", { name: "See Financial health" }).first().click();
  await expect(page.locator("#sec-health")).toBeInViewport();
});

test("F03-N1 an unknown symbol says so", async ({ page, account }) => {
  await page.goto("/stock/NOTAREALCO");
  await expect(page.getByText(/not found|isn.t|no company|unknown|couldn.t/i).first()).toBeVisible();
});

// ── F04 watchlist ───────────────────────────────────────────────────────────
test("F04-H1 watch from the company page, note it, remove it", async ({ page, account }) => {
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  await openPage(page, "Watchlist");
  await expect(page.getByRole("button", { name: /^Open Tata Consultancy Services/ })).toBeVisible();
  // the row's ⋯: a note, then removing it (26 Oct 2026)
  await page.getByRole("button", { name: /^More for Tata Consultancy Services/ }).click();
  await page.getByRole("button", { name: /^Add a note for/ }).click();
  await page.getByRole("textbox", { name: "Note" }).fill("Résumé check ✓ — wait for Q3");
  await page.getByRole("button", { name: "Save" }).click();
  await page.reload();
  await openPage(page, "Watchlist");
  await page.getByRole("button", { name: /^More for Tata Consultancy Services/ }).click();
  await expect(page.getByRole("button", { name: /^Edit note for/ })).toHaveText(/Résumé check ✓ — wait for Q3/);
  await page.getByRole("button", { name: "Remove from watchlist" }).click();
  await expect(page.getByRole("button", { name: /^Open Tata Consultancy Services/ })).toHaveCount(0);
});

// ── F05 portfolio ───────────────────────────────────────────────────────────
test("F05-H1 add, edit and remove a holding", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Portfolio");
  await page.getByRole("button", { name: "Add holding", exact: true }).click();
  await page.getByPlaceholder("e.g. TCS").fill("INFY");
  await page.getByPlaceholder("0.00").fill("1400");
  await page.getByPlaceholder("0", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Add to Portfolio" }).click();
  await expect(page.getByText(/Infosys/).first()).toBeVisible();
  // a holding's ⋯ holds edit and remove (26 Oct 2026)
  await page.getByRole("button", { name: /^More for Infosys/ }).click();
  await page.getByRole("button", { name: "Edit holding" }).click();
  await page.getByPlaceholder("0", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText(/12 at ₹1,400/).first()).toBeVisible();
  await page.getByRole("button", { name: /^More for Infosys/ }).click();
  await page.getByRole("button", { name: "Remove holding" }).click();
  await expect(page.getByText(/12 at ₹1,400/)).toHaveCount(0);
});

test("F05-N1 a made-up ticker is refused", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Portfolio");
  await page.getByRole("button", { name: "Add holding", exact: true }).click();
  await page.getByPlaceholder("e.g. TCS").fill("FAKECO123");
  await page.getByPlaceholder("0.00").fill("100");
  await page.getByPlaceholder("0", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Add to Portfolio" }).click();
  await expect(page.getByText(/isn.t|not (an )?NSE|not listed|unknown/i).first()).toBeVisible();
});

test("F05-H2 import a broker holdings file", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Portfolio");
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
  await page.getByRole("dialog", { name: "Set Alert" }).getByLabel("Alert price (₹)").fill("1500");
  await page.getByRole("button", { name: "Create alert" }).click();
  await page.goto("/");
  await openPage(page, "Alerts");
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
  await expect(page.locator('img[src^="/api/logo/TCS"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: /Company logos/ }).click();
  await expect(page.locator('img[src^="/api/logo/"]')).toHaveCount(0);
  await page.getByRole("button", { name: /Switch to (light|dark) mode/ }).click();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme || document.documentElement.className);
  await page.reload();
  await expect(page.locator('img[src^="/api/logo/"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.theme || document.documentElement.className)).toBe(theme);
});

// 22 Oct 2026: "before there was a percentage showing the gain or loss, why
// is it not showing now" — under three months every pick's return was a
// dash. Each pick's and each snapshot's return shows again, marked early;
// strategies are still not ranked against each other until three months.
test("F08-H3 strategy performance: an early pick shows its return, marked early", async ({ page, account }) => {
  // India's date, as the page counts days held (UTC's is a day behind until 5:30 am)
  const daysAgo = n => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() - n * 864e5));
  const pick = (ticker, name, cmp, now) => ({ ticker, name, cmp, currentPrice: now, returnPct: (now / cmp - 1) * 100 });
  const snap = { date: daysAgo(25), avgReturnPct: 4.5, priced: 2, picks: [pick("TCS", "Tata Consultancy Services", 2000, 2200), pick("ABB", "ABB India", 7000, 6650)] };
  await page.route("**/api/performance", route => route.fulfill({ json: {
    presets: [{ presetId: "bluechips", presetName: "Defensive Bluechips", sinceDate: snap.date, overallAvgReturnPct: 2.5, snapshots: [snap] }],
    snapshotCount: 1, pricedTickers: 2, totalTickers: 2, pricesDate: daysAgo(0), researchStudy: null,
  } }));
  await page.goto("/");
  await openPage(page, "Performance");
  const strategy = page.getByRole("button", { name: /Defensive Bluechips/ });
  await expect(strategy).toContainText("+2.5%");
  await expect(strategy).toContainText(/early/i);
  await strategy.click();
  await expect(page.getByText("+10.0%")).toBeVisible();
  await expect(page.getByText("-5.0%")).toBeVisible();
  // each company once, with the day it was first picked (24 Oct 2026)
  await expect(page.locator(".pf-picked").first()).toContainText(/^Picked \d{1,2} \w+ \d{4}/);
  await expect(strategy).toContainText(/early · 25 days/);
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
