// The YouTube channel's banner (13 Nov 2026): 2560×1440, everything that
// matters inside the 1546×423 middle strip YouTube shows on every screen
// (a computer shows only that; a TV the whole picture). The app's navy and
// teal, with the final silver JI (scripts/brand/ji-original.png) as on the
// channel's picture.
//   node scripts/youtube-banner.mjs → brand/social-final/youtube-banner-2560x1440.png
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "brand/social-final/youtube-banner-2560x1440.png");
const mark = `data:image/png;base64,${readFileSync(join(ROOT, "scripts/brand/ji-original.png")).toString("base64")}`;

// Faint figures beyond the safe strip: texture on a TV, never needed
const tape = ["TCS", "INFY", "HDFCBANK", "RELIANCE", "BEL", "ICICIBANK", "SBIN", "LT", "ITC", "HAL", "SUNPHARMA", "MARUTI", "TITAN", "NTPC", "BHARTIARTL"];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:2560px;height:1440px;overflow:hidden}
body{font-family:-apple-system,"SF Pro Display","Helvetica Neue",Inter,sans-serif;-webkit-font-smoothing:antialiased;color:#f4f5fb;
background:radial-gradient(1100px 700px at 78% 50%,rgba(0,224,190,.16),transparent 65%),radial-gradient(1000px 800px at 15% 60%,rgba(62,121,255,.14),transparent 62%),linear-gradient(180deg,#0b1028,#060814)}
.tape{position:absolute;left:0;right:0;font-size:30px;letter-spacing:.18em;color:rgba(169,175,196,.13);white-space:nowrap;font-weight:600}
.tape.t1{top:250px}.tape.t2{bottom:250px}
.safe{position:absolute;left:507px;top:508px;width:1546px;height:423px;display:flex;align-items:center;gap:64px;padding:0 40px}
.badge{flex:none;width:300px;height:300px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 6px rgba(0,224,190,.35),0 30px 80px rgba(0,0,0,.5)}
.badge img{width:262px;height:262px}
.name{font-size:104px;font-weight:700;letter-spacing:-.04em;line-height:1}
.name span{color:#00e0be}
.line{margin-top:22px;font-size:46px;font-weight:500;letter-spacing:-.01em;color:#d6dae8;line-height:1.2}
.small{margin-top:26px;display:flex;gap:28px;align-items:center;font-size:32px;color:#a9afc4}
.url{color:#00e0be;font-weight:700}
.dot{width:8px;height:8px;border-radius:50%;background:#3b4266}
</style></head><body>
<div class="tape t1">${tape.concat(tape).join("   ·   ")}</div>
<div class="tape t2">${tape.slice().reverse().concat(tape).join("   ·   ")}</div>
<div class="safe">
  <div class="badge"><img src="${mark}" alt=""></div>
  <div>
    <div class="name">Jocular <span>Insights</span></div>
    <div class="line">Indian stock market results, quarter by quarter</div>
    <div class="small"><span class="url">jocularinsights.in</span><span class="dot"></span><span>From company filings</span><span class="dot"></span><span>Free</span></div>
  </div>
</div>
</body></html>`;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
await page.setContent(html, { waitUntil: "load" });
await page.screenshot({ path: OUT });
await browser.close();
console.log(OUT);
