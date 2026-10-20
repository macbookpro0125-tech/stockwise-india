// The strategy list and "About this strategy" on Discover
// (StrategyPicker.jsx): the strategies by kind, and a strategy's rules in
// plain words with what each measure means (the metric catalogue's notes).

// The kinds, in the strategy grid's order (PresetCards.jsx shows the same)
export const KINDS = [
  ["quality", "Quality & growth", ["high_quality_compounders", "undervalued_growth", "small_cap_multibaggers", "ofss_style_filter", "debt_paydown", "sound_banks"]],
  ["value", "Value", ["turnaround_plays", "psu_value", "net_net_value", "fallen_quality"]],
  ["income", "Income & safety", ["dividend_aristocrats", "dividend_growth", "defensive_bluechips"]],
  ["momentum", "Momentum", ["momentum_growth", "up_every_timeframe", "near_highs_cheap", "doubled_in_year"]],
  ["owners", "Big investors", ["fii_favorites", "dii_backed"]],
];
export const kindOf = p => (p.custom ? ["yours", "Yours"] : KINDS.find(k => k[2].includes(p.id)) ?? ["other", "Other"]);

export function groupStrategies(presets) {
  const order = [...KINDS.map(k => k[0]), "other", "yours"];
  const groups = new Map();
  for (const p of presets) {
    const [id, label] = kindOf(p);
    (groups.get(id) ?? groups.set(id, { id, label, items: [] }).get(id)).items.push(p);
  }
  return order.filter(id => groups.has(id)).map(id => groups.get(id));
}

const num = v => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
function amount(def, v) {
  const unit = def?.unit;
  if (unit === "%") return `${num(v)}%`;
  if (unit === "x") return `${num(v)}×`;
  if (unit === "₹ Cr") return `₹${num(v)} Cr`;
  if (unit === "₹") return `₹${num(v)}`;
  if (unit === "/100") return `${num(v)}/100`;
  return num(v);
}

// [{ text: "ROE, 5-year average at least 18%", about }] — rules with no
// bound, and measures the catalogue doesn't know, are left out
export function describeRules(filters, meta) {
  return (filters ?? []).map(f => {
    const def = meta?.byId?.get(f.id);
    if (!def) return null;
    let text;
    if (f.values) text = f.values.length ? `${def.label}: ${f.values.join(", ")}` : null;
    else if (f.min != null && f.max != null) text = `${def.label} between ${amount(def, f.min)} and ${amount(def, f.max)}`;
    else if (f.min != null) text = `${def.label} at least ${amount(def, f.min)}`;
    else if (f.max != null) text = `${def.label} at most ${amount(def, f.max)}`;
    return text ? { id: f.id, text, about: def.about ?? null } : null;
  }).filter(Boolean);
}
