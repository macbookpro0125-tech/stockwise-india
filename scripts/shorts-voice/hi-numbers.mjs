// Hindi Shorts (14 Nov 2026): turns the figures in each line's "say" into spoken
// everyday Hindi, so the Hindi voice (Kokoro hm_psi) reads them right. The
// line can then be written with digits, e.g. "प्रॉफ़िट 14.9% बढ़कर 1,573 करोड़".
// Percentages are rounded as in the English Shorts: whole numbers at 10 and
// above, one decimal below ("सात पॉइंट छह परसेंट"). 1,100–1,999 is said the
// everyday way ("पंद्रह सौ तिहत्तर"). The "show" text keeps its digits.
//   node scripts/shorts-voice/hi-numbers.mjs <spec.json>     (rewrites the spec in place)
import { readFileSync, writeFileSync } from "node:fs";

const W = ("शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस " +
  "इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस " +
  "इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरेपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ " +
  "इकसठ बासठ तिरेसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उनासी अस्सी " +
  "इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे").split(" ");
if (W.length !== 100) throw new Error("number table");
const w999 = n => (n >= 100 ? `${W[Math.floor(n / 100)]} सौ${n % 100 ? " " + W[n % 100] : ""}` : W[n]);
export const hiWords = n => {
  n = Math.round(Math.abs(n));
  if (n < 100) return W[n];
  if (n >= 1100 && n < 2000) return `${W[Math.floor(n / 100)]} सौ${n % 100 ? " " + W[n % 100] : ""}`;
  const parts = [], crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1000), rest = n % 1000;
  if (crore) parts.push(`${hiWords(crore)} करोड़`);
  if (lakh) parts.push(`${W[lakh]} लाख`);
  if (th) parts.push(`${W[th]} हज़ार`);
  if (rest) parts.push(w999(rest));
  return parts.join(" ");
};
export const hiPct = x => { const a = Math.abs(x), t = Math.round((a % 1) * 10) % 10; return a >= 10 || t === 0 ? `${hiWords(a)} परसेंट` : `${hiWords(Math.floor(a))} पॉइंट ${W[t]} परसेंट`; };
export const hiSay = s => s
  .replace(/₹\s?/g, "").replace(/[−+](?=\d)/g, "")
  .replace(/(\d[\d,]*(?:\.\d+)?)\s*(%|परसेंट|प्रतिशत)/g, (_, n) => hiPct(parseFloat(n.replace(/,/g, ""))))
  .replace(/(\d[\d,]*)\.(\d+)/g, (_, a, b) => `${hiWords(parseInt(a.replace(/,/g, ""), 10))} पॉइंट ${b.split("").map(d => W[+d]).join(" ")}`)
  .replace(/\d[\d,]*/g, n => hiWords(parseInt(n.replace(/,/g, ""), 10)));

if (process.argv[2]) {
  const p = process.argv[2], spec = JSON.parse(readFileSync(p, "utf8"));
  for (const l of spec.lines) l.say = hiSay(l.say);
  spec.voice ??= "hm_psi"; spec.lang ??= "hi"; spec.speed ??= 1.0;
  writeFileSync(p, JSON.stringify(spec, null, 1));
  for (const l of spec.lines) console.log(l.id, l.say);
}
