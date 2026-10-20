// Where Discover's strategies page opens when you come back from a stock
// list (DiscoverView.jsx): where you were, if that was among the strategies;
// else the top of the strategies grid (just under the pinned header) — never
// the intro above it, which you'd have to scroll past to find them.
export function returnScroll(savedY, gridTop, headerH = 0) {
  const grid = gridTop == null ? null : Math.max(0, gridTop - headerH - 12);
  return Math.max(savedY ?? 0, grid ?? 0);
}
