// A sector from the company's name, for the ~1,200 smaller companies that
// neither NSE's index lists nor its announcements' industry cover. Only words
// that almost always mean one sector: checked against the 1,012 companies
// whose NSE sector is known (7 Oct 2026), these named 259 of 273 right (95%).
// Vaguer words were tried and dropped — "Industries", "Technologies", "Power",
// "Engineering", "Mills", "Films", "Cotton" named the right sector a third to
// two thirds of the time. Used to find companies by sector only; peer P/E and
// the research score keep to NSE's own sectors (metrics.js peerSector).
const RULES = [
  [/\b(bank|finance|financial|finserv|fincorp|finvest|leasing|credit|securities|stock ?brokers?|stock ?broking|insurance|asset management|nidhi)\b/, "Financial Services"],
  [/\b(pharma\w*|drugs?|healthcare|hospitals?|medicare|diagnostics?|life ?sciences|remedies|biotech|formulations)\b/, "Healthcare"],
  [/\bcements?\b/, "Construction Materials"],
  [/\b(petroleum|refiner\w*|lubricants?|oil (and )?gas)\b/, "Oil Gas & Consumable Fuels"],
  [/\bsugars?\b/, "Fast Moving Consumer Goods"],
  [/\b(textiles?|spinning|spinners|fabrics?|yarns?|denims?|weaving|garments?|apparels?|knit\w*|silk)\b/, "Textiles"],
  [/\b(automotive|auto components?|auto ancillar\w*|tyres?|tires?)\b/, "Automobile and Auto Components"],
  [/\b(foods?|beverages?|breweries|distilleries|tea|coffee|dairy|edible oils?|biscuits?|tobacco)\b/, "Fast Moving Consumer Goods"],
  [/\b(chemicals?|dyes?|dyestuffs?|pigments?|fertili[sz]ers?|agro ?chem\w*|pesticides?|petrochem\w*)\b/, "Chemicals"],
  [/\b(steels?|alloys?|aluminium|copper|zinc|ferro)\b/, "Metals & Mining"],
  [/\b(software|infotech)\b/, "Information Technology"],
  [/\b(media|entertainment|broadcast\w*|publications?|newspapers?)\b/, "Media Entertainment & Publication"],
  [/\b(hotels?|resorts?|hospitality|travels?|tours?|restaurants?)\b/, "Consumer Services"],
  [/\b(realty|real estate|properties)\b/, "Realty"],
  [/\b(logistics|shipping|freight|cargo|ports?)\b/, "Services"],
];

export function sectorFromName(name) {
  const words = String(name || "").toLowerCase().replace(/[.,()&-]/g, " ").replace(/\s+/g, " ");
  for (const [re, sector] of RULES) if (re.test(words)) return sector;
  return null;
}
