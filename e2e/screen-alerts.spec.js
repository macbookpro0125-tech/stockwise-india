// "Tell me when a company joins my screen" (31 Oct 2026): the switch when a
// screen is saved, and the bell on a saved screen
import { test, expect, openStocks, openFilters } from "./fixtures.js";

test("A-1 a saved screen can tell you when a company joins; its bell turns that off and on", async ({ page, account, isMobile, baseURL }) => {
  test.skip(isMobile, "the Workspace is a computer's");
  await page.goto("/");
  await openStocks(page);
  await openFilters(page);
  await page.getByRole("combobox").filter({ has: page.getByRole("option", { name: "All sectors" }) }).selectOption("Information Technology");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save as strategy" }).click();
  await page.getByPlaceholder("e.g. My pharma screen").fill("Alert test screen");
  const box = page.getByRole("checkbox", { name: /Tell me when a company joins/ });
  await expect(box).toBeChecked();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const bell = page.getByRole("button", { name: /^Alerts (on|off)$/ });
  await expect(bell).toHaveText(/Alerts on/);
  await expect(bell).toHaveAttribute("aria-pressed", "true");
  // kept with the account
  await expect.poll(async () => (await (await page.context().request.get(`${baseURL}/api/strategies`)).json()).strategies.find(s => s.name === "Alert test screen")?.notify ?? false).toBe(true);
  await bell.click();
  await expect(bell).toHaveText(/Alerts off/);
  await expect.poll(async () => (await (await page.context().request.get(`${baseURL}/api/strategies`)).json()).strategies.find(s => s.name === "Alert test screen")?.notify ?? false).toBe(false);
});
