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
