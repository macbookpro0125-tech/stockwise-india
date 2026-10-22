// A sector from how a company describes its own business in its results
// filing (the "segment" lines of NSE's integrated filing: "Milk and Milk
// Products", "Agro Chemicals", "Travel QSR outlets and Lounge services"),
// for the companies NSE's own lists don't classify (22 Oct 2026: 786 of
// 2,263 had no peers). Each line is read in the order the company lists
// them, main business first, so "Dairy; Renewable Energy" is a dairy and
// "Sugar; Power; Distillery" a sugar mill. Lines that name the market
// ("Domestic", "Exports") or the form ("Manufacturing", "Trading") say
// nothing. Equipment comes before metals and construction, as NSE files it:
// steel pipes and ship building are capital goods.
// Checked against the 449 companies of two samples whose NSE sector is known:
// a sector for 327, NSE's own for 298 (91%); 85% on the second sample before
// its misses were looked at. Re-check: scripts/business-sectors-check.mjs.
const RULES = [
  [/\b(banking|banks?|nbfcs?|non[- ]banking|lending|loans?|micro ?financ\w*|housing financ\w*|financ(e|ing)|financial (services|products)|insurance|broking|stock ?brok\w*|capital markets?|merchant banking|asset management|mutual funds?|treasury|credit cards?|stock exchange|wealth management|investments?|securities)\b/, "Financial Services"],
  [/\b(pharma\w*|apis?|active pharmaceutical\w*|bulk drugs?|drugs?|formulations?|hospitals?|health ?care|diagnostics?|pathology|ivf|vaccines?|medical devices?|nutraceuticals?)\b/, "Healthcare"],
  [/\b(software|it services|it enabled|it (and|&) it ?es|ites|it\b|information technology|business process|bpo|bpm|saas|cpaas|cloud|data analytics|silicon engineering|product engineering)\b/, "Information Technology"],
  [/\b(automo\w*|auto components?|auto parts|auto ancillar\w*|two[- ]wheelers?|three[- ]wheelers?|passenger vehicles?|tyres?|tires?|wiring harness\w*|tractors?|batter(y|ies)|storage batter(y|ies))\b/, "Automobile and Auto Components"],
  [/\b(cement|granites?|marble|tiles|ceramics?|sanitary ?ware|building materials?|building products)\b/, "Construction Materials"],
  [/\b(natural gas|crude oil|petroleum|refin\w+|lpg|cng|city gas|lubricants?|oil (and|&) gas)\b/, "Oil Gas & Consumable Fuels"],
  [/\b(telecom\w*|data networking|voice solutions|broadband|telecommunication\w*)\b/, "Telecommunication"],
  [/\b(electrical equipments?|heavy electrical\w*|transformers?|switch ?gears?|cables?|wires?|pumps?|valves?|compressors?|bearings?|machinery|machine tools|engineering products|industrial products|solar modules?|power products|defen[cs]e|aerospace|ship ?building|ship construction|rail(way)? systems|electronics? manufacturing|boilers?|heaters?|combustion|turbines?|motors?|castings?|forgings?|pipes?|tubes?|fasteners?|cranes?|material handling|construction equipment|earth ?moving|abrasives?)\b/, "Capital Goods"],
  [/\b(retail (trade|stores?|chains?|outlets?|of)|value retail|retailing)\b/, "Consumer Services"],
  // a delivery app or a restaurant chain isn't a food maker (Swiggy, Eternal)
  [/\b(food (?:ordering|delivery|services?)|quick commerce|restaurants?|qsr)\b/, "Consumer Services"],
  // testing a product isn't making it: diamond certification is a service
  [/\b(certification|testing and inspection|inspection services|testing services)\b/, "Services"],
  [/\b(textiles?|garments?|apparels?|yarns?|fabrics?(?! care)|denims?|spinning|weaving|towels?|bed ?sheets?|cotton|knit\w*|hosiery|home textiles?)\b/, "Textiles"],
  [/\b(food|foods|dairy|milk|edible oils?|sugar|distiller\w*|alcohol\w*|liquor|beers?|brewer\w*|beverages?|tea|coffee|personal care|beauty|cosmetics?|tobacco|cigarettes?|biscuits?|snacks?|spices?|rice|flour|shrimps?|aqua ?feed|poultry|fmcg|agro based|fabric care|home care|maize|starch|agro processing)\b/, "Fast Moving Consumer Goods"],
  [/\b(chemicals?|agro ?chem\w*|crop protection|fertili[sz]ers?|pesticides?|insecticides?|dyes?|dyestuffs?|pigments?|surfactants?|polymers?|resins?|printing inks?|specialty|speciality)\b/, "Chemicals"],
  [/\b(jewell?e?ry|gems?|diamonds?|paints?|home d[eé]cor|appliances?|watches|clocks|horological|air cool\w*|kitchen\w*|furniture|laminates?|plywood|footwear|consumer durables?)\b/, "Consumer Durables"],
  [/\b(steel|iron|pig iron|pellets?|ferro ?alloys?|aluminium|aluminum|copper|zinc|lead|mining|minerals?|coal|metals?)\b/, "Metals & Mining"],
  [/\b(power generation|generation of (power|electricity)|electricity|power plants?|transmission of power|solar power|wind power)\b/, "Power"],
  [/\b(real estate|realty|properties|property development|development of buildings?|residential projects?|commercial projects?)\b/, "Realty"],
  [/\b(construction|epc|infrastructure|infra|civil works?|turnkey|bot|annuity|engineering projects?|roads?|highways?)\b/, "Construction"],
  [/\b(hotels?|hospitality|resorts?|restaurants?|qsr|lounges?|retail\w*|e-?commerce|travel|tourism|education\w*|training)\b/, "Consumer Services"],
  // "films" as cinema only: "POLYESTER FILM" is a plastic
  [/\b(broadcast\w*|television|tv|films? (?:production|distribution|exhibition)|motion pictures?|movies?|media|entertainment|publishing|publications?|newspapers?|theatr\w*|cinemas?)\b/, "Media Entertainment & Publication"],
  [/\b(logistics|supply chain|containers?|shipping|ports?|airports?|freight|cargo|transport\w*|fleet|chartering|warehous\w*|courier|consultancy|staffing|manpower|marketing services|advertising|waste management|e-?waste|facility management|security services|workspaces?)\b/, "Services"],
  [/\b(paper|pulp|wood|timber)\b/, "Forest Materials"],
];

// Lines that name the market or the form, not the business
const SAYS_NOTHING = /^(single|one|only one|primary|reportable|operating|business|segment|segments|the company|company|n\.?a\.?|nil|none|not applicable|others?|other operating revenue|unallocable|unallocated|eliminations?|corporate|domestic|exports?|india|outside india|overseas|international|manufacturing|trading|services?|sales?|products?|equity|branded|bulk|investment income|[a-z]\)|\d+\.)[\s.,;:&/-]*$/;

export function cleanBusiness(lines) {
  return (lines ?? [])
    .map(l => String(l).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim())
    .filter(l => l && l.length <= 160 && !SAYS_NOTHING.test(l.toLowerCase()))
    // "Other operating revenue", however it's spelt ("Other opreating revenue")
    .filter(l => !/^others? (op\w+ )?(revenue|income)s?$/i.test(l))
    // a sentence about segment reporting ("The Company operates in a single segment…") isn't a business
    .filter(l => !/\b(single|one|only one|primary) (business |reportable |operating )?segment\b|\bind ?as ?108\b|\bsegment reporting\b|\bpublishes? (their|its) (statements|standalone)/i.test(l));
}

export function sectorFromBusiness(lines) {
  for (const line of cleanBusiness(lines)) {
    const text = line.toLowerCase();
    for (const [re, sector] of RULES) if (re.test(text)) return sector;
  }
  return null;
}
