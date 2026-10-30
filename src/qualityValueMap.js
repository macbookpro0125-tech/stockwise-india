// The quality-against-P/E chart's points and corners (QualityValueMap.jsx):
// each company with a P/E and a score, put in a corner against the middle
// values of the list it's in; losses and unscored companies only counted
const median = v => { const s = [...v].sort((a, b) => a - b); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

export function mapPoints(matches = []) {
  const all = matches.map(s => ({ symbol: s.symbol, name: s.name, pe: s.peTtm ?? s.pe, quality: s.research?.quality, cap: s.marketCapCr ?? 0 }));
  const points = all.filter(p => p.pe > 0 && Number.isFinite(p.quality));
  if (points.length < 3) return { points: [], left: all.length - points.length };
  const peMid = median(points.map(p => p.pe)), qMid = median(points.map(p => p.quality));
  for (const p of points) p.zone = `${p.quality >= qMid ? "h" : "l"}${p.pe <= peMid ? "l" : "h"}`;
  return { points, left: all.length - points.length, peMid, qMid };
}
