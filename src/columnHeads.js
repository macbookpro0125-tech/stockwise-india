// The table's column headings, short (31 Oct 2026, "it's wasting the
// space"): the usual Indian-market shorthand where there is one (PAT, NPM,
// ICR, GNPA), the full name on hover (the heading's title). A measure not
// listed keeps its catalogue short name.
export const HEAD = {
  priceStrength: "PS", qualityOnly: "Q ex-val", researchScore: "Res", businessScore: "Bus", earningsScore: "Earn",
  governanceScore: "Gov", valuationScore: "Val", technicalScore: "Tech", confidence: "Data q",
  pe: "P/E", medianPe: "Med P/E", peVsMedian: "P/E±med", earningsYield: "E yield", divYield: "Yield", vsPhase1: "vs FV−10%",
  mcapToNcav: "MC/NCAV", netMargin: "NPM", netMargin5y: "NPM 5Y", cashFlowMargin: "CF mgn",
  qSalesGrowthYoY: "Q Sales", qProfitGrowthYoY: "Q PAT", qSalesGrowthQoQ: "QoQ Sales", qProfitGrowthQoQ: "QoQ PAT",
  ttmRevenueCr: "Sales TTM", ttmProfitCr: "PAT TTM", profitGrowth1y: "PAT 1Y", profitGrowth3y: "PAT 3Y", profitGrowth5y: "PAT 5Y",
  ret1wVsNifty: "Rel 1W", ret1mVsNifty: "Rel 1M", ret3mVsNifty: "Rel 3M", ret6mVsNifty: "Rel 6M", ret1yVsNifty: "Rel 1Y", ret1yVsSector: "Rel Sec",
  priceCagr5y: "Px 5Y", downFrom52wHigh: "↓52W", upFrom52wLow: "↑52W",
  avgVolume1m: "AvgV 1M", avgVolume3m: "AvgV 3M", volumeChange1d: "ΔV 1D", volumeChange1w: "ΔV 1W", volVsAvg50: "V×avg",
  delivery1d: "Del 1D", deliveryJump: "ΔDel", delivery1m: "Del", vsEma20: "vs20E", vsSma50: "vs50D", vsSma200: "vs200D",
  volatility1y: "Vol", maxLoss1y: "MaxDD", promoterPct: "Prom", pledgedPct: "Pledge", freeFloat: "Float",
  interestCoverage: "ICR", currentRatio: "CR", assetTurnover: "AT", piotroski: "Piotr.",
  otherIncomeCr: "Oth inc", rawMaterialsCr: "RM", currentAssetsCr: "CA", currentLiabilitiesCr: "CL", shareCapitalCr: "Sh cap",
  gnpaPct: "GNPA", creditDepositPct: "C/D", costToIncomePct: "C/I", creditCostPct: "Cr cost", loanGrowthPct: "Loans", depositGrowthPct: "Deposits", faceValue: "FV",
};
export const headOf = def => HEAD[def.id] ?? def.short ?? def.label;

// The order you've dragged the columns into, remembered on this device: the
// shown ids sorted by it, any it hasn't seen keeping their place after
export function inOrder(ids, order) {
  const at = new Map((order ?? []).map((id, i) => [id, i]));
  return ids.map((id, i) => [id, at.has(id) ? at.get(id) : order.length + i]).sort((a, b) => a[1] - b[1]).map(([id]) => id);
}
// The order after moving one column onto another's place
export function moveTo(ids, id, target) {
  const from = ids.indexOf(id), to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.filter(x => x !== id);
  next.splice(to, 0, id);
  return next;
}

// Measures that come in periods (31 Oct 2026): a column switches between
// them in place from its ▾ menu, rather than one column a period
export const PERIOD_FAMILIES = [
  [["ret1d", "1 day"], ["ret1w", "1 week"], ["ret1m", "1 month"], ["ret3m", "3 months"], ["ret6m", "6 months"], ["ret9m", "9 months"], ["ret1y", "1 year"], ["ret3y", "3 years"], ["ret5y", "5 years"]],
  [["ret1wVsNifty", "1 week"], ["ret1mVsNifty", "1 month"], ["ret3mVsNifty", "3 months"], ["ret6mVsNifty", "6 months"], ["ret1yVsNifty", "1 year"]],
  [["salesGrowth1y", "1 year"], ["salesGrowth3y", "3 years"], ["salesGrowth5y", "5 years"]],
  [["profitGrowth1y", "1 year"], ["profitGrowth3y", "3 years"], ["profitGrowth5y", "5 years"]],
  [["epsGrowth1y", "1 year"], ["epsGrowth3y", "3 years"], ["epsGrowth5y", "5 years"]],
  [["ebitdaGrowth1y", "1 year"], ["ebitdaGrowth5y", "5 years"]],
  [["roce", "Latest year"], ["roce5y", "5-year average"]],
  [["opm", "Latest year"], ["opm5y", "5-year average"]],
  [["netMargin", "Latest year"], ["netMargin5y", "5-year average"]],
  [["roe", "Latest year"], ["roeAvg", "Average"]],
  [["delivery1d", "Last day"], ["delivery1m", "1-month average"]],
  [["volumeChange1d", "1 day"], ["volumeChange1w", "1 week"]],
  [["avgVolume1m", "1 month"], ["avgVolume3m", "3 months"]],
];
// The periods a column can switch between (those the app knows), or null
export function periodsOf(id, known = () => true) {
  const fam = PERIOD_FAMILIES.find(f => f.some(([x]) => x === id));
  const list = fam?.filter(([x]) => known(x));
  return list && list.length > 1 ? list : null;
}
// The order after moving a column left, right, to the start or the end
export function moveStep(ids, id, where) {
  const i = ids.indexOf(id);
  if (i < 0) return ids;
  const target = where === "left" ? ids[i - 1] : where === "right" ? ids[i + 1] : where === "start" ? ids[0] : ids[ids.length - 1];
  return target == null ? ids : moveTo(ids, id, target);
}
