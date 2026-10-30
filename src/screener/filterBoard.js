// The filter board's choices (30 Oct 2026, the "see everything, easy to
// reach" design): the most-used filters in groups, each a short list of
// ready ranges instead of a slider. A choice is a { min, max } on the same
// metric the drawer's sliders set, so the two always agree; a range set in
// the drawer that matches no choice shows as "Custom".

export const BOARD_GROUPS = [
  { id: "company", label: "Company", items: [
    { id: "capSize", label: "Market cap", category: true },
    { id: "index", label: "Index", category: true },
    { id: "theme", label: "Theme", category: true },
    { id: "sector", label: "Sector", category: true },
    { id: "resultsWhen", label: "Results", category: true },
    { id: "fno", label: "F&O", category: true },
  ] },
  { id: "value", label: "Value", items: [
    { id: "pe", label: "P/E", choices: [["Under 10", null, 10], ["Under 15", null, 15], ["Under 20", null, 20], ["Under 30", null, 30], ["Under 40", null, 40], ["Over 40", 40, null]] },
    { id: "peg", label: "PEG", choices: [["Under 1", null, 1], ["Under 1.5", null, 1.5], ["Under 2", null, 2]] },
    { id: "priceToBook", label: "Price to book", choices: [["Under 1", null, 1], ["Under 2", null, 2], ["Under 3", null, 3], ["Under 5", null, 5]] },
    { id: "vsFairValue", label: "vs fair value", choices: [["Below fair value", null, 0], ["20% or more below", null, -20], ["Above fair value", 0, null]] },
    { id: "divYield", label: "Dividend yield", choices: [["Over 1%", 1, null], ["Over 2%", 2, null], ["Over 3%", 3, null], ["Over 5%", 5, null]] },
  ] },
  { id: "quality", label: "Quality", items: [
    { id: "quality", label: "Quality score", choices: [["60 or more", 60, null], ["70 or more", 70, null], ["80 or more", 80, null], ["90 or more", 90, null]] },
    { id: "roce", label: "ROCE", choices: [["Over 10%", 10, null], ["Over 15%", 15, null], ["Over 20%", 20, null], ["Over 30%", 30, null]] },
    { id: "debtToEquity", label: "Debt to equity", choices: [["Almost none (under 0.1)", null, 0.1], ["Under 0.5", null, 0.5], ["Under 1", null, 1]] },
    { id: "piotroski", label: "Piotroski", choices: [["5 or more", 5, null], ["7 or more", 7, null], ["8 or more", 8, null]] },
  ] },
  { id: "growth", label: "Growth", items: [
    { id: "salesGrowth3y", label: "Sales growth, 3 years", choices: [["Over 10% a year", 10, null], ["Over 15% a year", 15, null], ["Over 20% a year", 20, null]] },
    { id: "profitGrowth3y", label: "Profit growth, 3 years", choices: [["Over 10% a year", 10, null], ["Over 15% a year", 15, null], ["Over 20% a year", 20, null]] },
    { id: "qProfitGrowthYoY", label: "Latest quarter's profit", choices: [["Up on a year ago", 0, null], ["Up 20% or more", 20, null], ["Down on a year ago", null, 0]] },
  ] },
  { id: "owners", label: "Owners", items: [
    { id: "promoterPct", label: "Promoter holding", choices: [["Over 25%", 25, null], ["Over 50%", 50, null], ["Over 70%", 70, null]] },
    { id: "pledgedPct", label: "Pledged", choices: [["None", null, 0], ["Under 5%", null, 5], ["Under 25%", null, 25]] },
    { id: "freeFloat", label: "Free float", choices: [["Over 30%", 30, null], ["Over 50%", 50, null]] },
  ] },
  { id: "price", label: "Price and technical", items: [
    { id: "priceStrength", label: "Price strength", choices: [["70 or more", 70, null], ["80 or more", 80, null], ["90 or more", 90, null], ["Under 30", null, 30]] },
    { id: "ret1y", label: "1-year return", choices: [["Up", 0, null], ["Up 20% or more", 20, null], ["Down", null, 0], ["Down 20% or more", null, -20]] },
    { id: "vsSma200", label: "vs 200-day average", choices: [["Above it", 0, null], ["Below it", null, 0]] },
    { id: "rsi14", label: "RSI", choices: [["Under 30", null, 30], ["30 to 70", 30, 70], ["Over 70", 70, null]] },
    { id: "downFrom52wHigh", label: "From 52-week high", choices: [["Within 5%", null, 5], ["Within 10%", null, 10], ["25% or more below", 25, null]] },
  ] },
];

// The choice a filter is on, "custom" for a range no choice matches, "" for off
export function choiceOf(item, filter) {
  if (!filter || (filter.min == null && filter.max == null)) return "";
  const i = item.choices.findIndex(([, min, max]) => (min ?? null) === (filter.min ?? null) && (max ?? null) === (filter.max ?? null));
  return i >= 0 ? String(i) : "custom";
}

// The filters with one changed: a choice (its index as a string), or "" to remove
export function setChoice(filters, item, value) {
  const rest = filters.filter(f => f.id !== item.id);
  if (value === "" || value === "custom") return value === "custom" ? filters : rest;
  const [, min, max] = item.choices[Number(value)];
  const next = { id: item.id, min, max };
  return filters.some(f => f.id === item.id) ? filters.map(f => (f.id === item.id ? next : f)) : [...filters, next];
}

export function setValues(filters, id, values) {
  const rest = filters.filter(f => f.id !== id);
  if (!values.length) return rest;
  return filters.some(f => f.id === id) ? filters.map(f => (f.id === id ? { id, values } : f)) : [...filters, { id, values }];
}

// "Find a filter": the board's items whose name has the words typed
export function matchesFind(item, text) {
  const words = String(text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const label = item.label.toLowerCase();
  return words.every(w => label.includes(w) || item.id.toLowerCase().includes(w));
}

// A filter in words, for the "On now" row
export function filterWords(def, f) {
  if (!def) return f.id;
  if (f.values) return `${def.label}: ${f.values.join(", ")}`;
  const item = BOARD_GROUPS.flatMap(g => g.items).find(i => i.id === f.id && i.choices);
  const c = item ? choiceOf(item, f) : "custom";
  if (c !== "custom" && c !== "") return `${item.label}: ${item.choices[Number(c)][0]}`;
  const unit = def.unit === "%" ? "%" : def.unit === "x" ? "×" : "";
  const n = v => `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${unit}`;
  const name = def.short ?? def.label;
  if (f.min != null && f.max != null) return `${name} ${n(f.min)} to ${n(f.max)}`;
  return f.min != null ? `${name} ${n(f.min)} or more` : `${name} up to ${n(f.max)}`;
}
