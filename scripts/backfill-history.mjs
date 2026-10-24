// Fill each company's price history (server/price-history.js) further back
// than the year the evening build reads, all at once, so the stock page's 3Y,
// 5Y and All charts have their years: `npm run history:backfill -- --years 5`.
// The evening refresh does the same a batch at a time (HISTORY_YEARS and
// HISTORY_BACKFILL_DAYS in .github/workflows/data-refresh.yml), so this is
// only for a copy that wants it all now. Stop it any time; run it again to
// carry on (server/history-backfill.js).
import { backfillHistory } from "../server/history-backfill.js";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const years = Math.min(20, Math.max(2, Number(arg("years", 5)) || 5));
const pauseMs = Number(arg("pause", 800));
const r = await backfillHistory({ years, pauseMs });
if (r.stopped) process.exitCode = 1;
