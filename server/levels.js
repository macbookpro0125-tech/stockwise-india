// Ported verbatim from stock-screener's calculateLevels and getAction
// (src/StockScreener.jsx) — same formula, same fields, same wording.
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

export function getAction(actionPrice, levels, priceLabel = "Price") {
  if (!actionPrice || !levels) return null;
  const lp = Number(actionPrice);
  if (isNaN(lp) || lp <= 0) return null;
  const { p1, p2, p3, target, stopLoss } = levels;
  const px = `${priceLabel} ${fmtRs(lp)}`;

  if (stopLoss > 0 && lp <= stopLoss) return { action: "BELOW STOP LOSS", color: "var(--red)", bg: "var(--red-dim)", reason: `${px} has breached stop loss ${fmtRs(stopLoss)}. Consider exiting to protect capital.`, icon: "🚨" };
  if (target > 0 && lp >= target * 1.15) return { action: "SELL ALL", color: "var(--red)", bg: "var(--red-dim)", reason: `${px} is 15%+ above target ${fmtRs(target)}. Overvalued.`, icon: "💰" };
  if (target > 0 && lp >= target) return { action: "SELL 50–70%", color: "var(--yellow)", bg: "var(--yellow-dim)", reason: `${px} hit target ${fmtRs(target)}. Book profits.`, icon: "🎯" };
  if (p3 > 0 && lp <= p3) return { action: "BUY — PHASE 3 (40%)", color: "var(--green)", bg: "var(--green-dim)", reason: `${px} ≤ Phase 3 ${fmtRs(p3)}. Deep value — deploy 40%.`, icon: "🟢" };
  if (p2 > 0 && lp <= p2) return { action: "BUY — PHASE 2 (30%)", color: "var(--green)", bg: "var(--green-dim)", reason: `${px} ≤ Phase 2 ${fmtRs(p2)}. Good discount — deploy 30%.`, icon: "🟢" };
  if (p1 > 0 && lp <= p1) return { action: "BUY — PHASE 1 (30%)", color: "var(--green)", bg: "var(--green-dim)", reason: `${px} ≤ Phase 1 ${fmtRs(p1)}. Start position — deploy 30%.`, icon: "🟢" };
  if (p1 > 0 && target > 0 && lp > p1 && lp < target) {
    const upside = (((target - lp) / lp) * 100).toFixed(1);
    return { action: "HOLD / WAIT", color: "var(--yellow)", bg: "var(--yellow-dim)", reason: `${px} is above Phase 1 ${fmtRs(p1)} but below target ${fmtRs(target)}. Wait for dip. Upside: +${upside}%.`, icon: "⏸️" };
  }
  return null;
}
