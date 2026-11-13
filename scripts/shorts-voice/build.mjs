// Voiced Shorts in the style the owner liked (13 Nov 2026, "TCS: great company,
// falling stock?"): Michael (Kokoro, local and free) speaks; the words appear as he
// says them; real cards from jocularinsights.in are lifted off the live page with the
// figure circled; big tiles, bars and price lines count up. Every figure on screen
// comes from the live site (cards are screenshots, lines and tiles from its public
// data) or from the spec, which must quote the live page.
//   node scripts/shorts-voice/build.mjs path/to/spec.json            → <dir>/<key>.mp4 (+ .srt)
//   node scripts/shorts-voice/build.mjs path/to/spec.json --stills   → <dir>/stills/<id>.jpg
// Spec: { key, source, lines: [{ id, say, show, visual: {type, ...} }] }; see README.md.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../..");
const SITE = "https://jocularinsights.in";
const { chromium } = await import(`${REPO}/node_modules/@playwright/test/index.mjs`);
const sh = (c, a) => execFileSync(c, a, { stdio: ["ignore", "pipe", "inherit"] }).toString();
const FPS = 30;

const specPath = resolve(process.argv[2] ?? "");
const STILLS = process.argv.includes("--stills");
const DIR = dirname(specPath);
const spec = JSON.parse(readFileSync(specPath, "utf-8"));

// 1. the voice (again only when a line's words changed)
const timingFile = join(DIR, "voice/timing.json");
const old = existsSync(timingFile) ? JSON.parse(readFileSync(timingFile, "utf-8")) : {};
if (spec.lines.some(l => old[l.id]?.say !== l.say)) execFileSync(join(homedir(), "Projects/files/tts/.venv/bin/python"), [join(HERE, "voice.py"), specPath], { stdio: "inherit" });
const timing = JSON.parse(readFileSync(timingFile, "utf-8"));

// 2. live data and screenshots for each company the visuals name
const symbols = [...new Set(spec.lines.flatMap(l => [l.visual.symbol, ...(l.visual.series ?? []).map(s => s.symbol)]).filter(Boolean))];
mkdirSync(join(DIR, "shots"), { recursive: true });
const data = {};
for (const s of symbols) {
  const r = await fetch(`${SITE}/api/public/stock/${encodeURIComponent(s)}`, { headers: { "User-Agent": "JocularShorts/1.0" } });
  if (!r.ok) throw new Error(`${s}: ${r.status}`);
  const j = await r.json(); data[s] = j.stock ?? j;
  if (!data[s].spark?.length) throw new Error(`${s}: no price line on the live page`);
}
const browser = await chromium.launch({ channel: "chrome" });
const shots = {};
for (const s of symbols.filter(s => spec.lines.some(l => l.visual.symbol === s && ["page", "card"].includes(l.visual.type)))) {
  const p = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: "dark" });
  await p.goto(`${SITE}/stock/${encodeURIComponent(s)}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const top = join(DIR, "shots", `${s}-top.png`);
  await p.screenshot({ path: top });
  shots[s] = { top: b64(top), cards: {} };
  for (const [card, sel] of [["quality", ".ps-quality"], ["ret", ".ps-year"], ["results", ".ps-quarter"]]) {
    const el = p.locator(sel).first();
    if (!(await el.count())) continue;
    const file = join(DIR, "shots", `${s}-${card}.png`);
    await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: file });
    // where each figure sits inside the card, for its circle
    const boxes = await el.evaluate(c => {
      const o = c.getBoundingClientRect(), rel = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left - o.left, y: b.top - o.top, w: b.width, h: b.height }; };
      const q = [...c.querySelectorAll(".ps-q2 > div")];
      return { w: o.width, h: o.height, ring: rel(c.querySelector(".ps-ring")), ret: rel(c.querySelector("b")), sales: rel(q[0]?.querySelector("b")), profit: rel(q[1]?.querySelector("b")) };
    });
    shots[s].cards[card] = { img: b64(file), ...boxes };
  }
  await p.close();
}
function b64(f) { return `data:image/png;base64,${readFileSync(f).toString("base64")}`; }

// 3. timing: each line after the last with a breath; words timed by their syllables
const syll = w => Math.max(1, (w.toLowerCase().replace(/[^a-z0-9%₹]/g, "").match(/[aeiouy]+|\d/g) || []).length + (/%/.test(w) ? 2 : 0));
let t = 0.25;
const lines = spec.lines.map(l => {
  const tm = timing[l.id], at = t;
  // *teal words* and ~red words~
  let state = null;
  const words = l.show.split(" ").map(raw => {
    let s = raw, tone = state;
    if (s.startsWith("*")) { tone = "t"; s = s.slice(1); } else if (s.startsWith("~")) { tone = "r"; s = s.slice(1); }
    const end = /[*~]([.,?!:;]*)$/.test(s);
    s = s.replace(/[*~]([.,?!:;]*)$/, "$1");
    state = end ? null : tone;
    return { text: s, tone };
  });
  const weights = words.map(w => syll(w.text) + (/[,.?!]$/.test(w.text) ? 1 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let s = at + tm.speechStart; const span = tm.speechEnd - tm.speechStart;
  words.forEach((w, k) => { w.at = s; s += (span * weights[k]) / total; });
  t = at + tm.dur + 0.28;
  return { id: l.id, visual: l.visual, at, end: at + tm.dur, words, show: words.map(w => w.text).join(" "), file: join(DIR, "voice", `${l.id}.wav`) };
});
const LENGTH = Math.ceil((t + 1.8) * 10) / 10;
const ts = x => { const ms = Math.round(x * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
writeFileSync(join(DIR, `${spec.key}.srt`), lines.map((l, i) => `${i + 1}\n${ts(l.at)} --> ${ts(l.end)}\n${l.show}\n`).join("\n"));

// 4. the scene
const logo = b64(join(REPO, "scripts/brand/ji-original.png"));
const live = Object.fromEntries(Object.entries(data).map(([s, d]) => [s, { name: d.name, spark: d.spark, change1y: d.change1y, closeDate: d.closeDate }]));
const html = readFileSync(join(HERE, "scene.html"), "utf-8")
  .replace("__DATA__", () => JSON.stringify({ lines: lines.map(({ file, ...l }) => l), LENGTH, source: spec.source, live, shots }))
  .replace(/__LOGO__/g, () => logo);
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await tab.setContent(html, { waitUntil: "load" });
if (STILLS) {
  rmSync(join(DIR, "stills"), { recursive: true, force: true }); // no frames left from an older version
  mkdirSync(join(DIR, "stills"), { recursive: true });
  for (const l of lines) { await tab.evaluate(y => window.render(y), l.end - 0.1); await tab.screenshot({ path: join(DIR, "stills", `${l.id}.jpg`), type: "jpeg", quality: 80 }); }
  await browser.close(); console.log(`${LENGTH} s · stills in ${join(DIR, "stills")}`); process.exit(0);
}
const frames = join(DIR, "frames-tmp"); rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const N = Math.round(LENGTH * FPS);
for (let f = 0; f < N; f++) { await tab.evaluate(x => window.render(x), f / FPS); await tab.screenshot({ path: join(frames, `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 94 }); }
await browser.close();

// 5. sound: Michael on top; a soft pulse and pad underneath, ducked when he speaks; a pop on each highlight
const A = join(DIR, "audio"); mkdirSync(A, { recursive: true });
const L = LENGTH.toFixed(2);
sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `aevalsrc=exprs='0.55*sin(2*PI*(42+70*exp(-28*mod(t\\,0.5)))*mod(t\\,0.5))*exp(-8*mod(t\\,0.5))':s=48000:d=${L}`,
  ...[146.83, 220, 261.63, 329.63].flatMap(f => ["-f", "lavfi", "-i", `sine=frequency=${f}:sample_rate=48000:duration=${L}`]),
  "-filter_complex", `[1][2][3][4]amix=inputs=4:normalize=1,tremolo=f=0.25:d=0.3,lowpass=f=1400,volume=0.5[pad];[0]lowpass=f=160,volume=0.9[kick];[pad][kick]amix=inputs=2:normalize=0,afade=t=in:d=1.2,afade=t=out:st=${(LENGTH - 2).toFixed(2)}:d=2`, "-ac", "2", join(A, "bed.wav")]);
sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=1320:sample_rate=48000:duration=0.08", "-af", "afade=t=out:st=0.005:d=0.07,volume=0.22", "-ac", "2", join(A, "pop.wav")]);
const pops = lines.flatMap(l => { const first = l.words.find(w => w.tone); return first ? [first.at] : []; });
const ev = [...lines.map(l => ({ f: l.file, at: l.at, v: true })), ...pops.map(at => ({ f: join(A, "pop.wav"), at, v: false }))];
const vi = ev.map((e, i) => (e.v ? i : -1)).filter(i => i >= 0), fi = ev.map((e, i) => (e.v ? -1 : i)).filter(i => i >= 0);
const fc = [
  ...ev.map((e, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(e.at * 1000)}:all=1${e.v ? ",volume=1.5" : ""}[e${i}]`),
  `${vi.map(i => `[e${i}]`).join("")}amix=inputs=${vi.length}:normalize=0,apad=whole_dur=${L},highpass=f=70,acompressor=threshold=0.1:ratio=3:attack=10:release=150,aecho=0.85:0.5:45:0.12[vo]`,
  `[vo]asplit=2[vo1][key]`,
  `${fi.map(i => `[e${i}]`).join("")}amix=inputs=${fi.length}:normalize=0,apad=whole_dur=${L}[fx]`,
  `[${ev.length}:a]volume=0.35[bed]`, `[bed][key]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[duck]`,
  `[vo1][fx][duck]amix=inputs=3:normalize=0,atrim=0:${L},loudnorm=I=-14:TP=-1.5:LRA=9[mix]`,
];
sh("ffmpeg", ["-y", "-loglevel", "error", ...ev.flatMap(e => ["-i", e.f]), "-i", join(A, "bed.wav"), "-filter_complex", fc.join(";"), "-map", "[mix]", "-ar", "48000", join(A, "mix.wav")]);
const out = join(DIR, `${spec.key}.mp4`);
sh("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "%05d.jpg"), "-i", join(A, "mix.wav"), "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]);
rmSync(frames, { recursive: true, force: true });
console.log(`${out} · ${LENGTH} s`);
