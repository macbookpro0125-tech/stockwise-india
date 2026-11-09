// Every press on a tab opens it, however long it's held (the drop's cut-out
// once swallowed taps longer than ~60ms, 9 Nov 2026):
//
//   node scripts/tabbar/holdtap.mjs
//
// Holds of 30, 120, 250 and 400ms, by mouse and by touch, on Explore and back
// on Discover; each line should name the tab it went to twice.
import { startApp, launch, phonePage } from "./app.mjs";

const { base } = await startApp();
const browser = await launch();
const { ctx, page, errors } = await phonePage(browser, base);
const cdp = await ctx.newCDPSession(page);
const current = () => page.$eval(".bottom-tab-bar [aria-current='page'] .btb-label", n => n.textContent);
const centre = async i => { const b = await page.locator(".bottom-tab-bar .btb-tab").nth(i).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const results = [];
let wrong = 0;
for (const how of ["mouse", "touch"]) for (const hold of [30, 120, 250, 400]) for (const target of [2, 0]) {
  const p = await centre(target);
  if (how === "mouse") { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.up(); }
  else {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
    await page.waitForTimeout(hold);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.waitForTimeout(700);
  const want = target === 2 ? "Explore" : "Discover", got = await current();
  if (got !== want) wrong++;
  results.push(`${how} hold ${hold}ms → ${want}: ${got}`);
}
console.log(results.join("\n"));
console.log(wrong ? `${wrong} presses didn't open their tab` : "every press opened its tab");
console.log("errors:", errors.length ? errors.join(" | ") : "none");
await browser.close();
process.exit(0);
