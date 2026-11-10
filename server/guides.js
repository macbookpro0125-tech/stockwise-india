// Guides (30 Oct 2026, after AdSense asked for more original content): plain
// explainers of what the app's figures mean and how to read a company's
// filings, written by us for people new to the Indian market. They're
// evergreen — no prices, no company's figures, nothing to buy or sell — and
// link to the pages where each idea can be seen on real data.
//
//   /learn          the list
//   /learn/<slug>   one guide
//
// Each section's text is our own HTML, written here (not from any input).

export const GUIDES_UPDATED = "2026-11-08";
// The day each guide went up, from the commit that added it (for the guides'
// Article markup, seo-pages.js; 9 Nov 2026, the SEO audit). A new guide adds
// its own line; one without falls back to GUIDES_UPDATED.
export const GUIDE_PUBLISHED = {
  "how-to-read-quarterly-results": "2026-10-30",
  "pe-ratio-explained": "2026-10-30",
  "roe-and-roce": "2026-10-30",
  "debt-to-equity": "2026-10-30",
  "reading-a-balance-sheet": "2026-10-30",
  "cash-flow-statement": "2026-10-30",
  "shareholding-pattern": "2026-10-30",
  "how-to-analyse-a-bank": "2026-10-30",
  "results-calendar-and-board-meetings": "2026-10-30",
  "dividends-record-date": "2026-10-30",
  "how-to-use-a-stock-screener": "2026-10-30",
  "profit-margins": "2026-11-03",
  "free-cash-flow": "2026-11-03",
  "price-to-book": "2026-11-03",
  "large-mid-small-cap": "2026-11-03",
  "bonus-split-buyback-rights": "2026-11-03",
  "promoter-pledge": "2026-11-03",
  "working-capital": "2026-11-03",
  "piotroski-f-score": "2026-11-03",
  "reading-company-announcements": "2026-11-03",
  "credit-ratings": "2026-11-03",
  "cyclical-and-defensive-sectors": "2026-11-03",
  "fair-value-explained": "2026-11-08",
  "eps-explained": "2026-11-08",
  "ev-ebitda-explained": "2026-11-08",
  "red-flags-in-financial-statements": "2026-11-08",
};

export const GUIDES = [
  {
    slug: "how-to-read-quarterly-results",
    title: "How to read a company's quarterly results",
    desc: "What an Indian company's quarterly results contain, which lines matter, and how to compare a quarter fairly: against the same quarter a year ago.",
    sections: [
      ["What a results filing is", `<p>Every company listed on NSE files its financial results with the exchange each quarter. The filing is a table of the quarter's income and expenses, usually with the quarter before, the same quarter a year earlier and the year so far beside it. Most companies file two versions: <b>standalone</b>, for the listed company alone, and <b>consolidated</b>, which adds its subsidiaries. For a group with large subsidiaries, the consolidated figures are the ones that describe the whole business.</p>`],
      ["The lines that matter most", `<ul>
<li><b>Revenue from operations</b> (sales): what the company earned from its business, before other income such as interest on its cash.</li>
<li><b>Expenses</b>: materials, employee costs, other operating costs, then depreciation and finance costs (interest).</li>
<li><b>Operating profit</b> (often called EBITDA): revenue minus the costs of running the business, before depreciation, interest and tax. Divided by revenue, it gives the <b>operating margin</b>.</li>
<li><b>Exceptional items</b>: one-off gains or losses, such as selling a building. They can make a quarter look much better or worse than the business really was.</li>
<li><b>Net profit</b>: what is left for shareholders after everything, including tax.</li>
<li><b>EPS</b> (earnings per share): net profit divided by the number of shares.</li>
</ul>`],
      ["Compare with the same quarter a year ago", `<p>Many businesses are seasonal: an air-conditioner maker sells more in summer, a retailer more around festivals. Comparing a quarter with the one just before can mislead for that reason. The fairer comparison is <b>year on year</b> (YoY): this quarter against the same quarter last year. That is why the results tables in Jocular Insights lead with the YoY change.</p>`],
      ["Questions to ask of any quarter", `<ul>
<li>Did revenue grow, and did profit grow faster or slower than revenue? Profit growing much faster than sales usually means margins widened; ask whether that can last.</li>
<li>Is the profit from the business, or from other income and exceptional items?</li>
<li>Did the margin change? A falling margin with rising sales can mean costs are rising faster than prices.</li>
<li>Is this one quarter a pattern? Look at the last eight quarters together before drawing a conclusion.</li>
</ul>`],
      ["When results arrive", `<p>Under SEBI's listing rules, companies generally publish quarterly results within 45 days of the quarter's end, and the audited results for the full year within 60 days. Before the board meets to approve them, the company tells the exchange the date. Our <a href="/results-calendar">results calendar</a> lists those dates.</p>`],
    ],
    see: [["/results-calendar", "The results calendar"], ["/stock/TCS/financials", "A company's financials, as an example"]],
  },
  {
    slug: "pe-ratio-explained",
    title: "The P/E ratio, explained for Indian stocks",
    desc: "What the price-to-earnings ratio measures, why a 'cheap' P/E can be a trap, and how to compare it fairly: against the company's own history and its sector.",
    sections: [
      ["What P/E measures", `<p>The price-to-earnings ratio is the share price divided by earnings per share over the last twelve months. Put another way, it is how many rupees the market is paying today for each rupee of the company's yearly profit. A P/E of 20 means the shares cost 20 times one year's earnings.</p>`],
      ["Why P/E differs so much between companies", `<p>The market pays more for profit it expects to grow, to last, or to be reliable. A company growing its earnings quickly, with little debt and steady cash flow, usually trades on a higher P/E than one whose profits rise and fall with commodity prices. Neither number is right or wrong on its own: P/E is a summary of what the market expects, not a verdict.</p>`],
      ["Three traps", `<ul>
<li><b>A one-off profit</b> makes the P/E look low. If last year's earnings included a large exceptional gain, the ratio flatters the company.</li>
<li><b>Earnings at a peak</b> make a cyclical company look cheap exactly when its profits are about to fall: steel, cement and chemicals often show their lowest P/E at the top of their cycle.</li>
<li><b>Losses</b> make P/E meaningless. A company with no profit has no P/E at all, which is why it shows as blank.</li>
</ul>`],
      ["Compare like with like", `<p>A P/E means most next to two other numbers: the company's own usual P/E over several years, and the P/E of its sector. A bank and a software company are not comparable on P/E; two banks are closer. The fair value in Jocular Insights is built this way: from each company's normalized earnings and its own usual P/E, capped at twice its sector's. Banks are valued on book value instead. The <a href="/methodology">methodology</a> explains it in full.</p>`],
      ["The other side: earnings yield", `<p>Turned upside down, P/E becomes the earnings yield: earnings divided by price. A P/E of 25 is an earnings yield of 4%. Some investors compare that yield with what a fixed deposit or government bond pays, as a rough check on how much growth the price already assumes.</p>`],
    ],
    see: [["/methodology", "How our fair value is worked out"], ["/screens", "Screens that use P/E"]],
  },
  {
    slug: "roe-and-roce",
    title: "ROE and ROCE: how well a company uses its money",
    desc: "Return on equity and return on capital employed in plain words: what each measures, why debt changes ROE, and what a good number looks like over time.",
    sections: [
      ["Return on equity (ROE)", `<p>ROE is net profit divided by shareholders' equity: the money owners have put in plus the profits kept in the business. It answers, "for every ₹100 of shareholders' money in this company, how much profit did it make this year?" An ROE of 18% means ₹18.</p>`],
      ["Return on capital employed (ROCE)", `<p>ROCE is operating profit before interest and tax divided by capital employed: equity <i>plus</i> borrowings. It measures how well the business uses all its money, whoever provided it. Because it counts debt as capital too, it can't be pushed up just by borrowing.</p>`],
      ["Why you want both", `<p>A company can raise its ROE by taking on debt: less of its own money, the same profit, a higher return on equity. That's why a high ROE with a much lower ROCE deserves a closer look at the balance sheet. When the two are close and both high, the business is earning well on everything it uses.</p>`],
      ["What 'good' looks like", `<ul>
<li><b>Consistency matters more than one year.</b> A company that has earned 15–20% for ten years tells you more than one that earned 35% once.</li>
<li><b>Above the cost of money.</b> A business earning less on its capital than it pays to borrow is shrinking its owners' value, however fast it grows.</li>
<li><b>Different for lenders.</b> Banks and finance companies are judged on ROE and return on assets; ROCE doesn't suit a business whose raw material is borrowed money.</li>
</ul>`],
      ["Where to see them", `<p>Every company page shows ROE and ROCE, and the quality score in Jocular Insights rewards returns that are high <i>and</i> steady across years, not one good year.</p>`],
    ],
    see: [["/screens/high-quality-compounders", "A screen built on steady high returns"], ["/methodology", "How the quality score uses returns"]],
  },
  {
    slug: "debt-to-equity",
    title: "Debt to equity: how much a company borrows",
    desc: "What the debt-to-equity ratio shows, when borrowing is fine and when it is a risk, and why it doesn't apply to banks.",
    sections: [
      ["The ratio", `<p>Debt to equity is total borrowings divided by shareholders' equity. A ratio of 0.5 means the company owes half as much as its owners have in it; 2 means it owes twice as much. A company with no borrowings shows 0.</p>`],
      ["Debt isn't bad by itself", `<p>Borrowing lets a company build a plant or open stores sooner than its own profits would allow. Power, roads and telecom are built largely on debt because their cash flows are long and steady. The question is whether the business can comfortably pay the interest in a bad year as well as a good one.</p>`],
      ["Signs of strain", `<ul>
<li><b>Interest coverage</b>: operating profit divided by interest. Below about 2, a fall in profit leaves little room to pay lenders.</li>
<li><b>Debt rising faster than profit</b> for several years.</li>
<li><b>Borrowing to pay dividends</b> or to cover losses rather than to grow.</li>
<li><b>Promoter shares pledged</b> as security for loans, which can lead to forced selling if the price falls. See <a href="/learn/shareholding-pattern">reading the shareholding pattern</a>.</li>
</ul>`],
      ["Why banks are different", `<p>A bank's deposits are its borrowings, and lending them out is its business, so its debt to equity is always high and says little. Lenders are judged instead on the quality of their loans (bad loans, or NPAs) and their capital. Jocular Insights applies that separate test to banks and finance companies. See <a href="/learn/how-to-analyse-a-bank">how to read a bank</a>.</p>`],
    ],
    see: [["/methodology", "How the balance-sheet checks work"]],
  },
  {
    slug: "reading-a-balance-sheet",
    title: "Reading a balance sheet in ten minutes",
    desc: "What a company owns, what it owes and what belongs to shareholders: the few lines of an Indian company's balance sheet worth checking first.",
    sections: [
      ["The one rule", `<p>A balance sheet is a picture of one day, usually 31 March or 30 September. On one side is everything the company owns (<b>assets</b>); on the other, where the money for them came from: what it owes (<b>liabilities</b>) and what belongs to its owners (<b>equity</b>). The two sides are always equal.</p>`],
      ["What it owns", `<ul>
<li><b>Fixed assets</b>: plant, machinery, buildings. <b>Capital work in progress</b> is what's still being built.</li>
<li><b>Investments</b>: shares, bonds and stakes in other companies.</li>
<li><b>Inventory</b>: goods made or bought and not yet sold.</li>
<li><b>Receivables</b> (trade receivables): money customers owe.</li>
<li><b>Cash and bank balances.</b></li>
</ul>`],
      ["What it owes, and what's left", `<ul>
<li><b>Borrowings</b>, long and short term.</li>
<li><b>Trade payables</b>: money owed to suppliers.</li>
<li><b>Equity</b>: share capital plus reserves, which are mostly profits kept over the years.</li>
</ul>`],
      ["Five quick checks", `<ul>
<li>Is cash larger than borrowings? Then the company is <b>net cash</b>.</li>
<li>Are receivables growing much faster than sales? Customers may be paying slower, or sales may be booked before cash arrives.</li>
<li>Is inventory piling up faster than sales?</li>
<li>Is equity growing year after year? It grows when profits are kept, and shrinks with losses.</li>
<li>Is a large share of assets "other" or intangible? Read the notes to see what they are.</li>
</ul>`],
      ["Where to see it", `<p>Each company's <a href="/stock/TCS/financials">financials page</a> shows its balance sheet over several years, so the trend is visible at a glance, not just one date.</p>`],
    ],
    see: [["/stock/TCS/financials", "A company's balance sheet over years"]],
  },
  {
    slug: "cash-flow-statement",
    title: "Profit versus cash: the cash flow statement",
    desc: "Why a profitable company can still run short of cash, and how operating, investing and financing cash flows tell you where the money really went.",
    sections: [
      ["Profit is an opinion, cash is a fact", `<p>Profit is counted when a sale is made, even if the customer hasn't paid yet. Cash is counted when it actually arrives. Over a few years the two should roughly agree. When they don't, the cash flow statement shows why.</p>`],
      ["Three parts", `<ul>
<li><b>Operating cash flow</b>: cash from running the business, after paying suppliers, staff and tax.</li>
<li><b>Investing cash flow</b>: cash spent on plants, equipment and acquisitions, or received from selling them. It is usually negative for a growing company.</li>
<li><b>Financing cash flow</b>: cash raised from loans or new shares, and cash paid out as interest, repayments and dividends.</li>
</ul>`],
      ["Free cash flow", `<p>Operating cash flow minus the money spent on fixed assets (capital expenditure) is <b>free cash flow</b>: what the business generates that could be paid to owners or used to cut debt. A company with steady free cash flow can fund its own growth and dividends; one that never has any depends on lenders and new shareholders.</p>`],
      ["What to look for", `<ul>
<li>Operating cash flow close to, or above, net profit over three to five years.</li>
<li>Profit growing every year while operating cash flow stays flat or falls: ask where the cash is going, often into receivables or inventory.</li>
<li>Dividends paid out of borrowed money (financing inflows) rather than operating cash.</li>
</ul>`],
      ["Where to see it", `<p>A company's financials page in Jocular Insights shows where the cash came from and went over one, three or five years, and the quality score's earnings-quality checks compare cash with profit.</p>`],
    ],
    see: [["/stock/TCS/financials", "Cash flow on a company's financials page"], ["/methodology", "The earnings-quality checks"]],
  },
  {
    slug: "shareholding-pattern",
    title: "Reading the shareholding pattern",
    desc: "Who owns an Indian listed company — promoters, foreign and domestic institutions, the public — what pledged shares mean, and which changes are worth noticing.",
    sections: [
      ["What it is", `<p>Every listed company files its shareholding pattern with the exchange each quarter. It shows what share of the company is held by each group of owners.</p>`],
      ["The groups", `<ul>
<li><b>Promoters</b>: the founders, family or parent company that control the business.</li>
<li><b>FIIs / FPIs</b>: foreign institutional and portfolio investors.</li>
<li><b>DIIs</b>: domestic institutions, such as mutual funds, insurers and pension funds.</li>
<li><b>Public</b>: everyone else, including individual investors.</li>
</ul>`],
      ["Changes worth noticing", `<ul>
<li><b>Promoters raising their stake</b> with their own money is often read as confidence; promoters steadily selling deserves a reason.</li>
<li><b>Pledged promoter shares</b>: shares given as security for a loan. If the share price falls far enough, lenders can sell them, which can push the price lower still. A high or rising pledge is a risk to note.</li>
<li><b>Institutions building or cutting a stake</b> over several quarters, rather than in one.</li>
</ul>`],
      ["Keep it in proportion", `<p>Ownership changes have many reasons: a fund rebalancing, a promoter paying tax, an index change. One quarter's move is a question to ask, not an answer. Jocular Insights shows each company's holdings over recent quarters so the direction is clear.</p>`],
    ],
    see: [["/news", "Companies' latest filings to NSE"]],
  },
  {
    slug: "how-to-analyse-a-bank",
    title: "How to read a bank or finance company",
    desc: "Why banks need different measures — bad loans (NPAs), capital, margins and book value — and what each tells you about an Indian lender.",
    sections: [
      ["Why the usual ratios don't fit", `<p>A bank borrows (from depositors) to lend, so its debt is huge by design, and its "sales" are interest. Measures built for factories and software firms, like debt to equity or operating margin, say little about it. Lenders are read on how safe their loans are, how much capital cushions them, and how much they earn on their assets.</p>`],
      ["The measures that matter", `<ul>
<li><b>Gross and net NPA</b>: loans that have stopped being repaid (non-performing assets), as a share of all loans, before and after the money already set aside for them. Lower is better, and the trend matters.</li>
<li><b>Provision coverage</b>: how much of the bad loans the bank has already set aside money for.</li>
<li><b>Capital adequacy</b>: capital as a share of risk-weighted loans, which the RBI requires to stay above a minimum. More is a bigger cushion.</li>
<li><b>Net interest margin</b>: what the bank earns on loans minus what it pays on deposits, relative to its assets.</li>
<li><b>Return on assets</b>: profit as a share of total assets. Around 1% or more is generally strong for a bank.</li>
<li><b>CASA ratio</b>: the share of deposits in current and savings accounts, which cost the bank less than fixed deposits.</li>
</ul>`],
      ["Valuing a lender", `<p>Banks are usually compared on <b>price to book value</b> rather than P/E, because their book (equity) is mostly loans and money that can be measured. A bank that earns a high, steady return on its equity and keeps its bad loans low tends to trade above its book value. Jocular Insights values banks this way, and judges them on bad loans and capital instead of debt to equity.</p>`],
    ],
    see: [["/methodology", "How banks are scored and valued"], ["/sectors", "Companies by sector"]],
  },
  {
    slug: "results-calendar-and-board-meetings",
    title: "Results season: board meetings and the results calendar",
    desc: "How Indian companies announce their results date, when results usually arrive, and what to watch around a board meeting.",
    sections: [
      ["How a results date is announced", `<p>A listed company's board approves its results at a meeting. Under SEBI's rules the company tells the exchange in advance that the meeting will consider results, and that notice is how the date becomes public. Companies may also set a "trading window" closure around it, during which insiders can't trade the shares.</p>`],
      ["When results arrive", `<p>Quarterly results generally come within 45 days of the quarter's end, and the full year's audited results within 60 days. So results for the quarter ending in June arrive mostly from mid-July to mid-August, and the full year's from mid-April to the end of May. Most companies file in the evening or during market hours on the meeting day.</p>`],
      ["What to read on the day", `<ul>
<li>The results table: revenue, operating margin and net profit against the same quarter a year ago. See <a href="/learn/how-to-read-quarterly-results">how to read quarterly results</a>.</li>
<li>Any exceptional items, and any change in accounting.</li>
<li>A dividend declared with the results, and its record date. See <a href="/learn/dividends-record-date">dividends and the record date</a>.</li>
<li>The investor presentation and earnings call, where management explains the quarter.</li>
</ul>`],
      ["Follow it in Jocular Insights", `<p>The <a href="/results-calendar">results calendar</a> lists the coming week's board meetings. Star a company and the app can remind you the evening before its results, and show its figures against a year ago once they're filed.</p>`],
    ],
    see: [["/results-calendar", "The results calendar"], ["/news", "The latest filings"]],
  },
  {
    slug: "dividends-record-date",
    title: "Dividends: yield, ex-date and record date",
    desc: "How dividends work on Indian shares: what dividend yield means, the difference between the record date and the ex-date, and why the share price drops on the ex-date.",
    sections: [
      ["Dividend yield", `<p>Dividend yield is the dividend paid per share over a year divided by the share price. A ₹10 dividend on a ₹500 share is a 2% yield. Because it depends on the price, the yield rises when the price falls, so a very high yield can mean the market expects the dividend to be cut.</p>`],
      ["Record date and ex-date", `<p>The <b>record date</b> is the day the company checks its register to see who will be paid. To be on it, you must own the shares by the end of that day. Since India moved to T+1 settlement, where a purchase settles the next working day, the <b>ex-date</b> — the first day a buyer no longer gets the dividend — is the same day as the record date. So you need to buy at least one working day before the record date.</p>`],
      ["Why the price drops", `<p>On the ex-date the dividend leaves the company's value for new buyers, so the share price usually opens lower by roughly the dividend. Buying just before the record date to collect a dividend doesn't, by itself, make money: you receive the dividend and the price falls by about as much, and the dividend is taxed as income.</p>`],
      ["What makes a dividend dependable", `<ul>
<li>It is paid out of operating cash, not borrowing. See <a href="/learn/cash-flow-statement">profit versus cash</a>.</li>
<li>The payout ratio — dividends as a share of profit — leaves room for a bad year.</li>
<li>A record of paying through good and bad years.</li>
</ul>`],
    ],
    see: [["/news", "Dividend announcements in the latest filings"]],
  },
  {
    slug: "how-to-use-a-stock-screener",
    title: "How to use a stock screener without fooling yourself",
    desc: "What a stock screener does, how to combine filters sensibly, and the common mistakes: chasing the cheapest P/E, one good year, and too many filters.",
    sections: [
      ["What a screener does", `<p>A screener filters every listed company down to the ones that meet your rules: for example, companies with low debt, returns on capital above 15% for five years, and profits that have grown. It doesn't find good investments for you; it narrows two thousand companies down to a list worth reading about.</p>`],
      ["Start from a question", `<p>A screen works best when it answers one question. "Which companies have earned high returns for years with little debt?" makes a good screen. "Everything cheap and growing fast" usually returns either nothing or a list of one-off stories. Jocular Insights' <a href="/screens">ready-made screens</a> each start from one such question and say what it is.</p>`],
      ["Common mistakes", `<ul>
<li><b>Sorting by the lowest P/E.</b> The cheapest companies are often cheap for a reason. See <a href="/learn/pe-ratio-explained">the P/E ratio, explained</a>.</li>
<li><b>Trusting one year.</b> Ask for returns or growth over three to five years, not the latest twelve months alone.</li>
<li><b>Too many filters.</b> Each one removes companies; past five or six, the list reflects the filters' quirks more than real quality.</li>
<li><b>Mixing banks with everyone else.</b> Lenders need their own measures. See <a href="/learn/how-to-analyse-a-bank">how to read a bank</a>.</li>
</ul>`],
      ["After the screen", `<p>Read each company on the list: its results over recent quarters, its balance sheet, its cash flow and who owns it. A screen is where research starts, not where it ends. Our <a href="/stock-screener-india">screener guide</a> explains each filter.</p>`],
    ],
    see: [["/screens", "All ready-made screens"], ["/stock-screener-india", "The screener guide"]],
  },
  // 3 Nov 2026: ten more, after AdSense's second "insufficient content" hint
  {
    slug: "profit-margins",
    title: "Profit margins: gross, operating and net",
    desc: "What a company's margins measure, how gross, operating and net margin differ, and why the trend in a margin tells you more than its level.",
    sections: [
      ["Margin is profit as a share of sales", `<p>A margin is a profit divided by revenue. If a company sells ₹100 of goods and keeps ₹15 as operating profit, its operating margin is 15%. Margins let you compare a small company with a large one, and one year with another, on the same footing.</p>`],
      ["Three margins, three questions", `<ul>
<li><b>Gross margin</b>: revenue minus the cost of the goods sold, as a share of revenue. It asks how much the company can charge above what its product costs to make. Many Indian results filings don't show it separately, because they list materials, purchases and change in inventory as their own lines.</li>
<li><b>Operating margin</b> (EBITDA margin): profit from running the business, before depreciation, interest and tax. It asks how well the whole operation turns sales into profit.</li>
<li><b>Net margin</b>: final profit after everything, as a share of revenue. It also reflects how much the company borrows (interest) and how heavily it invests (depreciation).</li>
</ul>`],
      ["Level depends on the business", `<p>A software company may keep 25% of revenue as operating profit; a grocery retailer may keep 7% and still be an excellent business, because it sells far more for each rupee it has invested. Compare a margin with the company's own past and with others in its industry, never across industries. Our <a href="/sectors">sector pages</a> group companies that can be compared.</p>`],
      ["The trend is the story", `<ul>
<li><b>Widening margins</b> can mean pricing power, a better product mix or costs that grow slower than sales.</li>
<li><b>Shrinking margins</b> with rising sales can mean the company is buying growth with discounts, or that a raw material has become dearer.</li>
<li>A margin that swings every year usually belongs to a business tied to a commodity price. See <a href="/learn/cyclical-and-defensive-sectors">cyclical and defensive sectors</a>.</li>
</ul>`],
      ["One check before trusting a margin", `<p>Look at <b>other income</b> and <b>exceptional items</b>. A net margin lifted by interest on a large cash pile or a one-off gain says little about the business itself. The operating margin leaves both out, which is why analysts lean on it.</p>`],
    ],
    see: [["/learn/how-to-read-quarterly-results", "How to read quarterly results"], ["/sectors", "Sectors, to compare like with like"]],
  },
  {
    slug: "free-cash-flow",
    title: "Free cash flow: the cash a business really makes",
    desc: "What free cash flow is, how to work it out from a cash flow statement, and why a company can report profits every year and still need to borrow.",
    sections: [
      ["The idea", `<p>Free cash flow is the cash a business generates from its operations after paying for the investment it needs to keep going and grow. It is the money that could be paid out to shareholders, used to repay debt, or kept, without the company borrowing or selling new shares.</p>`],
      ["Working it out", `<p>From the cash flow statement: take <b>cash from operating activities</b> and subtract <b>capital expenditure</b>, which appears under investing activities as purchase of property, plant and equipment (and intangible assets). For example, ₹500 crore of operating cash less ₹200 crore spent on new plants leaves ₹300 crore of free cash flow. See <a href="/learn/cash-flow-statement">the cash flow statement, explained</a> for where each line comes from.</p>`],
      ["Why it can differ from profit", `<ul>
<li><b>Money stuck in working capital.</b> Sales made on credit are counted as revenue before the customer pays. If receivables and inventory grow faster than sales, profit rises while cash doesn't. See <a href="/learn/working-capital">working capital</a>.</li>
<li><b>Heavy investment.</b> A company building new capacity can show negative free cash flow for years. That isn't bad in itself, if the new capacity later earns good returns.</li>
<li><b>Depreciation versus real spending.</b> Profit is charged depreciation, an estimate; free cash flow counts what was actually spent this year.</li>
</ul>`],
      ["What to look for", `<p>Add up free cash flow over five years and compare it with the profit reported over the same years. A business whose cash roughly keeps pace with its profit is converting earnings into money. One that reports profit year after year while its free cash flow stays negative, and its debt rises, deserves a closer look.</p>`],
    ],
    see: [["/learn/cash-flow-statement", "The cash flow statement"], ["/stock/TCS/financials", "A company's cash flow, as an example"]],
  },
  {
    slug: "price-to-book",
    title: "Book value and the price-to-book ratio",
    desc: "What book value per share means, how the P/B ratio is worked out, why it is the main measure for banks, and when a low P/B is not a bargain.",
    sections: [
      ["Book value", `<p>Book value is the shareholders' equity on the balance sheet: everything the company owns minus everything it owes. Divided by the number of shares, it gives <b>book value per share</b>. It is what the accounts say each share would be worth if the company sold its assets at their recorded values and paid off all its debts.</p>`],
      ["The P/B ratio", `<p>Price-to-book is the share price divided by book value per share. A P/B of 3 means the market values the company at three times what its accounts say it is worth. A P/B below 1 means the shares cost less than the book value behind them.</p>`],
      ["Why P/B matters most for lenders", `<p>A bank's assets are mostly loans and its liabilities mostly deposits, both recorded close to their real value, so its book value is a meaningful number. That is why banks and lending companies are usually valued on P/B rather than P/E, and why the fair value in Jocular Insights uses book value for them. The real question for a lender is whether its book value is honest: loans that won't be repaid but haven't been written off yet make it look larger than it is. See <a href="/learn/how-to-analyse-a-bank">how to analyse a bank</a>.</p>`],
      ["Why high P/B can be fair", `<p>For a company whose value lies in brands, software or know-how, the balance sheet records little of what it owns. Such companies can earn very high returns on a small book value and trade at a high P/B for years. P/B and <a href="/learn/roe-and-roce">return on equity</a> go together: a company earning 25% on its equity deserves a higher P/B than one earning 8%.</p>`],
      ["When a low P/B is a trap", `<ul>
<li>Returns on equity have been low for years, so the book value isn't earning much.</li>
<li>The assets are worth less than recorded: idle plants, old inventory, doubtful receivables, or bad loans at a lender.</li>
<li>Book value is shrinking because the company is making losses.</li>
</ul>`],
    ],
    see: [["/learn/how-to-analyse-a-bank", "How to analyse a bank"], ["/methodology", "How our fair value is worked out"]],
  },
  {
    slug: "large-mid-small-cap",
    title: "Large cap, mid cap and small cap in India",
    desc: "What market capitalisation is, how SEBI's rules sort Indian companies into large, mid and small caps, and how the three groups tend to differ.",
    sections: [
      ["Market capitalisation", `<p>Market capitalisation, or market cap, is what the stock market values a company at: its share price multiplied by the number of shares. A company with 100 crore shares at ₹500 has a market cap of ₹50,000 crore. It changes every trading day with the price.</p>`],
      ["How India draws the lines", `<p>SEBI's rules for mutual funds sort listed companies by full market cap:</p>
<ul>
<li><b>Large cap</b>: the 1st to 100th largest companies.</li>
<li><b>Mid cap</b>: the 101st to 250th.</li>
<li><b>Small cap</b>: the 251st company and beyond.</li>
</ul>
<p>The Association of Mutual Funds in India (AMFI) publishes the list every six months, so a company can move between groups as its price changes. Very small companies, far down the list, are often called micro caps; that term has no official definition.</p>`],
      ["How the groups differ", `<ul>
<li><b>Large caps</b> are usually established leaders in their industries. Their shares trade heavily, they are followed by many analysts, and their prices tend to move less than smaller companies'.</li>
<li><b>Mid caps</b> include companies growing into leaders and established firms in smaller niches. They can grow faster, and fall harder.</li>
<li><b>Small caps</b> are the widest group: young businesses, small specialists, and companies past their best. Fewer analysts follow them, information is thinner, and their prices can swing sharply. Some trade so little that buying or selling a modest amount moves the price.</li>
</ul>`],
      ["Size is not quality", `<p>A small company can be excellently run and a large one poorly. Size tells you mainly how much attention a company gets and how easily its shares trade. The quality of the business is in its filings: its returns on capital, its debt, and whether its profits turn into cash. Jocular Insights scores every company on those, whatever its size.</p>`],
    ],
    see: [["/screens", "Screens, which you can narrow by size"], ["/sectors", "Companies by sector"]],
  },
  {
    slug: "bonus-split-buyback-rights",
    title: "Bonus issues, splits, buybacks and rights issues",
    desc: "The four corporate actions that change a company's share count, what each does to your holding, and which of them actually moves money.",
    sections: [
      ["Bonus issue", `<p>A bonus issue gives shareholders free extra shares out of the company's reserves, for example one new share for every one held (1:1). No money changes hands. The company is worth the same afterwards, so the share price adjusts down in proportion: a ₹1,000 share becomes two shares of about ₹500. What your holding is worth doesn't change on the day.</p>`],
      ["Stock split", `<p>A split divides each share into several of a smaller face value, for example one ₹10 share into five ₹2 shares. Like a bonus, it changes the number of shares and the price per share, not the value of what you own. Companies usually split or issue bonuses when the share price has become high, to make a single share cheaper to buy.</p>`],
      ["Buyback", `<p>In a buyback the company spends its own cash to buy back shares, usually at a price above the market's, and cancels them. Here money really moves: cash leaves the company and goes to the shareholders who sell. Those who stay own a larger share of a company with less cash. Most Indian buybacks are now tender offers, where every shareholder can offer shares and the company accepts them in proportion; part of the offer is reserved for small shareholders.</p>`],
      ["Rights issue", `<p>A rights issue offers existing shareholders new shares, in proportion to what they hold, usually at a discount to the market price. It brings new money into the company. If you don't take up your rights, your share of the company shrinks. In India the right to buy, called a rights entitlement, arrives in your demat account and can be sold on the exchange if you don't want to use it.</p>`],
      ["Reading the announcement", `<p>Each of these is announced to the stock exchange with a <b>record date</b>: you must hold the shares at the end of that day to take part. Our <a href="/news">news page</a> shows these announcements as companies file them, with what the terms mean. See also <a href="/learn/dividends-record-date">dividends and the record date</a>.</p>`],
    ],
    see: [["/news", "The latest company announcements"], ["/learn/dividends-record-date", "Record date and ex-date"]],
  },
  {
    slug: "promoter-pledge",
    title: "Promoter pledging: what it is and why it matters",
    desc: "What it means when a company's promoters pledge their shares, where the disclosure appears, and why a high or rising pledge is watched closely.",
    sections: [
      ["Promoters and pledges", `<p>Promoters are the founders or controlling shareholders of a company. A <b>pledge</b> is when they put up some of their shares as security for a loan, much as a house can secure a home loan. The loan may be for the promoter's other businesses, for personal needs, or to put money into the company itself.</p>`],
      ["Why it is watched", `<p>If the share price falls far enough, the lender can ask for more security. If the promoter can't provide it, the lender can sell the pledged shares in the market. That selling can push the price down further, which can trigger more selling. A large pledge can turn an ordinary fall into a steep one, and the company can lose its controlling shareholder.</p>`],
      ["Where to see it", `<p>Listed companies report each quarter how much of the promoters' holding is pledged, in the <a href="/learn/shareholding-pattern">shareholding pattern</a>. Promoters must also tell the exchange when they create or release a pledge, so changes show up in the company's announcements on the <a href="/news">news page</a>.</p>`],
      ["How to read the number", `<ul>
<li><b>Look at the share pledged</b>, not just whether there is a pledge: a few per cent of the promoter's holding is very different from most of it.</li>
<li><b>Look at the trend</b>: a pledge rising quarter after quarter suggests the promoter needs money; one falling suggests loans are being repaid.</li>
<li><b>Ask what the loan is for.</b> Money borrowed to put into the company itself, as part of a rights issue for example, is different from borrowing for unrelated businesses.</li>
</ul>`],
    ],
    see: [["/learn/shareholding-pattern", "The shareholding pattern"], ["/screens", "Screens that leave out pledged companies"]],
  },
  {
    slug: "working-capital",
    title: "Working capital: receivables, inventory and the cash cycle",
    desc: "How money gets tied up in a business's day-to-day running, how to measure debtor days and inventory days, and why the trend warns early of trouble.",
    sections: [
      ["What working capital is", `<p>A business needs money just to keep running: it buys raw materials before it sells, keeps stock on its shelves, and often waits for customers to pay. Against that, it may get credit from its own suppliers. <b>Working capital</b> is the money tied up in this cycle: current assets such as receivables and inventory, minus current liabilities such as amounts owed to suppliers.</p>`],
      ["Three measures in days", `<ul>
<li><b>Debtor days</b>: receivables divided by revenue, times 365. It says how many days, on average, customers take to pay.</li>
<li><b>Inventory days</b>: inventory divided by the cost of goods sold, times 365. It says how long stock sits before it is sold.</li>
<li><b>Payable days</b>: what the company owes suppliers, divided by its purchases (or cost of goods sold), times 365. It says how long the company itself takes to pay.</li>
</ul>
<p>Debtor days plus inventory days minus payable days is the <b>cash conversion cycle</b>: how many days the company's own money is tied up before a sale comes back as cash.</p>`],
      ["Why it matters", `<p>When a company's cycle lengthens, profit can rise while cash falls, and the gap is often filled with borrowing. Rising debtor days can mean customers are paying late, or that the company is offering easy credit to keep sales growing. Rising inventory days can mean products aren't selling. These often show up in the balance sheet a few quarters before they show up in profit. See <a href="/learn/free-cash-flow">free cash flow</a>.</p>`],
      ["Compare within an industry", `<p>A supermarket that is paid in cash at the till and pays its suppliers later can run with very little working capital, or less than none. A capital goods maker that builds machines over months and is paid in stages needs a great deal. Judge a company against its own history and its industry's peers.</p>`],
    ],
    see: [["/learn/reading-a-balance-sheet", "Reading a balance sheet"], ["/learn/free-cash-flow", "Free cash flow"]],
  },
  {
    slug: "piotroski-f-score",
    title: "The Piotroski F-score, explained",
    desc: "The nine simple checks behind the Piotroski F-score, what a high or low score suggests about a company's finances this year, and what the score can't tell you.",
    sections: [
      ["Where it comes from", `<p>The F-score was set out in 2000 by Joseph Piotroski, an accounting professor, as a way to separate stronger from weaker companies among those that looked cheap on their book value. It is nine yes-or-no tests, each worth one point, comparing this year's accounts with last year's. A score of 8 or 9 is strong, 0 to 2 is weak.</p>`],
      ["Profitability: four points", `<ul>
<li>Net profit was positive.</li>
<li>Cash from operations was positive.</li>
<li>Return on assets improved on the year before.</li>
<li>Cash from operations was larger than net profit, a sign that profit is backed by cash.</li>
</ul>`],
      ["Debt and funding: three points", `<ul>
<li>Long-term debt fell, relative to total assets.</li>
<li>The current ratio (current assets divided by current liabilities) improved.</li>
<li>No new shares were issued during the year.</li>
</ul>`],
      ["Efficiency: two points", `<ul>
<li>Gross margin improved.</li>
<li>Asset turnover (revenue divided by total assets) improved.</li>
</ul>`],
      ["What it can and can't tell you", `<p>The score measures whether a company's finances got better or worse over one year. It says nothing about whether the business is good over the long run, whether the price is reasonable, or what comes next. A great company can score 5 in a year it borrowed to build a factory; a weak one can score 8 in a lucky year. Jocular Insights shows the score with each of its nine checks, and leaves it out for banks and other lenders, whose accounts don't fit the tests. Where a company's filings don't give a cost of goods sold, it compares operating margin instead of gross margin. See the <a href="/methodology">methodology</a>.</p>`],
    ],
    see: [["/methodology", "Our methodology"], ["/stock-screener-india", "The screener guide, with the F-score filter"]],
  },
  {
    slug: "reading-company-announcements",
    title: "How to read a company's stock exchange announcements",
    desc: "Why listed companies file announcements with NSE, the kinds that matter most, the routine ones you can skip, and how to read one without overreacting.",
    sections: [
      ["Why companies announce", `<p>Under SEBI's listing rules, a listed company must tell the stock exchange promptly about anything that could matter to investors: results, dividends, large orders, deals, changes among its directors, credit ratings, legal cases and more. The rule is known by its number, Regulation 30. Most announcements must be filed within 24 hours of the event, and some, such as a board meeting's decisions, sooner. They appear on the exchange's website at once, for everyone at the same time.</p>`],
      ["The ones that usually matter", `<ul>
<li><b>Results</b> and the board meeting outcome that approves them. See <a href="/learn/how-to-read-quarterly-results">how to read quarterly results</a>.</li>
<li><b>Orders and contracts</b>, judged by their size next to the company's yearly sales.</li>
<li><b>Fund-raising</b>: preferential issues, QIPs, rights issues. See <a href="/learn/bonus-split-buyback-rights">bonus, split, buyback and rights</a>.</li>
<li><b>Credit ratings</b>, especially a downgrade. See <a href="/learn/credit-ratings">credit ratings, explained</a>.</li>
<li><b>Resignations</b> of a chief executive, finance head or auditor, and the reason given.</li>
<li><b>Tax demands, penalties and court orders</b>, judged by their size next to profit.</li>
</ul>`],
      ["The routine ones", `<p>Many filings are paperwork the rules require: newspaper copies of notices, trading-window closures, certificates, investor meeting schedules, share certificate replacements. They rarely say anything about the business. Our <a href="/news">news page</a> leaves most of them out.</p>`],
      ["Reading one calmly", `<ul>
<li><b>Read the filing, not just the subject line.</b> A subject such as "Action(s) taken or orders passed" can describe a large penalty or a case the company won.</li>
<li><b>Put numbers next to the company's size.</b> A ₹50 crore order is huge for a company with ₹200 crore of sales and small for one with ₹50,000 crore.</li>
<li><b>Look for what's missing.</b> An announcement that gives no figure or no reason is worth noting.</li>
</ul>
<p>Jocular Insights marks each announcement with how news of that kind is usually read, and says "not clear" when the filing doesn't say enough to tell. That is a reading of the words, never a prediction of the price.</p>`],
    ],
    see: [["/news", "The latest announcements"], ["/results-calendar", "Upcoming results"]],
  },
  {
    slug: "credit-ratings",
    title: "Credit ratings, explained for shareholders",
    desc: "What a credit rating agency's grade says about a company's debt, how the scale from AAA to D works, what outlooks and watches mean, and why shareholders should care.",
    sections: [
      ["What a rating is", `<p>A credit rating is an agency's opinion of how likely a company is to repay its borrowings in full and on time. In India the agencies are registered with SEBI: CRISIL, ICRA, CARE Ratings, India Ratings, Acuité and Infomerics among them. Companies pay to have their loans and bonds rated, and must tell the stock exchange when a rating is assigned or changed.</p>`],
      ["The scale", `<ul>
<li><b>AAA</b>: the highest safety. <b>AA</b> and <b>A</b> follow, each still strong.</li>
<li><b>BBB</b>: moderate safety, the lowest of the <b>investment grade</b> ratings.</li>
<li><b>BB</b>, <b>B</b> and <b>C</b>: increasing risk of not being repaid.</li>
<li><b>D</b>: in default, or about to be.</li>
</ul>
<p>A plus or minus sign places a company within a grade, so AA+ sits just below AAA. Short-term debt, such as commercial paper, has its own scale, with A1+ the highest.</p>`],
      ["Outlooks and watches", `<p>An <b>outlook</b> (stable, positive or negative) says which way the agency thinks the rating may move over the next year or two. A <b>rating watch</b> is stronger: an event, such as a merger or a sudden loss, could change the rating soon. "Reaffirmed" means the rating stays as it was.</p>`],
      ["Why shareholders should care", `<p>Lenders are repaid before shareholders, so a company's debt is safer than its shares. If the agencies doubt the debt, the shares carry more risk still. A downgrade also raises what the company pays to borrow, which eats into profit. Agencies tend to move after problems are visible, so a rating is a check on what's known, not an early warning.</p>`],
    ],
    see: [["/learn/debt-to-equity", "Debt to equity"], ["/news", "Rating announcements in the latest filings"]],
  },
  {
    slug: "cyclical-and-defensive-sectors",
    title: "Cyclical and defensive sectors",
    desc: "Why some industries' profits rise and fall with the economy or commodity prices while others stay steady, and how that changes the way you read their numbers.",
    sections: [
      ["Two kinds of business", `<p>A <b>cyclical</b> business earns much more in good years than bad ones, because its sales or its prices follow the economy or a commodity. A <b>defensive</b> business sells things people buy whatever the economy is doing, so its profits change more slowly.</p>`],
      ["Examples in India", `<ul>
<li><b>Usually cyclical</b>: metals and mining, cement, chemicals, cars and commercial vehicles, real estate, capital goods, and companies whose profit depends on the price of oil, steel or another commodity.</li>
<li><b>Usually defensive</b>: everyday consumer goods (food, soap, toothpaste), medicines, power utilities with regulated returns, and telecom services.</li>
</ul>
<p>These are tendencies, not rules: a well-run cement company can be steadier than a struggling consumer brand.</p>`],
      ["Reading a cyclical company's numbers", `<ul>
<li><b>P/E misleads at the extremes.</b> At the top of a cycle, profits are high and the P/E looks low, just before profits fall. At the bottom, profits are thin and the P/E looks high. See <a href="/learn/pe-ratio-explained">the P/E ratio, explained</a>.</li>
<li><b>Average across a whole cycle.</b> Five to seven years of profit, margins and returns say more than the latest year.</li>
<li><b>Watch the balance sheet.</b> A cyclical company with little debt can survive a bad stretch; one with heavy debt may not. See <a href="/learn/debt-to-equity">debt to equity</a>.</li>
</ul>`],
      ["Reading a defensive company's numbers", `<p>Steady businesses usually trade at higher P/E ratios, because their profits are easier to predict. The question for them is less about the cycle and more about growth: whether volumes, not just prices, are rising, and whether margins are holding. Our <a href="/sectors">sector pages</a> show how each sector's companies have done.</p>`],
    ],
    see: [["/sectors", "All sectors"], ["/learn/profit-margins", "Profit margins"]],
  },
  // 8 Nov 2026: four more, for what people search and the AI answers quote
  {
    slug: "fair-value-explained",
    title: "Fair value: what a share might be worth, and its limits",
    desc: "What a fair value (or intrinsic value) estimate is, how it is usually worked out from earnings or book value, and why it is a model to question rather than a price to expect.",
    sections: [
      ["Price and value are different things", `<p>The share price is what the last buyer and seller agreed on. A <b>fair value</b>, sometimes called intrinsic value, is an estimate of what the business behind each share is worth, worked out from its own figures. The two can be far apart for years: prices move on news, mood and money flows, while a business's value changes more slowly, with its profits and its balance sheet.</p>`],
      ["Common ways to estimate it", `<ul>
<li><b>Earnings times a multiple</b>: take a normal year's earnings per share and multiply by a P/E the business has usually traded at, or that similar companies trade at. Simple, and only as good as the "normal" earnings chosen.</li>
<li><b>Discounted cash flow</b> (DCF): forecast the cash the business will produce for many years and work out what that is worth today. Thorough, but small changes to the growth or discount rate change the answer a lot.</li>
<li><b>Book value</b>: for banks and lenders, whose assets are mostly loans, what shareholders' equity is worth on the books, adjusted for how well the bank earns on it.</li>
</ul>`],
      ["How Jocular Insights does it", `<p>Our fair value uses each company's normalized earnings (smoothing out one-off years) and its own usual P/E, capped at twice its sector's, so one exuberant year can't set the bar. Banks and lenders are valued on book value instead. Each step, and what is left out, is in the <a href="/methodology">methodology</a>. The figure is a reference point for research, not a target price.</p>`],
      ["Why every fair value can be wrong", `<ul>
<li><b>The future isn't the past.</b> A model built on past earnings can't see a new competitor, a lost licence or a product that takes off.</li>
<li><b>Cyclical earnings mislead.</b> Profits at the top of a cycle make a fair value too high; at the bottom, too low. See <a href="/learn/cyclical-and-defensive-sectors">cyclical and defensive sectors</a>.</li>
<li><b>Accounting choices matter.</b> One-off gains, changes in how revenue is booked, or a large acquisition can all shift "normal" earnings.</li>
</ul>
<p>A useful habit: treat a fair value as a question ("what would have to be true for the price to be right?") rather than an answer.</p>`],
      ["The margin of safety", `<p>Because any estimate can be wrong, many value investors only consider a share when its price is well below their estimate, leaving room for error. How large that gap should be depends on how predictable the business is: a steady consumer company needs less room than a cyclical or heavily indebted one.</p>`],
    ],
    see: [["/methodology", "How our fair value is worked out"], ["/learn/pe-ratio-explained", "The P/E ratio, explained"]],
  },
  {
    slug: "eps-explained",
    title: "EPS: earnings per share, basic and diluted",
    desc: "What earnings per share means, the difference between basic and diluted EPS, and why EPS growth can differ from profit growth when a company issues or buys back shares.",
    sections: [
      ["What EPS is", `<p><b>Earnings per share</b> is a company's net profit for shareholders divided by the number of its shares. If a company earns ₹100 crore and has 10 crore shares, its EPS is ₹10. It turns a company's total profit into what each share earned, which is what a shareholder actually owns.</p>`],
      ["Basic and diluted", `<ul>
<li><b>Basic EPS</b> divides profit by the shares in issue on average over the period.</li>
<li><b>Diluted EPS</b> also counts shares that could soon exist: employee stock options, convertible bonds or warrants. It is usually a little lower, and it is the more cautious number to use.</li>
</ul>
<p>Indian results filings show both, for the quarter and the year so far.</p>`],
      ["Why EPS growth and profit growth can differ", `<ul>
<li><b>New shares</b> from a fund-raise (a QIP, a rights issue or a preferential allotment) spread the same profit over more shares, so EPS grows slower than profit, or falls.</li>
<li><b>A buyback</b> cancels shares, so EPS can grow faster than profit.</li>
<li><b>Bonus issues and splits</b> multiply the number of shares without changing the business; past EPS is restated so the years stay comparable. See <a href="/learn/bonus-split-buyback-rights">bonus, split, buyback and rights</a>.</li>
</ul>`],
      ["Using EPS well", `<ul>
<li>Look at EPS over several years, not one quarter: steady growth says more than a single jump.</li>
<li>Check whether a jump came from the business or from an exceptional item such as selling an asset.</li>
<li>EPS is the "E" in the P/E ratio, so anything that distorts EPS distorts P/E too. See <a href="/learn/pe-ratio-explained">the P/E ratio, explained</a>.</li>
</ul>`],
    ],
    see: [["/learn/how-to-read-quarterly-results", "How to read quarterly results"], ["/stock/TCS/financials", "A company's EPS over the years"]],
  },
  {
    slug: "ev-ebitda-explained",
    title: "EV/EBITDA: valuing a company with its debt included",
    desc: "What enterprise value and EBITDA are, why EV/EBITDA compares companies with different amounts of debt more fairly than P/E, and where it doesn't work.",
    sections: [
      ["Enterprise value", `<p>A company's <b>market cap</b> is what its shares are worth. Its <b>enterprise value</b> (EV) is what the whole business would cost a buyer: the market cap, plus its debt, minus the cash it holds. Two companies with the same market cap are not the same price if one also carries large borrowings: whoever owns it owns the debt too.</p>`],
      ["EBITDA", `<p><b>EBITDA</b> is earnings before interest, tax, depreciation and amortisation: roughly the operating profit of the business before how it is financed and before the wear on its assets. In Indian results it is close to the operating profit line. See <a href="/learn/profit-margins">profit margins</a>.</p>`],
      ["Why divide one by the other", `<p>EV/EBITDA asks how many years of operating profit the whole business costs. Because EV includes debt and EBITDA comes before interest, it compares a company that borrows heavily with one that doesn't on a more equal footing than P/E, which only sees the profit left after interest. It is widely used for capital-heavy industries: telecom, power, cement, metals, infrastructure.</p>`],
      ["Where it misleads", `<ul>
<li><b>Banks and lenders</b>: debt is their raw material, not a choice of financing, so EV/EBITDA doesn't apply. Book value is used instead. See <a href="/learn/how-to-analyse-a-bank">how to analyse a bank</a>.</li>
<li><b>Heavy capital spending</b>: EBITDA leaves out depreciation, so a business that must keep spending on plant and equipment can look cheaper than it is. Check its <a href="/learn/free-cash-flow">free cash flow</a> too.</li>
<li><b>Leases</b>: since accounting rules changed in 2019, lease rents are partly treated as interest and depreciation, which raises EBITDA for retailers, airlines and hotels compared with older years.</li>
</ul>`],
    ],
    see: [["/learn/debt-to-equity", "Debt to equity"], ["/learn/free-cash-flow", "Free cash flow"]],
  },
  {
    slug: "red-flags-in-financial-statements",
    title: "Warning signs in a company's financial statements",
    desc: "Ten things in an Indian company's filings that deserve a closer look: profit without cash, rising receivables, pledged shares, auditor changes, related-party dealings and more.",
    sections: [
      ["Why look for warning signs", `<p>Most companies' figures are what they seem. But a few patterns show up again and again before trouble: they don't prove anything is wrong, they're reasons to read the filings more carefully. Each of these can be checked from public NSE filings and the annual report.</p>`],
      ["In the profit and cash", `<ul>
<li><b>Profit without cash.</b> Net profit rising for years while cash from operations stays flat or negative. Profit is an accounting figure; cash is harder to invent. See <a href="/learn/cash-flow-statement">the cash flow statement</a>.</li>
<li><b>Receivables growing faster than sales.</b> Customers taking longer and longer to pay, or sales booked that may never be collected. See <a href="/learn/working-capital">working capital</a>.</li>
<li><b>Inventory piling up.</b> Stock growing much faster than sales can mean goods that aren't selling.</li>
<li><b>Profit propped up by other income</b> or exceptional gains, quarter after quarter.</li>
</ul>`],
      ["In the balance sheet", `<ul>
<li><b>Debt rising while profits don't</b>, or interest taking a growing share of operating profit. See <a href="/learn/debt-to-equity">debt to equity</a>.</li>
<li><b>Large loans to, or deals with, related parties</b>: group companies or businesses owned by the promoters. The annual report lists them.</li>
<li><b>Contingent liabilities</b>, such as guarantees or disputed tax demands, that are large next to the company's equity.</li>
</ul>`],
      ["In the people and the paperwork", `<ul>
<li><b>Promoters pledging their shares</b>, especially if the pledged share keeps rising. See <a href="/learn/promoter-pledge">promoter pledge</a>.</li>
<li><b>An auditor resigning mid-term</b>, or a qualified audit opinion. Companies must tell the exchange; see <a href="/learn/reading-company-announcements">reading company announcements</a>.</li>
<li><b>Frequent changes in the CFO or company secretary</b>, or results filed late.</li>
</ul>`],
      ["Using this list", `<p>One sign alone often has an innocent explanation: a big order that customers will pay for next quarter, or a pledge taken for a promoter's other business. Several together, over several years, are worth taking seriously. The quality score in Jocular Insights checks some of these from the filings (cash behind profits, debt, pledging, dilution, the audit opinion and auditor resignations); the <a href="/methodology">methodology</a> lists them.</p>`],
    ],
    see: [["/methodology", "What the quality score checks"], ["/learn/cash-flow-statement", "The cash flow statement"]],
  },
];

export const guideBySlug = slug => GUIDES.find(g => g.slug === slug) ?? null;
export const GUIDE_PATHS = () => ["/learn", ...GUIDES.map(g => `/learn/${g.slug}`)];
