// The position sizing worksheet's arithmetic (PhasePositionPlanner.jsx), kept
// apart so it can be tested: node --no-warnings src/position-plan-test.js
//
// levels: { p1, p2, p3, stopLoss } — the user's own levels; any may be missing.
// split: parts per level, indexed by level number - 1 (so a missing level 2
// never hands its part to level 3).
export function planPosition({ capital, maxLoss, levels, split }) {
  const cap = Number(capital);
  const limit = Number(maxLoss);
  const stop = Number(levels?.stopLoss);
  const hasStop = stop > 0;
  // Each level keeps its own number: level 3 is "Level 3" even when 2 is unset
  const entries = [levels?.p1, levels?.p2, levels?.p3]
    .map((price, i) => ({ level: i + 1, entry: Number(price) }))
    .filter(row => row.entry > 0);
  const parts = entries.map(row => Math.max(0, Number(split?.[row.level - 1]) || 0));
  const partTotal = parts.reduce((a, b) => a + b, 0);
  // A stop at or above a level isn't a stop for that level: buying there would
  // already be past it. Flagged rather than silently counted as ₹0 loss.
  const stopAbove = hasStop ? entries.filter(row => row.entry <= stop).map(row => row.level) : [];
  if (!(cap > 0) || !entries.length || !(partTotal > 0)) return { entries, stopAbove, result: null };

  const riskOf = row => (hasStop ? Math.max(0, row.entry - stop) : 0);
  const raw = entries.map((row, i) => {
    const budget = (cap * parts[i]) / partTotal;
    return { ...row, budget, shares: Math.floor(budget / row.entry) };
  });
  const rawLoss = hasStop ? raw.reduce((sum, row) => sum + row.shares * riskOf(row), 0) : null;
  const scale = limit > 0 && rawLoss > limit ? limit / rawLoss : 1;
  // Rounding down keeps the loss at or under the limit, never over it
  const tranches = raw.map(row => ({ ...row, shares: Math.floor(row.shares * scale) }))
    .map(row => ({ ...row, used: row.shares * row.entry, loss: hasStop ? row.shares * riskOf(row) : null }));
  const invested = tranches.reduce((sum, row) => sum + row.used, 0);
  const lossAtStop = hasStop ? tranches.reduce((sum, row) => sum + row.loss, 0) : null;
  return {
    entries,
    stopAbove,
    result: {
      tranches,
      invested,
      reserve: Math.max(0, cap - invested),
      lossAtStop,
      lossPct: hasStop && cap > 0 ? (lossAtStop / cap) * 100 : null,
      scaled: scale < 1,
      // a level whose cash can't buy even one share at that price
      tooSmall: raw.filter(row => row.budget > 0 && row.shares === 0).map(row => row.level),
    },
  };
}
