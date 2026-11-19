// Hook check (19 Nov 2026): scores a Short's opening line before we build it.
// The five checks and the weakest-link verdict follow the yt-script skill of
// github.com/Jakeschincariol/youtube-agent-skill (MIT): read, rewritten here,
// not installed. Our own additions: rupee figures count as specific, and words
// that sound like advice (buy, sell, target, multibagger…) fail the hook outright
// (the SEBI rule).
//   node scripts/shorts-voice/hook-check.mjs "Of every ₹100 you spend…"   one line
//   node scripts/shorts-voice/hook-check.mjs <spec.json>                  the spec's first line
import { readFileSync, existsSync } from "node:fs";

const FILLER = new Set("basically actually literally just really very so kind sort like guys hey welcome today video subscribe channel".split(" "));
const VAGUE = new Set("amazing incredible insane crazy huge massive game changer secret powerful ultimate best revolutionary mind blowing unbelievable".split(" "));
const ADVICE = /\b(buy|sell|target|multibagger|sure[- ]?shot|must[- ]?own|jackpot|double your money|returns guaranteed)\b/i;
const CONCRETE = /(₹\s?\d[\d,.]*|\$\d[\d,.]*|\b\d[\d,.]*\s?(%|k|cr|crore|lakh|x)?|\b\d+\s?(second|minute|hour|day|week|month|year)s?)\b/gi;
const SPOKEN = /\b((one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)( |-)?)+(hundred|thousand|lakh|crore|percent|rupees)?\b|\b(hundred|thousand|lakh|crore) (rupees|percent)\b/gi;
const YOU = /\b(you|your|you're|youre|yourself|you've)\b/gi;
const STAKE = /\b(lose|lost|losing|waste|wasting|cost|costs|risk|before|stop|never|miss|missed|fall|fell|dead)\b/gi;
const CURIOUS = /\b(why|how|what|which|who|until|before|but|nobody|almost|except|reason|actually|most people)\b/gi;
const words = t => t.toLowerCase().match(/[a-z0-9'%$₹.]+/g) ?? [];
const n = (re, t) => (t.match(re) ?? []).length;
const clamp = x => Math.max(0, Math.min(100, Math.round(x)));

export function hookScore(t) {
  const w = words(t);
  const proper = t.split(/\s+/).slice(1).filter(x => /^[A-Z₹]/.test(x)).length;
  const parts = {
    specific: clamp(34 + (n(CONCRETE, t) + n(SPOKEN, t)) * 22 - w.filter(x => VAGUE.has(x)).length * 16 - w.filter(x => FILLER.has(x)).length * 5 + Math.min(18, 6 * proper)),
    you: clamp(26 + n(YOU, t) * 20 + (n(YOU, t.split(/\s+/).slice(0, 6).join(" ")) ? 30 : 0)),
    stakes: clamp(22 + n(STAKE, t) * 26 + (/\d/.test(t) || n(SPOKEN, t) ? 14 : 0)),
    curiosity: clamp(24 + n(CURIOUS, t) * 17 + (t.trim().endsWith("?") ? 18 : 0) - (/\b(because|so that|which means)\b/i.test(t) ? 18 : 0)),
    short: w.length >= 9 && w.length <= 24 ? 100 : w.length < 9 ? Math.max(30, 100 - (9 - w.length) * 11) : Math.max(10, 100 - (w.length - 24) * 7),
  };
  const vals = Object.values(parts), mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const advice = ADVICE.test(t);
  const verdict = advice ? 0 : Math.round(0.6 * mean + 0.4 * Math.min(...vals));
  const weakest = Object.entries(parts).sort((a, b) => a[1] - b[1])[0][0];
  return { parts, verdict, band: advice ? "FAIL (advice words)" : verdict >= 72 ? "STRONG" : verdict >= 55 ? "OK" : "WEAK", weakest };
}

const FIX = { specific: "swap a word for a real figure from the filing (₹, %, a year)", you: "say 'you' or 'your' in the first six words", stakes: "say what it costs the viewer not to know (never, before, miss…)", curiosity: "end on an open question; cut the half that answers itself", short: "9 to 24 words: about 6 seconds spoken" };
const arg = process.argv[2];
if (arg) {
  const line = existsSync(arg) ? JSON.parse(readFileSync(arg, "utf8")).lines[0].say : process.argv.slice(2).join(" ");
  const r = hookScore(line);
  console.log(`${line}\n  ${Object.entries(r.parts).map(([k, v]) => `${k} ${v}`).join(" · ")}\n  ${r.verdict} ${r.band}${r.band === "STRONG" ? "" : ` — weakest: ${r.weakest}: ${FIX[r.weakest]}`}`);
}
