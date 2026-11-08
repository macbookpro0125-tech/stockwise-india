// Plain words for the market's jargon (8 Nov 2026, a review: "compounders",
// "moats" … appear without explanation): a dotted underline, and a short
// explanation on hover, focus or tap. Used where screens are named and described.
import { TERMS } from "./jargonTerms.js";

export function withTerms(text) {
  if (!text) return text;
  const out = [];
  let rest = String(text), k = 0;
  const used = new Set();
  while (rest) {
    let best = null;
    for (const [re, tip] of TERMS) {
      if (used.has(tip)) continue;
      const m = rest.match(re);
      if (m && (best == null || m.index < best.m.index)) best = { m, tip };
    }
    if (!best) { out.push(rest); break; }
    const { m, tip } = best;
    used.add(tip);
    if (m.index) out.push(rest.slice(0, m.index));
    out.push(<span key={k++} className="jg" tabIndex={0} data-tip={tip} title={tip} aria-label={`${m[0]}: ${tip}`} onClick={e => e.stopPropagation()}>{m[0]}</span>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

