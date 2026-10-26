import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { openCheck } from "./StockSide.jsx";

const card = { border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)" };
// The account is where a thesis lives. This browser keeps only edits that
// haven't reached the account yet, filed under the account that wrote them —
// on a shared computer the next person never sees, or saves, someone else's.
const DRAFTS_KEY = "stockwise-thesis-drafts";
const EMPTY = { case: "", marketGap: "", breakers: "" };
const normal = t => ({ case: t?.case ?? "", marketGap: t?.marketGap ?? "", breakers: t?.breakers ?? "" });
const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}"); } catch { return {}; } };
const writeDraft = (owner, symbol, thesis) => {
  try {
    const all = readDrafts();
    if (thesis) all[owner] = { ...all[owner], [symbol]: thesis };
    else if (all[owner]) { delete all[owner][symbol]; if (!Object.keys(all[owner]).length) delete all[owner]; }
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
  } catch {}
};

// review: the questions for the next filing (a phone asks them in the
// chapter that holds each figure — StockChapters.jsx — and keeps the thesis)
// bare: inside the phone's "Your view" card, which gives the frame and title
export default function ThesisMonitor({ metrics: m, account, review = true, bare = false }) {
  const owner = account ? `${account.userId}:${account.email ?? account.phone ?? ""}` : null;
  const [thesis, setThesis] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("loading");
  const saveSeq = useRef(0);
  const savedSnapshot = useRef(null);
  useEffect(() => {
    if (!m?.symbol || !owner) return;
    let cancelled = false;
    setReady(false);
    setSaveState("loading");
    // The first version kept every thesis in one browser-wide list,
    // whoever was signed in — never read it
    try { localStorage.removeItem("stockwise-investment-thesis"); } catch {}
    api.thesis(m.symbol).then(remote => {
      if (cancelled) return;
      const saved = normal(remote);
      savedSnapshot.current = JSON.stringify(saved);
      const draft = readDrafts()[owner]?.[m.symbol];
      setThesis(draft ? normal(draft) : saved);
      setSaveState("saved");
      setReady(true);
    }).catch(() => {
      // Without the saved copy an edit could overwrite it, so the boxes stay
      // read-only until it loads
      if (!cancelled) setSaveState("unavailable");
    });
    return () => { cancelled = true; };
  }, [m?.symbol, owner]);
  useEffect(() => {
    if (!ready || !m?.symbol) return;
    const snapshot = JSON.stringify(thesis);
    if (snapshot === savedSnapshot.current) { writeDraft(owner, m.symbol, null); return; }
    writeDraft(owner, m.symbol, thesis);
    setSaveState("saving");
    const sequence = ++saveSeq.current;
    const timer = setTimeout(() => {
      api.saveThesis(m.symbol, thesis).then(() => {
        if (sequence !== saveSeq.current) return;
        savedSnapshot.current = snapshot;
        writeDraft(owner, m.symbol, null);
        setSaveState("saved");
      }).catch(() => {
        if (sequence === saveSeq.current) setSaveState("offline");
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, m?.symbol, owner, thesis]);
  if (!m) return null;
  // Questions for the next filing, each pointing to the section that holds
  // the figure — the figures themselves aren't repeated here (each is shown
  // in one place on the page)
  const monitors = [];
  if (m.salesGrowth3y != null) monitors.push({ label: "Revenue trend", detail: "Is sales growth speeding up or slowing down?", go: "sec-financials", where: "Financials" });
  if (m.opm != null && m.opm5y != null) monitors.push({ label: "Operating margin", detail: "Is the margin holding near its five-year average?", go: "sec-financials", where: "Financials" });
  if (m.fcfCr != null) monitors.push({ label: "Cash generation", detail: "Is free cash flow keeping up with profit?", go: "sec-health", where: "Financial health" });
  if (m.debtToEquity != null) monitors.push({ label: "Leverage", detail: "Is debt growing faster than equity, or interest getting harder to cover?", go: "sec-health", where: "Financial health" });
  if (m.promoterPct != null) monitors.push({ label: "Ownership", detail: "Are the promoters' holding or pledges changing?", go: "sec-holding", where: "Holdings" });

  const editStyle = { width: "100%", minHeight: 62, resize: "vertical", boxSizing: "border-box", border: "1px solid var(--bdr2)", borderRadius: 8, background: "var(--s1)", color: "var(--t1)", padding: "8px 10px", font: "inherit", fontSize: 12, lineHeight: 1.5 };
  return (
    <section style={bare ? undefined : card} aria-labelledby="thesis-monitor-title">
      <h3 id="thesis-monitor-title" hidden={bare} style={{ fontSize: 15, fontWeight: 450, margin: "0 0 4px", color: "var(--t1)" }}>{review ? <>Investment case &amp; what to monitor</> : "Your investment thesis"}</h3>
      {review && <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 13, lineHeight: 1.5 }}>Questions to take to each new filing; the figures are in the sections linked. These are not forecasts or automatic thesis-break signals.</div>}
      {/* The strengths and things to watch are At a glance's, at the top of
          the page (StockGlance.jsx); a second list here disagreed with it */}
      {review && <div>
        <div style={{ fontSize: 12, fontWeight: 450, color: "var(--t1)", marginBottom: 7 }}>What to review in the next filing</div>
        {monitors.length ? <ul style={{ margin: 0, paddingLeft: 17, display: "grid", gap: 8 }}>{monitors.map((x, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "var(--t2)" }}><strong style={{ color: "var(--t1)" }}>{x.label}:</strong> {x.detail} <button type="button" onClick={() => openCheck(x.go)} style={{ padding: 0, border: 0, background: "none", font: "inherit", color: "var(--accent)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>See {x.where}</button></li>)}</ul> : <div style={{ fontSize: 12, color: "var(--t3)" }}>Too few current observations to build company-specific monitoring prompts.</div>}
      </div>}
      <div style={review ? { marginTop: 16, paddingTop: 13, borderTop: "1px solid var(--bdr)" } : undefined}>
        {review && <div style={{ fontSize: 12, fontWeight: 450, color: "var(--t1)", marginBottom: 8 }}>Your investment thesis</div>}
        <div className="ss-grid-3">
          {[
            ["case", "Why could this business compound?", "Your view on business quality, returns, and reinvestment."],
            ["marketGap", "What might the market be missing?", "Write the evidence that supports your differentiated view."],
            ["breakers", "What would change your view?", "Set measurable conditions to review, based on this company."],
          ].map(([key, label, placeholder]) => (
            <label key={key} style={{ fontSize: 11.5, color: "var(--t2)" }}>{label}<textarea maxLength={4000} value={thesis[key]} disabled={!ready} onChange={e => setThesis(s => ({ ...s, [key]: e.target.value }))} placeholder={placeholder} style={{ ...editStyle, display: "block", marginTop: 5, opacity: ready ? 1 : 0.6 }} /></label>
          ))}
        </div>
        <div role="status" style={{ fontSize: 10, color: saveState === "offline" || saveState === "unavailable" ? "var(--yellow)" : "var(--t3)", marginTop: 7 }}>{saveState === "loading" ? "Loading your saved thesis…" : saveState === "saving" ? "Saving to your account…" : saveState === "offline" ? "Couldn't save to your account. Your edits are kept in this browser and saved the next time you open this stock." : saveState === "unavailable" ? "Couldn't load your saved thesis. Reload the page to try again." : "Saved to your account."}</div>
      </div>
    </section>
  );
}
