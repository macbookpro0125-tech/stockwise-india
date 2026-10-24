// calculateLevels is ported verbatim from stock-screener (src/StockScreener.jsx)
// — same formula, same fields. Its getAction ("BUY — PHASE 1 (30%)", "SELL
// ALL", "deploy 30%") is replaced by pricePosition below, which describes
// where the price sits and never says what to do.
// Margin of safety discounts TODAY's fair value (fv25 = EPS x P/E), not the
// two-year growth projection: discounting fv27 instead makes the growth
// multiplier and the discount cancel out, leaving little to no real cushion
// on high-growth names. (fv25/26/27 are this year and the next two — the
// names are the original's.)
// Rupees to the rupee from ₹100 up, to the paisa below (16 Oct 2026): rounded
// to whole rupees, a ₹2 share's levels — ten paise apart — all became ₹2, and
// 76 companies' ladders collapsed onto the same figures
export const roundPrice = v => (v == null || !Number.isFinite(v) ? v : Math.abs(v) < 100 ? Math.round(v * 100) / 100 : Math.round(v));

// The levels are the user's own (24 Oct 2026): off until they turn them on,
// from four numbers they set — the margin of safety under today's fair value,
// the gap between levels, the stop under level 3 and the upper level over the
// two-year value. These defaults are the formula the app used before (level 2
// 10% under level 1, level 3 20% under, the stop 7% under level 3, the upper
// 10% over the two-year value), offered as a starting point to change.
export const DEFAULT_LEVEL_SETTINGS = Object.freeze({ mos: 10, step: 10, stop: 7, upper: 10 });
// What each may be set to, in %
export const LEVEL_LIMITS = Object.freeze({ mos: [0, 60], step: [1, 30], stop: [1, 30], upper: [0, 100] });
export const LEVEL_KEYS = ["p1", "p2", "p3", "stopLoss", "target"];

// Settings kept in range; anything missing or not a number is the default
export function cleanLevelSettings(s = {}) {
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(LEVEL_LIMITS)) {
    const v = Number(s?.[k]);
    out[k] = Number.isFinite(v) && s?.[k] !== "" && s?.[k] != null ? Math.min(hi, Math.max(lo, v)) : DEFAULT_LEVEL_SETTINGS[k];
  }
  return out;
}

// The fair values alone: each year's EPS (or book) and its fair value
export function fairValues(eps25, pe, growthPct) {
  const e25 = Number(eps25) || 0;
  const peN = Number(pe) || 0;
  const g = (Number(growthPct) || 0) / 100;
  if (!e25 || !peN) return null;
  const e26 = e25 * (1 + g);
  const e27 = e26 * (1 + g);
  const r = roundPrice;
  return { e26: r(e26), e27: r(e27), fv25: r(e25 * peN), fv26: r(e26 * peN), fv27: r(e27 * peN), exact: { fv25: e25 * peN, fv27: e27 * peN } };
}

// A set of fair values (fairValues, or a levels object) with only those kept,
// so a response carries the fair value and none of the app's own levels
export function fairValueOnly(levels) {
  if (!levels) return null;
  const { e26, e27, fv25, fv26, fv27, exact } = levels;
  return { e26, e27, fv25, fv26, fv27, ...(exact && { exact }) };
}

// Levels from fair values and settings: level 1 the margin of safety under
// today's fair value, levels 2 and 3 one and two gaps under it, the stop
// under level 3 (so all three can be reached before it), the upper level
// over the two-year value
export function levelsFromFairValue(fv, settings = DEFAULT_LEVEL_SETTINGS) {
  const fv25 = fv?.exact?.fv25 ?? fv?.fv25, fv27 = fv?.exact?.fv27 ?? fv?.fv27;
  if (!(fv25 > 0)) return null;
  const { mos, step, stop, upper } = cleanLevelSettings(settings);
  const p1 = fv25 * (1 - mos / 100);
  const p3 = p1 * (1 - (2 * step) / 100);
  const r = roundPrice;
  return {
    e26: fv.e26 ?? null, e27: fv.e27 ?? null, fv25: r(fv25), fv26: fv.fv26 ?? null, fv27: fv27 > 0 ? r(fv27) : null,
    safeBuy: r(p1), p1: r(p1), p2: r(p1 * (1 - step / 100)), p3: r(p3),
    stopLoss: r(p3 * (1 - stop / 100)), target: fv27 > 0 ? r(fv27 * (1 + upper / 100)) : null,
    exact: { fv25, fv27 },
  };
}

// A user's levels for one stock: the five they typed for it, or their
// settings applied to its fair value — or none while their levels are off
// (mine: { settings: { enabled, ...settings }, stocks: { SYMBOL: levels } })
export function userLevels(fv, mine, symbol) {
  const own = symbol && mine?.stocks?.[symbol];
  if (own && LEVEL_KEYS.every(k => own[k] > 0)) {
    return { ...fairValueOnly(fv ?? {}), ...Object.fromEntries(LEVEL_KEYS.map(k => [k, own[k]])), safeBuy: own.p1, own: true };
  }
  if (!mine?.settings?.enabled) return null;
  return levelsFromFairValue(fv, mine.settings);
}

// The original formula at a margin of safety (and the other settings at their
// defaults) — kept for the screener's "vs fair value less 10%" figure and the
// tests; what anyone sees as levels comes from userLevels
export function calculateLevels(eps25, pe, growthPct, mosPct = 10) {
  const fv = fairValues(eps25, pe, growthPct);
  return fv && levelsFromFairValue(fv, { ...DEFAULT_LEVEL_SETTINGS, mos: Number(mosPct) || 10 });
}

export function fmtRs(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const num = Number(n);
  if (num === 0) return "—";
  // paise only where they matter: under ₹100 and not a whole rupee
  if (Math.abs(num) < 100 && Math.round(num * 100) % 100 !== 0) return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "₹" + Math.round(num).toLocaleString("en-IN");
}

// Where a price sits against the levels: { zone, label, tone, detail, gist }.
// The levels are the user's own (userLevels). Tone marks the stop and far
// above the upper level in red; the other levels use a neutral accent. detail
// names the price and the level (watchlist, portfolio, export); gist is for
// the company page, which lists them right below, so it gives only how far
// off they are.
export function pricePosition(price, levels) {
  const p = Number(price);
  if (!levels || !(p > 0)) return null;
  const { p1, p2, p3, stopLoss, target, fv25 } = levels;
  const vsFv = fv25 > 0 ? ((p - fv25) / fv25) * 100 : null;
  const fvGap = vsFv == null ? "" : `${Math.abs(vsFv).toFixed(0)}% ${vsFv <= 0 ? "below" : "above"} today's fair value`;
  const fvText = fvGap && ` — ${fvGap} of ${fmtRs(fv25)}`;
  const at = (zone, label, tone, detail, apart = "") => ({ zone, label, tone, detail: `${detail}${fvText}.`, gist: apart ? `${apart}${fvGap ? ` — ${fvGap}` : ""}.` : fvGap ? `${fvGap.replace(/^./, c => c.toUpperCase())}.` : "" });
  if (stopLoss > 0 && p <= stopLoss) return at("below-stop", "Below your stop level", "red", `${fmtRs(p)} is under your stop level of ${fmtRs(stopLoss)}`);
  if (target > 0 && p >= target * 1.15) return at("far-above", "Far above your upper level", "red", `${fmtRs(p)} is more than 15% over your upper level of ${fmtRs(target)}`);
  if (target > 0 && p >= target) return at("above-upper", "At or above your upper level", "yellow", `${fmtRs(p)} has reached your upper level of ${fmtRs(target)}`);
  if (p3 > 0 && p <= p3) return at("phase3", "At or below your level 3", "neutral", `${fmtRs(p)} is at or under your level 3 of ${fmtRs(p3)}`);
  if (p2 > 0 && p <= p2) return at("phase2", "At or below your level 2", "neutral", `${fmtRs(p)} is at or under your level 2 of ${fmtRs(p2)}`);
  if (p1 > 0 && p <= p1) return at("phase1", "At or below your level 1", "neutral", `${fmtRs(p)} is at or under your level 1 of ${fmtRs(p1)}`);
  if (p1 > 0) {
    const toUpper = target > p ? ` and ${(((target - p) / p) * 100).toFixed(0)}% under your upper level` : "";
    const above = `${(((p - p1) / p1) * 100).toFixed(0)}% above your level 1`;
    return at("above-phase1", "Above your level 1", "neutral", `${fmtRs(p)} is ${above.replace("your level 1", `your level 1 of ${fmtRs(p1)}`)}${toUpper}`, `${above}${toUpper}`);
  }
  return null;
}
