// What search engines and signed-out visitors get (23 Oct 2026: "when we
// search on Google it should be at the top")
import { test, expect } from "./fixtures.js";

test("S-H1 a company's page is readable without signing in, with its own title; Sign in leads to the front page @phone", async ({ page, request }) => {
  const html = await (await request.get("/stock/TCS")).text();
  expect(html).toMatch(/<title>Tata Consultancy Services share price[^<]*\| TCS \| Jocular Insights<\/title>/);
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/jocularinsights\.in\/stock\/TCS"/);
  expect(html).toMatch(/<main class="seo-stock">[\s\S]*Quality score/);
  await page.goto("/stock/TCS");
  await expect(page.getByRole("heading", { level: 1, name: "Tata Consultancy Services" })).toBeVisible();
  await expect(page.getByText("Quality score")).toBeVisible();
  await expect(page.getByText(/fair value, the scorecard/)).toBeVisible();
  await expect(page).toHaveTitle(/Tata Consultancy Services share price/);
  await page.getByRole("button", { name: /Sign in or create a free account/ }).click();
  await expect(page.getByRole("button", { name: "Create free account" }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/stock\/TCS/);
});

test("S-H2 robots.txt and the sitemap", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://jocularinsights.in/sitemap.xml");
  const sm = await request.get("/sitemap.xml");
  expect(sm.headers()["content-type"]).toContain("xml");
  const xml = await sm.text();
  expect((xml.match(/<loc>/g) ?? []).length).toBeGreaterThan(2000);
  expect(xml).toContain("<loc>https://jocularinsights.in/stock/TCS</loc>");
});

// 24 Oct 2026: pages people search for — each strategy's companies, the strategies, the results calendar
test("S-H3 a strategy's page and the results calendar are open to everyone; a company opens its page @phone", async ({ page, request }) => {
  const html = await (await request.get("/screens/high-quality-compounders")).text();
  expect(html).toMatch(/<title>High Quality Compounders: \d+ NSE stocks that match today \| Jocular Insights<\/title>/);
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/jocularinsights\.in\/screens\/high-quality-compounders"/);
  expect(html).toMatch(/href="\/stock\/[A-Z0-9&%-]+"/);
  expect((await request.get("/screens/no-such-strategy")).status()).toBe(404);

  await page.goto("/screens");
  await expect(page.getByRole("heading", { level: 1, name: "Indian stock screens" })).toBeVisible();
  await page.getByRole("link", { name: /High Quality Compounders/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /High Quality Compounders: NSE companies that match today/ })).toBeVisible();
  await expect(page.getByText("The filters")).toBeVisible();
  const first = page.locator(".pl-co").first();
  const name = (await first.locator(".pl-co-name").innerText()).trim();
  await first.click();
  await expect(page).toHaveURL(/\/stock\/[A-Z0-9&%-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name.split(" ")[0]);

  await page.goto("/results-calendar");
  await expect(page.getByRole("heading", { level: 1, name: "Quarterly results calendar" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
