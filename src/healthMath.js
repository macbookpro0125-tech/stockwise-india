// The figures behind the company page's financial health (StockHealth.jsx),
// from the yearly results the company endpoint already sends (m.history,
// newest first, crores). The latest year with a balance sheet is used: what
// it owns against what it owes in the short and long term, its debt
// (borrowings and lease liabilities, as the Scorecard counts them) against
// its cash and liquid investments, how well cash flow and profit cover that
// debt, and — when free cash flow is negative — how long its cash would
// last at last year's burn. Lenders aren't measured this way (the page says so).

export function healthFigures(history) {
  const latest = (history ?? []).find(y => y.totalAssetsCr != null && y.equityCr != null);
  if (!latest) return null;
  const ca = latest.currentAssetsCr, cl = latest.currentLiabilitiesCr;
  const longTerm = latest.totalAssetsCr - latest.equityCr - (cl ?? 0);
  const borrowings = latest.debtCr ?? 0, leases = latest.leasesCr ?? 0, total = borrowings + leases, cash = latest.liquidCr ?? 0;
  const ocf = latest.ocfCr, fcf = latest.fcfCr, fin = latest.financeCostsCr, pbt = latest.pbtCr;
  const ebit = pbt != null && fin != null ? pbt + fin : null;
  return {
    fyEnd: latest.fyEnd,
    shortTerm: { assets: ca ?? null, liabilities: cl ?? null, cover: ca != null && cl > 0 ? ca / cl : null },
    longTerm: { liabilities: longTerm, cover: ca != null && longTerm > 0 ? ca / longTerm : null },
    debt: { borrowings, leases, total, cash, net: total - cash },
    // how much of the debt one year's operating cash flow would repay
    ocfToDebt: total > 0 && ocf > 0 ? (ocf / total) * 100 : null,
    interestCover: fin > 0 && ebit > 0 ? ebit / fin : null,
    runway: fcf < 0 ? { years: cash > 0 ? cash / -fcf : 0, burn: -fcf, cash } : null,
    // By year, borrowings to equity: most companies' older filings carry no
    // lease figures (986 of 1,092 with leases, Oct 2026), so a yearly series
    // with leases would jump in the latest year for no reason. The latest
    // year with leases — the Scorecard's figure — is given apart.
    deHistory: [...(history ?? [])].reverse().filter(y => y.debtCr != null && y.equityCr > 0).map(y => ({ fy: y.fyEnd, de: y.debtCr / y.equityCr })),
    deWithLeases: latest.debtToEquity ?? null,
  };
}
