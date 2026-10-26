import { useEffect, useState } from "react";
import { api } from "./api.js";
import { BrandMark } from "./site.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { AdCard } from "./ads.jsx";
import { niceName } from "./stockName.js";
import { ANALYSIS_EXAMPLES, companyAnalysisFor } from "./company-analysis.js";

// A company's page for someone not signed in (23 Oct 2026, so search engines
// and shared links show something real): the figures at the last close, the
// same summary the server writes into the page (server/seo.js), and the way
// in for the fair value, scorecard, charts and filings.

const num = (v, d = 1) => (v == null || !isFinite(v) ? null : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (v, d = 1) => (v == null || !isFinite(v) ? null : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
const crore = v => (v == null ? null : v >= 100000 ? `₹${num(v / 100000, 2)} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);

// The company in words, its peers, the screens it passes and plain answers —
// the same words the server writes into the page (server/seo-story.js)
function Story({ s }) {
  const t = s.story, n = niceName(s.name);
  const cell = (v, f) => (v == null ? "—" : f(v));
  return (
    <section className="ps-analysis ps-story">
      {(t.summary.length > 0 || t.trend) && <>
        <h2>{n} in short</h2>
        {t.summary.length > 0 && <p>{t.summary.join(" ")}</p>}
        {t.trend && <p>{t.trend}</p>}
      </>}
      {t.peers.length > 0 && <>
        <h2>{n} against similar companies</h2>
        <div className="ps-table-wrap">
          <table>
            <caption>Listed {t.sector?.name ?? ""} companies closest in size, at the last close</caption>
            <thead><tr><th>Company</th><th>Price</th><th>P/E</th><th>ROE</th><th>ROCE</th><th>Debt/equity</th><th>Quality</th></tr></thead>
            <tbody>{t.peers.map(p => (
              <tr key={p.symbol}>
                <th><a href={`/stock/${encodeURIComponent(p.symbol)}`}>{p.name}</a></th>
                <td>{cell(p.price, v => `₹${num(v, 2)}`)}</td><td>{cell(p.pe, v => num(v))}</td><td>{cell(p.roe, v => `${num(v)}%`)}</td>
                <td>{cell(p.roce, v => `${num(v)}%`)}</td><td>{cell(p.debtToEquity, v => num(v, 2))}</td><td>{cell(p.quality, v => `${Math.round(v)}/100`)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {t.sector && <p><a href={`/sector/${t.sector.slug}`}>Every listed {t.sector.name} company</a></p>}
      </>}
      <h2>Stock screens {n} passes</h2>
      {t.screens.length ? <ul>{t.screens.map(x => <li key={x.slug}><a href={`/screens/${x.slug}`}>{x.name}</a></li>)}</ul>
        : <p>It passes none of the ready-made screens today. <a href="/screens">See every screen</a>.</p>}
      <h2>Questions about {n}</h2>
      {t.qa.map(x => <div key={x.q}><h3>{x.q}</h3><p>{x.a}</p></div>)}
      {s.links?.length > 0 && <>
        <h2>More on {n}</h2>
        <ul>{s.links.map(l => <li key={l.path}><a href={l.path}>{l.label}</a></li>)}</ul>
      </>}
    </section>
  );
}

export default function PublicStock({ symbol, onSignIn, initial = null }) {
  const [s, setS] = useState(() => initial?.symbol === symbol ? initial : null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const title = x => `${niceName(x.name)} share price, P/E, results & quality score | ${x.symbol} | Jocular Insights`;
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
  const analysis = s ? companyAnalysisFor(s) : null;
  const analysisAmount = v => v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`;
  const analysisPct = v => v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
  const analysisRatio = (v, d = 1) => v == null ? "—" : Number(v).toFixed(d);
  const analysisRevenueLabel = s?.symbol === "HDFCBANK" ? "reported revenue line" : "reported revenue";
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
            <p className="ps-crumb">{s.story?.sector ? <a href={`/sector/${s.story.sector.slug}`}>{s.story.sector.name}</a> : <a href="/sectors">Sectors</a>} · {s.industry ?? s.symbol}</p>
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
            {/* a company's page, where a search lands: a card after its key
                figures and one before the way into the full analysis (ads.jsx) */}
            <AdCard feed="public" slot="company-top" size="medium" className="ps-ad" />
            {s.story && <Story s={s} />}
            {analysis && (
              <section className="ps-analysis" aria-labelledby="company-analysis-title">
                <h2 id="company-analysis-title">{analysis.title}</h2>
                <p>{analysis.lens}</p>
                {analysis.latest && <>
                  <h3>Latest reported figures · {analysis.latest.label}{analysis.latest.filed ? ` · filed ${day(analysis.latest.filed)}` : ""}</h3>
                  <p>{[
                    analysis.latest.salesCr != null && `${analysisRevenueLabel} ${analysisAmount(analysis.latest.salesCr)} crore${analysis.latest.salesYoY != null ? ` (${analysisPct(analysis.latest.salesYoY)} year on year)` : ""}`,
                    analysis.latest.profitCr != null && `net profit ${analysisAmount(analysis.latest.profitCr)} crore${analysis.latest.profitYoY != null ? ` (${analysisPct(analysis.latest.profitYoY)} year on year)` : ""}`,
                    analysis.latest.opm != null && `operating margin ${analysisRatio(analysis.latest.opm)}%`,
                  ].filter(Boolean).join("; ")}.</p>
                </>}
                {!!s.recentQuarters?.length && <div className="ps-table-wrap">
                  <table><caption>Recent quarterly figures, as reported (₹ crore unless stated)</caption>
                    <thead><tr><th>Period</th><th>Revenue line</th><th>Net profit</th><th>Operating margin</th><th>EPS</th></tr></thead>
                    <tbody>{s.recentQuarters.slice(0, 4).map(q => <tr key={q.end}>
                      <th>{q.label ?? day(q.end)}</th><td>{q.salesCr == null ? "—" : `${analysisAmount(q.salesCr)} cr`}</td>
                      <td>{q.profitCr == null ? "—" : `${analysisAmount(q.profitCr)} cr`}</td>
                      <td>{q.opm == null ? "—" : `${analysisRatio(q.opm)}%`}</td>
                      <td>{q.eps == null ? "—" : `₹${analysisRatio(q.eps, 2)}`}</td>
                    </tr>)}</tbody>
                  </table>
                </div>}
                <p>Quarterly figures are shown as reported in the available company results. Revenue lines can differ by business type and should not be compared across companies without checking each filing&apos;s definitions, especially for banks. Missing figures are omitted rather than treated as zero.</p>
                <h3>Market ratios at the {day(s.closeDate) ?? "latest available"} close</h3>
                <dl className="ps-analysis-ratios">{[
                  ["P/E", analysis.marketRatios.pe == null ? null : analysisRatio(analysis.marketRatios.pe)],
                  ["Price-to-book", analysis.marketRatios.pb == null ? null : analysisRatio(analysis.marketRatios.pb, 2)],
                  ["ROE", analysis.marketRatios.roe == null ? null : `${analysisRatio(analysis.marketRatios.roe)}%`],
                  ["ROCE", analysis.marketRatios.roce == null ? null : `${analysisRatio(analysis.marketRatios.roce)}%`],
                  ["Debt-to-equity", analysis.marketRatios.debtToEquity == null ? null : analysisRatio(analysis.marketRatios.debtToEquity, 2)],
                  ["Dividend yield", analysis.marketRatios.divYield == null ? null : `${analysisRatio(analysis.marketRatios.divYield, 2)}%`],
                ].filter(([, value]) => value != null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                <h3>How to read these numbers</h3><ul>{analysis.checks.map(item => <li key={item}>{item}</li>)}</ul>
                <h3>What the summary cannot answer</h3><p>{analysis.watch}</p>
                <h3>More company examples</h3><ul>{ANALYSIS_EXAMPLES.filter(item => item.symbol !== s.symbol).map(item => <li key={item.symbol}><a href={`/stock/${encodeURIComponent(item.symbol)}`}>{item.name}</a></li>)}</ul>
                <p>Quarterly data is based on company results filed with NSE; market ratios are from the latest Jocular Insights data snapshot. Figures can be revised or restated. Check the original filings before relying on them. This page is educational information, not investment advice. <a href="/methodology">How Jocular calculates scores and reference fair values</a>.</p>
              </section>
            )}
            <AdCard feed="public" slot="company-end" size="medium" className="ps-ad" />
            <section className="ps-more">
              <h2>See the full analysis</h2>
              <p>The scorecard's checks one by one, price charts, results year by year, what it sells and where, shareholding and its filings to NSE — free with an account.</p>
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
