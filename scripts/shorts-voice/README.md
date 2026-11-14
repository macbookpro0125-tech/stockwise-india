# Voiced Shorts (the style the owner liked, 13 Nov 2026)

Michael (Kokoro `am_michael`, free and local) speaks each line; the words appear as he
says them (`*teal*` for good news, `~red~` for bad); real cards from jocularinsights.in
are lifted off the live page with the figure circled; tiles, bars and price lines count up.

```
node scripts/shorts-voice/build.mjs ~/Projects/files/shorts-v2/<name>/spec.json --stills   # check frames first
node scripts/shorts-voice/build.mjs ~/Projects/files/shorts-v2/<name>/spec.json            # ~12 min → <key>.mp4 + .srt
```

Needs the Kokoro install in `~/Projects/files/tts` (Python 3.12 venv; see handoff/YOUTUBE.md).
Keep the videos outside the repo (`~/Projects/files/shorts-v2/`).

## Spec

```json
{ "key": "bel-q2fy27-v2",
  "source": "Bharat Electronics · Q2 FY27 (Jul–Sep 2026) as filed with NSE · prices and scores at the 12 Nov 2026 close · not investment advice",
  "lines": [ { "id": "l01", "say": "what Michael says (numbers in words)", "show": "what's shown, with *teal* and ~red~ words", "visual": { "type": "…" } } ] }
```

Every figure in `say`, `show` and the visuals must be copied from the live page
(`/stock/SYM` and `/stock/SYM/results/q2-fy27`), never typed from memory. Cards and
price lines are taken live by the script.

| visual `type` | fields |
|---|---|
| `page` | `symbol`: the top of its live company page in a phone frame |
| `card` | `symbol`, `card`: `quality` / `ret` / `results`; `circle`: `ring` / `ret` / `sales` / `profit`; `tone`: `teal` / `red` / `gold` |
| `chart` | `symbol` (its 1-year price), or `series: [{symbol, label, tone}, …]` for two companies' % change |
| `big` | `text` (use `A → B` for a before/after), `sub`, `tone` |
| `tiles` | `tiles: [{label, value, prefix, suffix, dec, sub, tone}]`, counted up from 0 |
| `bars` | `bars: [{label, value, prefix, suffix, dec, tone}]`, `max`, `note` |
| `pair` | `items: [{icon, title, sub, tone}]` (two) |
| `pills` | `items: [{text, tone}]` |
| `save`, `brand` | the closing "Save this" and the logo |

Consecutive lines with the same visual share it. Lines over ~52 characters shrink.
Examples: `~/Projects/files/shorts-v2/{bel,sterlite,hdfc-icici}/spec.json`.

## Script writers (14 Nov 2026) — each writes spec.json and post.txt from the live site

| Script | Format | Data |
|---|---|---|
| `from-results.mjs SYMBOL` | one company's quarter, story-led (9–10 scenes, ~45 s) | /stock/SYM/results/<q>, /api/public/stock/SYM |
| `from-movers.mjs` | Nifty 50 heat map, top 5 gainers and losers (₹1,000 cr+), sectors by the day's move | /lists/nifty-50-stocks, top-gainers-today, top-losers-today, nifty-500-stocks |
| `from-pair.mjs A B` / `--auto` | head-to-head of two rivals' quarters | /api/public/stock for both; --auto pairs the two largest recent filers in one industry |
| `from-penny.mjs` | penny stocks (under ₹10) whose profit grew (₹5 cr+ profit, ₹1 cr+ a year earlier) | /lists/penny-stocks + each company |
| `from-calendar.mjs` | results next week (Sundays) | /api/public/results-calendar |
| `from-sectors.mjs` | sector scorecard: each sector's total profit and sales growth for the latest quarter (Nifty 500 filers, 5+ per sector) | /api/public/lists/nifty-500-stocks + /api/public/stock for each |
| `from-weekly.mjs` | the week's roundup (Saturdays): Nifty 50 week heat map, the week's gainers (₹1,000 crore+) and fallers (Nifty 500), sectors, next week's results | /api/public/lists/top-gainers-this-week, nifty-500-stocks, nifty-50-stocks; /api/public/results-calendar |

`JI_SITE=http://127.0.0.1:8790` points any of them at a local copy for testing. Visuals: big, tiles, bars, chart, page, card, pair, pills, rank, heatmap, save, brand.

## Hindi versions (14 Nov 2026)

Every English Short also gets a Hindi version for the **Jocular Insights Hindi** channel (@JocularInsightsHindi). To make one:

1. Copy the English spec to `~/Projects/files/shorts-v2/hi-<key>/spec.json` with key `hi-<key>`. Keep every `visual` and every figure.
2. Rewrite each line's `say` and `show` in **everyday Hindi** (the owner's rule: not formal). Use English money words written in Devanagari: रिज़ल्ट, प्रॉफ़िट, सेल्स, क्वार्टर, मार्जिन, परसेंट, शेयर, सेक्टर. Company names go in Devanagari in `say` (आयशर मोटर्स); in `show` either script is fine.
3. In `say`, write figures as digits, but for percentages of 10 and over write the whole number the English `say` speaks (56.47% → 56, not 56.5 → 57). `node scripts/shorts-voice/hi-numbers.mjs <spec>` turns them into spoken Hindi and sets `"voice":"hm_psi","lang":"hi","speed":1.0`. `show` keeps its digits.
4. In `show`, a highlight right before a danda ("*…*।") leaves a stray "*"; hi-numbers.mjs drops that danda for you.
5. Translate on-screen labels in `visual` where they are words (tile labels, pills). Leave symbols, numbers and company names as they are.
6. Add `"source": "<English source> · निवेश सलाह नहीं"`.
7. Write `post.txt` (YOUTUBE TITLE / YOUTUBE DESCRIPTION) in everyday Hindi with the same figures. Include a links block and "सिर्फ़ जानकारी के लिए, निवेश सलाह नहीं।"

The first Hindi spec is ~/Projects/files/shorts-v2/hi-eichermot-q2-fy27/spec.json; use it as the model.
