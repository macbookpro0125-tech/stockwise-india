// "What changed recently" on the company page (StockRecent.jsx): the last
// six weeks of news from data the page already has — results filed (against
// a year ago), ex-dates passed, a big week for the price, a close near the
// 52-week high or low, a change in the promoters' holding — and the next two
// weeks' board meetings and ex-dates. Facts only; nothing here is a signal.

const DAY = 86400000;
// shareholding is filed within 21 days of a quarter's end: a quarter that
// ended within six weeks plus those 21 days was filed recently
const WINDOW = 42, AHEAD = 14, HOLDING_WINDOW = WINDOW + 21;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shift = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const month = iso => MONTHS[Number(iso.slice(5, 7)) - 1];
const rupees = n => `₹${Math.round(n).toLocaleString("en-IN")}`;
const move = (v, what) => `${what} ${v >= 0 ? "up" : "down"} ${Math.abs(v).toFixed(1)}%`;
const amount = t => [...t.matchAll(/(?:Rs|Re)\.?\s*(\d+(?:\.\d+)?)/gi)].reduce((s, m) => s + Number(m[1]), 0);
const QUARTER_END = /-(03-31|06-30|09-30|12-31)$/;

function actionText(title) {
  if (/dividend/i.test(title)) { const a = amount(title); return `ex-dividend${a > 0 ? `: ₹${Number(a.toFixed(2))} a share` : ""}`; }
  const bonus = title.match(/^bonus\s+(\d+:\d+)/i);
  if (bonus) return `ex-bonus ${bonus[1]}`;
  if (/split/i.test(title)) return "ex-split";
  return `ex-date for ${title.toLowerCase()}`;
}

export function recentChanges(m, holding, today) {
  const since = shift(today, -WINDOW), until = shift(today, AHEAD);
  const recent = [], upcoming = [];

  const q = m?.quarters?.[0];
  if (q?.filed && q.filed >= since && q.filed <= today) {
    const name = `the ${month(q.fyEnd)} ${q.fyEnd.slice(0, 4)} quarter`;
    const sales = q.salesYoY != null ? move(q.salesYoY, "sales") : null;
    let text;
    if (q.profitCr < 0) text = `Results for ${name}: ${sales ? `${sales} on a year ago, and ` : ""}a loss of ₹${Math.round(-q.profitCr).toLocaleString("en-IN")} Cr.`;
    else if (sales || q.profitYoY != null) text = `Results for ${name}: ${[sales, q.profitYoY != null ? move(q.profitYoY, "profit") : null].filter(Boolean).join(" and ")} on a year ago.`;
    else text = `Results for ${name} were filed.`;
    recent.push({ date: q.filed, kind: "results", text });
  }

  for (const e of m?.events ?? []) {
    if (!e?.date) continue;
    if (e.kind === "action" && e.date >= since && e.date <= today) {
      const t = actionText(e.title ?? "");
      recent.push({ date: e.date, kind: /dividend/i.test(e.title) ? "dividend" : "action", text: `Went ${t}.` });
    } else if (e.date > today && e.date <= until) {
      upcoming.push({ date: e.date, kind: e.kind, text: e.kind === "board" ? `${e.title}.` : `${actionText(e.title ?? "").replace(/^./, c => c.toUpperCase())}.` });
    }
  }

  const priced = m?.closeDate ?? today;
  if (m?.ret1w != null && Math.abs(m.ret1w) >= 7) recent.push({ date: priced, kind: "price", text: `The price ${m.ret1w >= 0 ? "rose" : "fell"} ${Math.abs(m.ret1w).toFixed(1)}% over the past week.` });
  if (m?.close > 0 && m.high52w > 0 && m.close >= m.high52w * 0.98) recent.push({ date: priced, kind: "high", text: `It closed within 2% of its 52-week high of ${rupees(m.high52w)}.` });
  else if (m?.close > 0 && m.low52w > 0 && m.close <= m.low52w * 1.02) recent.push({ date: priced, kind: "low", text: `It closed within 2% of its 52-week low of ${rupees(m.low52w)}.` });

  const quarters = (holding?.promoterHistory ?? []).filter(h => QUARTER_END.test(h.asOfIso ?? "")).sort((a, b) => b.asOfIso.localeCompare(a.asOfIso));
  const [now, before] = quarters;
  if (now && before && now.asOfIso >= shift(today, -HOLDING_WINDOW) && Math.abs(now.pct - before.pct) >= 0.25) {
    recent.push({ date: now.asOfIso, kind: "promoters", text: `Promoters held ${now.pct.toFixed(2)}% at the end of ${month(now.asOfIso)}, ${now.pct > before.pct ? "up" : "down"} from ${before.pct.toFixed(2)}% at the end of ${month(before.asOfIso)}.` });
  }

  recent.sort((a, b) => b.date.localeCompare(a.date));
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return { recent, upcoming };
}
