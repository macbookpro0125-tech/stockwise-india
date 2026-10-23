// The News page (22 Oct 2026): it fills itself from NSE's announcements and
// the day's headlines, so these tests check its shape, not its items.
import { test, expect, openPage } from "./fixtures.js";

test("N-H1 the News tile (a computer) or the Explore tab (a phone) leads to the News page and an item; Back returns @phone", async ({ page, account }) => {
  await page.goto("/");
  // a computer: Discover's News tile; a phone: the Explore tab (23 Oct 2026)
  const tile = page.getByRole("region", { name: "What's new today" });
  if (await tile.isVisible().catch(() => false)) {
    await expect(tile.locator(".ap-news-item").first()).toBeVisible();
    await tile.getByRole("button", { name: /Read the news/ }).click();
  } else {
    await expect(page.getByRole("region", { name: "Market news" }), "the phone's Discover has no news card").toHaveCount(0);
    await openPage(page, "Explore");
  }
  const kinds = page.getByRole("group", { name: "Kinds of news" });
  await expect(kinds.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  const row = page.locator(".nw-day .nw-row").first();
  await expect(row).toBeVisible();
  await row.click();
  const item = page.getByRole("article");
  await expect(item).toBeVisible();
  await expect(item.getByRole("link", { name: /Open the filing|Read the story/ }).or(item.getByText(/no summary/)).first()).toBeVisible();
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

test("N-H2 Discover's News tile and the News tab on a computer; a headline opens with its link out; an empty watchlist says so", async ({ page, account }) => {
  await page.goto("/");
  // the fourth of Discover's ways in (23 Oct 2026)
  const tile = page.getByRole("region", { name: "What's new today" });
  await expect(tile.locator(".ap-news-item").first().or(tile.getByText("Nothing new from NSE just now."))).toBeVisible();
  await tile.getByRole("button", { name: /Read the news/ }).click();
  await expect(page.getByRole("group", { name: "Kinds of news" })).toBeVisible();
  await page.goto("/stock/TCS");
  await openPage(page, "Explore");
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

  // larger companies by default; the switch brings in the rest, and the counts grow
  const size = page.getByRole("switch", { name: /Only companies over/ });
  await expect(size).toHaveAttribute("aria-checked", "true");
  const all = kinds.getByRole("button", { name: /^All/ });
  await all.click();
  const count = async () => Number((await all.locator(".nw-count").textContent()).replace(/\D/g, ""));
  await expect.poll(count).toBeGreaterThan(0);
  const large = await count();
  await size.click();
  await expect(size).toHaveAttribute("aria-checked", "false");
  await expect.poll(count).toBeGreaterThan(large);
});

// 23 Oct 2026, "are we getting any useful news?": a result shows its figures
// (or says when they come), and an announcement can be read for its key lines
test("N-H3 results show their figures; an announcement's filing is read for its key lines", async ({ page, account }) => {
  await page.goto("/");
  await openPage(page, "Explore");
  const kinds = page.getByRole("group", { name: "Kinds of news" });
  await kinds.getByRole("button", { name: /^Results/ }).click();
  const rows = page.locator(".nw-day .nw-row");
  await expect(rows.first().or(page.getByText("Nothing of this kind in the last few days."))).toBeVisible();
  if (!(await rows.count())) return;
  const withFigures = page.locator(".nw-day .nw-row:has(.nw-figs)").first();
  await expect(withFigures, "most results have their figures").toBeVisible();
  await expect(withFigures).toContainText(/Sales ₹|Profit ₹|Loss ₹/);
  await expect(withFigures).toContainText(/Q\d FY\d\d results/);
  await withFigures.click();
  const item = page.getByRole("article");
  await expect(item.getByText("The numbers, against the same quarter a year earlier")).toBeVisible();
  const lines = item.getByRole("region", { name: "From the filing" });
  await lines.getByRole("button", { name: /Read its key lines/ }).click();
  await expect(lines.locator(".nw-lines li").first().or(lines.getByText(/No lines stood out|Couldn't read|no readable text|no NSE attachment/))).toBeVisible({ timeout: 45_000 });
});
