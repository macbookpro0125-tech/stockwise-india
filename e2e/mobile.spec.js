// The installed app (17 Oct 2026; replica/test-plan.md "M" cases): the site
// as an app on a phone — installable, opens offline, never serves market data
// from a copy, explains Add to Home Screen on an iPhone, and has buttons big
// enough for a thumb. Phone cases run in the phone project (Pixel 7).
import { test, expect } from "./fixtures.js";
import { test as plain } from "@playwright/test";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("M-H1/H2 installable: manifest, icons and a service worker that takes over @phone", async ({ page, context, baseURL }) => {
  const manifest = await page.request.get(`${baseURL}/manifest.webmanifest`);
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  const m = await manifest.json();
  expect(m).toMatchObject({ name: expect.stringContaining("Jocular Insights"), short_name: "Jocular", start_url: "/", display: "standalone" });
  expect(m.icons.some(i => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
  for (const src of [...m.icons.map(i => i.src), "/apple-touch-icon.png"]) {
    const icon = await page.request.get(baseURL + src);
    expect(icon.status(), src).toBe(200);
  }
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Chrome's own check; a test browser is a private window, which can't install anything
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors.map(e => e.errorId).filter(id => id !== "in-incognito")).toEqual([]);
});

// Offline the browser logs every failed request, which the shared fixture
// counts as errors — so this one runs without it
plain("M-E1/E2 offline: the app's frame opens, market data is never served from a copy @phone", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Jocular Insights" }).first()).toBeVisible();
  // the logo comes from the copy made at install, not a broken image
  expect(await page.locator("img[src='/jocular-insights-mark.svg']").first().evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  // the API is never answered from a copy: offline it fails, it doesn't go stale
  const api = await page.evaluate(() => fetch("/api/presets").then(r => `answered ${r.status}`, () => "failed"));
  expect(api).toBe("failed");
});

test.describe("on an iPhone", () => {
  test.use({ userAgent: IPHONE_UA });
  test("M-H3 Account → Install the app shows the Add to Home Screen steps @phone", async ({ page, account }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: /Install the app/ }).click();
    await expect(page.getByText("In Safari, tap Share, then Add to Home Screen.")).toBeVisible();
  });
});

test("M-E3 buttons a thumb can hit: the bottom tabs and the header's are at least 44 px tall @phone", async ({ page, account }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the bottom tab bar is the phone layout's");
  await page.goto("/");
  await expect(page.locator(".bottom-tab-bar")).toBeVisible();
  const sizes = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll(".bottom-tab-bar button, .bottom-tab-bar a, header button")]
      .filter(el => el.offsetParent !== null)
      .map(el => { const r = el.getBoundingClientRect(); return { name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; });
    return boxes;
  });
  const small = sizes.filter(s => s.h < 44 || s.w < 44);
  expect(small, JSON.stringify(sizes)).toEqual([]);
});

// BUG-005: on a phone the header scrolls away (position: static), which also
// dropped it under Discover's hero (z-index 2), so the Account menu's items
// were covered — Sign out and Delete account couldn't be tapped on Discover
test("BUG-005 the Account menu can be used on Discover on a phone @phone", async ({ page, account }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find the few worth owning." })).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "Sign in", exact: true }).first()).toBeVisible();
});

// BUG-006: the front page counted strategies and filters by hand
test("BUG-006 the front page's counts aren't written in by hand", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "What's inside" }).scrollIntoViewIfNeeded();
  await expect(page.getByText(/\b13 ready-made strategies/)).toHaveCount(0);
  await expect(page.getByText(/\b99 metrics/)).toHaveCount(0);
});
