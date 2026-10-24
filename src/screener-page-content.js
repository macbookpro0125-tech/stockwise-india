export const SCREENER_PAGE_PATH = "/stock-screener-india";
export const SCREENER_PAGE_TITLE = "Stock Screener for Indian Stocks (NSE)";
export const SCREENER_PAGE_DESCRIPTION = "Looking for a stock screener for Indian shares? See what Jocular Insights offers for NSE stocks, how its filters and research scores work, who it suits, and what it does not do.";

export const SCREENER_PAGE_SECTIONS = [
  {
    title: "What Jocular Insights does",
    paragraphs: [
      "Jocular Insights is an Indian stock screener and company-research tool for NSE-listed shares. Use a ready-made strategy or build a screen by adjusting financial and market filters, then open a result to inspect the figures behind it.",
      "A screen narrows a list using selected conditions. It is a research starting point, not a prediction that a company will perform well or a recommendation to buy or sell it."
    ],
    bullets: [
      "Ready-made screens and custom filters, including ranges for financial metrics.",
      "Company pages with financial results, price and financial charts, shareholding, filings and news.",
      "A quality score with its component checks and data coverage shown; unavailable information is not guessed.",
      "Reference fair values and price levels, comparison of up to five companies, Excel export, watchlists, alerts and portfolio tracking."
    ]
  },
  {
    title: "Is Jocular Insights the best stock screener for you?",
    paragraphs: [
      "There is no single best screener for every investor. Jocular Insights may suit someone who wants to filter NSE-listed companies and then see a transparent, rules-based explanation of company quality and valuation in the same place.",
      "It may not suit someone who needs a broker for placing trades, intraday trading tools, a guaranteed fair-value estimate for every company, or investment advice from a registered professional. Check that a tool's market coverage, data timing, filters and costs fit your own use before relying on it."
    ]
  },
  {
    title: "How to use the scores and valuations",
    paragraphs: [
      "The quality score combines checks across business quality, earnings, balance sheet, management and governance, growth, and valuation. The company page shows the checks and their coverage so you can see what information supports the result.",
      "Reference fair value is model output, not a target price. The usual model uses normalized earnings and a company's historical P/E when enough data is available; banks use a book-value model. Some companies will not have a fair value when the available data is insufficient."
    ]
  },
  {
    title: "Data timing, access and limitations",
    paragraphs: [
      "Company results, announcements and shareholding information are based on public NSE filings. Prices, charts and closing-price calculations use NSE's daily closes. Prices and new filings are normally refreshed on weekday evenings, and company pages show the dates used.",
      "Jocular Insights is in early access; creating an account currently requires no card. It is an educational tool and is not registered with SEBI as an investment adviser or research analyst. Public data can be delayed, restated or incomplete. Check original filings and consult a SEBI-registered adviser for personal financial advice."
    ]
  }
];

export const SCREENER_PAGE_FAQS = [
  {
    question: "What is a stock screener?",
    answer: "A stock screener filters a list of shares using conditions such as financial ratios, growth, price or sector. It helps organize research; it does not decide whether a share is right for you."
  },
  {
    question: "Does Jocular Insights cover Indian stocks?",
    answer: "Jocular Insights screens NSE-listed Indian shares and provides company research based on public filings and market data."
  },
  {
    question: "Is Jocular Insights free?",
    answer: "The service is in early access and currently does not require a card to create an account. Future pricing is not stated here."
  },
  {
    question: "Does a high score mean I should buy a stock?",
    answer: "No. The score is a rules-based summary of available historical information, not a forecast or investment recommendation. Review the checks, coverage, company filings and your own circumstances."
  }
];
