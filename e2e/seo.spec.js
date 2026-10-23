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
