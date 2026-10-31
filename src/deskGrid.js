// My desk's grid (31 Oct 2026, "I should be able to change the sizes of all
// those things and move them anywhere"): 12 columns, rows of a fixed height;
// each card { x, y, w, h } in grid cells. Cards never overlap and float up
// to close gaps, as on a phone's home screen; the one being dragged keeps
// its place and the others make room around it.

export const COLS = 12;
export const MAX_ROWS = 200;

// smallest and starting size of each kind, in cells
export const SIZES = {
  list: { w: 3, h: 18, minW: 2, minH: 6 },
  chart: { w: 6, h: 18, minW: 4, minH: 12 },
  business: { w: 3, h: 18, minW: 2, minH: 6 },
  price: { w: 4, h: 14, minW: 2, minH: 6 },
  peers: { w: 5, h: 14, minW: 3, minH: 6 },
  mood: { w: 12, h: 4, minW: 4, minH: 3 },
  patterns: { w: 4, h: 14, minW: 2, minH: 5 },
  watchlist: { w: 3, h: 14, minW: 2, minH: 5 },
  results: { w: 4, h: 12, minW: 2, minH: 5 },
  notes: { w: 4, h: 8, minW: 2, minH: 3 },
};
const size = kind => SIZES[kind] ?? { w: 4, h: 8, minW: 2, minH: 3 };

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// A card kept inside the grid and at least its smallest size
export function clampCard(c) {
  const s = size(c.kind);
  const w = Math.max(s.minW, Math.min(COLS, Math.round(c.w ?? s.w)));
  const h = Math.max(s.minH, Math.min(60, Math.round(c.h ?? s.h)));
  return { ...c, w, h, x: Math.max(0, Math.min(COLS - w, Math.round(c.x ?? 0))), y: Math.max(0, Math.min(MAX_ROWS, Math.round(c.y ?? 0))) };
}

// Every card floated as high as it can go without overlapping one placed
// before it — in reading order, the pinned one (being dragged) placed first
// and never moved
export function compact(cards, pinnedId = null) {
  const pinned = cards.find(c => c.id === pinnedId);
  const placed = pinned ? [pinned] : [];
  const rest = cards.filter(c => c !== pinned).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of rest) {
    let y = 0;
    const at = { ...c, y };
    while (placed.some(p => overlaps(p, at))) at.y = ++y;
    placed.push(at);
  }
  // back in the order they came, so a card's place in the list doesn't jump
  const byId = new Map(placed.map(c => [c.id, c]));
  return cards.map(c => byId.get(c.id));
}

// Where a new card goes: the first gap from the top that fits it
export function placeNew(cards, card) {
  const c = clampCard(card);
  for (let y = 0; y <= MAX_ROWS; y++) {
    for (let x = 0; x + c.w <= COLS; x++) {
      const at = { ...c, x, y };
      if (!cards.some(o => overlaps(o, at))) return at;
    }
  }
  return { ...c, x: 0, y: Math.max(0, ...cards.map(o => o.y + o.h)) };
}

// A layout from before the grid ({ w: 1–3 } in reading order, 31 Oct 2026)
// laid out in the grid, a third of the width for each step of w
export function fromOld(cards) {
  let out = [];
  for (const c of cards) {
    if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.h)) { out.push(clampCard(c)); continue; }
    const s = size(c.kind);
    out.push(placeNew(out, { ...c, w: c.w >= 1 && c.w <= 3 ? c.w * 4 : s.w, h: s.h }));
  }
  return compact(out);
}
