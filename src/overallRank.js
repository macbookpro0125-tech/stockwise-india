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

// Business and share price together (12 Nov 2026): the pairing that held up
// when the market was re-scored on past dates (scripts/score-backtest.mjs).
// Quality 70+ with price strength 70+ did better than the average company a
// year later on 7 of 7 dates; under 50 with 30 or less did worst.
export function pairing(m) {
  const q = m?.research?.quality, s = m?.priceStrength;
  if (q == null || s == null) return null;
  if (q >= 70 && s >= 70) return { tone: "good", label: "Strong business, rising price", text: `Quality ${Math.round(q)} and price strength ${s}: in our tests on past dates, companies like this did better than the average company a year later`, href: "/screens/strong-business-rising-price" };
  if (q < 50 && s <= 30) return { tone: "bad", label: "Weak business, falling price", text: `Quality ${Math.round(q)} and price strength ${s}: in our tests on past dates, companies like this did worst a year later`, href: "/methodology" };
  return null;
}
