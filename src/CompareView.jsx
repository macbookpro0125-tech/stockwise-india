import { Suspense, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { lazyPage } from "./lazyPage.js";
import { FileText, X } from "lucide-react";
import { api } from "./api.js";
import { QualityBadge, overallTone } from "./ResearchBadges.jsx";
import CompareChart, { COMPARE_COLOURS } from "./CompareChart.jsx";
import { COMPARE_STATEMENTS } from "./FinanceCompare.jsx";
const InvestmentBriefView = lazyPage(() => import("./InvestmentBriefView.jsx"));

// Up to five stocks side by side, one subject at a time (19 Nov 2026, the
// owner: on the phone "bottom is not visible and it can't be closed", and
// show "quarterly results, profit and loss and so on"). A bar that never
// scrolls away holds Close; tabs pick the subject — scores, each statement
// from the companies' own filings, valuation, price. On a phone three
// companies show at a time, chosen from chips, each figure under its label.

function Sparkline({ prices, color }) {
  if (!prices?.length) return <span className="cmp-dash">—</span>;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = prices.map((p, i) => `${((i / (prices.length - 1)) * W).toFixed(1)},${(H - ((p - min) / range) * (H - 2) - 1).toFixed(1)}`).join(" ");
  const up = prices[prices.length - 1] >= prices[0];
  return (
    <svg width={W} height={H} aria-hidden="true" style={{ maxWidth: "100%" }}>
      <polyline points={pts} fill="none" stroke={color ?? (up ? "var(--green)" : "var(--red)")} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const SETUP_COLOR = { momentum: "var(--green)", pullback: "var(--accent)", base: "var(--yellow)", extended: "var(--yellow)", correction: "var(--red)", developing: "var(--t2)" };
const rs = v => (v ? `₹${Math.round(v).toLocaleString("en-IN")}` : "—");
const short = n => String(n ?? "").replace(/\s+(Limited|Ltd\.?)$/i, "");
const signed = v => (v != null ? `${v > 0 ? "+" : ""}${v}%` : "—");
const tone = v => (v == null ? undefined : parseFloat(v) >= 0 ? "var(--green)" : "var(--red)");

// A score with its word ("52 Fair"), or a dash when it couldn't be scored
const scored = (v, word, color = "var(--t3)") => (v == null
  ? <span className="cmp-dash">—</span>
  : <span>{Math.round(v)} <span style={{ fontSize: 11, fontWeight: 500, color }}>{word}</span></span>);
const GROUP_ROWS = [["business", "Business quality"], ["earnings", "Earnings quality"], ["balance", "Balance sheet"], ["governance", "Governance"], ["growth", "Growth"]];

// Each row: label, and a cell for one stock — ({ s, tech, m }) => node
const SCORE_ROWS = [
  ["Quality score", ({ s }) => <QualityBadge research={s.research} />],
  ["Overall score", ({ s }) => scored(s.research?.overall, s.research?.stance, overallTone(s.research?.overall).color)],
  ...GROUP_ROWS.map(([id, label]) => [label, ({ s }) => (id === "balance" && s.lender ? <span className="cmp-dash">Not scored for lenders</span> : scored(s.research?.groups?.[id], "/100"))]),
  ["Valuation", ({ s }) => scored(s.research?.valuation, s.research?.valuationLabel)],
  ["Technical setup", ({ s }) => scored(s.research?.technical, s.research?.technicalLabel)],
  ["Risk (higher = riskier)", ({ s }) => scored(s.research?.risk, s.research?.riskLabel)],
];
const VALUE_ROWS = [
  ["Price (₹)", ({ s }) => rs(s.cmp)],
  ["Market value", ({ s }) => (s.marketCapCr ? `₹${Math.round(s.marketCapCr).toLocaleString("en-IN")} Cr` : "—")],
  ["P/E (last 12 months)", ({ s }) => (s.peTtm != null ? s.peTtm.toFixed(1) : "—")],
  ["P/E (latest year)", ({ s }) => (s.peFy != null ? s.peFy.toFixed(1) : "—")],
  ["Price to book", ({ m }) => (m === undefined ? "…" : m?.pb != null ? m.pb.toFixed(1) : "—")],
  ["Return on equity", ({ m }) => { const v = m === undefined ? undefined : m?.roe ?? m?.history?.[0]?.roe; return v === undefined ? "…" : v != null ? `${v.toFixed(1)}%` : "—"; }],
  ["Return on capital", ({ s }) => (s.roce != null ? `${s.roce.toFixed(1)}%` : "—")],
  ["Dividend yield", ({ s }) => (s.divYield ? `${s.divYield.toFixed(1)}%` : "—")],
  // the user's own levels (myLevels.js) — dashes while they're off
  ["Your level 1", ({ s }) => rs(s.safeBuyPrice)],
  ["Your level 3", ({ s }) => rs(s.p3)],
  ["Your stop", ({ s }) => rs(s.stopLoss)],
  ["Your upper level", ({ s }) => rs(s.target)],
];
const techCell = (fmt, color) => ({ tech, loading }) => {
  if (loading) return <span className="cmp-dash">loading…</span>;
  if (!tech) return <span className="cmp-dash">—</span>;
  return <span style={{ color: color?.(tech) }}>{fmt(tech)}</span>;
};
const PRICE_ROWS = [
  ["Last 60 days", ({ tech, loading, colour }) => (loading ? <span className="cmp-dash">loading…</span> : <Sparkline prices={tech?.sparkline} color={colour} />)],
  ["Return, 20 days", techCell(t => signed(t.return20d), t => tone(t.return20d))],
  ["Return, 60 days", techCell(t => signed(t.return60d), t => tone(t.return60d))],
  ["Setup", techCell(t => (t.setupState ? t.setupState[0].toUpperCase() + t.setupState.slice(1) : "—"), t => SETUP_COLOR[t.setupState])],
  ["9 / 20 EMA", techCell(t => (t.emaSignal ? (t.emaSignal === "bullish" ? "▲ 9 above 20" : "▼ 9 below 20") : "—"), t => (t.emaSignal === "bullish" ? "var(--green)" : "var(--red)"))],
  ["% vs 20 EMA", techCell(t => signed(t.pctAboveEma20), t => tone(t.pctAboveEma20))],
  ["RSI-14", techCell(t => t.rsi14 ?? "—")],
];
// The statements, from each company's own filings (FinanceCompare.jsx)
const statementRows = id => COMPARE_STATEMENTS.find(x => x.id === id).rows.map(([label, get, fmt]) => [label, ({ m }) => (m === undefined ? <span className="cmp-dash">…</span> : m === null ? <span className="cmp-dash">—</span> : fmt(get(m))), get]);

const TABS = [
  { id: "scores", label: "Scores", rows: SCORE_ROWS },
  { id: "quarterly", label: "Quarterly results", rows: statementRows("quarterly"), filings: true, note: "The latest quarter each company has filed with NSE; quarters can end on different dates." },
  { id: "profitLoss", label: "Profit & loss", rows: statementRows("profitLoss"), filings: true, note: "The latest full year each company has filed with NSE." },
  { id: "balanceSheet", label: "Balance sheet", rows: statementRows("balanceSheet"), filings: true, note: "At the end of each company's latest full year. Banks and insurers report differently, so some lines don't compare." },
  { id: "cashFlow", label: "Cash flow", rows: statementRows("cashFlow"), filings: true, note: "The latest full year each company has filed with NSE." },
  { id: "valuation", label: "Valuation", rows: VALUE_ROWS, filings: true },
  { id: "price", label: "Price", rows: PRICE_ROWS, chart: true, note: "From NSE's daily closing prices." },
];

const usePhone = () => {
  const q = "(max-width: 640px)";
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return phone;
};

export default function CompareView({ stocks, pricesDate, onClose, onOpen }) {
  const phone = usePhone();
  const [tab, setTab] = useState("scores");
  const [techData, setTechData] = useState({});
  const [techLoading, setTechLoading] = useState({});
  const [metrics, setMetrics] = useState({}); // symbol → metrics | null (no figures)
  const [showBrief, setShowBrief] = useState(false);
  // on a phone, three at a time — the first three to start
  const [picked, setPicked] = useState(() => stocks.slice(0, 3).map(s => s.symbol));

  useEffect(() => {
    for (const s of stocks) {
      if (techData[s.symbol] || techLoading[s.symbol]) continue;
      setTechLoading(p => ({ ...p, [s.symbol]: true }));
      api.panel(s.symbol, "technicals")
        .then(j => setTechData(p => ({ ...p, [s.symbol]: j })))
        .catch(() => {})
        .finally(() => setTechLoading(p => ({ ...p, [s.symbol]: false })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks]);

  // Each company's filed figures, fetched the first time a tab needs them
  const needFilings = TABS.find(t => t.id === tab)?.filings;
  useEffect(() => {
    if (!needFilings) return;
    for (const s of stocks) {
      if (s.symbol in metrics) continue;
      setMetrics(p => ({ ...p, [s.symbol]: undefined }));
      api.stock(s.symbol)
        .then(d => setMetrics(p => ({ ...p, [s.symbol]: d?.metrics ?? null })))
        .catch(() => setMetrics(p => ({ ...p, [s.symbol]: null })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needFilings, stocks]);

  // Esc closes; the page behind doesn't scroll while this is open
  useEffect(() => {
    const key = e => { if (e.key === "Escape" && !showBrief) onClose?.(); };
    window.addEventListener("keydown", key);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = was; };
  }, [onClose, showBrief]);

  const colourOf = sym => COMPARE_COLOURS[stocks.findIndex(s => s.symbol === sym) % COMPARE_COLOURS.length];
  const shown = phone && stocks.length > 3 ? stocks.filter(s => picked.includes(s.symbol)) : stocks;
  const toggle = sym => setPicked(p => (p.includes(sym)
    ? (p.length > 1 ? p.filter(x => x !== sym) : p)
    : [...(p.length >= 3 ? p.slice(1) : p), sym]));
  const current = TABS.find(t => t.id === tab);
  const ctx = s => ({ s, tech: techData[s.symbol], loading: techLoading[s.symbol], m: metrics[s.symbol], colour: colourOf(s.symbol) });
  const open = sym => { onClose?.(); onOpen?.(sym); };
  const n = shown.length;
  const cols = phone ? `repeat(${n}, minmax(0, 1fr))` : `minmax(120px, 180px) repeat(${n}, minmax(0, 1fr))`;
  const asOf = pricesDate ? new Date(`${pricesDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;

  return createPortal(
    <div className="cmp" role="dialog" aria-modal="true" aria-labelledby="cmp-title">
      {showBrief && (
        <Suspense fallback={<div role="status" className="compare-loading">Building investment brief…</div>}>
          <InvestmentBriefView stocks={stocks} onClose={() => setShowBrief(false)} />
        </Suspense>
      )}
      <header className="cmp-bar">
        <div className="cmp-bar-row">
          <h2 id="cmp-title" className="cmp-title">Compare {stocks.length}</h2>
          <button type="button" onClick={() => setShowBrief(true)} className="cmp-brief"><FileText size={14} aria-hidden="true" /> {phone ? "Brief" : "Build investment brief"}</button>
          <button type="button" onClick={onClose} className="cmp-close" aria-label="Close compare"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="cmp-tabs" role="tablist" aria-label="What to compare">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="cmp-tab" onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {phone && stocks.length > 3 && (
          <div className="cmp-pick" role="group" aria-label="Which three to show">
            {stocks.map(s => (
              <button key={s.symbol} type="button" aria-pressed={picked.includes(s.symbol)} className="cmp-chip" onClick={() => toggle(s.symbol)}>
                <i style={{ background: colourOf(s.symbol) }} aria-hidden="true" />{s.symbol}
              </button>
            ))}
          </div>
        )}
        <div className="cmp-heads" style={{ gridTemplateColumns: cols }}>
          {!phone && <div className="cmp-heads-lbl">{asOf ? `Prices: NSE close, ${asOf}` : ""}</div>}
          {shown.map(s => (
            <div key={s.symbol} className="cmp-head">
              <i style={{ background: colourOf(s.symbol) }} aria-hidden="true" />
              {onOpen
                ? <button type="button" className="cmp-open" onClick={() => open(s.symbol)} title={`Open ${s.name}`}>{phone ? s.symbol : short(s.name)}</button>
                : <span className="cmp-open">{phone ? s.symbol : short(s.name)}</span>}
            </div>
          ))}
        </div>
      </header>

      <div className="cmp-body">
        {current.chart && <div className="cmp-chart"><CompareChart stocks={stocks} /></div>}
        <div className="cmp-rows" role="tabpanel" aria-label={current.label}>
          {current.rows.map(([label, cell, get]) => {
            // a bar under each filed figure, sized against the largest
            const vals = get ? shown.map(s => { const m = metrics[s.symbol]; const v = m ? get(m) : null; return Number.isFinite(v) ? v : null; }) : null;
            const max = vals ? Math.max(0, ...vals.map(v => Math.abs(v ?? 0))) : 0;
            return (
              <div key={label} className="cmp-row">
                {phone && <div className="cmp-lbl">{label}</div>}
                <div className="cmp-vals" style={{ gridTemplateColumns: cols }}>
                  {!phone && <div className="cmp-lbl">{label}</div>}
                  {shown.map((s, i) => (
                    <div key={s.symbol} className="cmp-val">
                      {cell(ctx(s))}
                      {max > 0 && vals[i] != null && <span className="cmp-meter" aria-hidden="true"><b className={vals[i] < 0 ? "neg" : ""} style={{ width: `${(Math.abs(vals[i]) / max) * 100}%`, background: vals[i] < 0 ? undefined : colourOf(s.symbol) }} /></span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="cmp-note">
          {current.note ? `${current.note} ` : ""}{phone && asOf ? `Prices: NSE close, ${asOf}. ` : ""}Figures from NSE filings and prices; for research, not a recommendation.
        </p>
      </div>
    </div>,
    document.body,
  );
}
