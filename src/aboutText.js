// "What it does", in a few plain sentences (4 Nov 2026: "I want details about
// the company; it doesn't show what it does in writing"). Built only from what
// the company itself filed: its sustainability report's description where it
// has one (the top ~1,000 file it), the business lines its results filing
// names (every filer), its NSE sector and industry, and last year's sales.
// Nothing is guessed: with none of those, there's no paragraph.

// "MICRONIZED MINERALS" → "Micronized minerals"; "BFS" stays as it is
const tidy = l => {
  const t = String(l).replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");
  if (t.length > 4 && t === t.toUpperCase()) return t.charAt(0) + t.slice(1).toLowerCase();
  return t;
};
const an = w => (/^[aeiou]/i.test(w) ? "an" : "a");
const list = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const crore = v => `₹${Math.round(v).toLocaleString("en-IN")} crore`;

// name: the company's short name; m: its figures (sector, industry, history);
// d: its profile panel ({ profile: { about, mainActivity, businessLines }, filedBusiness })
// the significant words of a line, for telling whether it only repeats another
const WORDS = l => String(l).toLowerCase().match(/[a-z]{4,}/g)?.filter(w => !/^(business|services?|company|activit(y|ies)|other|products?|operat\w*)$/.test(w)).map(w => w.replace(/s$/, "")) ?? [];

export function aboutParagraph(name, m, d) {
  const p = d?.profile;
  let own = String(p?.about || p?.mainActivity || "").trim().replace(/\.+$/, "");
  // the report's "The Company is…" reads better with the company's name
  own = own.replace(/^the company\b/i, name);
  // a phrase ("Operating Hotels") becomes a sentence
  const sentence = /\b(is|are|was|has|have|provides?|makes?|operates?|manufactures?|offers?|engaged)\b/i.test(own);
  if (own && !sentence) own = `${name}${/s$/i.test(name) ? "'" : "'s"} main activity is ${own.charAt(0).toLowerCase()}${own.slice(1).toLowerCase()}`;
  const ownWords = new Set(WORDS(own));
  const seen = new Set();
  const lines = [...(p?.businessLines ?? []), ...(d?.filedBusiness ?? [])].map(tidy)
    .filter(l => l && l.length <= 70 && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()))
    // the description already says it: don't repeat a line whose words are all in it
    .filter(l => !own || !WORDS(l).length ? !own.toLowerCase().includes(l.toLowerCase()) : !WORDS(l).every(w => ownWords.has(w)))
    .slice(0, 5);
  const kind = m?.industry && m.industry !== m.sector ? m.industry : null;
  const out = [];
  if (own) out.push(`${own}.`);
  else if (kind || m?.sector) {
    const what = kind ? `${an(kind)} ${kind.toLowerCase().replace(/ - /g, " – ")} company` : `a company in the ${m.sector} sector`;
    out.push(`${name} is ${what}${kind && m.sector ? `, in the ${m.sector} sector` : ""}.`);
  }
  if (lines.length) out.push(`${lines.length === 1 ? "Its business" : "Its businesses"}: ${list(lines)}.`);
  const last = (m?.history ?? []).find(y => y?.revenueCr > 0);
  if (last && out.length) out.push(`Sales in the year to ${new Date(`${last.fyEnd}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}: ${crore(last.revenueCr)}.`);
  return out.length ? out.join(" ") : null;
}
