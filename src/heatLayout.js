// The heat map's layout (31 Oct 2026, "have you seen Finviz's maps"): the
// companies in a block for each sector, each sector's industries in blocks
// of their own, so a day of falling banks and rising IT reads at a glance.
// Plain geometry, no DOM: boxes in, boxes out.

// Squarified treemap: boxes in proportion to their weight, as near square as
// the space allows (Bruls, Huizing & van Wijk), biggest first
export function squarify(items, width, height) {
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (!total || width <= 0 || height <= 0) return [];
  const nodes = items.map(i => ({ ...i, area: (i.weight / total) * width * height }));
  const out = [];
  let r = { x: 0, y: 0, w: width, h: height }, row = [];
  const worst = (list, side) => {
    const sum = list.reduce((a, n) => a + n.area, 0), max = Math.max(...list.map(n => n.area)), min = Math.min(...list.map(n => n.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };
  const place = list => {
    const sum = list.reduce((a, n) => a + n.area, 0);
    if (r.w >= r.h) {
      const w = sum / r.h; let y = r.y;
      for (const n of list) { out.push({ ...n, x: r.x, y, w, h: n.area / w }); y += n.area / w; }
      r = { x: r.x + w, y: r.y, w: r.w - w, h: r.h };
    } else {
      const h = sum / r.w; let x = r.x;
      for (const n of list) { out.push({ ...n, x, y: r.y, w: n.area / h, h }); x += n.area / h; }
      r = { x: r.x, y: r.y + h, w: r.w, h: r.h - h };
    }
  };
  for (const n of nodes) {
    const side = Math.min(r.w, r.h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { place(row); row = [n]; }
  }
  if (row.length) place(row);
  return out;
}

export const OTHER = "Other";

// How many rose and fell (a move under 0.05% either way is unchanged)
export function breadth(items) {
  let up = 0, down = 0;
  for (const i of items) { if (i.change > 0.05) up++; else if (i.change < -0.05) down++; }
  return { up, down, flat: items.length - up - down };
}

// A group's move: its companies' moves weighted by market value (whatever the
// boxes are sized by — an equal-sized map still says how the sector did)
export function groupMove(items) {
  const cap = items.reduce((a, i) => a + (i.cap ?? 0), 0);
  if (!cap) return items.length ? items.reduce((a, i) => a + i.change, 0) / items.length : 0;
  return items.reduce((a, i) => a + i.change * (i.cap ?? 0), 0) / cap;
}

function groupBy(items, key) {
  const m = new Map();
  for (const i of items) {
    const k = i[key] || OTHER;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }
  return [...m.entries()].map(([name, list]) => ({ name, list, weight: list.reduce((a, i) => a + i.weight, 0) }))
    .sort((a, b) => b.weight - a.weight);
}

const SECTOR_HEAD = 17, INDUSTRY_HEAD = 13;
// a heading only where the block has room for it and a row of boxes under it
const roomFor = (r, head) => r.w >= 64 && r.h >= head * 3;

// Items: { weight, change, cap, sector, industry, ... }. Returns the boxes
// (each item with x, y, w, h) and the headings over them ({ kind, name, x, y,
// w, h, head, change, count }: the block, and how tall its heading strip is).
// group: false lays the items out flat; focus: one sector's industries only.
export function layoutHeat(items, width, height, { group = true, focus = null } = {}) {
  if (!items.length || width <= 0 || height <= 0) return { tiles: [], heads: [] };
  if (!group) return { tiles: squarify(items, width, height), heads: [] };
  const tiles = [], heads = [];
  const industries = (list, x, y, w, h) => {
    const groups = groupBy(list, "industry");
    // one industry: the sector's own heading says it all
    if (groups.length < 2) { for (const t of squarify(list, w, h)) tiles.push({ ...t, x: t.x + x, y: t.y + y }); return; }
    for (const g of squarify(groups, w, h)) {
      const gap = g.w > 6 && g.h > 6 ? 1 : 0;
      const box = { x: g.x + x + gap, y: g.y + y + gap, w: g.w - 2 * gap, h: g.h - 2 * gap };
      const head = roomFor(box, INDUSTRY_HEAD) ? INDUSTRY_HEAD : 0;
      heads.push({ kind: "industry", name: g.name, ...box, head, change: groupMove(g.list), count: g.list.length, ...breadth(g.list) });
      for (const t of squarify(g.list, box.w, box.h - head)) tiles.push({ ...t, x: t.x + box.x, y: t.y + box.y + head });
    }
  };
  if (focus) {
    industries(items.filter(i => (i.sector || OTHER) === focus), 0, 0, width, height);
    return { tiles, heads };
  }
  for (const g of squarify(groupBy(items, "sector"), width, height)) {
    const gap = g.w > 8 && g.h > 8 ? 2 : 0;
    const box = { x: g.x + gap, y: g.y + gap, w: g.w - 2 * gap, h: g.h - 2 * gap };
    const head = roomFor(box, SECTOR_HEAD) ? SECTOR_HEAD : 0;
    heads.push({ kind: "sector", name: g.name, ...box, head, change: groupMove(g.list), count: g.list.length, ...breadth(g.list) });
    // a sector big enough is split by industry; a small one's boxes go straight in
    if (box.w >= 160 && box.h >= 120) industries(g.list, box.x, box.y + head, box.w, box.h - head);
    else for (const t of squarify(g.list, box.w, box.h - head)) tiles.push({ ...t, x: t.x + box.x, y: t.y + box.y + head });
  }
  return { tiles, heads };
}
