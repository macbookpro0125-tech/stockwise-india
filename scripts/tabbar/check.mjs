// The tab bar's layout and behaviour, on a phone-sized Chrome:
//
//   node scripts/tabbar/check.mjs
//
// 1. At 320, 375, 390 and 430 wide, every tab both ways: the bar's size and
//    place, and the bubble centred on the open tab's icon (it should be
//    within 0.1px; the end tabs' capsules move inward, so a tab's box isn't
//    the measure).
// 2. A trip in real time, frame by frame (centre, width, glass), screenshots
//    at 40/90/150/220ms; rapid taps (0 → 3 → 1 → 2 within ~150ms) end on the
//    last; reading down folds the bar; a focused field hides it, and letting
//    go brings it back. (Back is the e2e tests': on the web a tab adds no
//    history step, so Back from a tab leaves the app.)
// 3. The light theme over each page. 4. Reduced motion: no travel.
// Screenshots go to $OUT/check/.
import { startApp, launch, phonePage, outDir } from "./app.mjs";

const OUT = outDir("check") + "/";
const { base } = await startApp();
const browser = await launch();
const report = [], errors = [];
const open = async (width, height, theme, context = {}) => {
  const p = await phonePage(browser, base, { width, height, theme, context });
  p.page.on("pageerror", e => errors.push(`${width} ${e.message}`));
  return p;
};
const measure = page => page.evaluate(() => {
  const nav = document.querySelector(".bottom-tab-bar"), lens = nav.querySelector(".btb-lens");
  const r = nav.getBoundingClientRect();
  const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(lens.style.transform) || [];
  const lw = parseFloat(lens.style.width), lh = parseFloat(lens.style.height);
  const tabs = [...nav.querySelectorAll(".btb-tab")];
  const cur = tabs.findIndex(t => t.getAttribute("aria-current") === "page");
  const t = tabs[cur], svg = t?.querySelector("svg")?.getBoundingClientRect();
  const lensCentre = parseFloat(m[1]) + lw / 2, iconCentre = svg ? svg.left + svg.width / 2 - r.left : null;
  return {
    tab: t?.querySelector(".btb-label").textContent, bar: { x: +r.left.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bottomGap: +(innerHeight - r.bottom).toFixed(1) },
    lens: { w: +lw.toFixed(1), h: +lh.toFixed(1), top: +parseFloat(m[2]).toFixed(1) }, offIcon: iconCentre == null ? null : +(lensCentre - iconCentre).toFixed(2),
    icon: svg?.width, label: t ? getComputedStyle(t.querySelector(".btb-label")).fontSize : null,
  };
});
const clipBar = async (page, file) => {
  const r = await page.locator(".bottom-tab-bar").boundingBox();
  const x = Math.max(0, r.x - 14);
  await page.screenshot({ path: OUT + file, clip: { x, y: r.y - 24, width: Math.min(r.width + 28, page.viewportSize().width - x), height: r.height + 40 } });
};
const tab = (page, i) => page.locator(".bottom-tab-bar .btb-tab").nth(i);

// 1. sizes at four widths, every tab, both ways
let worst = 0;
for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932]]) {
  const { ctx, page } = await open(w, h, "dark");
  const n = await page.locator(".bottom-tab-bar .btb-tab").count();
  for (const i of [...Array(n).keys(), ...[...Array(n).keys()].reverse()]) {
    await tab(page, i).tap();
    await page.waitForTimeout(900);
    const m = await measure(page);
    worst = Math.max(worst, Math.abs(m.offIcon));
    report.push({ width: w, ...m });
    if (w === 390) await clipBar(page, `tab-${w}-${i}.png`);
  }
  await page.screenshot({ path: OUT + `full-${w}.png` });
  await ctx.close();
}
report.push({ largestOffsetFromIcon: worst });

// 2. a trip in real time, rapid taps, folding, typing, Back
{
  const { ctx, page } = await open(390, 844, "dark");
  await tab(page, 0).tap(); await page.waitForTimeout(900);
  const track = withGlass => page.evaluate(withGlass => {
    window.__f = [];
    const lens = document.querySelector(".bottom-tab-bar .btb-lens"), glass = lens.querySelector(".btb-lens-glass"), t0 = performance.now();
    const go = () => {
      const m = /translate3d\(([-\d.]+)px/.exec(lens.style.transform), w = parseFloat(lens.style.width);
      window.__f.push([Math.round(performance.now() - t0), +(parseFloat(m[1]) + w / 2).toFixed(1), +w.toFixed(1), ...(withGlass ? [+(+glass.style.opacity).toFixed(2)] : [])]);
      if (performance.now() - t0 < 1400) requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  }, withGlass);
  await track(true);
  await tab(page, 3).tap();
  let waited = 0;
  for (const ms of [40, 90, 150, 220]) { await page.waitForTimeout(ms - waited); waited = ms; await clipBar(page, `trip-${ms}.png`); }
  await page.waitForTimeout(1300);
  report.push({ trip: "[ms, centre, width, glass]", frames: await page.evaluate(() => window.__f) });
  await tab(page, 0).tap(); await page.waitForTimeout(900);
  await track(false);
  for (const i of [3, 1, 2]) { await tab(page, i).tap(); await page.waitForTimeout(50); }
  await page.waitForTimeout(1500);
  const rapid = await page.evaluate(() => window.__f);
  let jump = 0;
  for (let k = 1; k < rapid.length; k++) jump = Math.max(jump, Math.abs(rapid[k][1] - rapid[k - 1][1]));
  report.push({ rapidTapsEndOn: (await measure(page)).tab, shouldBe: "Explore", largestMoveInOneFrame: +jump.toFixed(1) });
  await tab(page, 0).tap(); await page.waitForTimeout(900);
  await page.mouse.wheel(0, 260); await page.waitForTimeout(500);
  await clipBar(page, "scrolled.png");
  report.push({ foldsWhileReadingDown: (await page.$eval(".bottom-tab-bar", n => n.className)).includes("collapsed") });
  await page.mouse.wheel(0, -2000); await page.waitForTimeout(700);
  await page.locator(".app-header-search input").first().focus().catch(() => {});
  await page.waitForTimeout(400);
  const typing = await page.$eval(".bottom-tab-bar", n => [n.className.includes("typing"), getComputedStyle(n).opacity]);
  await page.locator(".app-header-search input").first().blur().catch(() => {});
  await page.waitForTimeout(500);
  const after = await page.$eval(".bottom-tab-bar", n => [n.className.includes("typing"), getComputedStyle(n).opacity]);
  report.push({ hiddenWhileTyping: typing, backAfter: after });
  await ctx.close();
}
// 3. the light theme over each page
{
  const { ctx, page } = await open(390, 844, "light");
  for (const i of [0, 1, 2, 3]) { await tab(page, i).tap(); await page.waitForTimeout(1000); await page.screenshot({ path: OUT + `light-${i}.png` }); }
  await ctx.close();
}
// 4. reduced motion: no travel
{
  const { ctx, page } = await open(390, 844, "dark", { reducedMotion: "reduce" });
  await tab(page, 3).tap(); await page.waitForTimeout(30);
  const m = await measure(page).catch(e => ({ error: e.message.slice(0, 80) }));
  report.push({ reducedMotion: m.error ? m : { tab: m.tab, offIconAfter30ms: m.offIcon } });
  await page.screenshot({ path: OUT + "reduced.png" });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 0).replace(/\},\{/g, "},\n{"));
console.log("screenshots in", OUT);
console.log("errors:", errors.length ? errors.join("\n") : "none");
process.exit(0);
