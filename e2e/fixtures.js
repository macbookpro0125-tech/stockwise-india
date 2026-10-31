// Shared setup: every test signs up its own fresh account (random password,
// never stored), skips the guided tours, and fails on a console error or a
// 5xx answer from our server.
import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";

let n = 0;
// Errors the app causes on purpose or can't avoid, kept narrow
const EXPECTED_CONSOLE = [
  // A refused request the page handles itself (signed-out /api/auth/me, a
  // company with no logo, a form the server turned down) — the browser logs
  // each one; 5xx answers are caught separately below
  /Failed to load resource: the server responded with a status of 4\d\d/,
  // Google sign-in's helper, on a phone, asks Google for its settings; Google
  // refuses this test server's address (127.0.0.1 isn't one of the project's
  // own sites), never the live one's — its failed request is matched below
  /identitytoolkit\/v3\/relyingparty\/getProjectConfig.*blocked by CORS policy/,
];
// requests to Google's sign-in that may fail here, as above
const GOOGLE_SIGN_IN = /^https:\/\/(www\.googleapis\.com\/identitytoolkit|[a-z0-9-]+\.firebaseapp\.com\/)/;

export const test = base.extend({
  account: async ({ page, context, baseURL }, use, testInfo) => {
    const email = `e2e-${Date.now()}-${testInfo.workerIndex}-${n++}@example.test`;
    const password = randomUUID();
    const ip = `10.${testInfo.workerIndex}.${n % 250}.${(Date.now() / 1000 | 0) % 250}`;
    const res = await context.request.post(`${baseURL}/api/auth/signup`, { data: { email, password }, headers: { "x-forwarded-for": ip } });
    expect(res.ok(), `sign-up ${res.status()}`).toBeTruthy();
    const { userId } = await res.json();
    const owner = `${userId}:${email}`;
    await context.addInitScript(o => {
      try { localStorage.setItem("stockwise-tours", JSON.stringify({ [o]: { app: true, stock: true } })); } catch {}
    }, owner);
    await use({ email, password, userId, ip });
  },
  page: async ({ page }, use, testInfo) => {
    const problems = [];
    let googleFailed = 0;
    page.on("requestfailed", r => { if (GOOGLE_SIGN_IN.test(r.url())) googleFailed++; });
    page.on("console", m => {
      if (m.type() !== "error") return;
      const text = m.text();
      // the browser's line for that refused request names no address
      if (/^Failed to load resource: net::ERR_FAILED$/.test(text) && googleFailed > 0) { googleFailed--; return; }
      if (!EXPECTED_CONSOLE.some(re => re.test(text))) problems.push(`console: ${text}`);
    });
    page.on("pageerror", e => problems.push(`page error: ${e.message}`));
    page.on("response", r => {
      const u = new URL(r.url());
      if (r.status() >= 500 && u.hostname === "127.0.0.1") problems.push(`${r.status()} ${u.pathname}${u.search}`);
    });
    await use(page);
    testInfo.annotations.push(...problems.map(p => ({ type: "problem", description: p })));
    expect(problems, "console errors / 5xx during the test").toEqual([]);
  },
});

// Accessibility scan of what's on screen; serious and critical only
export async function axeCheck(page, label) {
  // Scan a still page: half-way through a fade-in, text is partly transparent
  // and reads as low contrast. Content that arrives with its data fades in
  // later, so wait until nothing finite has run for a moment (endless ones —
  // the price strip, pulses — are ignored).
  const settled = () => page.waitForFunction(() => !document.getAnimations().some(a => a.playState === "running" && a.effect?.getComputedTiming?.().iterations !== Infinity), null, { timeout: 5000 }).catch(() => {});
  await settled(); await page.waitForTimeout(400); await settled();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = violations.filter(v => v.impact === "serious" || v.impact === "critical");
  return bad.map(v => `${label}: ${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help}; e.g. ${v.nodes[0]?.target?.join(" ")} [${(v.nodes[0]?.any?.[0]?.message ?? "").slice(0, 160)}] <${(v.nodes[0]?.html ?? "").slice(0, 140)}>`);
}

// The filters' drawer (16 Oct 2026): on a computer it opens from the filter
// board's "More filters" (30 Oct 2026; the board folded opens first), on a
// narrow window from the Filters button
export async function openFilters(page) {
  const board = page.locator(".fb");
  if (await board.isVisible()) {
    const show = board.getByRole("button", { name: /^Show filters/ });
    if (await show.isVisible()) await show.click();
    await board.getByRole("button", { name: /^Exact ranges/ }).click();
  } else {
    await page.getByRole("button", { name: /^Filters/ }).first().click();
  }
  await page.locator(".filters-drawer.open").waitFor();
}

// Discover opens on its strategies (15 Oct 2026); this goes on to the stock
// list: a new screen of the whole market on a computer, the whole market on a
// phone
export async function openStocks(page) {
  await page.getByRole("button", { name: /Create new screen|Start screening/ }).first().click();
  await page.getByRole("checkbox", { name: /^Compare / }).first().waitFor();
}

// Open a page as a person would: its tab in the header's tab row; on a
// phone, the bottom tab bar (opening it first if it has folded into one
// button); on Discover on a computer, which has no tab row, by way of a
// company's page, whose header has the tabs
export async function openPage(page, name) {
  const re = new RegExp(`^${name}`);
  // the app drawn first (the header and the tab bar come together): asked
  // the moment a page starts loading, neither was there yet and a phone was
  // taken for a computer
  await page.locator(".app-header").first().waitFor();
  // a computer: the pages are in the bar down the left (26 Oct 2026);
  // Watchlist, Portfolio and Alerts open a peek first, whose Open goes there
  const rail = page.locator("nav.side-rail");
  // the Workspace tucks the bar away (31 Oct 2026): its ☰ brings it back
  const reveal = page.getByRole("button", { name: "Show the pages" });
  if (await reveal.isVisible().catch(() => false)) await reveal.click();
  if (await rail.isVisible().catch(() => false)) {
    // a company's page shows its chapters in the bar instead (27 Oct 2026): back first
    if (!(await rail.getByRole("button", { name: re }).count())) await page.getByRole("button", { name: /^Back to / }).first().click();
    await rail.getByRole("button", { name: re }).click();
    if (/^(Watchlist|Portfolio|Alerts)/.test(name)) {
      const peek = page.getByRole("dialog", { name: re });
      if (await peek.waitFor({ timeout: 2000 }).then(() => true, () => false)) await peek.getByRole("button", { name: /^Open / }).click();
    }
    return;
  }
  const row = page.locator(".discovery-tabs");
  if (await row.isVisible().catch(() => false)) return row.getByRole("button", { name: re }).click();
  const bar = page.getByRole("navigation", { name: "Pages" });
  if (await bar.isVisible().catch(() => false)) {
    const folded = bar.getByRole("button", { name: /: show all tabs$/ });
    if (await folded.isVisible().catch(() => false)) await folded.click();
    const tab = bar.getByRole("button", { name: re });
    if (await tab.count()) return tab.click();
    // a page with no tab of its own on a phone (Alerts, 23 Oct 2026): its row
    // in Settings, which the top bar's menu button opens (26 Oct 2026)
    await page.getByRole("button", { name: /^Settings/ }).first().click();
    return page.locator(".st-row").filter({ hasText: re }).first().click();
  }
  await page.goto("/stock/TCS");
  await row.waitFor();
  await row.getByRole("button", { name: re }).click();
}

// A company's chapter, picked in its bar (a computer's tabs since 27 Oct 2026)
export async function openChapter(page, name) {
  await page.getByRole("navigation", { name: "Parts of this page" }).getByRole("button", { name, exact: true }).click();
}

export { expect };

// The screen's name over the list (31 Oct 2026): a computer's heading
// (StrategyPicker.jsx .sp-name-big), else the title a phone shows
export const screenTitle = page => page.locator(".sp-name-big, .screen-title:not(.sr-only)").first();
