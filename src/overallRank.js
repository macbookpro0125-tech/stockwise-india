// A company's place by overall score (12 Nov 2026): "#12 of 2,263 on NSE ·
// #3 of 41 in Banks" (server/screen.js rankByOverall). A ranking by our
// method's figures, never a pick.
const n = v => v.toLocaleString("en-IN");
export function rankParts(rank) {
  if (!rank?.rank || !rank?.of) return null;
  return {
    market: `#${n(rank.rank)} of ${n(rank.of)}`,
    sector: rank.sectorRank && rank.sector ? `#${n(rank.sectorRank)} of ${n(rank.sectorOf)} in ${rank.sector}` : null,
  };
}
export function rankLine(rank) {
  const p = rankParts(rank);
  return p ? [`${p.market} on NSE`, p.sector].filter(Boolean).join(" · ") : null;
}
