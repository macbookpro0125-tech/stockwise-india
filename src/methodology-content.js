// Public explanation of the model, shared by the browser page and the
// server-rendered HTML that search crawlers receive before JavaScript runs.
export const METHODOLOGY_TITLE = "How Jocular Insights scores and values NSE companies";
export const METHODOLOGY_DESCRIPTION = "See how Jocular Insights calculates quality scores and fair values from NSE filings, how the bank and cyclical models differ, and when the data is not enough to show a value.";

export const METHODOLOGY_SECTIONS = [
  {
    title: "What the numbers are",
    paragraphs: [
      "Jocular Insights is an automated educational research tool. Its scores and valuation figures are outputs of fixed rules applied to public company filings and market data. They are reference estimates, not forecasts, research recommendations or investment advice.",
      "The calculations use reported information. They cannot assess facts that are not in the data, such as a company's competitive position, future plans or the quality of management beyond the checks described here. A check that cannot be supported by the filings is marked unavailable rather than guessed."
    ]
  },
  {
    title: "Quality score",
    paragraphs: [
      "The quality score is out of 100 and combines six groups. Each group has a fixed share of the total; the checks inside each group are scored against stated bands and their displayed reasons are available on the company's scorecard."
    ],
    bullets: [
      "Business quality: 25 points",
      "Earnings quality: 20 points",
      "Balance sheet: 15 points",
      "Management and governance: 15 points",
      "Growth: 10 points",
      "Valuation: 15 points"
    ]
  },
  {
    title: "Missing checks and the overall research score",
    paragraphs: [
      "A check that is missing or does not apply is not scored as zero or treated as a pass. The remaining eligible checks are reweighted within their group. A group can be scored when at least 35% of its applicable check weight has data, and a quality score is shown when scored groups cover at least 60% of the applicable group weight. This means two companies' scores can be based on different amounts of evidence; the scorecard shows what was checked and what was not.",
      "The overall research score geometrically blends quality excluding valuation (70%) with valuation (30%), then can be reduced by up to 35% for price risk and data gaps. Technical price trends are shown separately and do not change the quality or overall research score. Quality can be capped at 69 when important balance-sheet or governance data cannot be checked; an unresolved critical audit flag can cap the overall score at 39. The relevant company page explains any cap."
    ]
  },
  {
    title: "Fair value for most companies",
    paragraphs: [
      "For companies with a profit in the latest year, the usual earnings-based value requires at least five years of annual results and three usable historical P/E observations. The reference fair value is normalized earnings per share multiplied by the company's median historical P/E. When at least five sector or industry peers have usable P/Es, the multiple is capped at twice the peer median. If one year's earnings are unusually high compared with its own history, the model can use median historical earnings per share instead.",
      "For a company flagged as cyclical with at least seven years of history, earnings are normalized using its current revenue per share and its median historical profit margin, then valued at its usual multiple on those mid-cycle earnings. This is intended to reduce the effect of a temporary earnings peak or trough. With less than seven years, the page marks the cycle as partial and uses the earnings model where eligible.",
      "The model does not force a fair value when the information is insufficient. Recent listings, loss-makers, holding companies and some lenders can show that more data or a different model is needed instead. EV/Sales may be displayed as context for some companies; it is not presented as a fair value."
    ]
  },
  {
    title: "Bank valuation",
    paragraphs: [
      "Banks use a book-value model because their balance sheets and loan provisions make industrial-company earnings and cash-flow comparisons unsuitable. The model estimates a justified price-to-book multiple from return on equity, sustainable growth and a cost of equity, then applies it to book value per share after known net bad loans are deducted.",
      "The cost of equity assumption is 12%, or 13% for government-owned banks. Sustainable growth is based on return on equity and retained earnings, subject to model caps. Where net non-performing assets are below 2%, the model uses the median return on equity from the latest three years; otherwise it uses a longer through-cycle history. The stock page shows the assumptions and available cross-checks."
    ]
  },
  {
    title: "Sources, dates and limitations",
    paragraphs: [
      "Company results, announcements and shareholding information come from filings with NSE. Returns and model calculations use NSE closing prices. The chart and the latest displayed price use the same NSE daily closes. Prices and newly filed results are normally refreshed on weekday evenings; each company page shows the dates used for its figures.",
      "Public filings may be late, restated or misread, and market data can be delayed or unavailable. Check important figures against the original filings. The model is not proven to predict returns, and past performance does not predict future results.",
      "Jocular Insights is not registered with SEBI as an investment adviser or research analyst. It is independent of NSE, BSE and the companies shown. Questions or corrections can be sent to jocularinsights@gmail.com."
    ]
  }
];
