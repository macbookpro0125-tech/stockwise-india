// The screen's chart: any two scores, and a box dragged on it lists the
// companies between those values (5 Nov 2026)
import { test, expect, openStocks } from "./fixtures.js";

const shots = process.env.SHOTS;

test("QV-1 the chart: pick any two scores, swap them, drag a box to list the companies in that range", async ({ page, account, isMobile }) => {
  test.skip(isMobile, "the chart is on a computer");
  await page.goto("/");
  await openStocks(page);
  await page.getByRole("button", { name: "Chart" }).click();
  const chart = page.locator(".qv");
  await expect(chart.getByRole("button", { name: /^Higher quality, lower P\/E · \d+/ })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/qv-quality-pe.png` });
  await chart.getByLabel("Score up the side").selectOption("growth");
  await chart.getByLabel("Score across the bottom").selectOption("risk");
  await expect(chart.getByRole("button", { name: /^Higher growth, lower risk · \d+/ })).toHaveAttribute("aria-pressed", "true");
  await chart.getByRole("button", { name: "Swap up and across" }).click();
  await expect(chart.getByLabel("Score up the side")).toHaveValue("risk");
  await expect(chart.getByRole("button", { name: /^Lower risk, higher growth · \d+/ })).toHaveAttribute("aria-pressed", "true");
  // a box over the middle of the plot
  const box = await chart.locator("svg[role=img]").boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.8, { steps: 8 });
  await page.mouse.up();
  const boxed = chart.locator(".qv-boxed");
  await expect(boxed).toContainText(/In your box · \d+/);
  await expect(boxed).toContainText(/Risk score \d+–\d+ · growth \d+–\d+/);
  if (shots) await page.screenshot({ path: `${shots}/qv-box.png` });
  await chart.getByRole("button", { name: "Clear the box" }).click();
  await expect(boxed).toHaveCount(0);
  // a click on a dot still opens its company
  await chart.locator(".qv-dot").last().scrollIntoViewIfNeeded();
  await chart.locator(".qv-dot").last().click();
  await expect(page).toHaveURL(/\/stock\//);
});
