// Price strength, 1–99 (31 Oct 2026): how a company's share price has done
// against every other company's. Each one's weighted return — 40% the last
// 3 months, 20% each 6, 9 and 12 months, so recent moves count most — is
// ranked across all companies with all four; 90 means a stronger price than
// 90% of them. A ranking of the past from NSE's closes, not a forecast, and
// apart from the quality score, which is about the business.
const WEIGHTS = [["m3", 0.4], ["m6", 0.2], ["m9", 0.2], ["y1", 0.2]];

export function weightedReturn(r) {
  if (!r || WEIGHTS.some(([k]) => typeof r[k] !== "number" || !Number.isFinite(r[k]))) return null;
  return WEIGHTS.reduce((s, [k, w]) => s + r[k] * w, 0);
}

// returns: { SYMBOL: { m3, m6, m9, y1, … } } (the snapshot's) → Map(symbol → 1–99)
export function priceStrengthRanks(returns) {
  const scored = Object.entries(returns ?? {})
    .map(([sym, r]) => [sym, weightedReturn(r)])
    .filter(([, v]) => v != null)
    .sort((a, b) => a[1] - b[1]);
  const out = new Map();
  const n = scored.length;
  if (!n) return out;
  // ties share the rank of the first of them, so equal returns rate the same
  let below = 0;
  scored.forEach(([sym, v], i) => {
    if (i > 0 && v !== scored[i - 1][1]) below = i;
    out.set(sym, n === 1 ? 50 : Math.min(99, Math.max(1, Math.floor((below / (n - 1)) * 98) + 1)));
  });
  return out;
}

// One ranking per snapshot, worked out the first time it's asked for
const cache = new WeakMap();
export function priceStrengthOf(snap, sym) {
  if (!snap?.returns) return null;
  let ranks = cache.get(snap);
  if (!ranks) cache.set(snap, (ranks = priceStrengthRanks(snap.returns)));
  return ranks.get(sym) ?? null;
}
