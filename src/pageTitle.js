// Page titles, shared by the pages the server writes (server/seo*.js) and the
// app's copies of them (PublicLists.jsx, PublicStock.jsx…), so the title in
// the HTML and the one the app sets are always the same (Google reads the
// title after the page's scripts have run).
//
// Google shows about 60 characters of a title, with the site's name above it
// (from the WebSite markup on the front page). So a title gets the name after
// it only when both fit; a longer one keeps its own words instead of losing
// its end (9 Nov 2026, the SEO audit: titles ran 74–97 characters, cut off
// after about 60). The words people search come first, the count next.
export const BRAND = "Jocular Insights";
const FITS = 64;
export const pageTitle = text => (`${text} | ${BRAND}`.length <= FITS ? `${text} | ${BRAND}` : text);

export const HOME_TITLE = `${BRAND}: Indian stock screener & quality scores (NSE)`;
export const SCREENS_TITLE = pageTitle("NSE stock screens: quality, value, dividends and growth");
export const CALENDAR_TITLE = pageTitle("NSE results calendar: who reports this week");
export const SECTORS_TITLE = pageTitle("NSE stocks by sector: every listed company");
export const LISTS_TITLE = pageTitle("NSE stock lists: Nifty 50, PSU, defence, under ₹100");

// a screen: what people search for it by, when it has one, and today's count
export const screenTitle = ({ name, matched, guide }) => pageTitle(guide?.search ? `${guide.search}: ${matched} today` : `${name}: ${matched} NSE stocks match today`);
export const sectorTitle = ({ name, count }) => pageTitle(`${name} stocks on NSE: ${count} companies by P/E, ROE`);
// a rule's list counts its companies; an index or a theme is the companies NSE lists
export const listTitle = ({ name, kind, count, group }) => group === "score" ? pageTitle(`${name}: NSE companies ranked by overall score`) : pageTitle(`${name} list: ${kind === "rule" ? `${count} NSE companies` : "companies"} by P/E, ROE`);
export const stockTitle = (name, symbol) => pageTitle(`${name} share price, fair value, P/E & results | ${symbol}`);
