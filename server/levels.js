// calculateLevels is ported verbatim from stock-screener (src/StockScreener.jsx)
// — same formula, same fields. Its getAction ("BUY — PHASE 1 (30%)", "SELL
// ALL", "deploy 30%") is replaced by pricePosition below, which describes
// where the price sits and never says what to do.
// Margin of safety discounts TODAY's fair value (fv25 = EPS x P/E), not the
// two-year growth projection: discounting fv27 instead makes the growth
// multiplier and the discount cancel out, leaving little to no real cushion
// on high-growth names. (fv25/26/27 are this year and the next two — the
// names are the original's.)
export function calculateLevels(eps25, pe, growthPct, mosPct = 10) {
  const e25 = Number(eps25) || 0;
  const peN = Number(pe) || 0;
  const g = (Number(growthPct) || 0) / 100;
  const mos = (Number(mosPct) || 10) / 100;
  if (!e25 || !peN) return null;

  const e26 = e25 * (1 + g);
  const e27 = e26 * (1 + g);
  const fv25 = e25 * peN;
  const fv26 = e26 * peN;
  const fv27 = e27 * peN;

  const safeBuy = fv25 * (1 - mos);
  const p1 = safeBuy;
  const p2 = p1 * 0.9;
  const p3 = p1 * 0.8;
  const stopLoss = p3 * 0.93; // anchored to Phase 3, not Phase 1, so all phases can fill before exit triggers
  const target = fv27 * 1.1;

  return {
    e26: Math.round(e26), e27: Math.round(e27),
    fv25: Math.round(fv25), fv26: Math.round(fv26), fv27: Math.round(fv27),
    safeBuy: Math.round(safeBuy), p1: Math.round(p1), p2: Math.round(p2), p3: Math.round(p3),
    stopLoss: Math.round(stopLoss), target: Math.round(target),
  };
}

export function fmtRs(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const num = Number(n);
  if (num === 0) return "—";
  return "₹" + Math.round(num).toLocaleString("en-IN");
}

// Where a price sits against the levels: { zone, label, tone, detail }.
// Tone distinguishes risk levels (red past the stop-loss level or far above
// the upper level); model reference levels use a neutral accent.
export function pricePosition(price, levels) {
  const p = Number(price);
  if (!levels || !(p > 0)) return null;
  const { p1, p2, p3, stopLoss, target, fv25 } = levels;
  const vsFv = fv25 > 0 ? ((p - fv25) / fv25) * 100 : null;
  const fvText = vsFv == null ? "" : ` — ${Math.abs(vsFv).toFixed(0)}% ${vsFv <= 0 ? "below" : "above"} today's fair value of ${fmtRs(fv25)}`;
  const at = (zone, label, tone, detail) => ({ zone, label, tone, detail: `${detail}${fvText}.` });
  if (stopLoss > 0 && p <= stopLoss) return at("below-stop", "Below the stop-loss level", "red", `${fmtRs(p)} is under the stop-loss level of ${fmtRs(stopLoss)}`);
  if (target > 0 && p >= target * 1.15) return at("far-above", "Far above the upper level", "red", `${fmtRs(p)} is more than 15% over the upper level of ${fmtRs(target)}`);
  if (target > 0 && p >= target) return at("above-upper", "At or above the upper level", "yellow", `${fmtRs(p)} has reached the upper level of ${fmtRs(target)}`);
  if (p3 > 0 && p <= p3) return at("phase3", "At or below reference level 3", "neutral", `${fmtRs(p)} is at or under reference level 3 of ${fmtRs(p3)}`);
  if (p2 > 0 && p <= p2) return at("phase2", "At or below reference level 2", "neutral", `${fmtRs(p)} is at or under reference level 2 of ${fmtRs(p2)}`);
  if (p1 > 0 && p <= p1) return at("phase1", "At or below reference level 1", "neutral", `${fmtRs(p)} is at or under reference level 1 of ${fmtRs(p1)}`);
  if (p1 > 0) {
    const toUpper = target > p ? ` and ${(((target - p) / p) * 100).toFixed(0)}% under the upper level` : "";
    return at("above-phase1", "Above reference level 1", "neutral", `${fmtRs(p)} is ${(((p - p1) / p1) * 100).toFixed(0)}% above reference level 1 of ${fmtRs(p1)}${toUpper}`);
  }
  return null;
}
