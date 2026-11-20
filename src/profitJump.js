// Why profit jumped (20 Nov 2026, the owner: "some companies' profits jump
// like −10 to 55 cr … I just want somewhere to know why"). From the company's
// own filed lines only, never a guess: the change in net profit between two
// periods (a quarter and the same quarter a year earlier, or a year and the
// year before), split into where it came from — the business (sales and
// margin), other income, one-off (exceptional) items, interest, depreciation
// and tax. What the lines don't cover (an associate's share, a business sold)
// is shown as "other lines", never put down to anything.

const n = v => (v == null || !Number.isFinite(v) ? null : v);

// A jump worth explaining: a loss turned to profit (or back), or profit up
// half as much again or down by 40%, by at least ₹1 cr
export function isJump(now, then) {
  const a = n(now?.profitCr), b = n(then?.profitCr);
  if (a == null || b == null) return false;
  const d = a - b;
  if (Math.abs(d) < 1) return false;
  if (Math.sign(a) !== Math.sign(b) && (a !== 0 || b !== 0)) return true;
  if (b === 0) return true;
  const pct = (d / Math.abs(b)) * 100;
  return pct >= 50 || pct <= -40;
}

// { change, parts: [{ key, label, cr, note }], main, lender } or null
export function profitBridge(now, then, { lender = false } = {}) {
  if (!isJump(now, then)) return null;
  const d = (k, zeroIfMissing = false) => {
    let a = n(now[k]), b = n(then[k]);
    if (zeroIfMissing) { a ??= 0; b ??= 0; }
    return a == null || b == null ? null : a - b;
  };
  const change = now.profitCr - then.profitCr;
  const parts = [];
  const opD = lender ? null : d("operatingProfitCr");
  const pbtD = d("pbtCr");
  // XBRL leaves the exceptional line out when there's none
  const excD = d("exceptionalCr", true);
  const oiD = d("otherIncomeCr");
  if (opD != null) {
    let note = null;
    const s0 = n(then.revenueCr), s1 = n(now.revenueCr), m0 = n(then.opm), m1 = n(now.opm);
    if (s0 > 0 && s1 != null) {
      const sales = ((s1 / s0 - 1) * 100);
      note = `Sales ${sales >= 0 ? "up" : "down"} ${Math.abs(sales).toFixed(0)}%`;
      if (m0 != null && m1 != null) note += `, operating margin ${m1 >= m0 ? "up" : "down"} from ${m0.toFixed(1)}% to ${m1.toFixed(1)}%`;
    }
    parts.push({ key: "business", label: "The business itself", cr: opD, note });
  }
  if (oiD != null) parts.push({ key: "otherIncome", label: "Other income", cr: oiD, note: "Interest, dividends and gains on investments, outside the main business" });
  if (excD) {
    const a = n(now.exceptionalCr) ?? 0, b = n(then.exceptionalCr) ?? 0;
    const bits = [];
    if (a) bits.push(`${a > 0 ? "a one-off gain" : "a one-off charge"} of ₹${fmt(Math.abs(a))} cr in this period`);
    if (b) bits.push(`${b > 0 ? "a one-off gain" : "a one-off charge"} of ₹${fmt(Math.abs(b))} cr in the earlier one`);
    parts.push({ key: "exceptional", label: "One-off (exceptional) items", cr: excD, note: `The results show ${bits.join(" and ")}. A one-off doesn't repeat by itself.` });
  }
  if (!lender) {
    const fin = d("financeCostsCr"), dep = d("depreciationCr");
    if (fin != null) parts.push({ key: "interest", label: "Interest cost", cr: -fin, note: fin > 0 ? "More interest paid" : fin < 0 ? "Less interest paid" : null });
    if (dep != null) parts.push({ key: "depreciation", label: "Depreciation", cr: -dep, note: null });
  } else if (pbtD != null) {
    // a lender's pre-tax profit apart from other income and one-offs:
    // interest earned less interest paid, costs and provisions
    parts.unshift({ key: "business", label: "The lending business", cr: pbtD - (oiD ?? 0) - excD, note: "Interest earned less interest paid, running costs and provisions for bad loans" });
  }
  const taxD = d("taxCr");
  if (taxD != null) parts.push({ key: "tax", label: "Tax", cr: -taxD, note: taxD < 0 ? "Less tax charged" : taxD > 0 ? "More tax charged" : null });
  // what the lines don't cover, before tax and after it, never put down to anything
  const small = v => Math.abs(v) < Math.max(0.5, Math.abs(change) * 0.03);
  const preTax = parts.filter(p => p.key !== "tax").reduce((s, p) => s + p.cr, 0);
  if (pbtD != null) {
    const before = pbtD - preTax;
    if (!small(before)) parts.push({ key: "other", label: "Other lines before tax", cr: before, note: "In the results but not split out here, such as a one-off item or a share of an associate's profit. The results filing shows them." });
    const after = change - pbtD + (taxD ?? 0);
    if (!small(after)) parts.push({ key: "afterTax", label: taxD == null ? "Tax and lines after tax" : "Lines after tax", cr: after, note: taxD == null ? "Tax, and anything after it such as a business sold or closed" : "Such as a business sold or closed, or an associate's share" });
  } else {
    const rest = change - parts.reduce((s, p) => s + p.cr, 0);
    if (!small(rest)) parts.push({ key: "other", label: "Other lines", cr: rest, note: "Lines not split out here. The results filing shows them." });
  }
  const shown = parts.filter(p => Math.abs(p.cr) >= 0.05);
  // the line that moved most in the jump's direction
  const dir = Math.sign(change);
  const main = [...shown].filter(p => Math.sign(p.cr) === dir).sort((a, b) => Math.abs(b.cr) - Math.abs(a.cr))[0] ?? null;
  const share = main ? Math.abs(main.cr) / shown.filter(p => Math.sign(p.cr) === dir).reduce((s, p) => s + Math.abs(p.cr), 0) : 0;
  return { change, parts: shown.sort((a, b) => Math.abs(b.cr) - Math.abs(a.cr)), main, mostly: share >= 0.5, lender };
}

export function fmt(v) {
  const a = Math.abs(v);
  return a >= 100 ? Math.round(a).toLocaleString("en-IN") : a.toLocaleString("en-IN", { maximumFractionDigits: a >= 10 ? 0 : 1 });
}

// "a loss of ₹10 cr" / "₹55 cr"
export const profitWords = v => (v < 0 ? `a loss of ₹${fmt(v)} cr` : `₹${fmt(v)} cr`);

// One sentence on the main reason, in plain words
export function headline(b) {
  if (!b?.main) return null;
  const up = b.change > 0;
  const lead = b.mostly ? "Mostly" : "Largest part";
  switch (b.main.key) {
    case "business": return `${lead} from ${b.lender ? "the lending business" : "the business itself"}${b.main.note ? ` (${b.main.note.charAt(0).toLowerCase()}${b.main.note.slice(1)})` : ""}.`;
    case "otherIncome": return `${lead} from ${up ? "more" : "less"} other income, outside the main business.`;
    case "exceptional": return `${lead} from a one-off (exceptional) item, which doesn't repeat by itself.`;
    case "interest": return `${lead} from ${up ? "less" : "more"} interest paid.`;
    case "depreciation": return `${lead} from ${up ? "lower" : "higher"} depreciation.`;
    case "tax": return `${lead} from ${up ? "less" : "more"} tax charged.`;
    case "afterTax": return `${lead} from tax and the lines after it. The results filing shows them.`;
    default: return `${lead} from lines the figures here don't split out. The results filing shows them.`;
  }
}
