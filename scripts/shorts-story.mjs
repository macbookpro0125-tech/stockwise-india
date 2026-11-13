// Shorts, story style (13 Nov 2026, "I don't feel it's correct"): one point
// per video, worked out from the company's own results table on its live page
// — a hook in the first second ("HAL's profit rose 16%… but its margin
// fell."), the proof one big figure at a time, the reason, the last eight
// quarters, then the site. Every scene fills the screen. Silent: music is
// added on YouTube from its library.
//   node scripts/shorts-story.mjs HAL [q2-fy27] → replica/launch/shorts/story-hal.mp4 (+ .txt)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "replica/launch/shorts");
const SITE = "https://jocularinsights.in";
const FPS = 30, LENGTH = 22;
const [symbol, slug = "q2-fy27"] = process.argv.slice(2);
if (!symbol) { console.error("usage: node scripts/shorts-story.mjs SYMBOL [q2-fy27]"); process.exit(1); }

// ── the figures, from the live results page ──
const url = `${SITE}/stock/${encodeURIComponent(symbol)}/results/${slug}`;
const html = await (await fetch(url, { headers: { "User-Agent": "JocularShorts/3.0" } })).text();
const text = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const h1 = text(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
const name = h1.replace(/\s+Q\d FY\d\d results$/, "");
const label = h1.match(/(Q\d FY\d\d)/)?.[1];
const table = html.slice(html.indexOf("rq-table"));
const rows = new Map([...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => text(c[1]))).filter(r => r.length >= 4).map(r => [r[0], r]));
const n = s => (s == null || s === "—" ? null : Number(s.replace(/[,%₹ ]/g, "").replace("−", "-").replace("pts", "")));
const get = k => { const r = rows.get(k); return r && { now: n(r[1]), then: n(r[2]), change: r[3], pct: r[3]?.includes("%") ? n(r[3]) : null }; };
const sales = get("Sales"), costs = get("Operating costs"), margin = get("Operating margin %"), profit = get("Net profit");
const yearAgo = rows.get("Item")?.[2];
const profSec = html.slice(html.indexOf("Net profit, quarter by quarter"));
const qVals = [...profSec.matchAll(/rq-bar-v">([^<]*)</g)].slice(0, 8).map(m => n(m[1]));
const qLabels = [...profSec.matchAll(/rq-bar-l">([^<]*)</g)].slice(0, 8).map(m => m[1]);
if (!label || !sales || !profit || profit.then == null || !(profit.then > 0) || !(profit.now > 0)) throw new Error(`${url}: needs a profit in both quarters for this style`);
const short = name.replace(/ (Limited|Ltd\.?|India)$/i, "");
const poss = /s$/i.test(short) ? `${short}'` : `${short}'s`;
const p1 = v => `${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`;
const profitPct = (profit.now / profit.then - 1) * 100;
const marginUp = margin?.now != null && margin?.then != null ? margin.now >= margin.then : null;

// ── the one point: the hook, and what proves it ──
let hook, twist, twistTone, proof2, why;
if (profitPct >= 0 && marginUp === false) {
  hook = `${poss} profit rose ${p1(profitPct)}…`; twist = "…but its margin fell."; twistTone = "down";
  proof2 = { label: "Operating margin", value: `${margin.now}%`, sub: `from ${margin.then}% a year ago`, tone: "down" };
} else if (profitPct >= 0 && marginUp) {
  hook = `${poss} profit rose ${p1(profitPct)}…`; twist = "…and it kept more of every rupee."; twistTone = "up";
  proof2 = { label: "Operating margin", value: `${margin.now}%`, sub: `up from ${margin.then}%`, tone: "up" };
} else if (profitPct < 0 && sales.pct > 0) {
  hook = `${poss} sales rose ${p1(sales.pct)}…`; twist = `…but profit fell ${p1(profitPct)}.`; twistTone = "down";
  proof2 = { label: "Sales", value: `₹${Math.round(sales.now).toLocaleString("en-IN")} cr`, sub: `${sales.change} from ₹${Math.round(sales.then).toLocaleString("en-IN")} cr`, tone: "up" };
} else {
  hook = `${poss} profit fell ${p1(profitPct)}…`; twist = sales.pct < 0 ? `…and sales fell ${p1(sales.pct)}.` : "…here's what changed."; twistTone = "down";
  proof2 = { label: "Sales", value: `₹${Math.round(sales.now).toLocaleString("en-IN")} cr`, sub: `${sales.change} from ₹${Math.round(sales.then).toLocaleString("en-IN")} cr`, tone: sales.pct >= 0 ? "up" : "down" };
}
// the reason, when the table has it: costs against sales
if (costs?.pct != null && sales?.pct != null) {
  why = costs.pct > sales.pct
    ? { line: "Costs grew faster than sales", a: ["Costs", costs.pct], b: ["Sales", sales.pct], tone: "down" }
    : { line: "Sales grew faster than costs", a: ["Sales", sales.pct], b: ["Costs", costs.pct], tone: "up" };
}

const mark = `data:image/svg+xml;base64,${readFileSync(join(ROOT, "public/jocular-insights-mark.svg")).toString("base64")}`;
const D = { short, poss, label, yearAgo, hook, twist, twistTone, proof2, why, profit, profitPct, qVals, qLabels };

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:#05060b}
body{font-family:-apple-system,"SF Pro Display","Helvetica Neue",Inter,sans-serif;-webkit-font-smoothing:antialiased;color:#f6f7fb}
#bg{position:absolute;inset:0;background:radial-gradient(900px 900px at 80% 30%,rgba(0,224,190,.20),transparent 60%),radial-gradient(900px 900px at 15% 80%,rgba(62,121,255,.18),transparent 60%)}
#ghost{position:absolute;right:-60px;top:560px;font-size:620px;font-weight:900;letter-spacing:-.08em;color:rgba(255,255,255,.035);white-space:nowrap}
#progress{position:absolute;left:0;top:0;height:10px;background:#00e0be;box-shadow:0 0 24px #00e0be}
#cam{position:absolute;inset:0;transform-origin:50% 50%}
.brand{position:absolute;left:80px;top:330px;display:flex;align-items:center;gap:16px;font-size:34px;font-weight:600}
.brand img{width:56px;height:56px;border-radius:14px}.brand span{color:#00e0be}
.scene{position:absolute;left:80px;right:160px;top:430px;bottom:430px;display:flex;flex-direction:column;justify-content:center;opacity:0}
.hook{font-size:118px;font-weight:900;letter-spacing:-.05em;line-height:1.0}
.twist{margin-top:40px;font-size:96px;font-weight:900;letter-spacing:-.045em;line-height:1.02}
.up{color:#00e0be}.down{color:#ff5a6a}
.lab{font-size:44px;font-weight:700;color:#a9afc4}
.big{margin-top:10px;font-size:200px;font-weight:900;letter-spacing:-.06em;line-height:.95;font-variant-numeric:tabular-nums}
.sub{margin-top:26px;font-size:52px;font-weight:600;color:#d6dae8}
.pill{display:inline-block;margin-top:30px;padding:12px 30px;border-radius:999px;font-size:48px;font-weight:800}
.pill.up{background:rgba(0,224,190,.16)}.pill.down{background:rgba(255,90,106,.16)}
.why{font-size:84px;font-weight:900;letter-spacing:-.045em;line-height:1.04}
.race{margin-top:60px}.lane{margin-bottom:44px}.lane .k{display:flex;justify-content:space-between;font-size:50px;font-weight:800}
.track{margin-top:14px;height:46px;border-radius:23px;background:rgba(255,255,255,.08);overflow:hidden}.track b{display:block;height:100%;border-radius:23px}
.chart svg{width:100%;height:760px;overflow:visible}.ql{font-size:26px;fill:#8a91ad}.qv{font-size:40px;font-weight:800;fill:#fff}
.end{align-items:center;text-align:center}.end img{width:220px;height:220px;border-radius:50px}
.end h2{margin-top:44px;font-size:84px;letter-spacing:-.04em;line-height:1.02}.end p{margin-top:26px;font-size:44px;color:#a9afc4}
.end .url{margin-top:40px;font-size:68px;font-weight:900;color:#00e0be}
.foot{position:absolute;left:80px;right:160px;top:1440px;font-size:26px;color:#6f7694;opacity:0}
</style></head><body><div id="bg"></div><div id="ghost"></div><div id="cam">
<div class="brand" id="brand"><img src="${mark}" alt="">Jocular <span>Insights</span></div>
<section class="scene" id="s1"><div class="hook" id="hook"></div><div class="twist ${D.twistTone}" id="twist"></div></section>
<section class="scene" id="s2"><div class="lab">Net profit · ${D.label}</div><div class="big" id="p2"></div><div class="sub">from ₹${Math.round(D.profit.then).toLocaleString("en-IN")} cr a year ago</div><div><span class="pill ${D.profitPct >= 0 ? "up" : "down"}">${D.profitPct >= 0 ? "▲" : "▼"} ${Math.abs(D.profitPct).toFixed(1)}%</span></div></section>
<section class="scene" id="s3"><div class="lab">${D.proof2.label}</div><div class="big ${D.proof2.tone}">${D.proof2.value}</div><div class="sub">${D.proof2.sub}</div></section>
${D.why ? `<section class="scene" id="s4"><div class="why">${D.why.line}</div><div class="race">${[D.why.a, D.why.b].map((l, i) => `<div class="lane"><div class="k"><span>${l[0]}</span><span id="rv${i}">0%</span></div><div class="track"><b id="rb${i}" style="background:${i === 0 ? (D.why.tone === "down" ? "#ff5a6a" : "#00e0be") : "#8a91ad"}"></b></div></div>`).join("")}</div><div class="sub" style="font-size:36px;color:#8a91ad">${D.label} against ${D.yearAgo}</div></section>` : ""}
<section class="scene" id="s5"><div class="lab">Net profit, last ${D.qVals.length} quarters</div><div class="chart"><svg viewBox="0 0 840 760" id="chart"></svg></div></section>
<section class="scene end" id="s6"><img src="${mark}" alt=""><h2>${D.poss} full results,<br>free</h2><p>Every NSE company, from its own filings</p><div class="url">jocularinsights.in</div></section>
<div class="foot" id="foot">${D.label} against ${D.yearAgo}, as filed with NSE. Not investment advice.</div>
</div><div id="progress"></div>
<script>
const D = ${JSON.stringify(D)}, LEN = ${LENGTH};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => 1 - Math.pow(1 - clamp(x), 3);
const back = x => { x = clamp(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const span = (t, a, b) => clamp((t - a) / (b - a));
const $ = id => document.getElementById(id);
const fmt = v => Math.round(v).toLocaleString("en-IN");
const hasWhy = !!D.why;
// scenes: [id, in, out]; without a reason scene the others share its time
const S = hasWhy
  ? [["s1", 0, 4.2], ["s2", 4.2, 7.9], ["s3", 7.9, 11.4], ["s4", 11.4, 15.4], ["s5", 15.4, 19.0], ["s6", 19.0, LEN + 1]]
  : [["s1", 0, 4.6], ["s2", 4.6, 9.0], ["s3", 9.0, 13.2], ["s5", 13.2, 18.4], ["s6", 18.4, LEN + 1]];
const at = id => S.find(s => s[0] === id);
// the hook typed out word by word
const hw = D.hook.split(" "), tw = D.twist.split(" ");
// the chart
const W = 840, H = 760, P = { l: 10, r: 10, t: 80, b: 80 };
const vals = D.qVals, mx = Math.max(...vals.map(v => v ?? 0)) * 1.12, mn = Math.min(0, ...vals.map(v => v ?? 0));
const X = i => P.l + (i * (W - P.l - P.r)) / (vals.length - 1), Y = v => P.t + (1 - (v - mn) / (mx - mn)) * (H - P.t - P.b);
const pts = vals.map((v, i) => [X(i), Y(v ?? 0)]);
const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
$("chart").innerHTML = '<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00e0be" stop-opacity=".35"/><stop offset="1" stop-color="#00e0be" stop-opacity="0"/></linearGradient></defs><path id="area" d="' + path + ' L' + X(vals.length - 1) + ' ' + Y(mn) + ' L' + X(0) + ' ' + Y(mn) + ' Z" fill="url(#ar)" opacity="0"/><path id="ln" d="' + path + '" fill="none" stroke="#00e0be" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'
  + pts.map((p, i) => '<circle id="dot' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === vals.length - 1 ? 20 : 10) + '" fill="' + (i === vals.length - 1 ? "#fff" : "#00e0be") + '" opacity="0"/><text class="ql" x="' + p[0] + '" y="' + (H - 20) + '" text-anchor="' + (i === 0 ? "start" : i === vals.length - 1 ? "end" : "middle") + '">' + D.qLabels[i].replace(" FY", "\\u00a0") + '</text>').join("")
  + '<text id="lastv" class="qv" x="' + pts[pts.length - 1][0] + '" y="' + (pts[pts.length - 1][1] - 40) + '" text-anchor="end" opacity="0">₹' + fmt(vals[vals.length - 1]) + ' cr</text>';
const LL = $("ln").getTotalLength(); $("ln").style.strokeDasharray = LL;
window.render = t => {
  $("progress").style.width = clamp(t / LEN) * 1080 + "px";
  const endAt = at("s6")[1];
  $("brand").style.opacity = 1 - ease(span(t, endAt, endAt + .4));
  $("foot").style.opacity = ease(span(t, at("s2")[1], at("s2")[1] + .4)) * (1 - ease(span(t, endAt, endAt + .3)));
  for (const [id, a, b] of S) {
    const el = $(id), inn = id === "s1" ? 1 : ease(span(t, a, a + .4)), out = ease(span(t, b - .3, b));
    el.style.opacity = (id === "s1" ? 1 : inn) * (1 - out);
    el.style.transform = "translateY(" + ((1 - inn) * 80 - out * 60) + "px)";
  }
  // 1: the hook word by word, the twist after a beat
  const hk = Math.floor(clamp(t / 1.2) * hw.length + (t > 0.05 ? 1 : 0));
  $("hook").textContent = hw.slice(0, Math.min(hw.length, hk)).join(" ");
  const tk = Math.floor(span(t, 1.8, 2.8) * tw.length + (t > 1.8 ? 1 : 0));
  $("twist").textContent = tw.slice(0, Math.min(tw.length, tk)).join(" ");
  $("twist").style.transform = "scale(" + (1 + .06 * (span(t, 2.8, 3.0) - span(t, 3.0, 3.3))) + ")";
  // 2: the profit counted up, then held
  const s2 = at("s2")[1], c2 = ease(span(t, s2 + .2, s2 + 1.3));
  $("p2").textContent = "₹" + fmt(D.profit.then + (D.profit.now - D.profit.then) * c2) + " cr";
  // 4: the race
  if (hasWhy) { const s4 = at("s4")[1], rc = ease(span(t, s4 + .4, s4 + 1.8)), top = Math.max(Math.abs(D.why.a[1]), Math.abs(D.why.b[1])) * 1.15;
    [D.why.a, D.why.b].forEach((l, i) => { $("rb" + i).style.width = (Math.abs(l[1]) / top * 100 * rc) + "%"; $("rv" + i).textContent = (l[1] >= 0 ? "+" : "−") + (Math.abs(l[1]) * rc).toFixed(1) + "%"; }); }
  // 5: the line drawn
  const s5 = at("s5")[1], dr = ease(span(t, s5 + .3, s5 + 2.0));
  $("ln").style.strokeDashoffset = LL * (1 - dr);
  $("area").setAttribute("opacity", ease(span(t, s5 + 1.8, s5 + 2.4)));
  vals.forEach((_, i) => $("dot" + i).setAttribute("opacity", dr >= i / (vals.length - 1) - .001 ? 1 : 0));
  $("lastv").setAttribute("opacity", ease(span(t, s5 + 2.0, s5 + 2.4)));
  // a big faint figure behind each scene, and a slow push-in
  $("ghost").textContent = t >= at("s2")[1] && t < at("s3")[1] ? Math.round(Math.abs(D.profitPct)) + "%" : "";
  const cur = S.find(s => t >= s[1] && t < s[2]) ?? S[0];
  $("cam").style.transform = "scale(" + (1 + .03 * span(t, cur[1], cur[2])) + ")";
};
render(0);
</script></body></html>`;

mkdirSync(OUT, { recursive: true });
const key = `story-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const frames = join(tmpdir(), `short-${key}-${process.pid}`);
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await tab.setContent(page, { waitUntil: "load" });
await tab.evaluate(() => document.fonts?.ready);
for (let f = 0; f < LENGTH * FPS; f++) {
  await tab.evaluate(t => window.render(t), f / FPS);
  await tab.screenshot({ path: join(frames, `${String(f).padStart(5, "0")}.png`) });
}
await browser.close();
const file = join(OUT, `${key}.mp4`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", file]);
rmSync(frames, { recursive: true, force: true });
const title = `${D.hook.replace("…", "")}, ${D.twist.replace(/^…/, "").replace(/\.$/, "")} | ${label} results #Shorts`.slice(0, 100);
const desc = `${name} ${label} vs ${yearAgo}, as filed with NSE: sales ₹${Math.round(sales.now).toLocaleString("en-IN")} cr (${sales.change})${margin?.now != null ? `, operating margin ${margin.now}% (${margin.then}%)` : ""}, net profit ₹${Math.round(profit.now).toLocaleString("en-IN")} cr (${profit.change}).\n\nThe full quarter, line by line: ${url}\n\nFigures as filed with NSE. Not investment advice.\n\n#${short.replace(/[^A-Za-z0-9]/g, "")} #${label.replace(" ", "")}Results #StockMarketIndia`;
writeFileSync(join(OUT, `${key}.txt`), `TITLE:\n${title}\n\nDESCRIPTION:\n${desc}\n`);
console.log(JSON.stringify({ video: file, title }, null, 2));
