// The market's jargon in plain words (8 Nov 2026), for the app (jargon.jsx)
// and the server-written pages (server/seo-lists.js termsHtml)
export const TERMS = [
  [/\bcompounders?\b/i, "Companies that have grown profits steadily for years, reinvesting them at high returns."],
  [/\bmoats?\b/i, "Something that keeps competitors away for years: a strong brand, low costs, patents or a network."],
  [/\bBuffett-style\b/i, "In the spirit of Warren Buffett: good businesses at sensible prices, held for years."],
  [/\bblue ?chips?\b/i, "Large, well-established companies with long records."],
  [/\bmomentum\b/i, "A share price that has been rising faster than the market and kept going."],
  [/\bfair value\b/i, "Our estimate of what the business is worth from its own figures: a model, not a price target."],
  [/\bnet current asset value\b/i, "Current assets minus everything the company owes: roughly what's left if it stopped trading."],
  [/\bturnaround\b/i, "A company recovering from a bad patch."],
  [/\bdelivery\b/i, "Shares bought to keep, rather than sold again the same day."],
  [/\bP\/E\b/, "Price to earnings: the share price divided by a year's earnings per share."],
];

// Escaped HTML in, the first use of each term wrapped in <abbr title>
export function termsHtml(html) {
  let out = String(html ?? "");
  for (const [re, tip] of TERMS) out = out.replace(re, m => `<abbr title="${tip.replace(/"/g, "&quot;")}">${m}</abbr>`);
  return out;
}
