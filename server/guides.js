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

export const GUIDES_UPDATED = "2026-10-30";

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
];

export const guideBySlug = slug => GUIDES.find(g => g.slug === slug) ?? null;
export const GUIDE_PATHS = () => ["/learn", ...GUIDES.map(g => `/learn/${g.slug}`)];
