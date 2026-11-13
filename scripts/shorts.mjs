// YouTube Shorts from a quarter's results (12 Nov 2026): vertical 1080×1920,
// about 20 seconds, the figures building one by one, then the site. Each frame
// is drawn at an exact moment of the animation (the page's animations paused
// and moved by hand), so nothing stutters, then ffmpeg joins the frames.
// Figures are typed in from the live results pages; check them before a run.
//   node scripts/shorts.mjs            all of them
//   node scripts/shorts.mjs w2-bel     one
// Writes replica/launch/shorts/<name>.mp4 (needs ffmpeg).
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "replica/launch/shorts");
const FPS = 30;
const mark = `data:image/svg+xml;base64,${readFileSync(join(ROOT, "public/jocular-insights-mark.svg")).toString("base64")}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// rows: [label, value, note, barNow 0–1, barThen 0–1]
const SHORTS = {
  "w2-banks": {
    kicker: "Q2 FY27 · Private banks", title: "HDFC earns more.<br>ICICI grows faster.",
    rows: [["HDFC Bank", "₹20,700 cr", "profit · up 5.6% from ₹19,611 cr", 20700 / 21500, 19611 / 21500],
      ["ICICI Bank", "₹17,312 cr", "profit · up 21.4% from ₹14,256 cr", 17312 / 21500, 14256 / 21500]],
    line: "ICICI's profit grew almost 4× as fast.",
    foot: "July–September 2026 against a year earlier, as filed with NSE. Not investment advice.",
    voice: {
      intro: "HDFC Bank or ICICI Bank. Who grew profit faster this quarter?",
      rows: ["HDFC Bank's profit: twenty thousand seven hundred crore. Up five point six percent.", "ICICI Bank's: seventeen thousand three hundred and twelve crore. Up twenty one point four percent."],
      line: "HDFC still earns more, but ICICI's profit grew almost four times as fast.",
      end: "Every company's results, free, on Jocular Insights dot in.",
    },
  },
  "w2-bel": {
    kicker: "Bharat Electronics · Q2 FY27", title: "Sales up 26.5%.<br>Costs up 29.3%.",
    rows: [["Sales", "₹7,328 cr", "from ₹5,792 cr", 7328 / 7600, 5792 / 7600],
      ["Operating margin", "27.9%", "from 29.4%", 27.9 / 31, 29.4 / 31],
      ["Net profit", "₹1,540 cr", "up 19.7% from ₹1,287 cr", 1540 / 1600, 1287 / 1600]],
    line: "Costs grew faster than sales, so the margin narrowed.",
    foot: "July–September 2026 against a year earlier, as filed with NSE. Not investment advice.",
    voice: {
      intro: "Bharat Electronics. Second quarter results.",
      rows: ["Sales: seven thousand three hundred and twenty eight crore. Up twenty six and a half percent.", "Operating margin: twenty seven point nine percent, down from twenty nine point four.", "Net profit: fifteen hundred and forty crore. Up nineteen point seven percent."],
      line: "Costs grew faster than sales, so the margin narrowed.",
      end: "Every company's results, free, on Jocular Insights dot in.",
    },
  },
  "w2-sterlite": {
    kicker: "Sterlite Technologies · Q2 FY27", title: "Margin from 12.5%<br>to 32.1%",
    rows: [["Sales", "₹2,529 cr", "up 145% from ₹1,034 cr", 2529 / 2600, 1034 / 2600],
      ["Operating margin", "32.1%", "from 12.5%", 32.1 / 34, 12.5 / 34],
      ["Net profit", "₹517 cr", "from ₹4 cr a year ago", 517 / 540, 4 / 540]],
    line: "One quarter, from a small base. Will the margin hold?",
    foot: "July–September 2026 against a year earlier, as filed with NSE. Not investment advice.",
    voice: {
      intro: "Sterlite Technologies. A margin that went from twelve to thirty two percent.",
      rows: ["Sales: two thousand five hundred and twenty nine crore. Up from one thousand and thirty four, a year ago.", "Operating margin: thirty two point one percent, from twelve point five.", "Net profit: five hundred and seventeen crore, from just four crore."],
      line: "One quarter, from a small base. Will the margin hold?",
      end: "Every company's results, free, on Jocular Insights dot in.",
    },
  },
};

// the timeline, in seconds: title, then each row, the line, the end card.
// With a voice-over (13 Nov 2026: silent Shorts get swiped away) each part
// lasts at least as long as its sentence, read by macOS's Indian English
// voice (Rishi), with a soft tick as each figure lands.
const INTRO = 2.2, ROW = 2.8, LINE = 3.2, END = 4.2, BREATH = 0.45;
const VOICE = "Rishi";
const plan = (s, said = null) => {
  const fit = (min, i) => Math.max(min, said ? said[i] + BREATH : 0);
  const intro = fit(INTRO, 0);
  const rows = s.rows.map((_, i) => fit(ROW, 1 + i));
  const line = fit(LINE, 1 + s.rows.length), end = fit(END, 2 + s.rows.length) + 0.4;
  const rowAt = rows.map((_, i) => intro + rows.slice(0, i).reduce((a, b) => a + b, 0));
  const lineAt = intro + rows.reduce((a, b) => a + b, 0);
  return { rowAt, lineAt, endAt: lineAt + line, total: lineAt + line + end, starts: [0.15, ...rowAt.map(t => t + 0.2), lineAt + 0.2, lineAt + line + 0.3] };
};

const page = (s, p) => {
  const rowAt = i => p.rowAt[i];
  const lineAt = p.lineAt;
  const endAt = p.endAt;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{font-family:-apple-system,"SF Pro Display","Helvetica Neue",Inter,sans-serif;-webkit-font-smoothing:antialiased;color:#f4f5fb;
background:radial-gradient(900px 700px at 100% 0%,rgba(0,224,190,.20),transparent 62%),radial-gradient(900px 700px at 0% 100%,rgba(62,121,255,.16),transparent 60%),#07080f}
/* inside the Shorts safe area: YouTube covers the bottom ~440px and the right edge */
.wrap{position:absolute;inset:0;padding:100px 170px 450px 84px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:20px;font-size:40px;font-weight:600;letter-spacing:-.02em}
.brand img{width:72px;height:72px;border-radius:18px}.brand span{color:#00e0be}
.kicker{margin-top:60px;font-size:30px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#00e0be}
h1{margin-top:16px;font-size:80px;line-height:1.04;font-weight:700;letter-spacing:-.04em}
.rows{margin-top:44px;display:flex;flex-direction:column;gap:22px}
.row{padding:22px 30px;border-radius:26px;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 2px rgba(255,255,255,.08)}
.name{font-size:32px;color:#a9afc4;font-weight:500}
.val{margin-top:4px;font-size:62px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.note{font-size:28px;color:#a9afc4;margin-top:2px}
.bar{margin-top:16px;height:16px;border-radius:8px;background:rgba(255,255,255,.08);overflow:hidden}
.bar+.bar{margin-top:10px}
.bar b{display:block;height:100%;border-radius:9px;background:#00e0be;transform-origin:left center}
.bar.then b{background:rgba(169,175,196,.55)}
.line{margin-top:36px;font-size:42px;line-height:1.25;font-weight:600;letter-spacing:-.01em}
.foot{margin-top:20px;font-size:24px;color:#7d84a0;line-height:1.4}
.end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;text-align:center;padding:0 170px 300px 90px;background:#07080f}
.end img{width:200px;height:200px;border-radius:46px}
.end h2{font-size:70px;line-height:1.08;letter-spacing:-.035em}
.end p{font-size:40px;color:#a9afc4;line-height:1.35}
.end .url{font-size:60px;font-weight:700;color:#00e0be}
@keyframes up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.a{opacity:0;animation:up .7s cubic-bezier(.2,.7,.2,1) forwards}
.f{opacity:0;animation:fade .6s ease-out forwards}
.g{transform:scaleX(0);animation:grow 1.1s cubic-bezier(.2,.7,.2,1) forwards}
</style></head><body><div class="wrap">
<div class="brand f" style="animation-delay:0s"><img src="${mark}" alt="">Jocular <span>Insights</span></div>
<div class="kicker a" style="animation-delay:.2s">${esc(s.kicker)}</div>
<h1 class="a" style="animation-delay:.45s">${s.title}</h1>
<div class="rows">${s.rows.map(([n, v, note, now, then], i) => `<div class="row a" style="animation-delay:${rowAt(i)}s"><div class="name">${esc(n)}</div><div class="val">${esc(v)}</div><div class="note">${esc(note)}</div>
<div class="bar"><b class="g" style="width:${(now * 100).toFixed(1)}%;animation-delay:${rowAt(i) + 0.35}s"></b></div><div class="bar then"><b class="g" style="width:${(then * 100).toFixed(1)}%;animation-delay:${rowAt(i) + 0.55}s"></b></div></div>`).join("")}</div>
<div class="line a" style="animation-delay:${lineAt}s">${esc(s.line)}</div>
<div class="foot f" style="animation-delay:${lineAt + 0.4}s">${esc(s.foot)}</div>
</div>
<div class="end f" style="animation-delay:${endAt}s"><img src="${mark}" alt=""><h2>Every company's results,<br>quarter by quarter</h2><p>Free, from the companies' own filings with NSE</p><div class="url">jocularinsights.in</div></div>
</body></html>`;
};

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(SHORTS);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const name of names) {
  const s = SHORTS[name];
  if (!s) { console.error(`no short called ${name}`); continue; }
  const frames = join(tmpdir(), `short-${name}-${process.pid}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  // the voice-over first, so the timeline can fit it
  let said = null, clips = null;
  if (s.voice) {
    const parts = [s.voice.intro, ...s.voice.rows, s.voice.line, s.voice.end];
    clips = parts.map((text, i) => join(frames, `voice-${i}.aiff`));
    parts.forEach((text, i) => execFileSync("say", ["-v", VOICE, "-r", "178", "-o", clips[i], text]));
    said = clips.map(f => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()));
  }
  const p = plan(s, said);
  await tab.setContent(page(s, p), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts?.ready);
  const total = Math.round(p.total * FPS);
  for (let f = 0; f < total; f++) {
    const ms = (f / FPS) * 1000;
    await tab.evaluate(t => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, ms);
    await tab.screenshot({ path: join(frames, `${String(f).padStart(5, "0")}.png`) });
  }
  const file = join(OUT, `${name}.mp4`);
  const video = ["-framerate", String(FPS), "-i", join(frames, "%05d.png")];
  const enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart"];
  if (clips) {
    // each sentence at its part's start; a short soft tick as each row lands
    const ticks = p.rowAt.map(t => t + 0.35);
    const inputs = [...clips.flatMap(f => ["-i", f]), ...ticks.flatMap(() => ["-f", "lavfi", "-i", "sine=frequency=1320:duration=0.06"])];
    const delayed = [
      ...clips.map((_, i) => `[${i + 1}:a]adelay=${Math.round(p.starts[i] * 1000)}:all=1,volume=1.15[v${i}]`),
      ...ticks.map((t, j) => `[${clips.length + 1 + j}:a]afade=t=out:st=0.01:d=0.05,volume=0.25,adelay=${Math.round(t * 1000)}:all=1[t${j}]`),
    ];
    const mix = `${clips.map((_, i) => `[v${i}]`).join("")}${ticks.map((_, j) => `[t${j}]`).join("")}amix=inputs=${clips.length + ticks.length}:normalize=0,apad,atrim=0:${p.total.toFixed(2)},alimiter=limit=0.89[a]`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...video, ...inputs, "-filter_complex", [...delayed, mix].join(";"),
      "-map", "0:v", "-map", "[a]", ...enc, "-c:a", "aac", "-b:a", "160k", "-shortest", file]);
  } else {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...video, ...enc, file]);
  }
  rmSync(frames, { recursive: true, force: true });
  console.log(`${file} · ${(total / FPS).toFixed(1)} s`);
}
await browser.close();
