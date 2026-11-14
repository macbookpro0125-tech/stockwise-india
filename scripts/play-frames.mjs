// Store-style Play screenshots (14 Nov 2026, owner: didn't like the plain
// ones): a headline over the app in a phone frame, on the brand's navy.
// Uses the raw shots from scripts/play-assets.mjs; writes replica/launch/play/framed/.
//   node scripts/play-frames.mjs
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// PLAY_THEME=light: the light-theme shots on a light background (14 Nov 2026)
const LIGHT = process.env.PLAY_THEME === "light";
// PLAY_BG=first: the first background (near-black with a navy top and a teal glow), to compare (14 Nov 2026)
const FIRST = process.env.PLAY_BG === "first";
const IN = join(ROOT, "replica/launch/play"), OUT = join(IN, LIGHT ? "framed-light" : FIRST ? "framed-first" : "framed");
// The background must stand apart from the phone's screen (owner, 14 Nov:
// "background is black and the screen is also black"): a bright teal-to-indigo
// sky behind the dark app; a soft pale one behind the light app
const LOOK0 = LIGHT ? {
  bg: "radial-gradient(70% 38% at 12% 6%, rgba(150,130,255,.40), transparent 70%),radial-gradient(60% 34% at 95% 20%, rgba(90,160,255,.35), transparent 70%),radial-gradient(80% 40% at 50% 100%, rgba(0,200,170,.35), transparent 70%),linear-gradient(180deg,#F1EEFF 0%,#EEF4FF 50%,#E4F8F3 100%)",
  ink: "#0B1024", eyebrow: "#3A4466", sub: "#5B6585", em: "linear-gradient(90deg,#009C86,#3D63E0)",
  edge: "linear-gradient(135deg,#c9cdd8 0%,#8b909e 18%,#5d6270 50%,#9da2b0 82%,#d4d8e2 100%)", shadow: "0 70px 120px -30px rgba(30,40,90,.45),0 20px 40px rgba(30,40,90,.15)", sbInk: "#0B1024", screen: "#ffffff",
} : {
  // (owner, 14 Nov: back to the calm navy, clearly lighter than the app's near-black screen, with a soft glow behind the phone)
  bg: "radial-gradient(60% 36% at 50% 62%, rgba(46,240,207,.32), transparent 72%),radial-gradient(45% 30% at 50% 55%, rgba(140,170,255,.22), transparent 70%),radial-gradient(90% 45% at 50% 0%, #34407e 0%, transparent 70%),linear-gradient(180deg,#252f63 0%,#1a2148 55%,#161c3c 100%)",
  ink: "#FFFFFF", eyebrow: "#D5DBF5", sub: "#AEB8E0", em: "linear-gradient(90deg,#2EF0CF,#8DB4FF)",
  edge: "linear-gradient(135deg,#f2f4fa 0%,#b4b9c6 18%,#6c717e 50%,#c0c5d2 82%,#f5f7fc 100%)", shadow: "0 0 0 1.5px rgba(255,255,255,.35),0 0 90px 10px rgba(120,170,255,.35),0 0 200px 40px rgba(46,240,207,.18),0 80px 140px -30px rgba(0,0,20,.6)", sbInk: "#FFFFFF", screen: "#0a0c17",
};
const LOOK = FIRST ? { ...LOOK0, bg: "radial-gradient(60% 34% at 50% 62%, rgba(0,224,190,.24), transparent 70%),radial-gradient(80% 40% at 50% 0%, #1a2350 0%, transparent 70%),linear-gradient(180deg,#0c0f22 0%,#07080f 100%)" } : LOOK0;
mkdirSync(OUT, { recursive: true });
// research wording only: no buy/sell/target words
const SHOTS = [
  ["1-screeners.png", "27 ready-made", "screeners", "for the Indian stock market", [40, 650, 930, 560], 0],
  ["2-news.png", "Results, the day", "they're filed", "from companies' own announcements", [40, 1000, 1000, 560], -1],
  ["3-company.png", "Every company", "on one page", "price, returns and results", [40, 590, 1000, 750], 1],
  ["4-scorecard.png", "A quality score", "out of 100", "from each company's own filings", [40, 665, 1000, 540], -1],
  ["5-explore.png", "The whole market", "at a glance", "every sector and company, coloured by its move", null, 0],
  ["6-watchlist.png", "Your watchlist,", "kept for you", "and what needs a look", [40, 545, 1000, 440], -1],
];
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
for (const [file, a, b, sub, hl, lean] of SHOTS) {
  const img = readFileSync(join(IN, LIGHT ? "tall-light" : "tall", file)).toString("base64");
  const icon = readFileSync(join(ROOT, "public/jocular-insights-icon.svg")).toString("base64");
  // Apple-style craft (14 Nov 2026): one strong headline with tight tracking,
  // a quiet line under it, the phone lit from above and floating on a soft glow
  await page.setContent(`<!doctype html><html><head><style>
body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:-apple-system,'SF Pro Display','Inter',Roboto,sans-serif;color:${LOOK.ink};text-align:center;
 background:${LOOK.bg};-webkit-font-smoothing:antialiased}
.eyebrow{padding-top:104px;display:flex;align-items:center;justify-content:center;gap:14px;font-size:30px;font-weight:600;letter-spacing:-.2px;color:${LOOK.eyebrow}}
.eyebrow img{width:46px;height:46px;border-radius:12px}
h1{margin:34px 0 0;font-size:96px;font-weight:700;letter-spacing:-.035em;line-height:1.0}
h1 em{font-style:normal;background:${LOOK.em};-webkit-background-clip:text;color:transparent}
p{margin:26px 0 0;font-size:36px;font-weight:400;letter-spacing:-.01em;color:${LOOK.sub};font-weight:500}
.card{position:absolute;left:50%;top:540px;transform:translateX(-50%);width:780px;height:1386px;border-radius:56px;overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.10),0 80px 140px -30px rgba(0,0,0,.8),0 0 120px rgba(0,224,190,.12)}
.card img{width:100%;display:block}
.phone{position:absolute;left:50%;top:560px;transform:translateX(-50%);width:704px;height:1290px}
.btn{position:absolute;right:-5px;width:5px;border-radius:0 3px 3px 0;background:linear-gradient(90deg,#596080,#2b2f45)}
.edge{position:absolute;inset:0;border-radius:96px;padding:3px;background:linear-gradient(160deg,#8a90b0 0%,#2a2e44 30%,#1a1d2c 60%,#5a6080 100%);box-shadow:0 70px 120px -20px rgba(0,0,0,.75),0 30px 60px rgba(0,0,0,.4)}
.bezel{width:100%;height:100%;border-radius:93px;background:#000;padding:11px;box-sizing:border-box}
.screen{position:relative;width:100%;height:100%;border-radius:82px;overflow:hidden;background:#0b0d18}
.sb{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 48px 0 56px;font-size:23px;font-weight:600;letter-spacing:-.2px}
.cam{position:absolute;left:50%;top:15px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:#000;box-shadow:inset 0 0 0 3px #15161f}
.gloss{position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.07) 0%,rgba(255,255,255,0) 32%);pointer-events:none}
.ip{position:absolute;left:50%;top:452px;transform:translateX(-50%);width:690px;height:1433px}
.ti{position:absolute;inset:0;border-radius:104px;padding:5px;background:${LOOK.edge};box-shadow:${LOOK.shadow}}
.gl{width:100%;height:100%;border-radius:99px;background:#000;padding:13px;box-sizing:border-box}
.sc{position:relative;width:100%;height:100%;border-radius:86px;overflow:hidden;background:${LOOK.screen}}
.sc img{width:100%;display:block}
.sb{height:60px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 48px 6px 64px;font-size:24px;font-weight:600;letter-spacing:-.3px;color:${LOOK.sbInk};background:${LOOK.screen};box-sizing:border-box}
.di{position:absolute;left:50%;top:16px;width:170px;height:50px;margin-left:-85px;border-radius:30px;background:#000}
.hi{position:absolute;left:50%;bottom:12px;width:220px;height:8px;margin-left:-110px;border-radius:5px;background:${LIGHT ? "rgba(0,0,0,.75)" : "rgba(255,255,255,.85)"}}
.kb{position:absolute;width:6px;background:linear-gradient(90deg,#4a4e5a,#8d92a0)}
.kb.l{left:-5px;border-radius:3px 0 0 3px}.kb.r{right:-5px;border-radius:0 3px 3px 0;background:linear-gradient(90deg,#8d92a0,#4a4e5a)}
.eyebrow{padding-top:70px!important}h1{margin-top:22px!important;font-size:84px!important}p{margin-top:18px!important;font-size:33px!important}
.dim{position:absolute;inset:0;background:${LIGHT ? "rgba(20,30,70,.10)" : "rgba(0,0,10,.22)"};pointer-events:none}
.pop{position:absolute;border-radius:40px;background-repeat:no-repeat;box-shadow:0 0 0 3px ${LIGHT ? "rgba(0,156,134,.55)" : "rgba(46,240,207,.55)"},0 40px 80px -10px rgba(0,0,20,${LIGHT ? ".35" : ".7"}),0 0 80px ${LIGHT ? "rgba(0,156,134,.18)" : "rgba(46,240,207,.22)"}}
.deco{position:absolute;inset:0;pointer-events:none}
.eyebrow,h1,p{position:relative}
</style></head><body>
<svg class="deco" width="1080" height="1920" viewBox="0 0 1080 1920"><defs><pattern id="g" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="${LIGHT ? "rgba(40,50,120,.07)" : "rgba(255,255,255,.06)"}" stroke-width="1.5"/></pattern><radialGradient id="f" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="m"><rect width="1080" height="1920" fill="url(#f)"/></mask><linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${LIGHT ? "#009C86" : "#2EF0CF"}" stop-opacity="0"/><stop offset=".5" stop-color="${LIGHT ? "#009C86" : "#2EF0CF"}" stop-opacity=".55"/><stop offset="1" stop-color="${LIGHT ? "#3D63E0" : "#8DB4FF"}" stop-opacity=".0"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)" mask="url(#m)"/><path d="M-20 1500 C 160 1460, 220 1380, 340 1400 S 520 1250, 640 1230 S 860 1060, 1100 980" fill="none" stroke="url(#l)" stroke-width="6" stroke-linecap="round"/></svg>
<div class="eyebrow"><img src="data:image/svg+xml;base64,${icon}">Jocular Insights</div>
<h1>${a}<br><em>${b}</em></h1>
<p>${sub[0].toUpperCase() + sub.slice(1)}</p>
<div class="ip">
<i class="kb l" style="top:200px;height:56px"></i><i class="kb l" style="top:290px;height:100px"></i><i class="kb l" style="top:410px;height:100px"></i><i class="kb r" style="top:330px;height:160px"></i>
<div class="ti"><div class="gl"><div class="sc">
<div class="sb"><span>9:41</span><svg width="96" height="22" viewBox="0 0 96 22" fill="${LOOK.sbInk}"><rect x="0" y="14" width="5" height="7" rx="1.5"/><rect x="8" y="10" width="5" height="11" rx="1.5"/><rect x="16" y="6" width="5" height="15" rx="1.5"/><rect x="24" y="2" width="5" height="19" rx="1.5"/><path d="M47 20l-4.5-5.2a7 7 0 0 1 9 0z"/><path d="M38.5 11a13 13 0 0 1 17 0l-2.4 2.8a9.4 9.4 0 0 0-12.2 0z"/><rect x="64" y="4" width="28" height="14" rx="4.5" fill="none" stroke="${LOOK.sbInk}" stroke-opacity=".45" stroke-width="2"/><rect x="67" y="7" width="20" height="8" rx="2.5"/><rect x="93.5" y="8.5" width="2.5" height="5" rx="1" opacity=".45"/></svg></div>
<i class="di"></i>
<img src="data:image/png;base64,${img}">
<i class="hi"></i>${hl ? '<i class="dim"></i>' : ""}
</div></div></div></div>
${hl ? (() => { const k = 0.70, inPhone = 0.6056, cx = 213 + (hl[0] + hl[2] / 2) * inPhone + lean * 36, cy = 452 + 18 + 60 + (hl[1] + hl[3] / 2) * inPhone, w = hl[2] * k, h = hl[3] * k;
  return `<div class="pop" style="left:${Math.max(20, Math.min(1060 - w, cx - w / 2))}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;background-image:url(data:image/png;base64,${img});background-size:${1080 * k}px auto;background-position:${-hl[0] * k}px ${-hl[1] * k}px"></div>`; })() : ""}</body></html>`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: join(OUT, file) }); console.log(`  framed/${file}`);
}
await browser.close();
