import { useState, useEffect, useRef } from "react";
import { api } from "./api.js";

// The original's News & filings panel (stock-screener NewsPanel.jsx). Filings
// are the company's own announcements to NSE; reports are its annual reports;
// news is press coverage from Google News. Kept on separate tabs, filings
// first — what the company said shouldn't blur into a publisher's framing.

const MONO = { fontVariantNumeric: "tabular-nums" };
const INITIAL = 5;

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);
}

// NSE writes "21-Sep-2026 16:57:58"
const nseDate = s => (s ? String(s).split(" ")[0].replace(/-(\d{4})$/, " $1").replace(/-/g, " ") : null);

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      height: 34, padding: "0 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${active ? "var(--accent)" : "var(--bdr2)"}`,
      background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--s3)",
      color: active ? "var(--accent)" : "var(--t2)",
      transition: "all 120ms",
    }}>{children}</button>
  );
}

const emptyStyle = { fontSize: 12, color: "var(--t3)", lineHeight: 1.6, padding: "10px 0" };

export default function NewsPanel({ symbol }) {
  const [tab, setTab] = useState("filings");
  const [expanded, setExpanded] = useState(false);
  const [filings, setFilings] = useState(null);
  const [news, setNews] = useState(null);
  const [newsError, setNewsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.panel(symbol, "filings").then(d => { if (!cancelled) setFilings(d); }).catch(e => { if (!cancelled) setFilings({ announcements: [], annualReports: [], error: e.message }); });
    return () => { cancelled = true; };
  }, [symbol]);

  // News only when its tab is opened — a stock you only glance at costs no
  // news request. The guard is a ref, not the loading state (the original's
  // lesson: a state guard re-ran the effect and cancelled its own fetch).
  const askedFor = useRef(null);
  useEffect(() => {
    if (tab !== "news" || askedFor.current === symbol) return;
    askedFor.current = symbol;
    api.panel(symbol, "news")
      .then(d => { setNews(d.news ?? []); if (d.error) setNewsError(d.error); })
      .catch(e => { setNews([]); setNewsError(e.message); });
  }, [tab, symbol]);

  const announcements = filings?.announcements ?? [];
  const reports = filings?.annualReports ?? [];
  const items = tab === "filings"
    ? announcements.map(a => ({ key: `${a.date}-${a.title}`, title: a.title, sub: a.summary, meta: nseDate(a.date), url: a.url }))
    : tab === "news"
      ? (news ?? []).map(n => ({ key: n.url, title: n.title, sub: null, meta: [n.publisher, fmtDate(n.date)].filter(Boolean).join(" · "), url: n.url }))
      : [];
  const shown = expanded ? items : items.slice(0, INITIAL);
  const switchTab = t => { setTab(t); setExpanded(false); };

  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--s2)", padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>News &amp; filings</div>
        <a href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          On NSE ↗
        </a>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
        <TabButton active={tab === "filings"} onClick={() => switchTab("filings")}>Filings{announcements.length ? ` (${announcements.length})` : ""}</TabButton>
        <TabButton active={tab === "news"} onClick={() => switchTab("news")}>News</TabButton>
        {reports.length > 0 && <TabButton active={tab === "reports"} onClick={() => switchTab("reports")}>Reports ({reports.length})</TabButton>}
      </div>

      {tab === "reports" && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t3)", marginBottom: 6 }}>Annual reports</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {reports.slice(0, expanded ? reports.length : 8).map(r => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, textDecoration: "none", padding: "3px 9px", borderRadius: 999, border: "1px solid var(--bdr2)", background: "var(--s3)", color: "var(--t2)", whiteSpace: "nowrap", ...MONO }}>
                {r.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {tab === "filings" && !filings && <div style={emptyStyle}>Loading filings…</div>}
      {tab === "news" && news == null && <div style={emptyStyle}>Loading news…</div>}

      {tab !== "reports" && !shown.length && (tab === "filings" ? filings : news) && (
        <div style={emptyStyle}>
          {tab === "filings"
            ? (filings?.error ? `Couldn't reach NSE's announcements just now (${filings.error}).` : "No recent announcements from this company.")
            : newsError ? "Couldn't reach the news feed just now. Everything else on this page is unaffected — try again in a moment." : "No recent coverage found for this company."}
        </div>
      )}

      {shown.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {shown.map((a, i) => (
            <a key={`${a.key}-${i}`} href={a.url || undefined} target={a.url ? "_blank" : undefined} rel={a.url ? "noopener noreferrer" : undefined}
              style={{ display: "block", textDecoration: "none", color: "inherit", padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--bdr)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap", ...MONO }}>{a.meta || "—"}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", lineHeight: 1.45, flex: "1 1 200px", minWidth: 0 }}>{a.title}</span>
              </div>
              {a.sub && <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.55, marginTop: 4 }}>{a.sub}</div>}
            </a>
          ))}
        </div>
      )}

      {(tab === "reports" ? reports.length > 8 : items.length > INITIAL) && (
        <button onClick={() => setExpanded(v => !v)} style={{ marginTop: 10, height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--bdr2)", background: "var(--s3)", color: "var(--t2)" }}>
          {expanded ? "Show fewer" : `Show all ${tab === "reports" ? reports.length : items.length}`}
        </button>
      )}

      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 10, lineHeight: 1.5 }}>
        {tab === "filings"
          ? "The company's own announcements to NSE, newest first. Not news commentary or advice."
          : tab === "reports"
            ? "Annual reports as filed with NSE."
            : "Press coverage via Google News. The framing is each publisher's own, not a recommendation — price-prediction pieces are filtered out."}
      </div>
    </div>
  );
}
