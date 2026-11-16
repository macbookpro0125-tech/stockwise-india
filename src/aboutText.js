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

// More about the company, as short lines under the paragraph (16 Nov 2026,
// the owner: "can we write the details of the company more"). Each line only
// when its figures are on file: what sells most (its sustainability report's
// products with their share of turnover), where it sells (states, countries,
// exports), its size in its sector and its biggest listed rivals by sales
// (sector-share.js), its growth, and how long it has been in business and
// listed. Nothing is guessed; nothing is a judgement.
const pct = v => `${Math.round(v)}%`;
const yearOf = v => {
  const m = String(v ?? "").match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
};
export function aboutMore(name, m, d) {
  const p = d?.profile, l = d?.listing, out = [];
  const products = (p?.products ?? []).filter(x => x.pct > 0).map(x => ({ ...x, name: tidy(x.name) })).slice(0, 3);
  if (products.length) out.push(["What sells most", `${list(products.map(x => `${x.name} (${pct(x.pct)} of sales)`))}.`]);
  const ms = p?.marketsServed;
  const where = [
    ms?.states ? `${ms.states} Indian state${ms.states === 1 ? "" : "s"}` : null,
    ms?.countries ? `${ms.countries} countr${ms.countries === 1 ? "y" : "ies"}` : null,
  ].filter(Boolean);
  if (where.length || p?.exportsPct != null) {
    out.push(["Where it sells", [
      where.length ? `It sells in ${list(where)}` : null,
      p?.exportsPct != null ? `exports are ${pct(p.exportsPct)} of its sales` : null,
    ].filter(Boolean).join("; ").replace(/^e/, "E") + "."]);
  }
  const s = m?.sectorShare;
  if (s?.rank && s.companies > 2) {
    const rivals = (s.top ?? []).filter(r => r.symbol !== m.symbol).slice(0, 3).map(r => r.name.replace(/\s+(Limited|Ltd\.?)$/i, ""));
    out.push(["Its size", `Number ${s.rank} of ${s.companies} listed ${s.sector} companies by sales, with ${pct(s.sharePct)} of their combined sales.${rivals.length ? ` The biggest others: ${list(rivals)}.` : ""}`]);
  }
  const g = [
    m?.salesGrowth5y != null ? `sales ${m.salesGrowth5y >= 0 ? "grew" : "fell"} ${Math.abs(m.salesGrowth5y).toFixed(1)}% a year` : null,
    m?.profitGrowth5y != null ? `profit ${m.profitGrowth5y >= 0 ? "grew" : "fell"} ${Math.abs(m.profitGrowth5y).toFixed(1)}% a year` : null,
  ].filter(Boolean);
  if (g.length) out.push(["Over five years", `${list(g).replace(/^s/, "S").replace(/^p/, "P")}.`]);
  const inc = yearOf(p?.incorporated), listed = yearOf(l?.listedOn);
  if (inc || listed) {
    const h = [inc ? `In business since ${inc}` : null, listed ? `on NSE's main board since ${listed}` : null].filter(Boolean).join("; ");
    out.push(["History", `${h.charAt(0).toUpperCase()}${h.slice(1)}.`]);
  }
  return out;
}
