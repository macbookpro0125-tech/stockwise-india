// Plain English for a company's announcement to NSE (23 Oct 2026, "this isn't
// understandable, make it understandable"): what that kind of announcement
// usually is, and what the market terms in it mean. Fixed definitions of the
// words, matched in the announcement's own text — they say what a term means,
// never what this announcement means for the company or its price.

// What each kind of announcement usually is (market-news.js sorts them)
export const KIND_MEANS = {
  results: "The company's results for a quarter or a year. The usual check is sales and profit against the same quarter a year earlier.",
  dividends: "Money or shares going to shareholders. To get it, you must hold the shares on the record date.",
  deals: "An order, contract, purchase or way of raising money. How much it matters depends on its size next to the company's yearly sales.",
  people: "A change among the company's directors or senior managers.",
  legal: "A credit rating, court case, tax demand or penalty.",
  updates: "A disclosure the market's rules require. Many are routine; the filing has the details.",
};

// [pattern, the term as shown, what it means]; the first matches come first
const TERMS = [
  [/in[- ]principle approval/i, "In-principle approval", "The stock exchange's first go-ahead: the plan meets its rules. A final approval comes later, before anything is listed."],
  [/preferential (issue|allotment|basis)/i, "Preferential issue", "New shares (or warrants) sold to a chosen group of investors at a set price, rather than offered to every shareholder. It brings money into the company and adds shares, so each existing share is a slightly smaller part of the company."],
  [/convertible warrants?|\bwarrants?\b/i, "Convertible warrants", "A right, paid for partly now (usually a quarter of the price), to get shares later — within 18 months — at a price fixed today. The rest is paid when the warrant is turned into shares."],
  [/private placement/i, "Private placement", "Shares or bonds sold directly to selected investors instead of to the public."],
  [/\bqip\b|qualified institutions? placement/i, "QIP", "Qualified institutional placement: new shares sold to large investors such as mutual funds and insurers, a quick way for a listed company to raise money."],
  [/rights (issue|entitlement)/i, "Rights issue", "New shares offered to existing shareholders in proportion to what they hold, usually at a discount to the market price."],
  [/\bbonus\b/i, "Bonus issue", "Free extra shares for shareholders (for example 1 for every 1 held). There are more shares, but the company is worth the same, so the price per share adjusts down."],
  [/sub-?division|stock split|split of (equity )?shares/i, "Stock split", "Each share is split into several of a smaller face value. The share price adjusts by the same ratio; what your holding is worth doesn't change."],
  [/buy-?back/i, "Buyback", "The company buys its own shares back from shareholders, usually above the market price. Fewer shares are left afterwards."],
  [/record date/i, "Record date", "The date you must be on the company's list of shareholders to get a dividend, bonus or other benefit. Buy at least a working day before it."],
  [/interim dividend/i, "Interim dividend", "A dividend paid during the year, before the yearly accounts are final."],
  [/final dividend/i, "Final dividend", "The dividend for the full year, approved by shareholders at the annual meeting."],
  [/\bdividend\b/i, "Dividend", "Cash paid to shareholders out of profits, an amount per share."],
  [/face value/i, "Face value", "The nominal value printed on a share (₹1, ₹2, ₹10…). It isn't the market price, and dividends are often stated as a percentage of it."],
  [/outcome of (the )?board meeting/i, "Outcome of board meeting", "What the company's board decided at its meeting — often results, a dividend or fund-raising."],
  [/board meeting/i, "Board meeting", "A meeting of the company's directors, usually to approve results, dividends or plans. The notice says the date and why."],
  [/regulation 30|reg\.? 30/i, "Regulation 30", "SEBI's rule that a listed company must tell the exchange promptly about events that could matter to investors. Mentioning it means this is a required disclosure."],
  [/regulation 74|reg\.? 74/i, "Regulation 74(5)", "A routine quarterly confirmation that share certificates handed in to be held electronically were dealt with."],
  [/trading window/i, "Trading window", "The period when the company's insiders may not trade its shares, usually closed before results. Routine."],
  [/wholly[- ]owned subsidiary/i, "Wholly owned subsidiary", "A company this one owns entirely."],
  [/incorporation of (a |its )?(new )?(wholly[- ]owned )?subsidiar/i, "Incorporation of a subsidiary", "The company has set up a new company that it controls, often for a new business or project."],
  [/subsidiar(y|ies)/i, "Subsidiary", "A company this one controls, usually by owning more than half of it."],
  [/acquisition|acquire/i, "Acquisition", "Buying another company, or a stake in one."],
  [/amalgamation|scheme of arrangement|merger/i, "Merger", "Companies combining into one. A scheme of arrangement is the court-approved plan for it; shareholders may get shares of the combined company."],
  [/demerger/i, "Demerger", "A business split off into a separate company; shareholders usually get shares in the new one."],
  [/letter of award|\bloa\b|work orders?|purchase orders?|(bag|bags|bagged|receiv\w*|secur\w*|won|wins?)\s+(an?\s+)?([\w-]+\s+){0,3}orders?\b|order (book|inflow|win)/i, "Order", "A customer has given the company work. Its value next to the company's yearly sales shows how much it matters."],
  [/credit rating|rating agenc|\b(crisil|icra|care ratings|india ratings|acuite|brickwork)\b/i, "Credit rating", "An agency's view of how able the company is to repay its debts. An upgrade is better, a downgrade worse; 'reaffirmed' means unchanged."],
  [/non[- ]convertible debenture|\bncds?\b/i, "NCDs", "Non-convertible debentures: bonds the company issues to borrow money. They pay interest and never become shares."],
  [/commercial paper/i, "Commercial paper", "Short-term borrowing, usually repaid within a year."],
  [/pledge|encumbrance/i, "Pledge", "Shares put up as security for a loan, usually by the promoters. If the loan isn't repaid, the lender can sell them."],
  [/\bpromoters?\b/i, "Promoter", "The founders or controlling shareholders of the company."],
  [/esop|esos|employee stock option/i, "Employee stock options", "Shares given to employees under the company's stock option plan. A small number of new shares."],
  [/allotment/i, "Allotment", "New shares or securities have been given to the investors who were due them."],
  [/open offer/i, "Open offer", "Someone who has bought a large stake (25% or more) must offer to buy shares from the public too, at a set price."],
  [/substantial acquisition|\bsast\b/i, "Substantial acquisition (SAST)", "A required notice that someone's holding in the company has crossed a level such as 5%."],
  [/delist/i, "Delisting", "Taking the company's shares off the stock exchange; shareholders are offered a price for them."],
  [/resign/i, "Resignation", "A director, manager or the auditor has left the role; the filing usually gives the reason."],
  [/appoint/i, "Appointment", "A new director or senior manager has been named."],
  [/key managerial personnel|\bkmp\b/i, "Key managerial personnel", "The company's top managers by law: the chief executive, finance head and company secretary."],
  [/analyst|investor (meet|conference)|earnings call|con[- ]?call/i, "Investor meeting", "Management speaking to analysts and investors. A recording or transcript usually follows."],
  [/show cause notice/i, "Show cause notice", "An authority asks the company to explain why action shouldn't be taken. Not yet a penalty."],
  [/tax demand|\bgst\b|income tax/i, "Tax demand", "A tax authority says more tax is due. Companies often dispute these on appeal."],
  [/\bpenalt(y|ies)\b|\bfined\b|imposed a fine/i, "Penalty", "An authority has fined the company. Its size next to the company's profit shows how much it matters."],
  [/newspaper (publication|advertisement)/i, "Newspaper publication", "Copies of a notice the company had to print in newspapers. Routine."],
  [/duplicate share certificate|loss of share certificate/i, "Duplicate share certificate", "A shareholder lost a paper certificate and is getting a new one. Routine."],
  [/spurt in (volume|price)|clarification/i, "Clarification", "The exchange asked the company about a sudden move in its price or trading, and this is the reply."],
  [/press release/i, "Press release", "The company's own statement to the media; the filing has it in full."],
];

// The kind's note and up to five terms the announcement uses, in the order of
// the list above
export function explainFiling({ title = "", summary = "", kind } = {}) {
  const text = `${title} ${summary ?? ""}`;
  const terms = [];
  const seen = new Set();
  for (const [re, term, means] of TERMS) {
    if (terms.length >= 5) break;
    // a broader term is left out once a narrower one of the same family is in
    const family = term.split(" ").pop().replace(/s$/, "").toLowerCase();
    if (!re.test(text) || seen.has(family)) continue;
    seen.add(family);
    terms.push({ term, means });
  }
  return { kind: KIND_MEANS[kind] ?? null, terms };
}

// The market's words in a headline (24 Oct 2026: a headline's page in the app
// itself) — what each means in general, never what the story says
const MARKET_TERMS = [
  [/valuations?|\bp\/e\b|price[- ]to[- ]earnings/i, "Valuation", "How expensive shares are next to what the companies earn. The usual measure is the P/E ratio: the price divided by a year's profit per share. A valuation \"reset\" means that ratio has come down."],
  [/\bearnings\b|\bprofits?\b/i, "Earnings", "A company's profit. \"Earnings season\" is the few weeks each quarter when companies report their results; \"earnings momentum\" means profits are growing faster than before."],
  [/\bfiis?\b|\bfpis?\b|foreign (portfolio )?investors?|foreign funds?/i, "FIIs / FPIs", "Foreign institutional (or portfolio) investors: funds from abroad that buy Indian shares and bonds. Their buying or selling often moves the whole market."],
  [/\bdiis?\b|domestic institution/i, "DIIs", "Domestic institutional investors: Indian mutual funds, insurers and pension funds. They often buy when foreign funds sell."],
  [/repo rate|rate cut|rate hike|\bmpc\b|monetary policy/i, "Repo rate", "The rate at which the RBI lends to banks. A cut makes loans cheaper and usually helps shares; the RBI's Monetary Policy Committee (MPC) sets it."],
  [/\brbi\b/i, "RBI", "The Reserve Bank of India, the central bank: it sets interest rates, manages the rupee and regulates banks."],
  [/\bsebi\b/i, "SEBI", "The Securities and Exchange Board of India, the market regulator: it makes the rules for listed companies, brokers and funds."],
  [/inflation|\bcpi\b|\bwpi\b/i, "Inflation", "How fast prices are rising, measured by the consumer price index (CPI). High inflation makes rate cuts less likely."],
  [/\bgdp\b/i, "GDP", "Gross domestic product: the value of everything the country produces in a period. Its growth is the broadest measure of the economy."],
  [/\bipos?\b|initial public offer/i, "IPO", "Initial public offering: a company selling shares to the public for the first time, before they list on the exchange."],
  [/\bgmp\b|grey market/i, "Grey market premium", "An unofficial price people trade IPO shares at before listing. It isn't regulated and is often wrong."],
  [/\bsensex\b|\bnifty\b/i, "Sensex and Nifty", "The market's two main indices: the Sensex is 30 large companies on BSE, the NIFTY 50 is 50 large companies on NSE. They show how the market as a whole moved."],
  [/bond yields?|\byields?\b/i, "Bond yield", "The return on government bonds. When it rises, safer bonds compete harder with shares for investors' money."],
  [/\brupee\b/i, "Rupee", "Its value against the dollar. A weaker rupee helps exporters such as IT companies and hurts importers such as oil companies."],
  [/\bcrude\b|oil prices?/i, "Crude oil", "India imports most of its oil, so higher prices raise costs and inflation and weigh on the rupee and the market."],
  [/profit[- ]booking|profit[- ]taking/i, "Profit booking", "Investors selling shares that have risen, to lock in the gain. It often follows a sharp rally."],
  [/\bcorrection\b/i, "Correction", "A fall of about 10% or more from a recent high. A fall of 20% or more is usually called a bear market."],
  [/\brall(y|ies|ied)\b/i, "Rally", "A sustained rise in prices over days or weeks."],
  [/market cap|m-?cap/i, "Market cap", "What a company is worth on the market: its share price times the number of shares."],
  [/\bsips?\b|systematic investment/i, "SIP", "Systematic investment plan: a fixed amount put into a mutual fund every month."],
  [/\bq[1-4]\b|quarter/i, "Quarter", "Indian companies' year runs April to March: Q1 is April–June, Q2 July–September, Q3 October–December, Q4 January–March."],
];

// Up to four terms a headline uses, in the order of the list above
export function explainHeadline(title = "") {
  return MARKET_TERMS.filter(([re]) => re.test(title)).slice(0, 4).map(([, term, means]) => ({ term, means }));
}
