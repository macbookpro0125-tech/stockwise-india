// The front page's product screenshot (public/screens/discover.jpg), taken
// from the real app on a private copy (demo-app.mjs), so it always shows the
// current screens and real data. Re-run after the screens change:
// npm run build && npm run screens

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startDemoApp, ROOT, sleep } from "./demo-app.mjs";

const OUT_DIR = process.env.SCREENS_OUT ?? join(ROOT, "public", "screens");
mkdirSync(OUT_DIR, { recursive: true });

const { base, browser, context } = await startDemoApp({ port: 8793 });
const page = await context.newPage();
await page.goto(base, { waitUntil: "networkidle" });

// Discover: a strategy's results, just under the header
await page.getByRole("button", { name: /Buffett-style/ }).click();
await page.locator("table.data-table tbody tr").first().waitFor();
await sleep(800); // the results fade in
const top = await page.getByRole("button", { name: "Export Excel" }).evaluate(el => el.getBoundingClientRect().top + window.scrollY);
const headerH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0);
await page.evaluate(y => window.scrollTo(0, y), Math.max(0, top - headerH - 16));
await page.mouse.move(1270, 790); // no hover highlight on a row
await sleep(600);
const file = join(OUT_DIR, "discover.jpg");
await page.screenshot({ path: file, type: "jpeg", quality: 82 });

await context.close();
await browser.close();
console.log(`Saved ${file}`);
process.exit(0);
