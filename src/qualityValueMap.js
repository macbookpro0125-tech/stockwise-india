// The screen's chart (QualityValueMap.jsx): any two of the scores, one up
// and one across (5 Nov 2026: "it shows all the scores and if i want chose
// in between all the score i should be able to find it"). Each company with
// both figures goes in a corner against the middle values of the list it's
// in; the rest are only counted. Quality up, P/E across is where it starts.
const median = v => { const s = [...v].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const num = v => v != null && Number.isFinite(v);

// better: which end is the good one ("high", or "low" for P/E and risk)
export const AXES = [
  { id: "quality", label: "Quality score", short: "quality", better: "high", get: s => s.research?.quality },
  { id: "overall", label: "Research score", short: "research score", better: "high", get: s => s.research?.overall },
  { id: "business", label: "Business quality", short: "business", better: "high", get: s => s.research?.groups?.business },
  { id: "earnings", label: "Earnings quality", short: "earnings", better: "high", get: s => s.research?.groups?.earnings },
  { id: "balance", label: "Balance sheet", short: "balance sheet", better: "high", get: s => s.research?.groups?.balance },
  { id: "governance", label: "Management", short: "management", better: "high", get: s => s.research?.groups?.governance },
  { id: "growth", label: "Growth", short: "growth", better: "high", get: s => s.research?.groups?.growth },
  { id: "valuation", label: "Valuation score", short: "valuation score", better: "high", get: s => s.research?.valuation },
  { id: "technical", label: "Price trend", short: "price trend", better: "high", get: s => s.research?.technical },
  { id: "risk", label: "Risk score", short: "risk", better: "low", get: s => s.research?.risk },
  { id: "pe", label: "P/E (last 12 months)", short: "P/E", better: "low", ratio: true, get: s => { const v = s.peTtm ?? s.pe; return v > 0 ? v : null; } },
];
export const axisById = id => AXES.find(a => a.id === id) ?? AXES[0];

// "hl": higher up, lower across; the middle itself counts as higher up, lower across
export const zoneOf = (yv, xv, yMid, xMid) => `${yv >= yMid ? "h" : "l"}${xv <= xMid ? "l" : "h"}`;

// the corner where both figures are at their good end
export const bestZone = (yAxis, xAxis) => `${yAxis.better === "high" ? "h" : "l"}${xAxis.better === "low" ? "l" : "h"}`;

// "Higher quality, lower P/E"
export function zoneLabel(id, yAxis, xAxis) {
  const w = c => (c === "h" ? "Higher" : "Lower");
  return `${w(id[0])} ${yAxis.short}, ${w(id[1]).toLowerCase()} ${xAxis.short}`;
}

// 2 both at their good end, 1 the up one only, -1 the across one only, -2 neither
export function zoneTone(id, yAxis, xAxis) {
  const yGood = (id[0] === "h") === (yAxis.better === "high");
  const xGood = (id[1] === "h") === (xAxis.better === "high");
  return yGood && xGood ? 2 : yGood ? 1 : xGood ? -1 : -2;
}

export function mapPoints(matches = [], yId = "quality", xId = "pe") {
  const ya = axisById(yId), xa = axisById(xId);
  const all = matches.map(s => ({ symbol: s.symbol, name: s.name, y: ya.get(s), x: xa.get(s), cap: s.marketCapCr ?? 0 }));
  const points = all.filter(p => num(p.y) && num(p.x));
  if (points.length < 3) return { points: [], left: all.length - points.length };
  const xMid = median(points.map(p => p.x)), yMid = median(points.map(p => p.y));
  for (const p of points) p.zone = zoneOf(p.y, p.x, yMid, xMid);
  return { points, left: all.length - points.length, xMid, yMid };
}

// the companies inside a box drawn on the chart (its values, either corner first)
export function inBox(points, box) {
  if (!box) return [];
  const [x0, x1] = [box.x0, box.x1].sort((a, b) => a - b), [y0, y1] = [box.y0, box.y1].sort((a, b) => a - b);
  return points.filter(p => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
}
