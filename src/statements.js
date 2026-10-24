// The company page's statements as pictures (StatementCharts.jsx): one year's
// profit and loss and cash flow as steps from sales down to profit, and its
// balance sheet as what it owns beside how that's paid for. Plain arithmetic
// on the year's filed lines (server/metrics.js history, in ₹ Cr); a line the
// filing doesn't have is left out, and whatever the named lines don't explain
// shows as "Other", so every picture adds up to the filed totals.

const known = (...v) => v.filter(x => x != null && Number.isFinite(x));
const sum = (...v) => { const k = known(...v); return k.length ? k.reduce((a, b) => a + b, 0) : null; };
// Small enough to leave out: under half a percent of the base
const small = (v, base) => v == null || Math.abs(v) < Math.abs(base) * 0.005;

// Materials and goods bought, the stock change included (it's negative when
// the company built up stock, which it then didn't sell)
export const materialsOf = h => sum(h.materialsCr, h.purchasesCr, h.inventoryChangeCr);

// Profit and loss, sales to net profit: [{ label, value, kind }] where kind is
// "total" (a bar from 0) or "step" (a change from the bar before; value
// signed). null without sales and profit.
export function profitSteps(h) {
  const sales = h.revenueCr, net = h.profitCr;
  if (!(sales > 0) || net == null) return null;
  const steps = [{ label: "Sales", value: sales, kind: "total" }];
  const opCosts = h.expensesCr != null ? h.expensesCr - (h.depreciationCr ?? 0) - (h.financeCostsCr ?? 0) : null;
  if (h.operatingProfitCr != null && opCosts != null) {
    const parts = [["Materials & goods", materialsOf(h)], ["Employees", h.employeesCr], ["Other expenses", h.otherExpensesCr]].filter(([, v]) => v != null && !small(v, sales));
    const named = sum(...parts.map(([, v]) => v)) ?? 0;
    if (parts.length) {
      for (const [label, v] of parts) steps.push({ label, value: -v, kind: "step" });
      const rest = opCosts - named;
      if (!small(rest, sales)) steps.push({ label: "Other costs", value: -rest, kind: "step" });
    } else steps.push({ label: "Operating costs", value: -opCosts, kind: "step" });
    steps.push({ label: "Operating profit", value: h.operatingProfitCr, kind: "total" });
    let at = h.operatingProfitCr;
    // one-off (exceptional) items are filed with either sign, so they're
    // what's left between these and the filed profit before tax
    for (const [label, v] of [["Other income", h.otherIncomeCr], ["Depreciation", -(h.depreciationCr ?? 0)], ["Interest", -(h.financeCostsCr ?? 0)]]) {
      if (v == null || small(v, sales)) continue;
      steps.push({ label, value: v, kind: "step" }); at += v;
    }
    if (h.pbtCr != null) {
      if (!small(h.pbtCr - at, sales)) steps.push({ label: h.exceptionalCr != null && !small(h.exceptionalCr, sales) ? "One-off & other items" : "Other items", value: h.pbtCr - at, kind: "step" });
      steps.push({ label: "Profit before tax", value: h.pbtCr, kind: "total" });
      at = h.pbtCr;
    }
    if (h.taxCr != null && !small(h.taxCr, sales)) { steps.push({ label: "Tax", value: -h.taxCr, kind: "step" }); at -= h.taxCr; }
    // a share of associates' profit, discontinued operations… (and the tax,
    // when the filing has no tax line)
    if (!small(net - at, sales)) steps.push({ label: h.taxCr == null && h.pbtCr != null ? "Tax & other items" : "Other items", value: net - at, kind: "step" });
  } else {
    steps.push({ label: "Costs, tax and the rest", value: net - sales, kind: "step" });
  }
  steps.push({ label: "Net profit", value: net, kind: "total" });
  return steps;
}

// Cash flow: what came in or went out from the business, from investing and
// from financing, and the year's change in cash. null without operations.
export function cashSteps(h) {
  if (h.ocfCr == null) return null;
  const steps = [{ label: "From the business", value: h.ocfCr, kind: "step" }];
  if (h.investingCfCr != null) steps.push({ label: "Investing", value: h.investingCfCr, kind: "step" });
  if (h.financingCfCr != null) steps.push({ label: "Financing", value: h.financingCfCr, kind: "step" });
  if (steps.length < 2) return null;
  const total = steps.reduce((t, s) => t + s.value, 0);
  // the filed change, where it differs (exchange rates, a subsidiary bought…)
  const net = h.netCashChangeCr ?? total;
  if (!small(net - total, h.ocfCr || 1)) steps.push({ label: "Other", value: net - total, kind: "step" });
  steps.push({ label: "Change in cash", value: net, kind: "total" });
  return steps;
}

// Where the cash went, in words: the payments and receipts behind the three
// totals (payments are filed as positive amounts)
export function cashLines(h) {
  return [
    ["Spent on factories, equipment and software", h.capexCr != null ? -h.capexCr : null],
    ["From selling assets", h.assetSalesCr],
    ["Dividends paid", h.dividendsPaidCr != null ? -Math.abs(h.dividendsPaidCr) : null],
    ["Interest paid", h.interestPaidCr != null ? -Math.abs(h.interestPaidCr) : null],
    ["Tax paid", h.taxesPaidCr != null ? -h.taxesPaidCr : null],
    ["New borrowing", h.borrowedCr],
    ["Loans repaid", h.repaidCr != null ? -Math.abs(h.repaidCr) : null],
  ].filter(([, v]) => v != null && v !== 0).map(([label, value]) => ({ label, value }));
}

// The balance sheet: what it owns, and how that's paid for, each adding up to
// the filed total. null without the total or with under two named parts.
export function balanceParts(h) {
  const total = h.totalAssetsCr ?? h.assetsCr;
  if (!(total > 0)) return null;
  const side = lines => {
    const named = lines.filter(([, v]) => v != null && v > 0 && !small(v, total));
    if (named.length < 2) return null;
    const other = total - named.reduce((t, [, v]) => t + v, 0);
    const parts = named.map(([label, value]) => ({ label, value }));
    if (other > total * 0.005) parts.push({ label: "Other", value: other });
    // the named lines can't add up to more than the whole
    return other < -total * 0.02 ? null : parts;
  };
  const owns = side([
    ["Factories & equipment", sum(h.ppeCr, h.cwipCr)],
    ["Goodwill & intangibles", sum(h.goodwillCr, h.intangiblesCr)],
    ["Long-term investments", h.investmentsNcCr],
    ["Inventory", h.inventoriesCr],
    ["Owed by customers", h.receivablesCr],
    ["Cash & liquid investments", h.liquidCr],
  ]);
  const borrowings = sum(h.ltDebtCr, h.borrowingsCurrentCr) ?? h.debtCr;
  const funded = side([
    ["Shareholders' money", h.equityCr],
    ["Borrowings", borrowings],
    ["Leases", h.leasesCr],
    ["Owed to suppliers", h.payablesCr],
  ]);
  return owns && funded ? { total, owns, funded } : null;
}

// Revenue by segment for one year, biggest first, each with its share and
// growth on the year before (matched by name) and its margin where filed
export function segmentMix(h, prev) {
  const segs = (h?.segments ?? []).filter(s => s.revenueCr > 0);
  if (segs.length < 2) return null;
  const total = segs.reduce((t, s) => t + s.revenueCr, 0);
  const before = new Map((prev?.segments ?? []).map(s => [s.name.toLowerCase(), s.revenueCr]));
  return {
    by: h.segmentsBy ?? "business",
    total,
    parts: segs.map(s => {
      const was = before.get(s.name.toLowerCase());
      return {
        name: s.name, revenueCr: s.revenueCr, sharePct: (s.revenueCr / total) * 100,
        growthPct: was > 0 ? (s.revenueCr / was - 1) * 100 : null,
        marginPct: s.resultCr != null ? (s.resultCr / s.revenueCr) * 100 : null,
      };
    }).sort((a, b) => b.revenueCr - a.revenueCr),
  };
}
