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
  // a filing, a headline, or an RBI or SEBI notice (the newest are often these)
  await expect(item.getByRole("link", { name: /Open the filing|Read the story|Read it on (RBI|SEBI)'s website/ }).or(item.getByText(/no summary/)).first()).toBeVisible();
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
  // the headline as published, the figures around it the app's own (25 Oct 2026)
  await expect(item.getByText("The headline as published", { exact: false })).toBeVisible();
  await item.getByRole("button", { name: "News", exact: true }).click();
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
  // how the quarter compares: in sentences, against a year earlier
  const compare = item.getByRole("region", { name: "How the results compare" });
  await expect(compare).toContainText(/How the Q\d FY\d\d results compare/i);
  await expect(compare).toContainText(/(Sales|Profit) ₹[\d,.]+ crore|A loss of ₹/);
  const lines = item.getByRole("region", { name: "From the filing" });
  await lines.getByRole("button", { name: /Read its key lines/ }).click();
  await expect(lines.locator(".nw-lines li").first().or(lines.getByText(/No lines stood out|Couldn't read|no readable text|no NSE attachment/))).toBeVisible({ timeout: 45_000 });
});

// 23 Oct 2026: news from the watchlist's companies, and a dot on the Watchlist
// tab when there's something new since the page was last opened
test("N-H4 a starred company's news shows on the Watchlist, with a dot on its tab until opened @phone", async ({ page, account, baseURL, isMobile }) => {
  const ctx = page.context().request;
  const feed = await (await ctx.get(`${baseURL}/api/news?kind=all&size=all`)).json();
  const filing = feed.items.find(i => i.type === "filing");
  test.skip(!filing, "no announcements in the feed just now");
  expect((await ctx.post(`${baseURL}/api/watchlist`, { data: { ticker: filing.symbol } })).ok()).toBeTruthy();
  // last looked a week ago: anything since is new
  await page.addInitScript(() => { if (!sessionStorage.getItem("set")) { localStorage.setItem("watch-news-seen", new Date(Date.now() - 7 * 864e5).toISOString()); sessionStorage.setItem("set", "1"); } });
  // a computer's pages are in the bar down the left (26 Oct 2026); a phone's at the bottom
  const dot = ".tab-news-dot:visible, .btb-dot-news:visible, .side-rail .sr-dot:not(.warn):visible";
  await page.goto(isMobile ? "/" : "/stock/TCS");
  await expect(page.locator(dot).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Watchlist.*new from your companies/ }).first(), "the tab's name still leads").toBeVisible();
  const { openPage } = await import("./fixtures.js");
  await openPage(page, "Watchlist");
  const news = page.getByRole("region", { name: "News from your companies" });
  await expect(news.locator(".nw-row").first()).toBeVisible();
  await expect(page.locator(dot)).toHaveCount(0);
  // its row is in the list (since 26 Oct 2026 the news is the section's, not a line on each row)
  await expect(page.locator(".wl-row").first()).toBeVisible();
  await news.locator(".nw-row").first().click();
  await expect(page.getByRole("article")).toBeVisible();
});

// 23 Oct 2026: "if I add a new stock from the news, My watchlist isn't updating"
test("N-H5 starring a company from the news brings its news into My watchlist straight away", async ({ page, account, baseURL }) => {
  const { openPage } = await import("./fixtures.js");
  await page.goto("/");
  await openPage(page, "Explore");
  const kinds = page.getByRole("group", { name: "Kinds of news" });
  await kinds.getByRole("button", { name: /^My watchlist/ }).click();
  await expect(page.getByText(/Star companies to follow their news here/)).toBeVisible();
  await kinds.getByRole("button", { name: /^All/ }).click();
  const filing = page.locator(".nw-day .nw-row").filter({ has: page.locator(".nw-kind") }).first();
  await filing.click();
  await page.locator(".nw-quote").first().click();
  await expect(page).toHaveURL(/\/stock\//);
  await page.getByRole("button", { name: /^Add to watchlist/ }).first().click();
  await page.getByRole("button", { name: /^Back/ }).first().click();
  await page.getByRole("button", { name: /^News/ }).first().click().catch(() => {});
  await expect(kinds).toBeVisible();
  await kinds.getByRole("button", { name: /^My watchlist/ }).click();
  await expect(page.locator(".nw-day .nw-row").first()).toBeVisible();
  await expect(page.getByText(/Star companies to follow their news here/)).toHaveCount(0);
});
