// What each screen's public page says beyond its rules (25 Oct 2026, the SEO
// audit): the words people search for it by (its page title and heading),
// what the filters look for in plain words, who it may be a starting point
// for, and what it can't tell you. Written as research guidance about the
// filters, never as advice about the companies: a screen lists companies that
// pass a set of figures; it says nothing about whether to buy them.
export const SCREEN_GUIDES = {
  high_quality_compounders: {
    search: "High quality stocks India with high ROCE and low debt",
    lookFor: "Businesses that have grown sales by at least 10% a year for three years while earning high returns on equity and capital, with wide operating margins, little debt, owners who hold a large stake without pledging it, and a P/E that isn't extreme.",
    suits: "People studying durable, cash-generating businesses — the kind that can reinvest at high returns for years.",
    limits: "Past returns on capital don't guarantee future ones; a moat can erode. The P/E cap still admits expensive companies, and three years of growth can include one unusual year.",
  },
  dividend_aristocrats: {
    search: "High dividend paying stocks India",
    lookFor: "Large companies (₹5,000 Cr and up) paying a dividend yield of 1.5% or more, with a five-year average return on equity of at least 12%, moderate debt and a meaningful promoter stake.",
    suits: "People researching income from dividends, who want to start from established, profitable companies rather than the highest yields alone.",
    limits: "Yield is last year's dividends over today's price: a falling share price raises it, and a one-off special dividend can flatter it. It doesn't check how long the dividend has been paid or covered.",
  },
  undervalued_growth: {
    search: "Growth stocks India at a reasonable P/E",
    lookFor: "Companies growing sales by 12% or more a year with a five-year average ROE of at least 15%, low debt, and a P/E of 38 or less — growth that isn't priced at the extremes.",
    suits: "People looking for growing, profitable businesses and wanting to leave out the most richly priced ones.",
    limits: "A P/E of 38 is still high for many sectors; compare against the company's own history and its peers. Growth can slow, and the screen doesn't look at cash flow.",
  },
  defensive_bluechips: {
    search: "Large cap stocks India with steady returns and dividends",
    lookFor: "Very large companies (₹50,000 Cr and up) with a five-year average ROE of 12% or more, a promoter stake of at least 35% and a dividend yield of 1% or more.",
    suits: "People studying large, established companies that tend to move less than the market as a whole.",
    limits: "Size and a dividend don't remove risk; large companies can fall a long way. It doesn't check debt or how the share price has moved.",
  },
  small_cap_multibaggers: {
    search: "Small cap stocks India with strong growth and low debt",
    lookFor: "Smaller companies (₹500–5,000 Cr) growing sales by 15% or more a year, with a return on capital of at least 15%, low debt and promoters who own more than half.",
    suits: "People researching small companies with the traits that past large winners shared early on — growth, returns on capital, little debt, owners with skin in the game.",
    limits: "Most small companies with these traits don't become multibaggers. Small caps trade thinly, swing hard, and their filings deserve extra checking. The name describes traits, not a return anyone can expect.",
  },
  ofss_style_filter: {
    search: "Debt free stocks India with high margins and ROE",
    lookFor: "Companies with operating margins of 25% or more, a five-year average ROE of at least 20%, almost no debt, promoters owning over half and some sales growth.",
    suits: "People studying highly profitable, conservatively financed businesses.",
    limits: "High margins can attract competition, and some come from one product or customer. Little debt can also mean idle cash dragging on returns. Growth only has to be 5%.",
  },
  top_gainers: {
    search: "Top gainers NSE: stocks that rose most",
    lookFor: "Companies worth ₹500 Cr or more, ranked by how much their share price rose over the period you pick — a day, a week, a month, six months, a year, three or five years.",
    suits: "People who want to see where the market's strongest moves have been, as a place to start reading about why.",
    limits: "A big rise says nothing on its own about the business, and it doesn't continue by default. Check what drove it in the company's results and announcements.",
  },
  momentum_growth: {
    search: "Fast growing companies India with high sales growth",
    lookFor: "Companies growing sales by 25% or more a year for three years, with a five-year average ROE of 15% or more, manageable debt and a promoter stake of at least 30%.",
    suits: "People researching fast-growing businesses that are still earning good returns while they grow.",
    limits: "Very fast growth is hard to keep up, and it is often already in the price. It doesn't check valuation or cash flow.",
  },
  turnaround_plays: {
    search: "Low PE stocks India with growing sales and low debt",
    lookFor: "Companies on a P/E of 20 or less that are still growing sales by 10% or more a year, with a return on capital of at least 12% and low debt.",
    suits: "People looking for profitable, growing companies the market prices modestly.",
    limits: "A low P/E can be low for a reason — a cyclical peak, a one-off gain, or trouble ahead. The figures are a year old at most; check the latest quarters.",
  },
  psu_value: {
    search: "PSU stocks with low PE and high dividend",
    lookFor: "Large companies (₹5,000 Cr and up) on a P/E of 15 or less with a dividend yield of 2% or more and a five-year average ROE of at least 10%.",
    suits: "People studying government-owned and other established companies that pay out much of what they earn.",
    limits: "Government-owned companies can be steered by policy as well as profit, and their dividends can change with the government's needs. A low P/E may reflect that.",
  },
  dividend_growth: {
    search: "Dividend growth stocks India",
    lookFor: "Companies growing sales by 10% or more a year with a five-year average ROE of 15% or more, low debt, a promoter stake of at least 35% and a dividend yield of 1% or more.",
    suits: "People researching companies that can both grow and pay dividends — where the dividend has room to rise with profits.",
    limits: "It checks today's yield and the business's growth, not a record of rising dividends year after year; the company's dividend history shows that.",
  },
  fii_favorites: {
    search: "Stocks with high FII holding",
    lookFor: "Large companies (₹10,000 Cr and up) where foreign institutions own 20% or more, with a five-year average ROE of 12% or more and moderate debt.",
    suits: "People studying which companies foreign funds hold in size.",
    limits: "Foreign funds cut their holdings as readily as they add to them, sometimes all at once for reasons that have nothing to do with the company. The holding is from the last quarterly filing.",
  },
  dii_backed: {
    search: "Stocks with high mutual fund and DII holding",
    lookFor: "Companies worth ₹5,000 Cr or more where domestic institutions — mutual funds, insurers, pension funds — own 25% or more, with a five-year average ROE of at least 10%.",
    suits: "People studying which companies Indian institutions hold in size.",
    limits: "Institutions' reasons vary, and a big holding can be index-driven. The holding is from the last quarterly filing.",
  },
  net_net_value: {
    search: "Net net stocks India: trading below net current assets",
    lookFor: "Companies whose whole market value is at or below their net current assets — current assets less all liabilities — Benjamin Graham's deepest value test.",
    suits: "People studying deep-value ideas, where the balance sheet alone seems to cover the price.",
    limits: "Many net-nets are cheap because the business is shrinking or the assets aren't what they seem — receivables that won't be collected, stock that can't be sold. Most are small and thinly traded.",
  },
  up_every_timeframe: {
    search: "Stocks in an uptrend on NSE",
    lookFor: "Shares higher than they were a month, six months, a year and five years ago — a price trend that holds on every timeframe.",
    suits: "People studying price trends, as a starting point for reading the businesses behind them.",
    limits: "It is about the share price only: it doesn't look at the business or its valuation, and a trend can end at any time.",
  },
  near_highs_cheap: {
    search: "Stocks near 52 week high with low PE",
    lookFor: "Companies worth ₹500 Cr or more within 10% of their 52-week high, yet on a P/E of 20 or less, with earnings per share up 25% or more on a year ago.",
    suits: "People looking at companies whose earnings have risen faster than their share price.",
    limits: "One year's jump in earnings can be a one-off; check that it came from the business, not an exceptional gain. Few companies pass at once.",
  },
  debt_paydown: {
    search: "Companies reducing debt in India",
    lookFor: "Companies that cut their debt by 15% or more in the last year while growing sales and operating profit by 15% or more, with debt below their equity.",
    suits: "People researching balance sheets that are getting stronger while the business grows.",
    limits: "Debt can fall because assets were sold or new shares were issued, not only from profits. It's one year's change; look at a few years.",
  },
  fallen_quality: {
    search: "Quality stocks that have fallen sharply",
    lookFor: "Companies with a quality score of 60 or more whose shares are oversold on the 14-day RSI (30 or below) — good businesses on their filings, sold hard recently.",
    suits: "People studying sharp falls in otherwise sound companies, to read what caused them.",
    limits: "A fall can reflect news the filings don't show yet. RSI describes recent price moves only and says nothing about where the price goes next.",
  },
  doubled_in_year: {
    search: "Stocks that doubled in 1 year in India",
    lookFor: "Companies worth ₹1,000 Cr or more whose share price at least doubled over the last year.",
    suits: "People who want to see the year's biggest moves and read what drove them.",
    limits: "A doubling says nothing about what happens next; many of these are cyclical or re-rated on expectations. Check the results behind the move.",
  },
  sound_banks: {
    search: "Banks with low NPA and strong capital",
    lookFor: "Banks with gross bad loans of 2% or less, net bad loans of 0.5% or less, CET1 capital of 12% or more and a return on assets of at least 1%.",
    suits: "People studying banks with clean loan books and strong capital.",
    limits: "Bad loans can rise quickly in a downturn, and these are the last reported quarter's figures. Valuation isn't part of the screen.",
  },
};
