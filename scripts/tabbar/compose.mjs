// The recording's frames beside ours, one row per moment:
//
//   node scripts/tabbar/compose.mjs <refDir> <ourDir> <out.png> [--full] <k>…
//
// refDir from refframes.sh, ourDir from film.mjs (frame k of each is the same
// moment after the touch). Without --full, each strip whole and scaled down;
// with --full, the bubble's area at full size (x 60..660, y 10..260 of each).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2).filter(a => a !== "--full");
const full = process.argv.includes("--full");
const [refDir, ourDir, out, ...ks] = args;
const img = f => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const pad = k => (k < 0 ? "-1" : String(k).padStart(2, "0"));
const ms = k => `${Math.round((k + 1) * 16.67)}ms`;
const cell = src => (full ? `<div class=c><img src="${src}" style="margin-left:-60px;margin-top:-10px"></div>` : `<img class=s src="${src}">`);
const rows = ks.map(Number).map(k => `<div class=r><b>${ms(k)}</b>${cell(img(`${refDir}/f_${pad(k)}.png`))}${cell(img(`${ourDir}/f_${pad(k)}.png`))}</div>`).join("");
const html = `<style>body{margin:0;background:#777;font:600 20px system-ui}.r{display:flex;align-items:center;gap:6px;padding:3px 6px}.r b{width:80px;color:#fff}.c{width:600px;height:250px;overflow:hidden;background:#fff}.c img{display:block}.s{width:900px;height:auto;display:block}.h{display:flex;gap:6px;padding:6px 6px 0 92px;color:#fff}.h span{width:${full ? 600 : 900}px}</style><div class=h><span>iOS 26 (recording)</span><span>Ours</span></div>${rows}`;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: full ? 1300 : 1930, height: 300 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("→", out);
