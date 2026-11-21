// Two scores in place of one (21 Nov 2026, the owner: the overall score "is
// the worst thing, making everything messy" — Sansera showed 33 in red with
// five strong scores, because a "Very expensive" price pulled a strong
// business down). Each answers one question:
//   Business — is it a good company? The quality score without the price part
//     (research.js qualityOnly), from the filings.
//   Price — is the share cheap or dear now? The valuation group's label.
// The two are never blended on the page.

const TONE = s => (s == null ? "none" : s >= 70 ? "good" : s >= 50 ? "mid" : "bad");
// the price label's colour: cheap green, fair amber, dear red
const PRICE_TONE = v => (v == null ? "none" : v >= 60 ? "good" : v >= 30 ? "mid" : "bad");

// r: a company's research, either the full one (the stock page: valuation {score, label})
// or a list row's brief (valuation: a number, valuationLabel)
export function twoScores(r) {
  if (!r) return null;
  const business = r.qualityOnly ?? null;
  const v = r.valuation != null && typeof r.valuation === "object" ? r.valuation : { score: r.valuation ?? null, label: r.valuationLabel ?? null };
  if (business == null && v.score == null) return null;
  return {
    business: business == null ? null : Math.round(business),
    businessTone: TONE(business),
    price: v.score == null ? null : v.label,
    priceScore: v.score,
    priceTone: PRICE_TONE(v.score),
  };
}

// "Business 84 · Very expensive", as a small pill (header, lists) or larger (the summary)
export function TwoScores({ research, size = "small", onClick = null, title = "Business: the company's quality from its filings, without the price. Price: whether the share is cheap or dear at the last close." }) {
  const t = twoScores(research);
  if (!t) return null;
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className={`two-scores two-scores-${size}`} {...(onClick ? { type: "button", onClick } : {})} title={title}
      aria-label={[t.business != null && `Business score ${t.business} of 100`, t.price && `price ${t.price.toLowerCase()}`].filter(Boolean).join(", ")}>
      {t.business != null && <span className={`ts-business sd-tone-${t.businessTone}`}><small>Business</small><b>{t.business}</b></span>}
      {t.price && <span className={`ts-price ts-price-${t.priceTone}`}>{t.price}</span>}
    </Tag>
  );
}
