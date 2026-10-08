import { useEffect, useMemo, useState } from "react";
import { Zap, TriangleAlert, SlidersHorizontal, Calculator, X, Info, LoaderCircle } from "lucide-react";
import { api } from "./api.js";

// The Momentum tab: short-term (about a month) screen on price and volume
// alone (server/momentum.js) — separate from Discover's research scores and
// never mixed with them. Passers are ranked by a momentum score; a day with
// none says so rather than loosening the checks. A calculator works out a
// position from the user's own capital, price, stop and target — the
// numbers are theirs; the app doesn't tell anyone to trade.

const MONO = { fontVariantNumeric: "tabular-nums" };
const SETTINGS_KEY = "momentumSettings";
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
const dayLabel = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "—");
const rs = (v, d = 2) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d })}`);
const num = (v, d = 1) => (v == null ? "—" : Number(v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (v, d = 1, signed = false) => (v == null ? "—" : `${signed && v > 0 ? "+" : ""}${num(v, d)}%`);

// The checks a company must pass, as settings — labels say what each does
const SETTINGS = [
  { key: "minPrice", label: "Lowest price", unit: "₹", step: 10, about: "Leaves out penny stocks" },
  { key: "minAvgValueCr", label: "Traded a day, at least", unit: "₹ Cr", step: 1, about: "20-session average of rupees traded — room to get in and out" },
  { key: "nearHighPct", label: "Under its 52-week high, at most", unit: "%", step: 0.5 },
  { key: "volSurge", label: "Last session's volume, at least", unit: "× avg", step: 0.1, about: "Against its 20-session average" },
  { key: "rsiMin", label: "RSI from", unit: "", step: 1 },
  { key: "rsiMax", label: "RSI up to", unit: "", step: 1, about: "Strength without a blow-off" },
];

function ResultsDate({ row, known }) {
  if (!known) return <span style={{ color: "var(--t3)" }} title="NSE's results calendar couldn't be read">Unknown</span>;
  if (!row.nextResults) return <span style={{ color: "var(--t3)" }} title="No results meeting announced on NSE yet">Not announced</span>;
  if (row.resultsSoon) {
    return (
      <span title="Results come out before a one-month exit — the price can jump either way on the day" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--red)", fontWeight: 650, whiteSpace: "nowrap" }}>
        <TriangleAlert size={12} strokeWidth={2.4} />{dayLabel(row.nextResults)} · event risk
      </span>
    );
  }
  return <span style={MONO}>{dayLabel(row.nextResults)}</span>;
}

// Position from the user's own numbers. Default price = the last close,
// stop and target from the settings; everything editable.
function PositionCalculator({ row, config, onClose }) {
  const [capital, setCapital] = useState(() => String(read("momentumCapital", 100000)));
  const [price, setPrice] = useState(String(row.close));
  const [stopPct, setStopPct] = useState(String(config.stopPct));
  const [targetR, setTargetR] = useState(String(config.targetR));
  useEffect(() => { write("momentumCapital", Number(capital) || 0); }, [capital]);
  const p = Number(price), cap = Number(capital), sp = Number(stopPct) / 100, r = Number(targetR);
  const ok = p > 0 && cap > 0 && sp > 0 && sp < 1 && r > 0;
  const qty = ok ? Math.floor(cap / p) : 0;
  const stop = ok ? p * (1 - sp) : null, target = ok ? p * (1 + sp * r) : null;
  const field = (label, value, set, unit, step) => (
    <label style={{ display: "block", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 11.5, color: "var(--t3)", marginBottom: 4 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" inputMode="decimal" step={step} value={value} onChange={e => set(e.target.value)} className="input-base" style={{ height: 36, fontSize: 13.5, minWidth: 0 }} />
        {unit && <span style={{ fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>{unit}</span>}
      </span>
    </label>
  );
  const out = (label, value, color) => (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--s1)", border: "1px solid var(--bdr)", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 650, color: color ?? "var(--t1)", ...MONO }}>{value}</div>
    </div>
  );
  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--s2)", padding: 16, marginBottom: 16, boxShadow: "var(--sh-sm)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <Calculator size={18} style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: "var(--t1)" }}>Position calculator — {row.name}</div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Your numbers: price defaults to NSE's last close ({rs(row.close)}), not a live price.</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the calculator" className="btn-ghost" style={{ height: 32, width: 32, padding: 0, justifyContent: "center", flexShrink: 0 }}><X size={15} /></button>
      </div>
      <div className="momentum-calc-inputs">
        {field("Amount for this position", capital, setCapital, "₹", 1000)}
        {field("Your price", price, setPrice, "₹", 0.05)}
        {field("Stop, under your price", stopPct, setStopPct, "%", 0.5)}
        {field("Target, in multiples of the stop", targetR, setTargetR, "×", 0.25)}
      </div>
      {ok ? (
        <div className="momentum-calc-outputs" style={{ marginTop: 12 }}>
          {out("Quantity", qty.toLocaleString("en-IN"))}
          {out("Position value", rs(qty * p, 0))}
          {out("Stop level", rs(stop))}
          {out("Target level", rs(target))}
          {out("If the stop is hit", `−${rs(qty * (p - stop), 0)}`, "var(--red)")}
          {out("If the target is reached", `+${rs(qty * (target - p), 0)}`, "var(--green)")}
          {out("Reward : risk", `${num(r, 2)} : 1`)}
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--yellow)" }}>Enter an amount, a price, a stop between 0 and 100% and a target above 0.</div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--t3)", lineHeight: 1.55, margin: "12px 0 0" }}>
        Gains on shares held under a year are taxed as short-term capital gains (20%), and brokerage, STT and other charges come off both ways — on small moves they take a real share. A stop can fill below its level when a price gaps down.
      </p>
    </div>
  );
}

export default function MomentumView({ onOpenStock }) {
  const [settings, setSettings] = useState(() => read(SETTINGS_KEY, {}));
  const [draft, setDraft] = useState(settings);
  const [showSettings, setShowSettings] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [calcFor, setCalcFor] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.momentum({ config: settings })
      .then(d => { if (!cancelled) { setData(d); setDraft(prev => ({ ...d.config, ...prev })); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    write(SETTINGS_KEY, settings);
    return () => { cancelled = true; };
  }, [settings]);

  const config = data?.config;
  const defaults = data?.defaults;
  const changed = useMemo(() => !!defaults && Object.keys(defaults).some(k => settings[k] != null && Number(settings[k]) !== defaults[k]), [settings, defaults]);
  const apply = () => setSettings(Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== "" && v != null)));
  const reset = () => { setDraft(defaults ?? {}); setSettings({}); };

  const exportCsv = () => {
    const head = ["Rank", "Symbol", "Company", "Close", "Score", "% from 52w high", "RSI 14", "1M return %", "SMA20", "SMA50", "SMA200", "Avg traded ₹ Cr/day", "Avg volume 20d", "Volume × avg", "Next results", "Results within 30 days"];
    const q = v => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
    const lines = data.passers.map((r, i) => [i + 1, r.symbol, r.name, r.close, r.score, r.pctFromHigh, r.rsi14, r.ret1m, r.sma20, r.sma50, r.sma200, r.avgValueCr, r.avgVol20, r.volRatio, r.nextResults ?? "", r.resultsSoon ? "Yes" : ""].map(q).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `stockwise-india-momentum-${data.asOf ?? "today"}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const [exporting, setExporting] = useState(false);
  const exportExcel = async () => {
    setExporting(true);
    try { const { exportMomentumExcel } = await import("./exportExcel.js"); await exportMomentumExcel(data); }
    finally { setExporting(false); }
  };

  const passers = data?.passers ?? [];
  const cell = { padding: "9px 10px", borderBottom: "1px solid var(--bdr)", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: "var(--page-top, 24px) var(--page-x) 80px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--t1)", margin: 0, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={18} style={{ color: "var(--yellow)" }} /> Momentum
        </h2>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--yellow-dim)", color: "var(--yellow)", border: "1px solid var(--yellow-bdr)" }}>Short-term · speculative</span>
      </div>
      <p style={{ fontSize: 13, color: "var(--t2)", margin: "0 0 12px", lineHeight: 1.55, maxWidth: 820 }}>
        Companies in a confirmed uptrend near their 52-week high, on heavier volume — a screen for moves of about a month. Price and volume only: it's separate from Discover's Quality and Research scores, and a company can rank high here and low there.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "var(--yellow-dim)", border: "1px solid var(--yellow-bdr)", fontSize: 12, color: "var(--t2)", lineHeight: 1.55, marginBottom: 14, maxWidth: 820 }}>
        <TriangleAlert size={14} style={{ color: "var(--yellow)", flexShrink: 0, marginTop: 2 }} />
        <span>A screen of price patterns, not a recommendation to buy or sell. Short-term moves reverse often, and these figures use NSE's closing prices{data?.asOf ? ` of ${dayLabel(data.asOf)}` : ""}, not live ones. Educational use only — not investment advice.</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className="btn-ghost" onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings} style={{ height: 34, fontSize: 12.5 }}>
          <SlidersHorizontal size={14} /> Settings{changed && <span style={{ fontSize: 10.5, padding: "0 7px", borderRadius: 999, fontWeight: 700, background: "var(--accent)", color: "var(--on-accent)" }}>changed</span>}
        </button>
        {data && !loading && data.available && (
          <span style={{ fontSize: 12.5, color: "var(--t2)" }}>
            <strong style={{ color: "var(--t1)" }}>{data.counts.passed}</strong> of {data.counts.screened.toLocaleString("en-IN")} companies pass
            {data.counts.insufficient > 0 && <span style={{ color: "var(--t3)" }}> · {data.counts.insufficient} have under 210 sessions of history</span>}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {passers.length > 0 && (
          <>
            <button type="button" className="btn-ghost hide-phone" onClick={exportExcel} disabled={exporting} style={{ height: 32, fontSize: 12.5 }}>{exporting ? "Exporting…" : "Excel"}</button>
            <button type="button" className="btn-ghost hide-phone" onClick={exportCsv} style={{ height: 32, fontSize: 12.5 }}>CSV</button>
          </>
        )}
      </div>

      {showSettings && defaults && (
        <div style={{ borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>
            Every check must pass. Price over its 20-day average, the 20-day over the 50-day and the 50-day over the 200-day is always required.
          </div>
          <div className="momentum-settings">
            {[...SETTINGS, { key: "stopPct", label: "Calculator: stop", unit: "%", step: 0.5 }, { key: "targetR", label: "Calculator: target", unit: "× stop", step: 0.25 }].map(s => (
              <label key={s.key} title={s.about} style={{ display: "block", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--t3)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" inputMode="decimal" step={s.step} value={draft[s.key] ?? ""} placeholder={String(defaults[s.key])}
                    onChange={e => setDraft(d => ({ ...d, [s.key]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") apply(); }}
                    className="input-base" style={{ height: 34, fontSize: 13, minWidth: 0 }} />
                  {s.unit && <span style={{ fontSize: 11.5, color: "var(--t3)", whiteSpace: "nowrap" }}>{s.unit}</span>}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn-primary" onClick={apply} style={{ height: 34, fontSize: 12.5, padding: "0 16px" }}>Apply</button>
            <button type="button" className="btn-ghost" onClick={reset} style={{ height: 34, fontSize: 12.5 }}>Back to defaults</button>
          </div>
        </div>
      )}

      {calcFor && config && <PositionCalculator key={calcFor.symbol} row={calcFor} config={config} onClose={() => setCalcFor(null)} />}

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--red-dim)", border: "1px solid var(--red-bdr)", color: "var(--red)", fontSize: 13, marginBottom: 16 }}>
          <strong>Error — </strong>{error}
        </div>
      )}

      {loading && !data && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--t3)", fontSize: 13 }}>
          <LoaderCircle size={22} style={{ animation: "spin 0.9s linear infinite", marginBottom: 8 }} /><div>Screening…</div>
        </div>
      )}

      {data && !error && !data.available && (
        <div role="status" style={{ textAlign: "center", padding: "40px 20px", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
          <div style={{ fontSize: 15, fontWeight: 650, color: "var(--t1)", marginBottom: 6 }}>Momentum figures aren't in yet</div>
          <p style={{ fontSize: 13, color: "var(--t2)", margin: "0 auto", maxWidth: 520, lineHeight: 1.6 }}>They're worked out with each evening's prices. Check back after the next update.</p>
        </div>
      )}

      {/* No passers is an answer, not an error — the checks aren't loosened */}
      {data && !error && data.available && passers.length === 0 && (
        <div role="status" style={{ textAlign: "center", padding: "40px 20px", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
          <div style={{ fontSize: 15, fontWeight: 650, color: "var(--t1)", marginBottom: 6 }}>No confirmed uptrends today</div>
          <p style={{ fontSize: 13, color: "var(--t2)", margin: "0 auto", maxWidth: 520, lineHeight: 1.6 }}>
            Nothing passes every check on NSE's close of {dayLabel(data.asOf)}. That's the screen's answer for today: no setup. The checks aren't loosened to fill the list{changed ? " — your settings differ from the defaults" : ""}.
          </p>
        </div>
      )}

      {passers.length > 0 && isMobile && (
        <div style={{ borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--s2)", overflow: "hidden" }}>
          {passers.map((r, i) => (
            <div key={r.symbol} className="phone-row" role="link" tabIndex={0} onClick={() => onOpenStock(r.symbol)} onKeyDown={e => { if (e.key === "Enter") onOpenStock(r.symbol); }}
              style={{ padding: "12px 12px 12px 14px", borderTop: i ? "1px solid var(--bdr)" : "none", cursor: "pointer" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 10, alignItems: "baseline" }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {r.name}</div>
                <div style={{ fontSize: 14, fontWeight: 650, color: "var(--t1)", ...MONO }}>{rs(r.close)}</div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.symbol}{r.sector ? ` · ${r.sector}` : ""}</div>
                <div style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 650, marginTop: 3, ...MONO }}>Score {num(r.score)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
                {[["From high", pct(r.pctFromHigh)], ["RSI", num(r.rsi14)], ["1M", pct(r.ret1m, 1, true)], ["Volume", `${num(r.volRatio, 1)}×`]].map(([l, v]) => (
                  <div key={l} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, color: "var(--t3)", marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: "var(--t1)", ...MONO }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, fontSize: 11.5 }}>
                <span style={{ color: "var(--t3)" }}>Next results: <ResultsDate row={r} known={data.resultsKnown} /></span>
                <button type="button" className="btn-ghost tap" onClick={e => { e.stopPropagation(); setCalcFor(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ height: 30, fontSize: 12, padding: "0 10px" }}><Calculator size={13} /> Calculate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {passers.length > 0 && !isMobile && (
        <div style={{ borderRadius: 12, border: "1px solid var(--bdr2)", overflow: "auto", background: "var(--s2)", boxShadow: "var(--sh-xs)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--s3)" }}>
                {["#", "Company", "Close", "Score", "From 52w high", "RSI 14", "1M return", "SMA 20", "SMA 50", "SMA 200", "Traded ₹ Cr/day", "Volume × avg", "Next results", ""].map(h => (
                  <th key={h} style={{ ...cell, textAlign: h === "Company" ? "left" : "right", fontSize: 11.5, fontWeight: 600, color: "var(--t2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {passers.map((r, i) => (
                <tr key={r.symbol} style={{ background: calcFor?.symbol === r.symbol ? "color-mix(in srgb, var(--accent) 7%, transparent)" : undefined }}>
                  <td style={{ ...cell, textAlign: "right", color: "var(--t3)", ...MONO }}>{i + 1}</td>
                  <td style={{ ...cell, maxWidth: 260 }}>
                    <button type="button" className="stock-link" onClick={() => onOpenStock(r.symbol)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 650, fontSize: 13, textAlign: "left", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", display: "block", fontFamily: "inherit" }}>{r.name}</button>
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>{r.symbol}{r.sector ? ` · ${r.sector}` : ""}</span>
                  </td>
                  <td style={{ ...cell, textAlign: "right", fontWeight: 600, ...MONO }}>{rs(r.close)}</td>
                  <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: "var(--accent)", ...MONO }}>{num(r.score)}</td>
                  <td style={{ ...cell, textAlign: "right", ...MONO }}>{pct(r.pctFromHigh)}</td>
                  <td style={{ ...cell, textAlign: "right", ...MONO }}>{num(r.rsi14)}</td>
                  <td style={{ ...cell, textAlign: "right", color: r.ret1m == null ? "var(--t3)" : r.ret1m >= 0 ? "var(--green)" : "var(--red)", ...MONO }}>{pct(r.ret1m, 1, true)}</td>
                  <td style={{ ...cell, textAlign: "right", color: "var(--t2)", ...MONO }}>{num(r.sma20, 2)}</td>
                  <td style={{ ...cell, textAlign: "right", color: "var(--t2)", ...MONO }}>{num(r.sma50, 2)}</td>
                  <td style={{ ...cell, textAlign: "right", color: "var(--t2)", ...MONO }}>{num(r.sma200, 2)}</td>
                  <td style={{ ...cell, textAlign: "right", ...MONO }}>{num(r.avgValueCr, 1)}</td>
                  <td style={{ ...cell, textAlign: "right", ...MONO }}>{num(r.volRatio, 2)}×</td>
                  <td style={{ ...cell, textAlign: "right" }}><ResultsDate row={r} known={data.resultsKnown} /></td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    <button type="button" className="btn-ghost" onClick={() => { setCalcFor(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ height: 28, fontSize: 11.5, padding: "0 10px" }}><Calculator size={12} /> Calculate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <p style={{ display: "flex", gap: 6, fontSize: 11.5, color: "var(--t3)", lineHeight: 1.6, marginTop: 16, maxWidth: 820 }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 3 }} />
          <span>
            Passes only when every check holds: price over its 20-day average, over its 50-day, over its 200-day; ₹{config.minPrice}+; ₹{config.minAvgValueCr} Cr+ traded a day; within {config.nearHighPct}% of its 52-week high; last session's volume {config.volSurge}× its 20-day average or more; RSI {config.rsiMin}–{config.rsiMax}. Score = (50 − % under the high) + (RSI − 50) + 10 × volume multiple (up to 3×) + 10. Results dates are NSE's announced board meetings; "event risk" = within 30 days.
          </span>
        </p>
      )}
    </div>
  );
}
