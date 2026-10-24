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

// Tiles whose areas are their values, filling a w × h box, as near square as
// they'll go (the squarified treemap: Bruls, Huizing & van Wijk) — for the
// balance sheet's map. items: [{ value, … }], biggest first; returns each
// with x, y, w, h.
export function squarify(items, w, h) {
  const total = items.reduce((t, i) => t + i.value, 0);
  if (!(total > 0) || !(w > 0) || !(h > 0)) return [];
  const scale = (w * h) / total;
  const out = [];
  let rest = items.filter(i => i.value > 0).map(i => ({ ...i, area: i.value * scale }));
  let box = { x: 0, y: 0, w, h };
  const worst = (row, side) => {
    const s = row.reduce((t, r) => t + r.area, 0);
    return Math.max(...row.map(r => Math.max((side * side * r.area) / (s * s), (s * s) / (side * side * r.area))));
  };
  while (rest.length) {
    const side = Math.min(box.w, box.h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) row.push(rest[i++]);
    rest = rest.slice(i);
    const s = row.reduce((t, r) => t + r.area, 0);
    if (box.w >= box.h) {
      // a column down the left
      const cw = s / box.h;
      let y = box.y;
      for (const r of row) { const rh = r.area / cw; out.push({ ...r, x: box.x, y, w: cw, h: rh }); y += rh; }
      box = { x: box.x + cw, y: box.y, w: box.w - cw, h: box.h };
    } else {
      // a row along the top
      const rh = s / box.w;
      let x = box.x;
      for (const r of row) { const rw = r.area / rh; out.push({ ...r, x, y: box.y, w: rw, h: rh }); x += rw; }
      box = { x: box.x, y: box.y + rh, w: box.w, h: box.h - rh };
    }
  }
  return out;
}

// Where the cash came from and where it went, over the last `years` years
// added together, from the cash-flow lines: the business's own cash, net new
// borrowing, assets or investments sold and cash drawn down on one side;
// spending on assets, investments bought, dividends, interest, loans repaid
// and cash put by on the other. The two sides are equal by construction —
// whatever the named lines don't explain goes to "Other". null unless every
// one of those years has the three cash-flow totals.
export function sourcesAndUses(history, years = 1) {
  const span = history.slice(0, years);
  if (span.length < years || !span.every(h => h.ocfCr != null && h.investingCfCr != null && h.financingCfCr != null)) return null;
  const t = k => span.reduce((s, h) => s + (h[k] ?? 0), 0);
  const ocf = t("ocfCr"), inv = t("investingCfCr"), fin = t("financingCfCr");
  const capex = t("capexCr"), assetSales = t("assetSalesCr");
  const netBorrow = t("borrowedCr") - Math.abs(t("repaidCr"));
  const dividends = Math.abs(t("dividendsPaidCr")), interest = Math.abs(t("interestPaidCr"));
  const change = span.every(h => h.netCashChangeCr != null) ? t("netCashChangeCr") : ocf + inv + fin;
  const otherInv = inv + capex - assetSales; // investments bought (−) or sold (+), acquisitions
  const otherFin = fin - netBorrow + dividends + interest; // shares issued, leases paid…
  const otherCash = change - (ocf + inv + fin); // exchange rates and the like
  const lines = [
    ["From the business", ocf, "Lost by the business"],
    ["New borrowing (net)", netBorrow, "Loans repaid (net)"],
    ["Assets sold", assetSales, null],
    ["Investments sold", otherInv, "Investments & acquisitions"],
    [null, -capex, "Factories & equipment"],
    [null, -dividends, "Dividends"],
    [null, -interest, "Interest"],
    ["Other financing", otherFin, "Other financing"],
    ["Other", otherCash, "Other"],
    ["Cash drawn down", -change, "Added to cash"],
  ];
  const sources = [], uses = [];
  for (const [inLabel, v, outLabel] of lines) {
    if (!v || Math.abs(v) < 0.005 * Math.max(Math.abs(ocf), 1)) continue;
    if (v > 0) sources.push({ label: inLabel ?? outLabel, value: v });
    else uses.push({ label: outLabel ?? inLabel, value: -v });
  }
  // biggest first on each side
  sources.sort((a, b) => b.value - a.value);
  uses.sort((a, b) => b.value - a.value);
  const total = sources.reduce((s, l) => s + l.value, 0);
  return sources.length && uses.length ? { years: span.length, total, sources, uses } : null;
}

// The trailing twelve months as one more column for the Profit & Loss table:
// the last four quarters added line by line — only when they're four in a
// row, and a line only when all four have it
const TTM_KEYS = ["revenueCr", "expensesCr", "operatingProfitCr", "otherIncomeCr", "depreciationCr", "financeCostsCr", "pbtCr", "taxCr", "profitCr", "eps",
  "materialsCr", "purchasesCr", "inventoryChangeCr", "employeesCr", "otherExpensesCr", "exceptionalCr"];
export function ttmOf(quarters) {
  const last4 = (quarters ?? []).slice(0, 4);
  const DAY = 86400000;
  const inARow = last4.length === 4 && last4.every((q, i) => i === 0 || Math.abs(Date.parse(last4[i - 1].fyEnd) - Date.parse(q.fyEnd) - 91 * DAY) <= 20 * DAY);
  if (!inARow || last4.some(q => q.revenueCr == null)) return null;
  const out = { fyEnd: last4[0].fyEnd, label: "TTM", ttm: true, scope: last4[0].scope };
  for (const k of TTM_KEYS) out[k] = last4.every(q => q[k] != null) ? last4.reduce((t, q) => t + q[k], 0) : null;
  out.opm = out.operatingProfitCr != null && out.revenueCr > 0 ? (out.operatingProfitCr / out.revenueCr) * 100 : null;
  return out;
}
