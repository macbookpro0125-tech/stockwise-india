import { useEffect, useState } from "react";
import { api } from "./api.js";
import { BrandMark } from "./site.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { niceName } from "./stockName.js";

// A company's page for someone not signed in (23 Oct 2026, so search engines
// and shared links show something real): the figures at the last close, the
// same summary the server writes into the page (server/seo.js), and the way
// in for the fair value, scorecard, charts and filings.

const num = (v, d = 1) => (v == null || !isFinite(v) ? null : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (v, d = 1) => (v == null || !isFinite(v) ? null : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
const crore = v => (v == null ? null : v >= 100000 ? `₹${num(v / 100000, 2)} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);

export default function PublicStock({ symbol, onSignIn, initial = null }) {
  const [s, setS] = useState(() => initial?.symbol === symbol ? initial : null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const title = x => `${niceName(x.name)} share price, P/E, fair value & quality score | ${x.symbol} | Jocular Insights`;
    if (initial?.symbol === symbol) {
      setS(initial);
      document.title = title(initial);
      return () => { active = false; };
    }
    setS(null);
    setError("");
    api.publicStock(symbol).then(x => {
      if (!active) return;
      setS(x);
      document.title = title(x);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [symbol, initial]);
  const facts = s ? [
    ["Market cap", crore(s.marketCapCr)],
    ["52-week range", s.low52w != null && s.high52w != null ? `₹${num(s.low52w, 2)} – ₹${num(s.high52w, 2)}` : null],
    ["1-year return", pct(s.change1y)],
    ["P/E", s.pe > 0 ? num(s.pe) : null],
    ["P/B", s.pb > 0 ? num(s.pb, 2) : null],
    ["ROE", s.roe != null ? `${num(s.roe)}%` : null],
    ["ROCE", s.roce != null ? `${num(s.roce)}%` : null],
    ["Debt to equity", s.debtToEquity != null ? num(s.debtToEquity, 2) : null],
    ["Dividend yield", s.divYield != null ? `${num(s.divYield, 2)}%` : null],
    ["Next results", s.nextResults ? day(s.nextResults) : null],
  ].filter(([, v]) => v != null) : [];
  return (
    <div className="ps-page">
      <header className="ps-head">
        <a href="/" className="ps-brand"><BrandMark size={34} /><span>Jocular <b>Insights</b></span></a>
        <button type="button" className="btn-primary ps-signin" onClick={onSignIn}>Sign in</button>
      </header>
      <main className="ps-main">
        {error && <p className="nw-empty">{error}</p>}
        {!s && !error && <div className="nw-skel" role="status" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} />)}</div>}
        {s && (
          <>
            <p className="ps-crumb">{s.sector ?? "NSE"} · {s.industry ?? s.symbol}</p>
            <div className="ps-title">
              <CompanyLogo symbol={s.symbol} size={48} fallback={s.name} />
              <div>
                <h1>{niceName(s.name)}</h1>
                <p>NSE: {s.symbol}</p>
              </div>
            </div>
            {s.close != null && (
              <p className="ps-price">₹{num(s.close, 2)} <span className={s.change1d >= 0 ? "up" : "down"}>{pct(s.change1d, 2)}</span><small>close on {day(s.closeDate)}</small></p>
            )}
            <div className="ps-cards">
              {s.quality != null && (
                <div className="ps-score"><span>Quality score</span><b>{Math.round(s.quality)}<small>/100</small></b><em>From its own filings</em></div>
              )}
              {s.quarter && (s.quarter.salesCr != null || s.quarter.profitCr != null) && (
                <div className="ps-score"><span>{s.quarter.label} results</span>
                  {s.quarter.salesCr != null && <em>Sales ₹{Math.round(s.quarter.salesCr).toLocaleString("en-IN")} cr {pct(s.quarter.salesYoY)}</em>}
                  {s.quarter.profitCr != null && <em>{s.quarter.profitCr < 0 ? "Loss" : "Profit"} ₹{Math.round(Math.abs(s.quarter.profitCr)).toLocaleString("en-IN")} cr {pct(s.quarter.profitYoY)}</em>}
                </div>
              )}
            </div>
            <dl className="ps-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <section className="ps-more">
              <h2>See the full analysis</h2>
              <p>{niceName(s.name)}'s fair value, the scorecard's checks one by one, price charts, results year by year, shareholding and its filings to NSE — free with an account.</p>
              <p><a href="/methodology">How the scores and fair values are calculated</a> · <a href="/disclaimer">Important limitations</a></p>
              <button type="button" className="btn-primary ps-cta" onClick={onSignIn}>Sign in or create a free account</button>
            </section>
            <p className="nw-note">Figures from NSE filings and prices at the last close. An educational tool, not investment advice.</p>
          </>
        )}
      </main>
    </div>
  );
}
