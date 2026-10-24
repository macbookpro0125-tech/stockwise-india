// A company's share of its sector's sales — among the NSE-listed companies in
// the app's sector (sector-compare.js peerKey), on each one's latest full
// year — for the company page's "Where the money comes from". Not market
// share: unlisted companies, imports and the parts of a rival's sales in
// other sectors aren't in it, and the page says so. null with under three
// companies, where a share means little.
import { peerKey } from "./sector-compare.js";

export function sectorShare(m, rows, { top = 5 } = {}) {
  const key = peerKey(m);
  if (!key || !(m?.revenueCr > 0)) return null;
  const peers = rows.filter(r => peerKey(r) === key && r.revenueCr > 0 && r.symbol !== m.symbol);
  if (peers.length < 2) return null;
  const all = [...peers.map(r => ({ symbol: r.symbol, name: r.name, revenueCr: r.revenueCr })), { symbol: m.symbol, name: m.name, revenueCr: m.revenueCr }]
    .sort((a, b) => b.revenueCr - a.revenueCr);
  const totalCr = all.reduce((t, r) => t + r.revenueCr, 0);
  const rank = all.findIndex(r => r.symbol === m.symbol) + 1;
  const shown = all.slice(0, top);
  if (rank > top) shown.push(all[rank - 1]);
  return {
    sector: m.sector, companies: all.length, totalCr, rank,
    sharePct: (m.revenueCr / totalCr) * 100,
    top: shown.map(r => ({ ...r, sharePct: (r.revenueCr / totalCr) * 100 })),
  };
}
