// Ported from stock-screener's calculateLevels (src/StockScreener.jsx) —
// same formula, same reasoning, not reinvented. Margin of safety discounts
// TODAY's fair value (fv25 = EPS x P/E), not the two-year growth projection:
// discounting fv27 instead makes the growth multiplier and the discount
// cancel out, leaving little to no real cushion on high-growth names.
export function calculateLevels(eps, pe, growthPct, mosPct = 10) {
  const e25 = Number(eps) || 0;
  const peN = Number(pe) || 0;
  const g = (Number(growthPct) || 0) / 100;
  const mos = (Number(mosPct) || 10) / 100;
  if (!e25 || !peN) return null;

  const e26 = e25 * (1 + g);
  const e27 = e26 * (1 + g);
  const fv25 = e25 * peN;
  const fv27 = e27 * peN;

  const safeBuy = fv25 * (1 - mos);
  const p1 = safeBuy;
  const p2 = p1 * 0.9;
  const p3 = p1 * 0.8;
  const stopLoss = p3 * 0.93; // anchored to Phase 3, not Phase 1, so all phases can fill before exit triggers
  const target = fv27 * 1.1;

  return {
    fv25: Math.round(fv25), fv27: Math.round(fv27),
    p1: Math.round(p1), p2: Math.round(p2), p3: Math.round(p3),
    stopLoss: Math.round(stopLoss), target: Math.round(target),
  };
}

export function getAction(cmp, levels) {
  if (!cmp || !levels) return null;
  const { p1, p2, p3, target, stopLoss } = levels;
  if (stopLoss > 0 && cmp <= stopLoss) return { action: "BELOW STOP LOSS", color: "var(--red)" };
  if (target > 0 && cmp >= target * 1.15) return { action: "SELL ALL", color: "var(--red)" };
  if (target > 0 && cmp >= target) return { action: "SELL 50–70%", color: "var(--yellow)" };
  if (p3 > 0 && cmp <= p3) return { action: "BUY — PHASE 3 (40%)", color: "var(--green)" };
  if (p2 > 0 && cmp <= p2) return { action: "BUY — PHASE 2 (30%)", color: "var(--green)" };
  if (p1 > 0 && cmp <= p1) return { action: "BUY — PHASE 1 (30%)", color: "var(--green)" };
  return { action: "HOLD / WAIT", color: "var(--t2)" };
}
