// A company against its sector on the measures that tell businesses apart —
// growth, returns on capital, margins, debt and price — for the company
// page's "Against its sector" (StockSectorCompare.jsx). Each row gives the
// sector's middle value and how many of the sector's other companies it
// beats (for debt and P/E, lower beats). Lenders are compared with the
// lenders in their sector, and not on debt, margins or ROCE, which mean
// something else for a bank. Sectors are the ones the page shows (m.sector).

export const MEASURES = [
  { id: "salesGrowth5y", label: "Sales growth, 5 years (a year)", better: "higher" },
  { id: "epsGrowth5y", label: "EPS growth, 5 years (a year)", better: "higher" },
  { id: "roe", label: "Return on equity", better: "higher" },
  { id: "roce5y", label: "Return on capital, 5-year average", better: "higher", noLenders: true },
  { id: "opm5y", label: "Operating margin, 5-year average", better: "higher", noLenders: true },
  { id: "debtToEquity", label: "Debt to equity", better: "lower", noLenders: true },
  { id: "peTtm", label: "P/E on the last four quarters", better: "lower", positiveOnly: true },
];

export const peerKey = m => (m.sector ? `${m.sector}${m.lender ? " · lenders" : ""}` : null);

const usable = (meas, v) => Number.isFinite(v) && (meas.positiveOnly ? v > 0 : meas.id !== "debtToEquity" || v >= 0);

// Every measure's values for each sector, sorted; only where minPeers or
// more companies have the figure
export function buildSectorStats(rows, { minPeers = 5 } = {}) {
  const groups = new Map();
  for (const m of rows) {
    const key = peerKey(m);
    if (!key) continue;
    const g = groups.get(key) ?? groups.set(key, {}).get(key);
    for (const meas of MEASURES) {
      if (meas.noLenders && m.lender) continue;
      const v = m[meas.id];
      if (usable(meas, v)) (g[meas.id] ??= []).push(v);
    }
  }
  const out = new Map();
  for (const [key, g] of groups) {
    const kept = {};
    for (const [id, vals] of Object.entries(g)) if (vals.length >= minPeers) kept[id] = vals.sort((a, b) => a - b);
    if (Object.keys(kept).length) out.set(key, kept);
  }
  return out;
}

const median = s => (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);

export function sectorComparison(m, stats) {
  const group = stats.get(peerKey(m));
  if (!group) return [];
  const rows = [];
  for (const meas of MEASURES) {
    if (meas.noLenders && m.lender) continue;
    const v = m[meas.id], all = group[meas.id];
    if (!usable(meas, v) || !all) continue;
    // the others: the sector without the company itself
    const others = [...all];
    const self = others.indexOf(v);
    if (self >= 0) others.splice(self, 1);
    const beaten = others.filter(o => (meas.better === "higher" ? o < v : o > v)).length;
    rows.push({ id: meas.id, label: meas.label, better: meas.better, value: v, median: median(all), n: all.length, beats: others.length ? beaten / others.length : null });
  }
  return rows;
}
