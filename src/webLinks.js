// "Around the web" (24 Oct 2026: "show tweets, Reddit, YouTube videos about
// the stock in one place; in one click search the whole internet"): for a
// company, a search on each site that's talked about it, opened in a new tab.
// Links only — what's on those sites stays there; X and Reddit can't be read
// into the app without their paid or approved APIs.

// The name as people write it: without "Limited", "(India)", "Ltd."
export function searchName(name, symbol = "") {
  const n = String(name ?? "").replace(/\b(limited|ltd)\b\.?/gi, "").replace(/\(india\)/gi, "").replace(/\s+/g, " ").trim();
  return n || String(symbol);
}

// TradingView writes NSE's & and - as _ (M&M → NSE-M_M, BAJAJ-AUTO → NSE-BAJAJ_AUTO)
const tvSymbol = symbol => String(symbol).replace(/[&-]/g, "_");
const q = encodeURIComponent;

// [group, [{ id, label, sub, url }]]
export function webLinks({ name, symbol }) {
  const n = searchName(name, symbol);
  const quoted = `"${n}"`;
  return [
    ["People talking about it", [
      { id: "x", label: "X (Twitter)", sub: "Latest posts", url: `https://x.com/search?q=${q(`${quoted} (share OR stock OR results) lang:en`)}&f=live` },
      { id: "reddit", label: "Reddit", sub: "Indian investing subreddits", url: `https://www.reddit.com/search/?q=${q(`${n} subreddit:IndianStockMarket OR subreddit:IndiaInvestments OR subreddit:IndianStreetBets`)}&sort=new` },
      { id: "valuepickr", label: "ValuePickr", sub: "Long-form investor discussion", url: `https://forum.valuepickr.com/search?q=${q(n)}` },
      { id: "youtube", label: "YouTube", sub: "Videos and analysis", url: `https://www.youtube.com/results?search_query=${q(`${n} share analysis`)}` },
    ]],
    ["News", [
      { id: "gnews", label: "Google News", sub: "Every outlet, newest", url: `https://news.google.com/search?q=${q(`${quoted} share`)}&hl=en-IN&gl=IN&ceid=IN:en` },
      { id: "moneycontrol", label: "Moneycontrol", sub: "News and analysis", url: `https://www.google.com/search?q=${q(`site:moneycontrol.com ${n}`)}` },
      { id: "et", label: "Economic Times", sub: "Markets coverage", url: `https://www.google.com/search?q=${q(`site:economictimes.indiatimes.com ${n} share`)}` },
    ]],
    ["From the company", [
      { id: "nse", label: "NSE", sub: "Quote and announcements", url: `https://www.nseindia.com/get-quotes/equity?symbol=${q(symbol)}` },
      { id: "concalls", label: "Concalls and presentations", sub: "Transcripts, slides, annual reports", url: `https://www.screener.in/company/${q(symbol)}/consolidated/#documents` },
      { id: "annual", label: "Annual reports", sub: "Search for the PDFs", url: `https://www.google.com/search?q=${q(`${quoted} annual report pdf`)}` },
    ]],
    ["Other tools", [
      { id: "screener", label: "Screener.in", sub: "Ten years of figures", url: `https://www.screener.in/company/${q(symbol)}/consolidated/` },
      { id: "tradingview", label: "TradingView", sub: "Chart and ideas", url: `https://www.tradingview.com/symbols/NSE-${q(tvSymbol(symbol))}/` },
      { id: "google", label: "The whole web", sub: "Google", url: `https://www.google.com/search?q=${q(`${quoted} share`)}` },
    ]],
  ];
}

// "Search all": the four that say most about what people think, in one go
export const SEARCH_ALL = ["x", "reddit", "youtube", "gnews"];
