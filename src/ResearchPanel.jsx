import { ChevronDown, ScanSearch, TriangleAlert } from "lucide-react";
import { qualityTone, overallTone } from "./ResearchBadges.jsx";

// The stock page's research dashboard (server/research.js): the quality score
// and the overall research score up top with a plain summary, the six groups
// as cards — each saying how many of its checks had data — the valuation,
// technical and risk lenses, and "Why this score?" with every check's figure,
// points and reason. Checks the filings can't show are listed, not hidden.

const MONO = { fontVariantNumeric: "tabular-nums" };
const card = { border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)", boxShadow: "var(--sh-xs)" };
const n = v => (v == null ? "—" : Math.round(v));

// Every card up top opens its own explanation below (a group's checks, the
// technical or risk breakdown, or how the scores work) and scrolls to it
function showDetails(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "DETAILS") el.open = true;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  document.querySelectorAll(".research-flash").forEach(x => x.classList.remove("research-flash"));
  void el.offsetWidth; // restart the highlight if the same card is clicked again
  el.classList.add("research-flash");
}
const clickable = id => ({
  role: "button", tabIndex: 0, className: "research-card",
  onClick: () => showDetails(id),
  onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showDetails(id); } },
});
// The small "details below" mark beside a card's label
const More = () => <ChevronDown size={13} strokeWidth={2.2} className="research-card-more" style={{ color: "var(--t3)", flexShrink: 0 }} aria-hidden="true" />;
const cardLabel = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 };
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Bar({ value, color, height = 5 }) {
  return (
    <div style={{ height, borderRadius: 99, background: "var(--s3)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, height: "100%", borderRadius: 99, background: color, transition: "width 300ms" }} />
    </div>
  );
}

// One of the three headline numbers
function Headline({ label, value, unit = "/100", word, sub, tone, title, details }) {
  return (
    <div title={title} {...clickable(details)} style={{ minWidth: 0, padding: "14px 16px", borderRadius: 10, background: "var(--s1)", border: `1px solid ${tone.border}` }}>
      <div style={{ ...cardLabel, fontSize: 12, color: "var(--t2)", fontWeight: 500, marginBottom: 6 }}>{label}<More /></div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: value == null ? "var(--t3)" : "var(--t1)", letterSpacing: "-0.03em", lineHeight: 1, ...MONO }}>{n(value)}</span>
        {value != null && <span style={{ fontSize: 13, color: "var(--t3)", ...MONO }}>{unit}</span>}
        {word && <span style={{ fontSize: 12.5, fontWeight: 650, color: tone.color, marginLeft: 2 }}>{word}</span>}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 6, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

// word: shown after the score (the valuation group's "Inexpensive" … "Expensive")
function GroupCard({ g, word }) {
  const tone = qualityTone(g.score);
  return (
    <div {...clickable(`why-${g.id}`)} title={`See every ${g.label.toLowerCase()} check below`} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--s1)", border: "1px solid var(--bdr)", minWidth: 0 }}>
      <div style={{ ...cardLabel, fontSize: 12, color: "var(--t2)", fontWeight: 500, marginBottom: 6, lineHeight: 1.35 }}>{g.label}<More /></div>
      {!g.applicable ? (
        <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.45 }}>Doesn't apply to lenders</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: g.score == null ? "var(--t3)" : tone.color, ...MONO }}>{n(g.score)}</span>
            {g.score != null && <span style={{ fontSize: 11.5, color: "var(--t3)", ...MONO }}>/100</span>}
            {word && g.score != null && <span style={{ fontSize: 12, fontWeight: 650, color: tone.color, marginLeft: 4 }}>{word}</span>}
          </div>
          <Bar value={g.score} color={tone.color} />
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "2px 8px", fontSize: 11, color: "var(--t3)", marginTop: 7, ...MONO }}>
            <span style={{ whiteSpace: "nowrap" }}>{g.points != null ? `${g.points}/${g.weight} pts` : "Not enough data"}</span>
            <span style={{ whiteSpace: "nowrap" }}>{g.checked} of {g.total} checked</span>
          </div>
        </>
      )}
    </div>
  );
}

function LensCard({ title, score, word, note, tone, details }) {
  return (
    <div {...clickable(details)} title={`See the ${title.toLowerCase()} breakdown below`} style={{ flex: "1 1 200px", minWidth: 0, padding: "12px 14px", borderRadius: 10, background: "var(--s1)", border: "1px solid var(--bdr)" }}>
      <div style={{ ...cardLabel, fontSize: 12, color: "var(--t2)", fontWeight: 500, marginBottom: 6 }}>{title}<More /></div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: score == null ? "var(--t3)" : "var(--t1)", ...MONO }}>{n(score)}</span>
        {score != null && <span style={{ fontSize: 11.5, color: "var(--t3)", ...MONO }}>/100</span>}
        <span style={{ fontSize: 12.5, fontWeight: 650, color: tone }}>{word}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 5, lineHeight: 1.45 }}>{note}</div>
    </div>
  );
}

// One check: its figure, its points out of 100 and why — or why it wasn't checked
function ItemRow({ item, weight }) {
  const state = item.na ? "na" : item.score != null ? "checked" : "missing";
  const tone = qualityTone(item.score);
  return (
    <div className="research-item" style={{ padding: "9px 0", borderTop: "1px solid var(--bdr)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ flex: "1 1 220px", fontSize: 12.5, fontWeight: 600, color: state === "checked" ? "var(--t1)" : "var(--t3)", minWidth: 0 }}>
          {item.label}
          <span style={{ fontWeight: 400, color: "var(--t3)", marginLeft: 6, fontSize: 11, ...MONO }}>{Math.round(weight * 100)}% of the group</span>
        </span>
        {state === "checked" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12, ...MONO }}>
            {item.display && <span style={{ color: "var(--t2)" }}>{item.display}</span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 92 }}>
              <span style={{ width: 46 }}><Bar value={item.score} color={tone.color} height={4} /></span>
              <strong style={{ color: tone.color, minWidth: 40, textAlign: "right" }}>{n(item.score)}/100</strong>
            </span>
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--t3)", fontWeight: 500 }}>{state === "na" ? "Doesn't apply" : item.structural ? "Not checked" : "No data"}</span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: state === "checked" ? "var(--t2)" : "var(--t3)", marginTop: 3, lineHeight: 1.5 }}>
        {item.reason ?? item.missing ?? item.na}
      </div>
    </div>
  );
}

// A collapsible section; native <details>, so it works without script state
function Expand({ id, title, right, children, open = false }) {
  return (
    <details id={id} open={open} className="research-expand" style={{ borderTop: "1px solid var(--bdr)", padding: "2px 0" }}>
      <summary style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", cursor: "pointer", listStyle: "none", fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
        <ChevronDown size={15} className="research-chevron" style={{ color: "var(--t3)", flexShrink: 0, transition: "transform 150ms" }} />
        <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
        {right && <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 500, ...MONO }}>{right}</span>}
      </summary>
      <div style={{ padding: "0 0 10px 23px" }}>{children}</div>
    </details>
  );
}

export default function ResearchPanel({ research: r }) {
  if (!r) return null;
  const o = r.overall;
  const quality = r.quality;
  const qTone = qualityTone(quality);
  const oTone = overallTone(o.score);
  const confTone = qualityTone(r.confidence >= 80 ? 100 : r.confidence >= 60 ? 60 : 0);
  const riskTone = r.risk.score >= 50 ? "var(--red)" : r.risk.score >= 25 ? "var(--yellow)" : "var(--green)";
  const techTone = r.technical.score == null ? "var(--t3)" : r.technical.score >= 65 ? "var(--green)" : r.technical.score >= 40 ? "var(--yellow)" : "var(--red)";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <ScanSearch size={17} strokeWidth={2} style={{ color: "var(--t3)" }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--t1)", letterSpacing: "-0.01em" }}>Research dashboard</h3>
        <span style={{ fontSize: 11.5, color: "var(--t3)", marginLeft: "auto" }}>
          From NSE filings{r.valuation.asOf ? ` · valued at the ${day(r.valuation.asOf)} close` : ""}
        </span>
      </div>

      {r.flags?.map(f => {
        // Critical (a qualified audit) in red; a caution (an auditor's resignation) in amber
        const c = f.severity === "critical" ? "red" : "yellow";
        return (
          <div key={f.id} role={f.severity === "critical" ? "alert" : "note"} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--t1)", background: `var(--${c}-dim)`, border: `1px solid var(--${c}-bdr)`, borderRadius: 8, padding: "9px 12px", marginBottom: 12, lineHeight: 1.5 }}>
            <TriangleAlert size={15} style={{ color: `var(--${c})`, flexShrink: 0, marginTop: 1 }} />
            <span><strong style={{ color: `var(--${c})` }}>{f.severity === "critical" ? "Red flag." : "Caution."}</strong> {f.text}</span>
          </div>
        );
      })}

      <div className="research-head" style={{ marginBottom: 12 }}>
        <Headline label="Quality score" value={quality} tone={qTone}
          word={r.provisional ? "provisional" : null}
          sub={quality == null ? "Too few years of filings to score." : `Without valuation: ${n(r.qualityOnly)}/100`}
          title="Out of 100 across six groups — business, earnings, balance sheet, governance, growth and valuation" details="why-this-score" />
        <Headline label="Overall research score" value={o.score} tone={oTone}
          word={o.score != null ? o.stance : null}
          sub={o.score != null ? `${o.text}${o.status === "provisional" ? " — provisional: low confidence caps it at 59" : ""}` : o.text}
          title="Quality without valuation (70%) and valuation (30%), trimmed for price swings and data gaps. Not a buy or sell signal." details="why-how" />
        <Headline label="Confidence" value={r.confidence} tone={confTone}
          sub={`${r.coverage.checked} of ${r.coverage.total} checks have data`}
          title="How much of the score rests on data: checks covered, how recent the results are and how fresh the price is" details="why-how" />
      </div>

      {r.capped && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--t2)", background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, lineHeight: 1.5 }}>
          <TriangleAlert size={14} style={{ color: "var(--yellow)", flexShrink: 0, marginTop: 2 }} />
          <span>{r.capped.reason} Uncapped, it would be {n(r.capped.uncapped)}/100.</span>
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 14px" }}>{r.summary}</p>

      <div className="research-groups" style={{ marginBottom: 10 }}>
        {r.groups.map(g => <GroupCard key={g.id} g={g} word={g.id === "valuation" ? r.valuation.label : null} />)}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <LensCard title="Technical setup" details="why-technical" score={r.technical.score} word={r.technical.label} tone={techTone}
          note="Price trend and momentum. Shown alongside — never part of the quality or overall score." />
        <LensCard title="Risk" details="why-risk" score={r.risk.score} word={r.risk.label} tone={riskTone}
          note={`Higher means riskier. Biggest: ${r.risk.top.map(id => r.risk.parts.find(p => p.id === id)?.label.toLowerCase()).filter(Boolean).join(", ")}.`} />
      </div>

      <div style={{ marginTop: 12 }}>
        <div id="why-this-score" className="research-expand" style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", margin: "6px 0 2px" }}>Why this score?</div>
        {r.groups.map(g => (
          <Expand key={g.id} id={`why-${g.id}`} title={g.label}
            right={!g.applicable ? "doesn't apply" : g.score == null ? `not enough data · ${g.checked} of ${g.total} checked` : `${n(g.score)}/100 · ${g.checked} of ${g.total} checked`}>
            {!g.applicable && <div style={{ fontSize: 12, color: "var(--t3)", padding: "6px 0" }}>{g.items[0]?.na}</div>}
            {g.applicable && g.items.map(item => <ItemRow key={item.id} item={item} weight={item.weight} />)}
          </Expand>
        ))}
        <Expand id="why-technical" title="Technical setup" right={r.technical.score == null ? "not enough price history" : `${n(r.technical.score)}/100 · ${r.technical.label}`}>
          {r.technical.parts.map(p => (
            <ItemRow key={p.id} item={{ label: p.label, score: p.score, display: p.display, reason: p.reason }} weight={p.weight / 100} />
          ))}
          <div style={{ fontSize: 11, color: "var(--t3)", paddingTop: 8 }}>From a year of NSE daily prices{r.technical.asOf ? ` to ${day(r.technical.asOf)}` : ""}. Describes the trend; it isn't a timing signal.</div>
        </Expand>
        <Expand id="why-risk" title="Risk" right={`${n(r.risk.score)}/100 · ${r.risk.label} · higher = riskier`}>
          {r.risk.parts.map(p => (
            <div key={p.id} style={{ padding: "9px 0", borderTop: "1px solid var(--bdr)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 220px", fontSize: 12.5, fontWeight: 600, color: "var(--t1)" }}>
                  {p.label}<span style={{ fontWeight: 400, color: "var(--t3)", marginLeft: 6, fontSize: 11, ...MONO }}>{p.weight}% of risk</span>
                </span>
                <strong style={{ fontSize: 12, color: p.score >= 50 ? "var(--red)" : p.score >= 25 ? "var(--yellow)" : "var(--green)", ...MONO }}>{n(p.score)}/100</strong>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 3, lineHeight: 1.5 }}>{p.reason}</div>
            </div>
          ))}
        </Expand>
        <Expand id="why-how" title="How the scores work">
          <ul style={{ margin: "4px 0 0", padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: "var(--t2)", lineHeight: 1.55 }}>
            <li><strong>Quality (0–100)</strong> weighs six groups: business quality 25, earnings quality 20, balance sheet 15, management &amp; governance 15, growth 10 and valuation 15. Each check scores 0–100 against stated bands — ROCE of 13% scores 50, 20% scores 75, 33% or more scores 100.</li>
            <li><strong>Nothing is guessed.</strong> A check the filings can't show — related-party deals, competitive position, forecasts, market size, a cash-flow model — is listed as not checked and left out of the score (the cash-flow scenario on the stock page uses your own assumptions, so it isn't scored either). Missing data never counts as zero or as a pass. A group needs over a third of its weight checked to be scored.</li>
            <li><strong>Overall research score</strong> blends quality without valuation (70%) with valuation (30%) so one strong side can't fully hide a weak one, then trims up to 35% for price swings and data gaps. Debt and pledging count once, in quality, not again as risk.</li>
            <li><strong>Red flags override.</strong> If the auditor qualified the latest accounts, the overall score stops at 39 and reads "Review required" until a clean audit. An auditor's resignation in the last three years halves the audit check and shows as a caution — the reasons are in the company's disclosure. Lenders, and companies whose balance sheet or shareholding can't be checked, have quality capped at 69.</li>
            <li><strong>Technical setup and risk</strong> are separate lenses. The price trend never moves the quality or overall score.</li>
            <li>Valued at NSE's close so Discover and this page agree; your own EPS or P/E above changes the price levels, not the score. The weights and bands are a stated starting point, not a model tested against past returns.</li>
            <li>A research summary, not a recommendation to buy or sell. Check the filings and your own situation before investing.</li>
          </ul>
        </Expand>
      </div>
    </div>
  );
}
