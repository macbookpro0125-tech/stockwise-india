// Moving a screener filter up or down the panel (FilterPanel.jsx). Market cap
// size and sector are pinned at the top whatever their place in the list;
// the others are shown in list order, which is also the order of their
// columns in the results (DiscoverView.jsx). A move swaps a filter with the
// next shown one in that direction; a list that can't change comes back as is.

const PINNED = new Set(["capSize", "sector"]);
const movable = filters => filters.map((f, i) => (PINNED.has(f.id) ? -1 : i)).filter(i => i >= 0);

export function moveFilter(filters, id, step) {
  const order = movable(filters);
  const at = order.findIndex(i => filters[i].id === id);
  const to = at + Math.sign(step);
  if (at < 0 || to < 0 || to >= order.length) return filters;
  const next = [...filters];
  [next[order[at]], next[order[to]]] = [next[order[to]], next[order[at]]];
  return next;
}

export function canMove(filters, id) {
  const order = movable(filters);
  const at = order.findIndex(i => filters[i].id === id);
  return { up: at > 0, down: at >= 0 && at < order.length - 1 };
}
