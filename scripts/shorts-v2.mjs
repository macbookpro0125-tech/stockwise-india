// Shorts, second style (13 Nov 2026, "they're like simple videos"): one
// company's quarter told in moving scenes — its logo, the profit change as a
// big counted-up stamp, sales and margin counting up, the last eight quarters'
// profit drawn as a line, then the site. Figures come from the company's live
// results page (its own tables), never typed. Every frame is drawn by
// render(t) in the page, so nothing stutters, then ffmpeg joins them.
// Silent: music is added on YouTube from its library.
//   node scripts/shorts-v2.mjs HAL [q2-fy27]  → replica/launch/shorts/v2-hal.mp4
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "replica/launch/shorts");
const SITE = "https://jocularinsights.in";
const FPS = 30, LENGTH = 21;
const [symbol, slug = "q2-fy27"] = process.argv.slice(2);
if (!symbol) { console.error("usage: node scripts/shorts-v2.mjs SYMBOL [q2-fy27]"); process.exit(1); }

// ── the figures, from the live results page ──
const url = `${SITE}/stock/${encodeURIComponent(symbol)}/results/${slug}`;
const html = await (await fetch(url, { headers: { "User-Agent": "JocularShorts/2.0" } })).text();
const text = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const h1 = text(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
const name = h1.replace(/\s+Q\d FY\d\d results$/, "");
const label = h1.match(/(Q\d FY\d\d)/)?.[1];
const table = html.slice(html.indexOf("rq-table"));
const rows = new Map([...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => text(c[1]))).filter(r => r.length >= 4).map(r => [r[0], r]));
const n = s => (s == null || s === "—" ? null : Number(s.replace(/[,%₹ ]/g, "").replace("−", "-").replace("pts", "")));
const get = k => { const r = rows.get(k); return r && { now: n(r[1]), then: n(r[2]), change: r[3] }; };
const sales = get("Sales"), margin = get("Operating margin %"), profit = get("Net profit");
const yearAgo = rows.get("Item")?.[2];
const profSec = html.slice(html.indexOf("Net profit, quarter by quarter"));
const qVals = [...profSec.matchAll(/rq-bar-v">([^<]*)</g)].slice(0, 8).map(m => n(m[1]));
const qLabels = [...profSec.matchAll(/rq-bar-l">([^<]*)</g)].slice(0, 8).map(m => m[1]);
if (!label || !sales || !profit || !(profit.now > 0) || !(profit.then > 0) || qVals.length < 4) throw new Error(`${url}: not enough figures for this style`);
const logoFile = join(ROOT, "data/logos", `${symbol}.img`);
const logoMeta = existsSync(`${logoFile.slice(0, -4)}.json`) ? JSON.parse(readFileSync(`${logoFile.slice(0, -4)}.json`, "utf-8")) : null;
const logo = existsSync(logoFile) && logoMeta?.type?.startsWith("image/") ? `data:${logoMeta.type};base64,${readFileSync(logoFile).toString("base64")}` : null;
const mark = `data:image/svg+xml;base64,${readFileSync(join(ROOT, "public/jocular-insights-mark.svg")).toString("base64")}`;

const data = { name, label, yearAgo, sales, margin, profit, qVals, qLabels, logo, mark, initials: name.split(/\s+/).map(w => w[0]).join("").slice(0, 3) };

// ── the page: every element placed by render(t) ──
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#06070d}
body{font-family:-apple-system,"SF Pro Display","Helvetica Neue",Inter,sans-serif;-webkit-font-smoothing:antialiased;color:#f4f5fb}
#bg{position:absolute;inset:-200px;background:radial-gradient(800px 700px at 85% 25%,rgba(0,224,190,.22),transparent 65%),radial-gradient(900px 800px at 10% 85%,rgba(62,121,255,.20),transparent 62%)}
#progress{position:absolute;left:0;top:0;height:10px;background:#00e0be;box-shadow:0 0 24px #00e0be}
#cam{position:absolute;inset:0;transform-origin:50% 45%}
.scene{position:absolute;left:84px;right:170px;top:330px;bottom:430px;display:flex;flex-direction:column;justify-content:center;opacity:0}
.brand{position:absolute;left:84px;top:330px;display:flex;align-items:center;gap:16px;font-size:34px;font-weight:600;opacity:0}
.brand img{width:56px;height:56px;border-radius:14px}.brand span{color:#00e0be}
.logo{width:190px;height:190px;border-radius:44px;background:#fff;display:grid;place-items:center;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}
.logo img{max-width:150px;max-height:120px}.logo b{font-size:80px;color:#0b1028}
.co{margin-top:40px;font-size:74px;font-weight:800;letter-spacing:-.04em;line-height:1.02}
.sub{margin-top:18px;font-size:40px;color:#a9afc4;font-weight:500}
.kick{font-size:34px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#00e0be}
.stamp{margin-top:10px;font-size:260px;font-weight:900;letter-spacing:-.06em;line-height:.95;font-variant-numeric:tabular-nums}
.stamp.up{color:#00e0be}.stamp.down{color:#ff5a6a}
.fromto{margin-top:26px;font-size:50px;font-weight:600;font-variant-numeric:tabular-nums}
.fromto small{display:block;font-size:32px;color:#a9afc4;font-weight:500;margin-top:8px}
#flash{position:absolute;inset:0;background:#00e0be;opacity:0;mix-blend-mode:screen}
.card{padding:30px 34px;border-radius:30px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 2px rgba(255,255,255,.09);margin-bottom:26px}
.card .l{font-size:34px;color:#a9afc4;font-weight:600}
.card .v{margin-top:6px;font-size:96px;font-weight:800;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.chip{display:inline-block;margin-top:10px;padding:8px 20px;border-radius:999px;font-size:34px;font-weight:700}
.chip.up{background:rgba(0,224,190,.16);color:#00e0be}.chip.down{background:rgba(255,90,106,.16);color:#ff7b88}
.chart{position:relative}
.chart svg{width:100%;height:640px;overflow:visible}
.ql{font-size:24px;fill:#7d84a0}.qv{font-size:30px;font-weight:700;fill:#f4f5fb}
.line{margin-top:10px;font-size:52px;line-height:1.2;font-weight:700;letter-spacing:-.02em}
.foot{margin-top:26px;font-size:28px;color:#7d84a0;line-height:1.4}
.end{align-items:center;text-align:center}
.end img{width:200px;height:200px;border-radius:46px}
.end h2{margin-top:40px;font-size:72px;letter-spacing:-.035em;line-height:1.05}
.end p{margin-top:24px;font-size:40px;color:#a9afc4}
.end .url{margin-top:34px;font-size:62px;font-weight:800;color:#00e0be}
</style></head><body><div id="bg"></div><div id="cam">
<div class="brand" id="brand"><img src="${data.mark}" alt="">Jocular <span>Insights</span></div>
<section class="scene" id="s1"><div class="logo" id="logo">${data.logo ? `<img src="${data.logo}" alt="">` : `<b>${data.initials}</b>`}</div><div class="co">${data.name}</div><div class="sub">${data.label} results · as filed with NSE</div></section>
<section class="scene" id="s2"><div class="kick">Net profit vs a year ago</div><div class="stamp ${data.profit.now >= data.profit.then ? "up" : "down"}" id="stamp">0%</div><div class="fromto" id="fromto"></div></section>
<section class="scene" id="s3"><div class="card"><div class="l">Sales</div><div class="v" id="salesV">₹0 cr</div><span class="chip ${data.sales.now >= data.sales.then ? "up" : "down"}" id="salesC">${data.sales.change} vs ${data.yearAgo}</span></div>${data.margin && data.margin.now != null ? `<div class="card"><div class="l">Operating margin</div><div class="v" id="marV">0%</div><span class="chip ${data.margin.now >= data.margin.then ? "up" : "down"}">from ${data.margin.then}%</span></div>` : ""}</section>
<section class="scene" id="s4"><div class="kick">Net profit, last ${data.qVals.length} quarters (₹ cr)</div><div class="chart"><svg viewBox="0 0 826 640" id="chart"></svg></div></section>
<section class="scene" id="s5"><div class="line" id="verdict"></div><div class="foot">${data.label} against ${data.yearAgo}, as filed with NSE. Not investment advice.</div></section>
<section class="scene end" id="s6"><img src="${data.mark}" alt=""><h2>Every company's results,<br>free</h2><p>Quarter by quarter, from their own filings</p><div class="url">jocularinsights.in</div></section>
</div><div id="flash"></div><div id="progress"></div>
<script>
const D = ${JSON.stringify({ ...data, logo: null, mark: null })};
const LEN = ${LENGTH};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 3);
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const span = (t, a, b) => clamp((t - a) / (b - a));
const fmt = v => Math.round(v).toLocaleString("en-IN");
const pctTxt = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%";
const $ = id => document.getElementById(id);
// scenes: [id, in, out]
const S = [["s1", 0.2, 3.0], ["s2", 3.0, 7.6], ["s3", 7.6, 11.8], ["s4", 11.8, 16.4], ["s5", 16.4, 18.4], ["s6", 18.4, LEN + 1]];
const profitPct = (D.profit.now / D.profit.then - 1) * 100;
// the chart, drawn once; its line revealed by dash offset
const W = 826, H = 640, P = { l: 10, r: 10, t: 60, b: 70 };
const vals = D.qVals, mx = Math.max(...vals.map(v => v ?? 0)) * 1.12, mn = Math.min(0, ...vals.map(v => v ?? 0));
const X = i => P.l + (i * (W - P.l - P.r)) / (vals.length - 1), Y = v => P.t + (1 - (v - mn) / (mx - mn)) * (H - P.t - P.b);
const pts = vals.map((v, i) => [X(i), Y(v ?? 0)]);
const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
$("chart").innerHTML = '<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00e0be" stop-opacity=".35"/><stop offset="1" stop-color="#00e0be" stop-opacity="0"/></linearGradient></defs>'
  + '<path id="area" d="' + path + ' L' + X(vals.length - 1) + ' ' + Y(mn) + ' L' + X(0) + ' ' + Y(mn) + ' Z" fill="url(#ar)" opacity="0"/>'
  + '<path id="ln" d="' + path + '" fill="none" stroke="#00e0be" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
  + pts.map((p, i) => '<circle id="dot' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === vals.length - 1 ? 16 : 9) + '" fill="' + (i === vals.length - 1 ? "#fff" : "#00e0be") + '" opacity="0"/>'
    + '<text class="ql" x="' + p[0] + '" y="' + (H - 20) + '" text-anchor="' + (i === 0 ? "start" : i === vals.length - 1 ? "end" : "middle") + '">' + D.qLabels[i].replace(" FY", "\\u00a0") + '</text>').join("")
  + '<text id="lastv" class="qv" x="' + pts[pts.length - 1][0] + '" y="' + (pts[pts.length - 1][1] - 34) + '" text-anchor="end" opacity="0">₹' + fmt(vals[vals.length - 1]) + ' cr</text>';
const LL = $("ln").getTotalLength();
$("ln").style.strokeDasharray = LL;
$("verdict").textContent = "Profit " + (profitPct >= 0 ? "up " : "down ") + Math.abs(profitPct).toFixed(1) + "%, sales " + (D.sales.change.startsWith("−") ? "down " : "up ") + D.sales.change.replace(/^[+−]/, "") + " on a year earlier.";
window.render = t => {
  $("progress").style.width = (clamp(t / LEN) * 1080) + "px";
  $("brand").style.opacity = t < 18.4 ? ease(span(t, 0, .5)) : 1 - ease(span(t, 18.4, 18.8));
  for (const [id, a, b] of S) {
    const el = $(id), inn = ease(span(t, a, a + .45)), out = ease(span(t, b - .35, b));
    el.style.opacity = inn * (1 - out);
    el.style.transform = "translateY(" + ((1 - inn) * 70 - out * 70) + "px)";
  }
  // scene 1: the logo pops
  const lp = back(span(t, .3, 1.0)); $("logo").style.transform = "scale(" + (.4 + .6 * lp) + ") rotate(" + ((1 - lp) * -8) + "deg)";
  // scene 2: the profit change counted up, a flash when it lands, a slow push-in
  const cu = ease(span(t, 3.2, 4.9));
  $("stamp").textContent = pctTxt(profitPct * cu);
  $("stamp").style.transform = "scale(" + (1 + .08 * back(span(t, 4.9, 5.3)) - .08 * span(t, 5.3, 5.6)) + ")";
  $("fromto").innerHTML = "₹" + fmt(D.profit.then) + " cr → ₹" + fmt(D.profit.then + (D.profit.now - D.profit.then) * cu) + " cr<small>" + D.yearAgo + " → " + D.label + "</small>";
  $("flash").style.opacity = .35 * (span(t, 4.9, 5.0) - span(t, 5.0, 5.5));
  // scene 3: sales and margin counted up
  const c3 = ease(span(t, 7.8, 9.4));
  $("salesV").textContent = "₹" + fmt(D.sales.now * c3) + " cr";
  if ($("marV")) $("marV").textContent = (D.margin.now * ease(span(t, 8.4, 9.9))).toFixed(1) + "%";
  // scene 4: the line drawn left to right, dots as it passes, the last one labelled
  const dr = ease(span(t, 12.1, 14.6));
  $("ln").style.strokeDashoffset = LL * (1 - dr);
  $("area").setAttribute("opacity", ease(span(t, 14.2, 14.9)));
  vals.forEach((_, i) => $("dot" + i).setAttribute("opacity", dr >= i / (vals.length - 1) - .001 ? 1 : 0));
  $("lastv").setAttribute("opacity", ease(span(t, 14.6, 15.0)));
  // the camera: a slow push-in on each scene
  const z = t < 3 ? span(t, 0, 3) : t < 7.6 ? span(t, 3, 7.6) : t < 11.8 ? span(t, 7.6, 11.8) : t < 16.4 ? span(t, 11.8, 16.4) : span(t, 16.4, LEN);
  $("cam").style.transform = "scale(" + (1 + .035 * z) + ")";
};
render(0);
</script></body></html>`;

mkdirSync(OUT, { recursive: true });
const key = `v2-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const frames = join(tmpdir(), `short-${key}-${process.pid}`);
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await tab.setContent(page, { waitUntil: "load" });
await tab.evaluate(() => document.fonts?.ready);
const total = LENGTH * FPS;
for (let f = 0; f < total; f++) {
  await tab.evaluate(t => window.render(t), f / FPS);
  await tab.screenshot({ path: join(frames, `${String(f).padStart(5, "0")}.png`) });
}
await browser.close();
const file = join(OUT, `${key}.mp4`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "%05d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", file]);
rmSync(frames, { recursive: true, force: true });
console.log(`${file} · ${LENGTH} s`);
