// How smoothly the tab bar's bubble really moves, in real time, on a
// phone-sized Chrome — slowed, to stand in for a slower phone:
//
//   node scripts/tabbar/timing.mjs [rate] [mode]
//
// rate: how many times slower the processor runs (1 = this computer, 4 = a
// slow phone). mode: "switch" (real taps: the bubble and the new page) or
// "bubble" (the tap's click is swallowed, so only the bubble moves).
// Ten taps across the four tabs, 80ms each, by touch. For each: animation
// frames drawn in the first 600ms (36 = every frame at 60Hz), the longest gap,
// frames later than 25ms, the work done in animation-frame callbacks (the
// bubble's own), the long frames with the scripts in them (Chrome's Long
// Animation Frames), and when the new page showed after the finger lifted.
//
// 9 Nov 2026, 4x slower: before — the bubble alone 33/36 frames at ~15ms of
// work a frame; a tab switch 29/36, worst gap 75ms. After — 36/36 at 0.4ms;
// 33/36, worst gap 43ms. The page showed ~35ms after the finger lifted at 1x.
import { startApp, launch, phonePage } from "./app.mjs";

const rate = Number(process.argv[2] || 4), mode = process.argv[3] || "switch";

// in the page, before it loads: every frame's time, each animation-frame
// callback's cost, long frames, and when a tab became the open one
function instrument(swallow) {
  window.__frames = []; window.__cbs = []; window.__loaf = []; window.__current = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const s = performance.now(); try { cb(ts); } finally { window.__cbs.push({ at: s, ms: performance.now() - s }); } });
  const tick = ts => { window.__frames.push(ts); raf(tick); };
  raf(tick);
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__loaf.push({ at: e.startTime, ms: e.duration, scripts: e.scripts.map(s => ({ inv: s.invoker, ms: Math.round(s.duration), fn: s.sourceFunctionName, layout: Math.round(s.forcedStyleAndLayoutDuration) })) });
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch { /* not in this browser */ }
  new MutationObserver(ms => { for (const m of ms) if (m.target.getAttribute?.("aria-current") === "page") window.__current.push({ at: performance.now(), label: m.target.querySelector(".btb-label")?.textContent }); })
    .observe(document, { attributes: true, attributeFilter: ["aria-current"], subtree: true });
  if (swallow) addEventListener("click", e => { if (e.target.closest?.(".btb-tab")) { e.stopPropagation(); e.preventDefault(); } }, true);
}

const { base } = await startApp();
const browser = await launch();
const { ctx, page, errors } = await phonePage(browser, base, { init: [[instrument, mode === "bubble"]] });
await page.waitForTimeout(1000);
const cdp = await ctx.newCDPSession(page);
if (rate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
const tabs = await page.$$eval(".bottom-tab-bar .btb-tab", ts => ts.map(t => { const r = t.getBoundingClientRect(); return { name: t.querySelector(".btb-label").textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
const rows = [];
for (const i of [1, 2, 3, 0, 2, 0, 3, 1, 3, 0]) {
  await page.waitForTimeout(1200);
  const t0 = await page.evaluate(() => performance.now());
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tabs[i].x, y: tabs[i].y }] });
  await page.waitForTimeout(80);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(900);
  rows.push({ to: tabs[i].name, ...(await page.evaluate(t0 => {
    const f = window.__frames.filter(t => t >= t0 && t <= t0 + 600);
    const gaps = f.slice(1).map((t, k) => t - f[k]);
    const cbs = window.__cbs.filter(c => c.at >= t0 && c.at <= t0 + 600);
    const shown = window.__current.find(c => c.at > t0 + 80);
    return {
      frames: f.length, worst: Math.max(...gaps), late: gaps.filter(g => g > 25).length,
      work: cbs.reduce((s, c) => s + c.ms, 0) / (cbs.length || 1), workMax: Math.max(0, ...cbs.map(c => c.ms)),
      shownAfterUp: shown ? shown.at - (t0 + 80) : null,
      long: window.__loaf.filter(e => e.at + e.ms >= t0 && e.at <= t0 + 600).map(e => ({ ms: Math.round(e.ms), at: Math.round(e.at - t0), scripts: e.scripts.filter(s => s.ms >= 3) })),
    };
  }, t0)) });
}
const avg = k => (rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(1);
const shown = rows.map(r => r.shownAfterUp).filter(v => v != null);
console.log(`rate ${rate}x, ${mode}: frames in the first 600ms (36 = all) avg ${avg("frames")}, worst gap avg ${avg("worst")}ms, late frames avg ${avg("late")}, frame-callback work avg ${avg("work")}ms (max ${Math.max(...rows.map(r => r.workMax)).toFixed(1)}ms)`);
if (shown.length) console.log(`the new page showed after the finger lifted: avg ${(shown.reduce((a, b) => a + b, 0) / shown.length).toFixed(0)}ms, max ${Math.max(...shown).toFixed(0)}ms`);
for (const r of rows) console.log(`  → ${r.to.padEnd(10)} frames ${r.frames}  worst ${r.worst.toFixed(0)}ms  late ${r.late}  work ${r.work.toFixed(1)}/${r.workMax.toFixed(1)}ms  long frames: ${r.long.map(e => `${e.ms}ms@${e.at} [${e.scripts.map(s => `${s.inv}${s.fn ? ":" + s.fn : ""} ${s.ms}${s.layout ? " (layout " + s.layout + ")" : ""}`).join(", ")}]`).join(" | ") || "none"}`);
if (errors.length) console.log("errors:", errors.slice(0, 5).join(" | "));
await browser.close();
process.exit(0);
