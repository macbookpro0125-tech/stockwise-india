# Company page: what Simply Wall St shows that we don't (20 Oct 2026)

Looked at as a signed-out visitor: their public company page for TCS
(Overview tab — the other tabs need an account) and the list of checks their
analysis model documents publicly. Their screener link
(simplywall.st/screener) returns "page not found". Nothing was copied: no
wording, design or code; their model write-up is licensed non-commercial, so
only the kinds of checks it covers informed this list. Everything below is
built from our own data (NSE filings, NSE daily prices and index closes) in
our own words and look.

## Already on our page

Price and 1W/1M/1Y returns, 52-week range, beta and volatility, market cap,
P/E (TTM and FY), fair value and price levels, a quality score from six
groups with every check explained, Piotroski, ten years of results and
quarters, ratios, five quarters of shareholding and pledges, peers, NSE
announcements with key lines, upcoming events (board meetings, corporate
actions), the company profile (website, employees), your notes.

## Missing — buildable from our data

Built 20 Oct 2026: #1–5 (At a glance and How the price has done on the
overview), #6 (Dividends), #7 (Financial health), #8 (Against its sector),
#10 (What changed recently) and #12 (Where these figures come from). Still
to build: #9 and #11.

| # | What | Theirs (in short) | Ours would be | Size |
|---|---|---|---|---|
| 1 | **Strengths and risks at the top** | a short list of rewards and risks before anything else | the 3–4 strongest checks and every caution from our own scorecard, in plain sentences, at the top of Overview | S |
| 2 | **The six scores at a glance** | one shape for five scores | our six group scores as one compact picture (our own design — not their "snowflake") | S–M |
| 3 | **Returns against the sector and the market** | 7D and 1Y vs industry and market, with a sentence | 1W/1M/1Y/3Y vs the stock's NSE sector index and Nifty 50, from our index closes, with one line saying ahead or behind | S |
| 4 | **Is the price jumpy?** | weekly movement vs industry, market and the market's calmest/wildest 10% | our volatility against the sector's and market's medians and the market's 10th/90th percentiles | S |
| 5 | **Longer price history** | 3M, 3Y, 5Y and since-listing changes | 3M/3Y/5Y changes from our price history | S |
| 6 | **A dividend section** | yield vs market, payout ratio, ex-date and pay date with a countdown, years of steady/growing payouts | yield vs the market's, earnings and cash payout ratios, next ex-date and record date from NSE's corporate actions, ten years of payouts and whether they held or grew | M |
| 7 | **Financial health as a picture** | short-term assets vs liabilities, debt vs equity over time, debt covered by cash flow, cash runway for loss-makers | the same questions answered from our balance sheets, with a debt-to-equity history chart and a cash runway line for loss-makers | M |
| 8 | **Against the sector, not just peers** | earnings growth and returns on capital vs industry | 5-year EPS growth, ROE and ROCE beside the sector's medians (we already compute sector P/E medians) | M |
| 9 | **Insider and promoter trades** | insider buying and selling | NSE's insider-trading (PIT) and takeover-code (SAST) disclosures for the last 12 months: who, bought or sold, how much | M–L (a new NSE data job) |
| 10 | **What changed recently** | an automatic feed: results posted, dividend declared, price moved 16% this week | the same kind of lines from our own data: results vs a year ago, a dividend announced, a big weekly move, a score change | M |
| 11 | **The latest earnings call** | an AI summary of the call and results vs analyst estimates | the transcript Indian companies must file with NSE, linked with its key lines (we already pull key lines from filings); results vs the same quarter last year, not vs estimates | M |
| 12 | **Where the data comes from, and when** | a table of sources and last-updated times | prices date, latest results filed, score worked out at — one small box | S |

## Not doable with free data (or not for us)

- Analyst forecasts, price targets, "consensus vs reported" — paid data.
- A cash-flow (DCF) fair value from analyst forecasts — needs forecasts; a
  DCF from past cash flows alone is possible later as a second view.
- Community fair values and narratives; an AI chat about the company —
  social features that need moderation, and the chat would need an LLM
  service.
- Management (CEO tenure and pay, board) — in annual reports, not in the
  structured NSE data we read; possible later from the corporate-governance
  filings.
