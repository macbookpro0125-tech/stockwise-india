// What search engines and signed-out visitors get (23 Oct 2026: "when we
// search on Google it should be at the top")
import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures.js";

test("S-H1 a company's page is readable without signing in, with its own title; its ways in open the sign-up box on the page @phone", async ({ page, request }) => {
  const html = await (await request.get("/stock/TCS")).text();
  expect(html).toMatch(/<title>Tata Consultancy Services share price[^<]*\| TCS(?: \| Jocular Insights)?<\/title>/);
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/jocularinsights\.in\/stock\/TCS"/);
  expect(html).toMatch(/<main class="seo-stock">[\s\S]*Quality score/);
  await page.goto("/stock/TCS");
  await expect(page.getByRole("heading", { level: 1, name: "Tata Consultancy Services" })).toBeVisible();
  // (the label, exactly: the page also asks and answers "What is its quality score?")
  await expect(page.getByText("Quality score", { exact: true })).toBeVisible();
  // what an account adds, in its own words (25 Oct 2026)
  await expect(page.getByText(/scorecard's checks one by one/)).toBeVisible();
  await expect(page).toHaveTitle(/Tata Consultancy Services share price/);
  // what the full page answers, chapter by chapter (27 Oct 2026)
  await expect(page.getByRole("heading", { name: /The full page answers 7 questions about Tata Consultancy Services/ })).toBeVisible();
  // a way in opens the sign-up box here, saying why — not the front page
  await page.getByRole("button", { name: "Set a price alert" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Create a free account to set a price alert for Tata Consultancy Services.")).toBeVisible();
  await expect(page).toHaveURL(/\/stock\/TCS/);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Tata Consultancy Services" })).toBeVisible();
});

test("S-H4 Add to watchlist on a company's public page signs up there, then shows the company, starred @phone", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.44.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: "Add to watchlist" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Create a free account to add Tata Consultancy Services to your watchlist.")).toBeVisible();
  // the box shows its ways in first: wait for them, they may take a moment to draw
  await dialog.getByRole("button", { name: "Continue with email" }).click();
  await dialog.getByLabel("Email").fill(`ps-${Date.now()}@example.test`);
  await dialog.getByLabel("Password", { exact: true }).fill(randomUUID());
  await dialog.getByRole("button", { name: "Create free account" }).click();
  const skip = page.getByRole("button", { name: "Skip tour" });
  if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) await skip.click();
  await expect(page).toHaveURL(/\/stock\/TCS/);
  await expect(page.getByRole("button", { name: /In watchlist/ }).filter({ visible: true }).first()).toBeVisible();
});

// 9 Nov 2026, the SEO audit's step 8: each way in finishes what it began
async function signUpInBox(dialog, prefix) {
  await dialog.getByRole("button", { name: "Continue with email" }).click();
  await dialog.getByLabel("Email").fill(`${prefix}-${Date.now()}@example.test`);
  await dialog.getByLabel("Password", { exact: true }).fill(randomUUID());
  await dialog.getByRole("button", { name: "Create free account" }).click();
}

test("S-H9 Set a price alert on a company's public page signs up there, then opens the alert form on the company, before any tour @phone", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.45.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await page.goto("/stock/TCS");
  await page.getByRole("button", { name: "Set a price alert" }).click();
  const box = page.getByRole("dialog");
  await expect(box.getByText("Create a free account to set a price alert for Tata Consultancy Services.")).toBeVisible();
  await signUpInBox(box, "alert");
  const form = page.getByRole("dialog", { name: "Set Alert" });
  await expect(form).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/stock\/TCS/);
  // the company's tour waits for the form
  await page.waitForTimeout(1500);
  await expect(page.getByRole("button", { name: "Skip tour" })).toHaveCount(0);
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(form).toHaveCount(0);
  // and once (a reload doesn't open it again)
  await page.reload();
  const skip = page.getByRole("button", { name: "Skip tour" });
  if (await skip.isVisible({ timeout: 8000 }).catch(() => false)) await skip.click();
  await expect(page.getByRole("button", { name: /Set an alert/ }).first()).toBeAttached({ timeout: 15000 });
  await expect(page.getByRole("dialog", { name: "Set Alert" })).toHaveCount(0);
});

test("S-H10 the header's sign-up on a public page opens the box there, saying why, and the visitor stays on the page @phone", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.46.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  // a page that brings no box of its own: the frame's, over the page
  await page.goto("/privacy");
  await page.locator(".pub-acts .btn-ghost").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  // a list's page: its own reason, and back on the same page, signed in
  await page.goto("/screens");
  await page.locator(".pub-acts .btn-primary").click();
  const box = page.getByRole("dialog");
  await expect(box.getByText("Create a free account to run every screen and save your own.")).toBeVisible();
  await signUpInBox(box, "header");
  await expect(page.locator(".pub-acts").getByRole("button", { name: "Back to the app" })).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/screens$/);
  await expect(page.getByRole("heading", { level: 1, name: "Indian stock screens" })).toBeVisible();
});

test("S-H2 robots.txt and the sitemap", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://jocularinsights.in/sitemap.xml");
  const sm = await request.get("/sitemap.xml");
  expect(sm.headers()["content-type"]).toContain("xml");
  // an index of sitemaps since 25 Oct 2026 (pages, screens, sectors, stocks, details)
  const index = await sm.text();
  expect(index).toContain("<sitemapindex");
  for (const part of ["pages", "screens", "sectors", "lists", "stocks", "details"]) expect(index).toContain(`<loc>https://jocularinsights.in/sitemap-${part}.xml</loc>`);
  const stocks = await (await request.get("/sitemap-stocks.xml")).text();
  expect((stocks.match(/<loc>/g) ?? []).length).toBeGreaterThan(2000);
  expect(stocks).toContain("<loc>https://jocularinsights.in/stock/TCS</loc>");
  // IndexNow reads the site's key back (30 Oct 2026, indexnow.js)
  const { INDEXNOW_KEY } = await import("../server/indexnow-key.js");
  const key = await request.get(`/${INDEXNOW_KEY}.txt`);
  expect(key.status()).toBe(200);
  expect(await key.text()).toBe(INDEXNOW_KEY);
});

// 24 Oct 2026: pages people search for — each strategy's companies, the strategies, the results calendar
test("S-H3 a strategy's page and the results calendar are open to everyone; a company opens its page @phone", async ({ page, request }) => {
  const html = await (await request.get("/screens/high-quality-compounders")).text();
  // the title in the words people search for (25 Oct 2026), with today's count
  expect(html).toMatch(/<title>[^<]+: \d+ today(?: \| Jocular Insights)?<\/title>/);
  expect(html).toMatch(/<h1>[^<]*High Quality Compounders<\/h1>/);
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/jocularinsights\.in\/screens\/high-quality-compounders"/);
  expect(html).toMatch(/href="\/stock\/[A-Z0-9&%-]+"/);
  expect((await request.get("/screens/no-such-strategy")).status()).toBe(404);

  await page.goto("/screens");
  await expect(page.getByRole("heading", { level: 1, name: "Indian stock screens" })).toBeVisible();
  await page.getByRole("link", { name: /High Quality Compounders/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /High Quality Compounders: NSE companies that match today/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The filters" })).toBeVisible();
  const first = page.locator(".pl-co").first();
  const name = (await first.locator(".pl-co-name").innerText()).trim();
  await first.click();
  await expect(page).toHaveURL(/\/stock\/[A-Z0-9&%-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name.split(" ")[0]);

  await page.goto("/results-calendar");
  await expect(page.getByRole("heading", { level: 1, name: "Quarterly results calendar" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // the ways in (28 Oct 2026): a free account's card, and a day's "+N more"
  // and the header's Sign in open the box on the page, saying why
  await expect(page.getByRole("region", { name: "Know when your companies report" })).toBeVisible();
  const more = page.locator(".ex-more").first();
  if (await more.count()) {
    await more.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/^Create a free account to see all \d+ companies reporting/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
  }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sign in" })).toBeVisible();
  await expect(page).toHaveURL(/\/results-calendar$/);
});

// 30 Oct 2026: the guides, open to everyone and written into the page
test("S-H5 the guides: a list, each guide its own page, and links between them stay in the app @phone", async ({ page, request }) => {
  const html = await (await request.get("/learn/pe-ratio-explained")).text();
  expect(html).toMatch(/<title>The P\/E ratio, explained for Indian stocks \| Jocular Insights<\/title>/);
  expect(html).toContain('"@type":"Article"');
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/jocularinsights\.in\/learn\/pe-ratio-explained"/);
  expect((await request.get("/learn/no-such-guide")).status()).toBe(404);
  expect(await (await request.get("/help")).text()).toContain("Where the figures come from");

  await page.goto("/learn");
  await expect(page.getByRole("heading", { level: 1, name: "Learn to read a company's figures" })).toBeVisible();
  await page.getByRole("link", { name: "How to read a bank or finance company" }).click();
  await expect(page).toHaveURL(/\/learn\/how-to-analyse-a-bank$/);
  await expect(page.getByRole("heading", { level: 1, name: "How to read a bank or finance company" })).toBeVisible();
});

// 6 Nov 2026: lists people search for — each index's companies, NSE's
// themes, price bands and plain filters
test("S-H6 stock lists: an index's companies, a theme, a price band; in the sitemap; open to everyone @phone", async ({ page, request }) => {
  const sm = await (await request.get("/sitemap-lists.xml")).text();
  for (const slug of ["nifty-50-stocks", "defence-stocks", "stocks-under-100", "debt-free-stocks", "large-cap-stocks", "high-roe-stocks", "piotroski-score-stocks", "psu-stocks", "fno-stocks", "cash-rich-stocks"]) expect(sm).toContain(`<loc>https://jocularinsights.in/lists/${slug}</loc>`);
  const html = await (await request.get("/lists/nifty-50-stocks")).text();
  expect(html).toMatch(/<title>Nifty 50 stocks list[^<]*\| Jocular Insights<\/title>/);
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/jocularinsights\.in\/lists\/nifty-50-stocks"/);
  expect(html).toContain('href="/stock/TCS"');
  // its own picture when shared (scripts/og-cards.mjs)
  expect(html).toContain('<meta property="og:image" content="https://jocularinsights.in/og/lists/nifty-50-stocks.jpg"');
  expect((await request.get("/og/lists/nifty-50-stocks.jpg")).headers()["content-type"]).toContain("image/jpeg");
  expect((await request.get("/lists/no-such-list")).status()).toBe(404);
  // the app's own page: the list, and a company opens its page
  await page.goto("/lists");
  await page.getByRole("link", { name: /^Defence stocks/ }).click();
  await expect(page.getByRole("heading", { name: "Defence stocks" }).first()).toBeVisible();
  // shared to WhatsApp (or the phone's share sheet) with the list's own address
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  await page.locator(".pl-co").first().click();
  await expect(page).toHaveURL(/\/stock\//);
});

test("S-H7 latest results: who just reported, with figures in the titles; in the sitemap; a company opens its results @phone", async ({ page, request }) => {
  const html = await (await request.get("/results")).text();
  expect(html).toMatch(/<title>Q\d FY\d\d results today: latest NSE company results(?: \| Jocular Insights)?<\/title>/);
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/jocularinsights\.in\/results"/);
  expect(await (await request.get("/sitemap-details.xml")).text()).toContain("<loc>https://jocularinsights.in/results</loc>");
  // a company's results page leads with its figures (Google shows the title)
  const tcs = await (await request.get("/stock/TCS/results/q2-fy27")).text();
  // (14 Nov 2026) at most 70 characters: long ones drop the symbol, then use "+14.9%", then the sales figure
  const title = tcs.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  expect(title).toMatch(/^Tata Consultancy Services Q2 FY27 results: profit (up |down |\+|−)[\d.]+% to ₹[\d,]+ cr/);
  expect(title.length).toBeLessThanOrEqual(70);
  // the calendar points to it; in the app, a company opens its quarter
  await page.goto("/results-calendar");
  await page.getByRole("link", { name: "See the latest results" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Latest Q\d FY\d\d results$/ })).toBeVisible();
  await page.locator("table.lr-table tbody th a").first().click();
  await expect(page).toHaveURL(/\/stock\/[^/]+\/results\/q\d-fy\d\d$/);
  await expect(page.getByRole("heading", { level: 1, name: / results$/ })).toBeVisible();
});

// Google's renderer runs the app but loads nothing robots.txt keeps out, and
// for years that was all of /api/: these pages, drawn from /api/public/ after
// the app started, came out as a bare "Stock list" heading and no companies
// (9 Nov 2026, the SEO audit). They now start from the data the server writes
// into them (seo.js listData), so they draw whole with the API out of reach.
test("S-H8 screens, sectors, lists and the calendar draw their companies with /api/ out of reach, as Google renders them @phone", async ({ page }) => {
  // refused, as robots.txt refuses Google (a 4xx the app handles, not a dropped connection)
  await page.route("**/api/**", route => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Not for robots" }) }));
  // each page, its heading, and links that only its data can draw
  for (const [path, heading, links] of [
    ["/screens", /^Indian stock screens$/, 'a[href^="/screens/"]'],
    ["/screens/high-quality-compounders", /^High Quality Compounders/, 'a[href^="/stock/"]'],
    ["/sectors", /^NSE stocks by sector$/, 'a[href^="/sector/"]'],
    ["/sector/information-technology", /^Information Technology stocks on NSE$/, 'a[href^="/stock/"]'],
    ["/lists", /^NSE stock lists$/, 'a[href^="/lists/"]'],
    ["/lists/nifty-50-stocks", /Nifty 50/, 'a[href^="/stock/"]'],
    ["/results-calendar", /^Quarterly results calendar$/, null],
  ]) {
    await page.goto(path);
    // the app's own page, once it has replaced the server's (main.seo-stock)
    const app = page.locator("main:not(.seo-stock)");
    await expect(app.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
    // not the placeholder a page shows while it waits for its data
    await expect(app.getByRole("heading", { level: 1, name: /^(Stock list|Sector|Stock screen)$/ }), path).toHaveCount(0);
    if (links) await expect.poll(() => app.locator(links).count(), { message: path }).toBeGreaterThan(5);
  }
});

// 9 Nov 2026: a hidden term tip ("moats", near the right edge) widened the
// screens' pages on a phone; the page scrolled sideways and the sign-up box
// stretched past the screen. (Against the page's own width: on a phone the
// window widens with the page, so innerWidth can't tell.)
test("S-H11 the public pages fit a phone's screen: nothing scrolls sideways @phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a phone's width");
  for (const path of ["/", "/screens", "/screens/high-quality-compounders", "/sectors", "/sector/information-technology", "/lists", "/lists/nifty-50-stocks", "/results-calendar", "/results", "/learn", "/stock/TCS", "/privacy"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
  }
});
