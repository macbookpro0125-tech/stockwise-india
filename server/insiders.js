// Insider and promoter trades for the company page (InsidersPanel.jsx), from
// NSE's insider-trading disclosures under SEBI's PIT rules (company-extras.js
// fetches a year of them). Only shares count; ADRs and other securities are
// left out. Buying and selling mean market purchases and sales; option
// exercises, gifts, off-market and inter-se transfers are counted apart, as
// they aren't anyone backing or doubting the price.

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const isoOf = s => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(s ?? "").trim());
  return m && MONTHS[m[2]] ? `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};
const num = s => { const n = Number(String(s ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const shift = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export const GROUPS = [
  { id: "promoters", label: "Promoters and their group" },
  { id: "insiders", label: "Directors, officers and their relatives" },
  { id: "others", label: "Others" },
];
const groupOf = category => (/promoter/i.test(category) ? "promoters"
  : /director|key managerial|kmp|designated|employee|relative|officer|manager|ceo|cfo/i.test(category) ? "insiders" : "others");

// rows: NSE's PIT disclosures (any period); today: YYYY-MM-DD. Null rows (NSE
// not read) is unknown, not "no trades".
export function summarizeInsiders(rows, today) {
  if (!Array.isArray(rows)) return null;
  const from = shift(today, -364);
  const empty = () => ({ value: 0, shares: 0, trades: 0 });
  const groups = GROUPS.map(g => ({ ...g, bought: empty(), sold: empty() }));
  const otherMoves = {};
  const recent = [];
  for (const r of rows) {
    if (!/equity/i.test(r.secType ?? "")) continue;
    const date = isoOf(r.acqtoDt) ?? isoOf(r.acqfromDt) ?? isoOf(r.date);
    if (!date || date < from || date > today) continue;
    const mode = String(r.acqMode ?? "").trim();
    const side = /market purchase/i.test(mode) ? "buy" : /market sale/i.test(mode) ? "sell" : null;
    if (!side) {
      const key = mode && mode !== "-" ? mode : "Other";
      otherMoves[key] = (otherMoves[key] ?? 0) + 1;
      continue;
    }
    const shares = num(r.secAcq), value = num(r.secVal);
    const g = groups.find(x => x.id === groupOf(r.personCategory ?? ""));
    const tally = side === "buy" ? g.bought : g.sold;
    tally.value += value; tally.shares += shares; tally.trades++;
    recent.push({ date, name: String(r.acqName ?? "").trim(), category: String(r.personCategory ?? "").trim(), group: g.id, side, shares, value, holdingAfter: num(r.afterAcqSharesPer) });
  }
  recent.sort((a, b) => b.date.localeCompare(a.date));
  return { from, to: today, groups, otherMoves, recent: recent.slice(0, 10) };
}
