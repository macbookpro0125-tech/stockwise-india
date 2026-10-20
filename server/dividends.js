// A company's dividend record for its page: dividends a share in each Indian
// financial year (April to March, named by the year it ends — FY26 ends
// March 2026), on today's share count, and how often they were raised, held
// or cut. From NSE's corporate actions, which the evening build reads six
// years back (market-data.js dividendHistory); only financial years wholly
// inside that window are counted, so a half-covered first year doesn't read
// as a cut. Special dividends are kept apart and left out of raised/cut.

const DAY = 86400000;

export function fyOf(iso) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7));
  return m >= 4 ? y + 1 : y;
}

const round = n => Math.round(n * 10000) / 10000;

// history: [{ exDate, amount, special? }] per share as paid; splits:
// [{ exDate, ratio }] (shares × ratio); today: YYYY-MM-DD. Null history (the
// actions couldn't be read) is unknown, not "never paid".
export function dividendRecord({ history, splits, today, windowDays = 6 * 365 }) {
  if (!Array.isArray(history)) return null;
  const windowStart = new Date(Date.parse(`${today}T00:00:00Z`) - windowDays * DAY + DAY).toISOString().slice(0, 10);
  const thisFy = fyOf(today);
  let firstFy = fyOf(windowStart);
  if (`${firstFy - 1}-04-01` < windowStart) firstFy++;
  // A dividend paid before a later split or bonus, on today's shares
  const factorAfter = exDate => (splits ?? []).filter(s => s.exDate > exDate && s.exDate <= today).reduce((f, s) => f * s.ratio, 1);

  const byYear = [];
  for (let fy = firstFy; fy <= thisFy; fy++) byYear.push({ fy, regular: 0, special: 0, partial: fy === thisFy });
  for (const d of history) {
    if (!d?.exDate || !(d.amount > 0) || d.exDate > today) continue;
    const year = byYear.find(y => y.fy === fyOf(d.exDate));
    if (!year) continue;
    year[d.special ? "special" : "regular"] += d.amount / factorAfter(d.exDate);
  }
  for (const y of byYear) { y.regular = round(y.regular); y.special = round(y.special); }

  const whole = byYear.filter(y => !y.partial);
  const track = { years: whole.length, paid: whole.filter(y => y.regular + y.special > 0).length, raised: 0, held: 0, cut: 0, cuts: [] };
  for (let i = 1; i < whole.length; i++) {
    const prev = whole[i - 1].regular, cur = whole[i].regular;
    if (cur > prev * 1.005) track.raised++;
    else if (cur < prev * 0.995) { track.cut++; track.cuts.push(whole[i].fy); }
    else track.held++;
  }
  return { byYear, track };
}
