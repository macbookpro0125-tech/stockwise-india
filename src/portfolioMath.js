// Return a complete portfolio total only when every holding has a current
// price. Treating an unpriced position as if it were unchanged hides a gap.
export function portfolioSummary(rows) {
  const totalInvested = rows.reduce((sum, row) => sum + row.invested, 0);
  const unpriced = [...new Set(rows.filter(row => !(row.cmp > 0) || !Number.isFinite(row.currentVal)).map(row => row.ticker))];
  const allPricesLoaded = unpriced.length === 0;
  const totalCurrent = allPricesLoaded ? rows.reduce((sum, row) => sum + row.currentVal, 0) : null;
  const totalPL = totalCurrent == null ? null : totalCurrent - totalInvested;
  const totalPLPct = totalPL == null || totalInvested <= 0 ? null : (totalPL / totalInvested) * 100;
  return { totalInvested, totalCurrent, totalPL, totalPLPct, unpriced, allPricesLoaded };
}
