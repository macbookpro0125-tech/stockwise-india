// Names to suggest for a new watchlist list (24 Oct 2026, "it should suggest
// names for the watchlist, or else we can name it anything"): first from the
// starred stocks themselves — a sector with two or more of them, made with
// those stocks in it — then the usual ways people group a watchlist. Any name
// the user already has is left out; they can always type their own.

// NSE's sector names, as a list would be called
const SECTOR_NAME = {
  "Information Technology": "IT stocks",
  "Financial Services": "Banks & finance",
  "Fast Moving Consumer Goods": "FMCG",
  "Healthcare": "Pharma & healthcare",
  "Automobile and Auto Components": "Auto stocks",
  "Capital Goods": "Capital goods",
  "Metals & Mining": "Metals",
  "Oil Gas & Consumable Fuels": "Oil & gas",
  "Power": "Power",
  "Construction Materials": "Cement",
  "Consumer Durables": "Consumer durables",
  "Consumer Services": "Consumer services",
  "Chemicals": "Chemicals",
  "Realty": "Real estate",
  "Telecommunication": "Telecom",
  "Construction": "Infra & construction",
  "Media Entertainment & Publication": "Media",
  "Textiles": "Textiles",
};
export const sectorListName = sector => SECTOR_NAME[sector] ?? (sector ? String(sector) : null);

export const COMMON_NAMES = ["Long term", "To research", "High conviction", "Dividend picks", "Results watch", "Buy on dips", "Swing trades", "Small caps"];

// starred: [{ ticker, sector }]; existing: the names already used; sector: the
// one stock's a list is being made for (from its page, or just starred), first
export function suggestListNames({ starred = [], existing = [], sector = null } = {}, max = 8) {
  const used = new Set(existing.map(n => n.trim().toLowerCase()));
  const out = [];
  const bySector = new Map();
  for (const s of starred) {
    const name = sectorListName(s.sector);
    if (!name) continue;
    if (!bySector.has(name)) bySector.set(name, []);
    bySector.get(name).push(s.ticker);
  }
  // the sectors with most starred stocks first, two or more each, three at most
  for (const [name, tickers] of [...bySector].filter(([, t]) => t.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 3)) {
    if (!used.has(name.toLowerCase())) out.push({ name, tickers });
  }
  const own = sectorListName(sector);
  if (own && !used.has(own.toLowerCase()) && !out.some(o => o.name === own)) out.unshift({ name: own, tickers: [] });
  for (const name of COMMON_NAMES) {
    if (out.length >= max) break;
    if (!used.has(name.toLowerCase())) out.push({ name, tickers: [] });
  }
  return out.slice(0, max);
}
