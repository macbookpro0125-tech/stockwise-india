// The News page (22 Oct 2026): it fills itself from NSE's announcements and
// the day's headlines, so these tests check its shape, not its items.
import { test, expect, openPage } from "./fixtures.js";

test("N-H1 Discover's Market news card leads to the News page and an item; Back returns @phone", async ({ page, account }) => {
  await page.goto("/");
  const card = page.getByRole("region", { name: "Market news" });
  await expect(card.locator(".nw-row").first()).toBeVisible();
  await card.getByRole("button", { name: /See all/ }).click();
  const kinds = page.getByRole("group", { name: "Kinds of news" });
  await expect(kinds.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  const row = page.locator(".nw-day .nw-row").first();
  await expect(row).toBeVisible();
  await row.click();
  const item = page.getByRole("article");
  await expect(item).toBeVisible();
  await expect(item.getByRole("link", { name: /Open the filing|Read the story/ }).or(item.getByText(/no summary/))).toBeVisible();
  await page.goBack();
  await expect(kinds).toBeVisible();
  await expect(item).toHaveCount(0);

  // a kind narrows the list to that kind
  await kinds.getByRole("button", { name: "Results" }).click();
  await expect(kinds.getByRole("button", { name: "Results" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".nw-day .nw-row").first().or(page.getByText("Nothing of this kind in the last few days."))).toBeVisible();
  const labels = await page.locator(".nw-day .nw-kind").allTextContents();
  expect([...new Set(labels)].filter(l => l !== "Results"), "only results").toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("N-H2 the News tab on a computer; a headline opens with its link out; an empty watchlist says so", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "News");
  const kinds = page.getByRole("group", { name: "Kinds of news" });
  await kinds.getByRole("button", { name: "Headlines" }).click();
  const headline = page.locator(".nw-day .nw-row").first();
  await expect(headline).toBeVisible();
  await headline.click();
  const item = page.getByRole("article");
  await expect(item.getByRole("link", { name: /^Read the story/ })).toHaveAttribute("target", "_blank");
  await expect(item.getByText("this page shows its headline only", { exact: false })).toBeVisible();
  await item.getByRole("button", { name: "News" }).click();
  await kinds.getByRole("button", { name: "My watchlist" }).click();
  await expect(page.getByText(/Star companies to follow their news here/)).toBeVisible();
});
