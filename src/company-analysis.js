// Human-written reading guides for three widely followed NSE companies.
// Numeric observations come from each company's public stock summary; the
// guides explain which figures to compare without making a recommendation.
export const COMPANY_ANALYSIS = {
  TCS: {
    title: "TCS results and valuation: what to watch",
    lens: "For an IT services company, read revenue growth alongside operating margin and profit growth. A faster sales line does not automatically mean improving profitability.",
    checks: [
      "Compare operating margin with the same quarter a year earlier. Changes can reflect delivery costs, utilisation, wage changes and business mix; the headline ratio alone does not identify the cause.",
      "Check whether profit growth is supported by operating performance. Other income, tax and one-off items can make net profit move differently from operating profit.",
      "Read the current P/E as a price-to-reported-earnings snapshot. Jocular's reference fair-value method uses normalized earnings and historical multiples when enough observations are available; see the methodology for its limits.",
    ],
    watch: "Useful next checks in the full results: constant-currency growth, deal wins and conversion, client concentration, employee costs, cash generation and the company’s own outlook. These details are not all represented by the summary ratios above.",
  },
  RELIANCE: {
    title: "Reliance Industries results: reading the consolidated numbers",
    lens: "Reliance combines businesses with different economics. Consolidated revenue, operating margin and profit describe the group total, but can hide very different movements across its segments.",
    checks: [
      "Compare revenue and net profit growth for the same quarter. When they move in opposite directions, use the filed results to inspect costs, depreciation, financing, tax and other income before drawing a conclusion.",
      "Compare operating margin with the same quarter a year earlier, not only the previous quarter. Refining, retail, digital services and other activities can have different seasonal patterns.",
      "Treat P/E, ROE, ROCE and debt-to-equity as group-level context. They do not replace segment results, cash-flow analysis or a review of debt maturities and capital spending.",
    ],
    watch: "Useful next checks in the full results: segment revenue and EBITDA, refining and petrochemical spreads, retail operating metrics, telecom subscriber and ARPU trends, capital expenditure, net debt and cash flow. The group ratios here do not explain these drivers.",
  },
  HDFCBANK: {
    title: "HDFC Bank results and valuation: bank-specific checks",
    lens: "For a bank, price-to-book and return on equity are more useful starting points than industrial-company measures such as ROCE, debt-to-equity or operating margin. Deposits and borrowings are part of how a bank operates, so those industrial ratios are not shown as if they were directly comparable.",
    checks: [
      "Compare net profit with the same quarter a year earlier, then check whether the filing shows a similar direction in net interest income and pre-provision operating profit.",
      "A bank’s growth and risk picture also depends on net interest margin, deposit growth and mix, loan growth, slippages, provisions, capital adequacy and asset quality. These details need the full results; the compact public snapshot does not contain them.",
      "Read P/B together with ROE and asset quality, not in isolation. P/E is another price snapshot and does not capture funding costs or future credit losses by itself.",
    ],
    watch: "Useful next checks in the full results: CASA and term-deposit growth, loan-to-deposit ratio, net interest margin, gross and net NPA, credit costs, provision coverage and capital adequacy. These are not inferred from the summary P/E or P/B.",
  },
};

export const ANALYSIS_EXAMPLES = [
  { symbol: "TCS", name: "TCS results and valuation analysis" },
  { symbol: "RELIANCE", name: "Reliance Industries results analysis" },
  { symbol: "HDFCBANK", name: "HDFC Bank results and valuation analysis" },
];

const sameQuarterLastYear = (quarters = []) => {
  const latest = quarters[0];
  if (!latest?.fyEnd) return null;
  const [year, month, day] = latest.fyEnd.split("-").map(Number);
  const target = `${year - 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return quarters.find(q => q.fyEnd === target) ?? null;
};

export function companyAnalysisFor(stock) {
  const profile = COMPANY_ANALYSIS[stock?.symbol];
  if (!profile) return null;
  const latest = stock.quarter ?? null;
  const yearAgo = sameQuarterLastYear(stock.recentQuarters ?? []);
  return {
    ...profile,
    symbol: stock.symbol,
    latest,
    yearAgo,
    closeDate: stock.closeDate ?? null,
    marketRatios: {
      pe: stock.pe ?? null,
      pb: stock.pb ?? null,
      roe: stock.roe ?? null,
      roce: stock.roce ?? null,
      debtToEquity: stock.debtToEquity ?? null,
      divYield: stock.divYield ?? null,
    },
  };
}
