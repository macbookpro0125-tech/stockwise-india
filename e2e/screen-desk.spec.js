// The Desk, a page of its own (31 Oct 2026): a list, the company picked
// charted beside its business and price, moved with a click or ↑/↓
import { test, expect, openPage } from "./fixtures.js";

test("D-1 the Desk walks a ready-made screen; a click and the arrow keys move the chart and the company together", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the desk is a computer's");
  await page.goto("/");
  await openPage(page, "Desk");
  await page.getByRole("combobox", { name: "List" }).selectOption({ label: "High Quality Compounders" });
  const list = page.getByRole("listbox", { name: /^Companies/ });
  await expect(list.getByRole("option").first()).toBeVisible({ timeout: 45_000 });
  const first = await list.getByRole("option").first().locator("b").textContent();
  await expect(page.locator(".desk-title span")).toContainText(first);

  await list.getByRole("option").nth(2).click();
  const third = await list.getByRole("option").nth(2).locator("b").textContent();
  await expect(page.locator(".desk-title span")).toContainText(third);
  await list.press("ArrowDown");
  const fourth = await list.getByRole("option").nth(3).locator("b").textContent();
  await expect(page.locator(".desk-title span")).toContainText(fourth);
  await expect(list.getByRole("option").nth(3)).toHaveAttribute("aria-selected", "true");

  // the side's tabs, and a quick view narrows the list
  await page.getByRole("tab", { name: "Price" }).click();
  await expect(page.getByText("Against 200-day average")).toBeVisible();
  await page.getByRole("tab", { name: "Business" }).click();
  await expect(page.getByText("Against fair value").last()).toBeVisible();
  const views = page.getByRole("group", { name: "Quick views" });
  const all = Number((await views.getByRole("button", { name: /^All/ }).locator("span").textContent()).replace(/,/g, ""));
  const value = views.getByRole("button", { name: /^Below fair value/ });
  const n = Number((await value.locator("span").textContent()).replace(/,/g, ""));
  if (n > 0) {
    await value.click();
    await expect(list.getByRole("option")).toHaveCount(n);
    expect(n).toBeLessThanOrEqual(all);
  }
  // the market's mood, and a pattern narrows the list to the companies showing it
  const mood = page.getByRole("region", { name: "Market mood" });
  await expect(mood).toContainText(/Market: (Strong|Mixed|Weak)/, { timeout: 45_000 });
  await expect(mood).toContainText("Advancing");
  await views.getByRole("button", { name: /^All/ }).click();
  const patterns = page.getByRole("group", { name: "Price patterns" });
  const chips = patterns.getByRole("button");
  for (let i = 0; i < await chips.count(); i++) {
    const chip = chips.nth(i);
    const k = Number((await chip.locator("span").textContent()).replace(/,/g, ""));
    if (!k) continue;
    await chip.click();
    await expect(list.getByRole("option")).toHaveCount(k);
    await chip.click();
    break;
  }
  if (process.env.DESK_SHOT) { await views.getByRole("button", { name: /^All/ }).click(); await page.waitForTimeout(1500); await page.screenshot({ path: process.env.DESK_SHOT }); }

});

test("D-2 My desk: cards dragged anywhere, resized by the corner and by keys, kept after a reload", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the desk is a computer's");
  await page.setViewportSize({ width: 1440, height: 1700 }); // the whole desk in view, to drag across it
  await page.goto("/");
  await openPage(page, "Desk");
  await page.getByRole("group", { name: "Desk layout" }).getByRole("button", { name: "My desk" }).click();
  await page.getByRole("button", { name: "start with a suggested layout" }).click();
  const cards = page.locator(".md-card");
  await expect(cards).toHaveCount(6);
  await expect(page.getByRole("region", { name: "Company list" }).locator(".md-list li").first()).toBeVisible({ timeout: 45_000 });

  // pick a company in the list: the cards follow it
  const second = page.getByRole("region", { name: "Company list" }).locator(".md-list li").nth(1);
  const sym = (await second.locator("b").textContent()).trim();
  await second.getByRole("button").click();
  await expect(second).toHaveAttribute("aria-selected", "true");

  const boxOf = name => page.getByRole("region", { name, exact: true }).boundingBox();
  // drag the Peers card by its title up to the top left, above everything
  const peers = page.getByRole("region", { name: "Peers", exact: true });
  const ph = await peers.locator(".md-card-head h3").boundingBox();
  const list0 = await boxOf("Company list");
  await page.mouse.move(ph.x + 10, ph.y + 10);
  await page.mouse.down();
  await page.mouse.move(ph.x - 100, ph.y - 200, { steps: 6 });
  await page.mouse.move(list0.x + 20, list0.y - 4, { steps: 8 });
  await expect(page.locator(".md-ghost")).toBeVisible();
  await page.mouse.up();
  await expect.poll(async () => (await boxOf("Peers")).y).toBeLessThan((await boxOf("Company list")).y);

  // widen the Business card from its corner
  const corner = page.getByRole("region", { name: "Business", exact: true }).locator(".md-resize");
  await corner.scrollIntoViewIfNeeded();
  const biz0b = await boxOf("Business");
  const cb = await corner.boundingBox();
  await page.mouse.move(cb.x + 9, cb.y + 9);
  await page.mouse.down();
  await page.mouse.move(cb.x - 200, cb.y + 160, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await boxOf("Business")).height).toBeGreaterThan(biz0b.height + 100);

  // and the keyboard: Shift + → makes the Price card wider
  const price0 = await boxOf("Price");
  await page.getByRole("button", { name: /^Move or resize Price/ }).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(async () => (await boxOf("Price")).width).toBeGreaterThan(price0.width + 20);

  // a note, then everything kept after a reload
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByRole("dialog", { name: "Add a card" }).getByRole("button", { name: /^Notes/ }).click();
  await page.getByRole("textbox", { name: "Notes" }).fill(`watch ${sym}`);
  await expect(page.locator(".md-save")).toHaveText("Saved", { timeout: 10_000 });
  const before = { peers: await boxOf("Peers"), biz: await boxOf("Business"), price: await boxOf("Price") };
  if (process.env.MYDESK_SHOT) { await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); }); await page.waitForTimeout(800); await page.screenshot({ path: process.env.MYDESK_SHOT, fullPage: true }); }

  await page.reload();
  await openPage(page, "Desk");
  await expect(cards).toHaveCount(7);
  await page.waitForTimeout(600);
  const after = { peers: await boxOf("Peers"), biz: await boxOf("Business"), price: await boxOf("Price") };
  for (const k of Object.keys(before)) {
    expect(Math.abs(after[k].x - before[k].x), k).toBeLessThan(3);
    expect(Math.abs(after[k].width - before[k].width), k).toBeLessThan(3);
    expect(Math.abs(after[k].height - before[k].height), k).toBeLessThan(3);
  }
  await expect(page.getByRole("textbox", { name: "Notes" })).toHaveValue(`watch ${sym}`);
});
