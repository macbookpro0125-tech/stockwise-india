// What search engines and signed-out visitors get (23 Oct 2026: "when we
// search on Google it should be at the top")
import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures.js";

test("S-H1 a company's page is readable without signing in, with its own title; its ways in open the sign-up box on the page @phone", async ({ page, request }) => {
  const html = await (await request.get("/stock/TCS")).text();
  expect(html).toMatch(/<title>Tata Consultancy Services share price[^<]*\| TCS \| Jocular Insights<\/title>/);
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
  const viaEmail = dialog.getByRole("button", { name: "Continue with email" });
  if (await viaEmail.isVisible().catch(() => false)) await viaEmail.click();
  await dialog.getByLabel("Email").fill(`ps-${Date.now()}@example.test`);
  await dialog.getByLabel("Password", { exact: true }).fill(randomUUID());
  await dialog.getByRole("button", { name: "Create free account" }).click();
  const skip = page.getByRole("button", { name: "Skip tour" });
  if (await skip.isVisible({ timeout: 5000 }).catch(() => false)) await skip.click();
  await expect(page).toHaveURL(/\/stock\/TCS/);
  await expect(page.getByRole("button", { name: /In watchlist/ }).filter({ visible: true }).first()).toBeVisible();
});

test("S-H2 robots.txt and the sitemap", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://jocularinsights.in/sitemap.xml");
  const sm = await request.get("/sitemap.xml");
  expect(sm.headers()["content-type"]).toContain("xml");
  // an index of sitemaps since 25 Oct 2026 (pages, screens, sectors, stocks, details)
  const index = await sm.text();
  expect(index).toContain("<sitemapindex");
  for (const part of ["pages", "screens", "sectors", "stocks", "details"]) expect(index).toContain(`<loc>https://jocularinsights.in/sitemap-${part}.xml</loc>`);
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
  expect(html).toMatch(/<title>[^<]+: \d+ today \| Jocular Insights<\/title>/);
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
