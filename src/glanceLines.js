// What the stock page's "At a glance" card lists (StockGlance.jsx): the best
// line from each of the strongest research groups, then every flag and the
// weakest line of each group under "fair" — research.js's own checks and
// sentences, picked, never reworded beyond dropping the verdict word.

// research.js's own words for a check: 75+ strong, 50+ fair, 25+ weak, else poor
const STRONG = 75, WEAK = 50;
const VERDICT = /\s*—\s*(strong|fair|weak|poor)\.$/;
const say = item => item.reason.replace(VERDICT, ".");
// A flag's first sentence; the scorecard has the rest
const firstSentence = t => (t.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? t);

export function pickLines(r) {
  const scored = r.groups.filter(g => g.applicable).map(g => ({ g, items: (g.items ?? []).filter(i => i.score != null && i.reason) }));
  // The best line from each of the strongest groups
  const strengths = scored
    .map(({ g, items }) => ({ g, top: items.reduce((a, b) => (b.score > (a?.score ?? -1) ? b : a), null) }))
    .filter(x => x.top?.score >= STRONG)
    .sort((a, b) => (b.g.score ?? 0) - (a.g.score ?? 0) || b.top.score - a.top.score)
    .slice(0, 3)
    .map(({ g, top }) => ({ key: `${g.id}-${top.id}`, group: g.label, text: say(top), target: `why-${g.id}` }));
  // Every flag first, critical ones on top, then the weakest line of each
  // group that has one under "fair"
  const flags = [...(r.flags ?? [])].sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1));
  const watch = flags.map(f => ({ key: `flag-${f.id}`, group: f.severity === "critical" ? "Red flag" : "Caution", text: firstSentence(f.text), target: "sec-scores", tone: f.severity === "critical" ? "bad" : "mid" }));
  const weak = scored
    .map(({ g, items }) => ({ g, low: items.reduce((a, b) => (b.score < (a?.score ?? 101) ? b : a), null) }))
    .filter(x => x.low?.score < WEAK)
    .sort((a, b) => a.low.score - b.low.score)
    .map(({ g, low }) => ({ key: `${g.id}-${low.id}`, group: g.label, text: say(low), target: `why-${g.id}`, tone: low.score < 25 ? "bad" : "mid" }));
  return { strengths, watch: [...watch, ...weak].slice(0, 3) };
}
