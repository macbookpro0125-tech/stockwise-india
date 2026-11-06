// A company's filing in one plain sentence, and how much it matters (6 Nov
// 2026, the owner: "the news is not understandable"). NSE titles its filings
// in legal words ("Announcement under Regulation 30(9) of SEBI LODR"), and a
// director's change sat in the list as loudly as a ₹400 crore order. Here,
// by rules and no AI: what happened, in words a new investor reads at a
// glance, taken only from the company's own title and text — a number is
// only ever one the filing states — and a weight:
//   big     results with figures, orders and deals with an amount, dividends,
//           splits, bonuses, buybacks, rights, a new or departing CEO/MD/CFO,
//           rating upgrades and downgrades, money raised, production started
//   normal  most other news a holder would want to know
//   minor   paperwork: board committees, routine directors, investor meets,
//           compliance notices — kept, folded away in the list
// The filing's own words stay on its page (NewsView Detail).

const RS = String.raw`(?:rs\.?|re\.?|inr|₹)\s?`;
const AMOUNT = new RegExp(String.raw`${RS}([\d,]+(?:\.\d+)?)\s?(crores?|cr\.?|lakhs?|lacs?|million|mn|billion|bn)\b`, "i");

// "₹428.55 crore" as the filing says it, or null
export function amountIn(text = "") {
  const m = String(text).match(AMOUNT);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!isFinite(n) || n <= 0) return null;
  const unit = /^cr/i.test(m[2]) ? "crore" : /^la/i.test(m[2]) ? "lakh" : /^m/i.test(m[2]) ? "million" : "billion";
  return { value: n, unit, text: `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${unit}` };
}

const pershare = text => { const m = String(text).match(new RegExp(String.raw`dividend\s+(?:of\s+)?${RS}([\d.]+)\s*(?:\/-\s*)?(?:per|a|each)?`, "i")) ?? String(text).match(new RegExp(String.raw`${RS}([\d.]+)\s*(?:\/-\s*)?per\s+(?:equity\s+)?share`, "i")); return m && Number(m[1]) > 0 ? `₹${Number(m[1]).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : null; };
const fyQ = fyEnd => { const [y, mo] = String(fyEnd).split("-").map(Number); return y && mo ? `Q${mo >= 4 ? Math.ceil((mo - 3) / 3) : 4} FY${String(mo >= 4 ? y + 1 : y).slice(2)}` : null; };
const cr = v => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 })} cr`;
const pctw = v => `${Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString("en-IN") : Math.abs(v).toFixed(0)}%`;
const DAY = /(\d{1,2})(?:st|nd|rd|th)?[\s.\/-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s.,\/-]+(\d{4})|(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function dateIn(text) {
  const m = String(text).match(DAY);
  if (!m) return null;
  const d = Number(m[1] ?? m[4]), mo = m[2] ? MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) : Number(m[5]) - 1;
  if (!(d >= 1 && d <= 31 && mo >= 0 && mo <= 11)) return null;
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo]}`;
}
// "Mr Satish Kumar Kaushik" from "Appointment of Mr Satish Kumar Kaushik as Chief…",
// "Angan Guha" from "Wipro Appoints Angan Guha as President…"
const person = text => {
  const m = String(text).match(/\b((?:[Mm]rs?|[Mm]s|[Dd]r|[Ss]hri|[Ss]mt)\.?\s+[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,4})\s+as\b/)
    ?? String(text).match(/\b[Aa]ppoint(?:s|ed)?\s+([A-Z][\w.'-]+(?:\s+[A-Z][\w.'-]+){1,3})\s+as\b/);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
};
const TOP = [[/chief executive|\bceo\b/i, "CEO"], [/managing director|\bmd\b/i, "managing director"], [/chief financial|\bcfo\b/i, "CFO"], [/\bchair(man|person)\b/i, "chairman"], [/whole[- ]time director/i, "whole-time director"]];
const roleIn = text => TOP.find(([re]) => re.test(text))?.[1] ?? null;
// a head of one unit or region, not of the company ("CEO for Americas 2 Strategic Market Unit")
const UNIT = /\bfor.{0,50}(unit|division|business|region|segment|americas|europe|apac|emea|vertical)\b|\b(?:of|in) (?:a |its |the )?(?:wholly[- ]owned )?subsidiar/i;

// The quarter a filing speaks of: "Q2 FY27", or the date a quarter ends
const QEND = { "march": "03-31", "june": "06-30", "september": "09-30", "december": "12-31" };
function quarterIn(text) {
  const t = String(text);
  const q = t.match(/\bq([1-4])\s?(?:&\s?h[12]\s?)?fy\s?'?(\d{2})\b/i);
  if (q) return `Q${q[1]} FY${q[2]}`;
  const d = t.match(/(march|june|september|december)\s+(?:3[01]|30)(?:st|th)?,?\s+(\d{4})|(3[01]|30)(?:st|th)?[\s.-]+(march|june|september|december|sept?|dec|mar|jun)[a-z]*,?[\s.-]+(\d{4})|(3[01]|30)\.(0[369]|12)\.(\d{4})/i);
  if (!d) return null;
  if (d[1]) return fyQ(`${d[2]}-${QEND[d[1].toLowerCase()]}`);
  if (d[4]) { const m = d[4].toLowerCase(); const k = m.startsWith("mar") ? "march" : m.startsWith("jun") ? "june" : m.startsWith("sep") ? "september" : "december"; return fyQ(`${d[5]}-${QEND[k]}`); }
  return fyQ(`${d[8]}-${d[7]}-30`);
}

// A company's own sentence, without the letter-writing around it
const clean = text => {
  let s = String(text ?? "").replace(/\s+/g, " ").trim()
    .replace(/^a press release dated .*?,\s*titled\s*/i, "")
    .replace(/^please find (?:attached |enclosed )?a copy of (?:the )?press release titled\s*/i, "")
    .replace(/^[A-Z][\w&.,()' -]{2,80}? has (?:informed|submitted to) (?:the exchange )?(?:regarding|about)\s+/i, "")
    .replace(/^(?:further to our .*?,\s*(?=(?:we|this|please)\b))?(?:pursuant to regulation[^,]*,\s*)?(?:we (?:wish|would like) to inform (?:you )?that|this is to inform (?:you )?that|please be informed that|we write to inform you that|we are pleased to inform (?:you )?that)\s*/i, "")
    .replace(/^the (?:company|bank)\s+(?=[a-z])/i, "")
    .replace(/^["“]|["”]\.?$/g, "");
  if (s && s === s.toUpperCase()) s = s.toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};
// Says something: a figure, or more than a label
const telling = s => /\d+(?:\.\d+)?\s?%|₹|\brs\.?\s?\d|\binr\s?\d|crore|\bcr\b/i.test(s);
const PAPER = /half-?yearly report|newspaper|publication of|advertisement|committee|trading window|compliance certificate|reg(?:ulation)?\.? ?74|loss of share|duplicate share|forfeit|e-?voting|postal ballot|book closure|demat|rematerial|re-?lodg|physical shares|transfer requests|materiality of an event|related party transactions|intimation sent to (?:concerned |the )?shareholders|monitoring agency|code of conduct|policy on|investor grievance|scrutini[sz]er|closure of (?:the )?trading/;
const GENERIC_RELEASE = /^(?:intimation of |announcement under [^-]*-\s*)?(?:a )?(?:press|media) release(?: dt\.?| dated)?\b|^(?:un-?audited |audited |the )?(?:standalone |consolidated )?financial results?\b|^(?:for )?un-?audited financial|^outcome of (?:the )?board|^out come|^(?:general )?updates?\b|^earnings release|^quarterly earnings|^press release on|^media release|^\.?$/i;
const shorten = s => (s.length > 150 ? `${s.slice(0, 147).replace(/\s+\S*$/, "")}…` : s);

const R = (line, weight = "normal") => ({ line, weight });

export function plainNews(item) {
  if (!item || item.type !== "filing") return null;
  const title = String(item.title ?? ""), summary = String(item.summary ?? "");
  const primary = `${title} · ${summary}`;
  const all = [primary, ...(item.also ?? []).flatMap(a => [a.title, a.summary])].filter(Boolean).join(" · ");

  // ── results with their figures ──
  const n = item.numbers;
  if (n && (n.profitCr != null || n.salesCr != null)) {
    const q = fyQ(n.quarter) ?? "Quarterly";
    const profit = n.profitCr == null ? null
      : n.profitCr < 0 ? `a loss of ${cr(n.profitCr)}`
      : n.profitYoY != null && isFinite(n.profitYoY) && n.profitCr / (1 + n.profitYoY / 100) > 0 ? `profit ${n.profitYoY >= 0 ? "up" : "down"} ${pctw(n.profitYoY)} to ${cr(n.profitCr)}` : `profit of ${cr(n.profitCr)}`;
    const sales = n.salesYoY != null && isFinite(n.salesYoY) ? `sales ${n.salesYoY >= 0 ? "up" : "down"} ${pctw(n.salesYoY)}` : null;
    return R(`${q} results: ${[profit, sales].filter(Boolean).join(", ")}`, "big");
  }
  // the filing's own words decide; what was filed with it fills a gap
  const own = classify(primary, item.kind, title, summary);
  if (own.weight !== "minor" || !item.also?.length) return own;
  for (const a of item.also) { const r = classify(`${a.title ?? ""} · ${a.summary ?? ""}`, item.kind, a.title ?? "", a.summary ?? ""); if (r.weight !== "minor") return r; }
  return own;
}

function classify(text, kind, title, summary) {
  const a = text.toLowerCase(), t = title.toLowerCase();
  const money = amountIn(text);
  const ownLine = clean(summary);

  // paperwork first: it often mentions results, dividends or rights in passing
  if (/insolvency|\bcirp\b|liquidat/.test(a)) return R("Under insolvency proceedings: an update on the process", "big");
  if (PAPER.test(a)) return R("Routine paperwork filed with NSE", "minor");

  // ── results ──
  if (/revis|re-?submi|updated/.test(a) && /error|inadvertent|omitted|correct|typo/.test(a)) return R("Re-filed a document to correct an error", "minor");
  const resultsy = kind === "results" || /financial results?|earnings|outcome of (?:the )?board|results for|\bq[1-4]\s?(?:&\s?h[12]\s?)?fy\s?\d{2}|\bh[12]\s?fy\s?\d{2}/.test(a);
  if (/presentation|shareholders? letter|letter to shareholders|investor update|earnings? call transcript/.test(a) && resultsy) return R("Shared a presentation or letter on its latest results");
  if (resultsy && /schedul|to consider|will be held|is scheduled|intimation of board meeting/.test(a) && !/approved|outcome|held on/.test(a)) { const d = dateIn(text); return R(d ? `Board meets on ${d} to approve its results` : "Set a date to announce its results"); }
  if (resultsy && ownLine && telling(ownLine) && !GENERIC_RELEASE.test(ownLine)) return R(shorten(ownLine), "big");
  // a press release filed among the results that is about something else (a ship delivered)
  if (resultsy && /press|media/.test(title.toLowerCase()) && ownLine.length > 20 && !GENERIC_RELEASE.test(ownLine) && !/result|earning|financial|performance|quarter/i.test(ownLine)) return R(shorten(ownLine));
  if (resultsy && !/dividend|buy-?back|bonus|split|appoint|resign|order|acqui|merger|amalgamation/.test(a)) { const q = quarterIn(text); return R(q ? `Announced its ${q} results` : "Announced its latest results"); }

  // ── dividends, splits, bonuses, buybacks, rights ──
  if (/sub-?division|stock split|split of/.test(a)) { const m = text.match(/(\d+)\s+(?:equity\s+)?shares?\s+of\s+(?:rs\.?|re\.?|₹)\s?\d+[^]*?into\s+(\d+)/i); return R(m && Number(m[1]) === 1 && Number(m[2]) <= 20 ? `Splitting each share into ${m[2]}` : "Approved a stock split", "big"); }
  if (/\bbonus\b/.test(a) && /share|issue|ratio/.test(a)) {
    const m = text.match(/(\d+)\s*:\s*(\d+)/); let x = m ? [Number(m[1]), Number(m[2])] : null;
    if (x) { const g = (p, q) => (q ? g(q, p % q) : p); const d = g(x[0], x[1]); x = [x[0] / d, x[1] / d]; }
    return R(x && x[0] <= 20 && x[1] <= 20 ? `Bonus shares: ${x[0]} free for every ${x[1]} held` : "Approved bonus shares for shareholders", "big");
  }
  if (/buy-?back/.test(a)) return /public announcement|letter of offer|post.?buy|completion/.test(a) ? R("Shared the details of its share buyback") : R("Approved a buyback of its own shares", "big");
  if (/rights (?:issue|basis)/.test(a)) return /subscription|allotment|update/.test(a) && !/approv|decided/.test(a) ? R("Update on its rights issue") : R(money ? `Plans a ${money.text} rights issue: new shares offered to its shareholders` : "Plans a rights issue: new shares offered to its shareholders", "big");
  if (/record date/.test(a)) { const d = dateIn(text); return R(d ? `Record date ${d}: own the shares by then to get the ${/dividend/.test(a) ? "dividend" : /bonus/.test(a) ? "bonus shares" : "benefit"}` : "Set the record date for a shareholder benefit"); }
  if (/tax deduction|\btds\b/.test(a) && /dividend/.test(a)) return R("Note to shareholders on the tax taken from its dividend", "minor");
  if (/dividend/.test(a) && /declar|approv|recommend|interim|final|special/.test(a)) { const ps = pershare(text); const k = /interim/.test(a) ? "an interim dividend" : /final/.test(a) ? "a final dividend" : /special/.test(a) ? "a special dividend" : "a dividend"; return R(ps ? `Declared ${k} of ${ps} a share` : `Declared ${k}`, "big"); }

  // ── auditors ──
  if (/auditor/.test(a)) return /resign/.test(a) ? R("Its auditor resigned", "big") : R("Appointed or changed its auditor");

  // ── orders, deals, money ──
  if (/order|contract|letter of award|\bloa\b|lowest bidder|\bl1\b/.test(a) && !/order book|orders? passed|court|tribunal|commissioner|order pronounced/.test(a)) {
    if (/amendment/.test(a)) return R("Changed the terms of an existing contract");
    if (/lowest bidder|\bl1\b/.test(a)) return R(money ? `Lowest bidder for a ${money.text} contract (not yet awarded)` : "Lowest bidder for a contract (not yet awarded)");
    return R(money ? `Won ${/orders\b/.test(a) ? "orders" : "an order"} worth ${money.text}` : "Won a new order or contract", money ? "big" : "normal");
  }
  if (/\bqip\b|qualified institution/.test(a)) return R(money ? `Raised ${money.text} from large investors (QIP)` : "Raising money from large investors (QIP)", "big");
  if (/preferential/.test(a)) return R(money ? `Issuing ${money.text} of new shares to selected investors` : "Issuing new shares to selected investors (preferential issue)");
  if (/fund ?rais|raising (?:of )?funds/.test(a)) return R(money ? `Plans to raise ${money.text}` : "Board to consider raising money");
  if (/acquisition of shares by promoter|promoter.{0,40}(?:acquir|purchas|bought)/.test(a)) return R("A promoter bought more shares", "big");
  if (/pledge/.test(a)) return /invoc/.test(a) ? R("Lenders sold a promoter's pledged shares", "big") : /release|revoc/.test(a) ? R("A promoter freed shares from a pledge") : R("A promoter pledged shares as security for a loan");
  if (/amalgamation|merger|scheme of arrangement|demerger/.test(a)) {
    if (/nclt|tribunal/.test(a) && /sanction|approv|order/.test(a)) return R("The tribunal (NCLT) approved its merger or restructuring plan", "big");
    if (/observation letter|no.?objection/.test(a)) return R("Stock exchanges cleared its merger plan for the next step");
    if (/approv|consider/.test(a) && /board/.test(a)) return R("Board approved a merger or restructuring plan", "big");
    return R("Update on its merger or restructuring plan");
  }
  if (/acquisition|acquire/.test(a)) {
    const m = text.match(/acqui\w* (?:of )?(?:an? )?(\d+(?:\.\d+)?%) (?:stake|equity(?: stake)?|shares?|of the (?:equity )?share capital)?\s*(?:in|of) ([A-Z][^.,;(]{2,60})/i);
    return R(m ? `Buying ${m[1]} of ${m[2].trim()}` : money ? `An acquisition worth ${money.text}` : "Announced an acquisition", "big");
  }
  if (/\bsale\b|disposal|divest/.test(t) || /\bsale of\b.{0,60}(?:shares|stake|business|undertaking|subsidiary)/.test(a)) return R(/terminat|cessation/.test(a) ? "Ended an agreement and stopped the business under it" : money ? `Selling a stake or business for ${money.text}` : "Selling a stake or a business");
  if (/commencement of commercial|commercial production|commenced operations|commission(?:ed|s)\b|energi[sz]ation|inaugurat/.test(a)) return R(ownLine && !GENERIC_RELEASE.test(ownLine) && ownLine.length > 20 ? shorten(ownLine) : "Started commercial production or operations", "big");
  if (/capacity (?:addition|expansion)|new plant|expansion of/.test(a)) return R("Adding production capacity");
  if (/(?:loan|term loan|borrow|credit facility|debentures?|\bncds?\b)/.test(a) && money) return R(`Took a ${money.text} loan or debt facility`);
  if (/tie.?up|partnership|joint venture|\bmou\b|memorandum of understanding|agreement/.test(a)) {
    if (/purchase of .{0,30}premises|office premises/.test(a)) return R("Buying office premises");
    if (/share purchase agreement/.test(a)) return R("Signed an agreement to buy or sell shares in a company");
    if (/licen[cs]e agreement/.test(a)) return R("Signed a licence agreement");
    if (ownLine && telling(ownLine) && !GENERIC_RELEASE.test(ownLine)) return R(shorten(ownLine));
    return R(/long term|supply|sales and purchase/.test(a) ? "Signed a long-term supply or sales agreement" : "Signed a partnership or agreement");
  }

  // ── people ──
  const role = roleIn(text), who = person(text), unit = UNIT.test(text);
  if (/resign|cessation|retire|step(?:s|ped)? down|demise/.test(a) && !/appointment of .{0,80}(?:chief|director|officer)/.test(a.split("·")[1] ?? "")) {
    if (role && !unit) return R(`${/retire/.test(a) ? "Retiring" : "Leaving"}: ${who ? `${who}, ` : "its "}${role}`, role === "chairman" ? "normal" : "big");
    if (/independent director/.test(a)) return R("An independent director left the board");
    if (/director/.test(a)) return R("A director left the board", "minor");
    return R("A senior manager left", "minor");
  }
  if (/appoint|change in (?:director|management|key managerial)|re-?designat|re-?appoint/.test(a)) {
    if (/re-?appoint/.test(a)) return R(`Re-appointed${who ? ` ${who}` : " a director"}`, "minor");
    if (role && unit) return R(`New head of a business unit or subsidiary${who ? `: ${who}` : ""}`);
    if (role) return R(`New ${role}${who ? `: ${who}` : ""}`, role === "chairman" ? "normal" : "big");
    if (/chief (?:operating|technology|business|scientific|strategy|people|human|risk|marketing|digital)|\bcoo\b|\bcto\b|president|vice president|head of/.test(a)) return R(`New senior leader${who ? `: ${who}` : ""}`);
    if (/independent director/.test(a)) return R("Added an independent director to its board", "minor");
    if (/director/.test(a)) return R("A change on its board of directors", "minor");
    return R("A change in its management", "minor");
  }

  // ── ratings and regulators ──
  if (/\besg rating/.test(a)) return R("Got an ESG (environment and governance) rating", "minor");
  if (/credit rating|\brating\b/.test(a)) {
    if (/upgrad/.test(a)) return R("Its credit rating was upgraded", "big");
    if (/downgrad/.test(a)) return R("Its credit rating was downgraded", "big");
    if (/watch/.test(a) && /negative/.test(a)) return R("Its credit rating was put on watch for a cut", "big");
    if (/revis/.test(a)) return R("Its credit rating was revised (see the filing for which way)");
    if (/reaffirm|retain|maintain/.test(a)) return R("Its credit rating stayed the same", "minor");
    return R("Got a credit rating on its loans or bonds", "minor");
  }
  if (/fine|penalt/.test(a) && /exchange|sebi|nse|bse/.test(a)) return R("Was fined by the stock exchanges or SEBI");
  if (/warning letter/.test(a)) return R("Got a warning letter from SEBI");
  if (/usfda|fda\b/.test(a)) return R(/observation|483|warning/.test(a) ? "A US FDA inspection found issues at a plant" : /inspection/.test(a) ? "The US FDA inspected one of its plants" : "News from the US FDA about its plants");
  if (/orders? passed|order pronounced|action\(s\)|show cause|demand (?:order|notice)|seizure|search|raid|\bgst\b|income tax|customs|directorate|high court|supreme court|litigation|dispute/.test(a)) return R(money ? `Got a court, tax or regulator order (${money.text})` : /court|litigation|dispute|nclt/.test(a) ? "An update on a court case or dispute" : "Got an order or notice from a tax authority or regulator");
  if (/spurt in volume|price movement|clarification/.test(a)) return R("NSE asked it to explain unusual trading in its shares");
  if (/licen[cs]e|registration|approval letter|incentive/.test(a) && /grant|receiv|approv|certificate/.test(a)) return R(ownLine && !GENERIC_RELEASE.test(ownLine) ? shorten(ownLine) : "Received a licence or government approval");
  if (/fire|explosion|accident|shut-?down|strike|lockout/.test(a)) return R(ownLine ? shorten(ownLine.replace(/^press release (?:on )?/i, "")) : "Reported an incident at a plant", "big");

  // ── updates that say something ──
  if (/business update|monthly update|operational update|sales update|production update/.test(a)) return R("Shared its monthly business update");
  if (/mclr|lending rate|interest rate/.test(a)) return R("Changed its lending interest rates", "minor");
  if (/analyst|investors?\s*meet|conference call|earnings call|con-?call/.test(a)) return R(/transcript|recording/.test(a) ? "Shared the recording or notes of its investor call" : "Meeting analysts or investors", "minor");
  if (/presentation|investor update|shareholders? letter/.test(a)) return R("Shared an investor presentation or update", "minor");
  if (/insider trading|regulation 7\(2\)|regulation 8\b|form c\b|\bsast\b|regulation 29|regulation 31\b/.test(a)) return R("Disclosed shares bought or sold by an insider", "minor");
  if (/reclassification/.test(a)) return R("Asked to change who counts as a promoter", "minor");
  if (/new (?:retail )?store|opening of/.test(a)) return R("Opened a new store or branch");
  if (/material (?:issue|event)/.test(a) && (!ownLine || /disclosure of material/.test(ownLine.toLowerCase()))) return R("Reported a material event (the details are in the filing)");
  if (ownLine && !GENERIC_RELEASE.test(ownLine) && !/regulation\s*\d|lodr|sebi \(listing|^disclosure (?:under|pursuant)|^intimation (?:under|pursuant)/i.test(ownLine) && ownLine.length > 12) return R(shorten(ownLine), telling(ownLine) ? "normal" : /press release/.test(t) ? "normal" : "normal");
  if (/press release|media release/.test(a)) return R(/result|earning|q[1-4]|h[12]/.test(a) ? "Shared a press release on its results" : "Shared a press release", "minor");
  return R("Routine notice filed with NSE", "minor");
}
