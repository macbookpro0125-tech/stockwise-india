// How the whole market stands: every company trading ₹1 crore a day or more,
// by the stage of its trend, and how many are over their 50- and 200-day
// averages. The word is from the 200-day share alone: 60% or more strong,
// under 40% weak, mixed between.
const STAGE_TONE = { advancing: "var(--green)", topping: "var(--yellow)", declining: "var(--red)", basing: "var(--brand-wise)" };
export function MoodBar({ market }) {
  if (!market) return <div className="mood mood-loading" role="status">Working out the market's mood…</div>;
  if (!market.liquid) return null;
  const a200 = market.above200 ?? 0;
  const word = a200 >= 60 ? "Strong" : a200 < 40 ? "Weak" : "Mixed";
  const day = market.date ? new Date(`${market.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
  return (
    <section className="mood" aria-label="Market mood">
      <div className="mood-top">
        <span className={`mood-word ${word.toLowerCase()}`} title="From the share of companies over their 200-day average: 60% or more strong, under 40% weak">Market: {word}</span>
        {market.stageInfo.map(s => (
          <span key={s.id} className="mood-stage" title={s.about}>
            <i style={{ background: STAGE_TONE[s.id] }} />{s.label} <b>{market.stages[s.id].toLocaleString("en-IN")}</b>
            <small>{Math.round((market.stages[s.id] / market.liquid) * 100)}%</small>
          </span>
        ))}
        <span className="mood-meta">{Math.round(market.above50)}% over their 50-day · {Math.round(a200)}% over their 200-day · {market.liquid.toLocaleString("en-IN")} companies trading ₹{market.liquidCr} crore a day or more · close {day}</span>
      </div>
      <div className="mood-bar" aria-hidden="true">
        {market.stageInfo.map(s => <i key={s.id} style={{ flexGrow: market.stages[s.id], background: STAGE_TONE[s.id] }} />)}
      </div>
    </section>
  );
}
