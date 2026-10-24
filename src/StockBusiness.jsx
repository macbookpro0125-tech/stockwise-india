import { useState } from "react";
import { segmentMix } from "./statements.js";
import { useShown, PALETTE, fmtCrShort } from "./StatementCharts.jsx";

// Where the money comes from (24 Oct 2026): the company's sales by the
// segments it reports — what it sells, or where, when its segments are places
// — as bars that grow in, each with its share, growth on the year before and
// margin where filed; then its share of its sector's sales among NSE-listed
// companies, as a ring (server/sector-share.js). Both from filings only: a
// company that reports one segment has no split, and the sector share is not
// market share — the card says both.

const MONO = { fontVariantNumeric: "tabular-nums" };
const pct = (v, d = 0) => `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(d)}%`;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Segments({ mix, fy }) {
  const [ref, shown] = useShown();
  const top = mix.parts[0];
  return (
    <div ref={ref}>
      <p className="biz-gist">
        {mix.by === "region"
          ? <>In {fy}, <strong>{Math.round(top.sharePct)}%</strong> of its sales came from <strong>{top.name}</strong>.</>
          : <>In {fy}, <strong>{top.name}</strong> brought in <strong>{Math.round(top.sharePct)}%</strong> of its sales.</>}
      </p>
      <ul className="biz-bars">
        {mix.parts.map((p, i) => (
          <li key={p.name}>
            <div className="biz-bar-head">
              <span className="biz-name">{p.name}</span>
              <span style={MONO}>{fmtCrShort(p.revenueCr)} · <strong>{Math.round(p.sharePct)}%</strong></span>
            </div>
            <span className="biz-track" aria-hidden="true">
              <span style={{ width: `${p.sharePct}%`, background: PALETTE[i % PALETTE.length], transform: shown ? "none" : "scaleX(0)", transition: reduced() ? "none" : `transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 110}ms` }} />
            </span>
            {(p.growthPct != null || p.marginPct != null) && (
              <div className="biz-sub" style={MONO}>
                {p.growthPct != null && <span style={{ color: p.growthPct >= 0 ? "var(--green)" : "var(--red)" }}>{p.growthPct >= 0 ? "▲" : "▼"} {pct(p.growthPct)} on the year before</span>}
                {p.marginPct != null && <span>profit margin {pct(p.marginPct)}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectorRing({ share, name }) {
  const [ref, shown] = useShown();
  const R = 54, C = 2 * Math.PI * R;
  const arc = (share.sharePct / 100) * C;
  return (
    <div ref={ref} className="biz-share">
      <svg viewBox="0 0 140 140" width="132" height="132" role="img" aria-label={`${name}: ${share.sharePct.toFixed(1)}% of the listed ${share.sector} companies' sales`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--s3)" strokeWidth="16" />
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--accent)" strokeWidth="16" strokeLinecap={share.sharePct > 2 ? "round" : "butt"}
          strokeDasharray={`${shown ? Math.max(arc, 1.5) : 0} ${C}`} transform="rotate(-90 70 70)"
          style={{ transition: reduced() ? "none" : "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }} />
        <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--t1)" style={MONO}>{share.sharePct < 10 ? share.sharePct.toFixed(1) : Math.round(share.sharePct)}%</text>
        <text x="70" y="88" textAnchor="middle" fontSize="10.5" fill="var(--t3)">of the sector</text>
      </svg>
      <div className="biz-share-list">
        <p className="biz-gist" style={{ marginTop: 0 }}>
          Number <strong>{share.rank}</strong> of {share.companies} listed {share.sector} companies by sales.
        </p>
        <ul className="biz-bars compact">
          {share.top.map((c, i) => (
            <li key={c.symbol} className={c.symbol === share.self ? "me" : undefined}>
              <div className="biz-bar-head">
                <span className="biz-name">{c.name}</span>
                <span style={MONO}>{c.sharePct < 10 ? c.sharePct.toFixed(1) : Math.round(c.sharePct)}%</span>
              </div>
              <span className="biz-track" aria-hidden="true">
                <span style={{ width: `${(c.sharePct / share.top[0].sharePct) * 100}%`, background: c.symbol === share.self ? "var(--accent)" : "var(--t3)", opacity: c.symbol === share.self ? 1 : 0.45, transform: shown ? "none" : "scaleX(0)", transition: reduced() ? "none" : `transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${200 + i * 90}ms` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function StockBusiness({ m, name }) {
  const history = m?.history ?? [];
  // the newest year with a split, and the year before for growth
  const years = history.map((h, i) => ({ h, prev: history[i + 1], mix: segmentMix(h, history[i + 1]) })).filter(y => y.mix);
  const [view, setView] = useState(0);
  const share = m?.sectorShare ? { ...m.sectorShare, self: m.symbol } : null;
  if (!years.length && !share) return null;
  const latest = years[0];
  const byBoth = years.length && share;
  const fy = latest ? `FY${latest.h.fyEnd.slice(2, 4)}` : null;
  return (
    <div className="biz-card">
      {byBoth ? (
        <div className="stm-years" role="tablist" aria-label="Show">
          {[latest.mix.by === "region" ? "Where it sells" : "What it sells", "Its share of the sector"].map((label, i) => (
            <button key={label} type="button" role="tab" aria-selected={view === i} className={`stm-year${view === i ? " on" : ""}`} onClick={() => setView(i)}>{label}</button>
          ))}
        </div>
      ) : null}
      {latest && (!byBoth || view === 0) && <Segments mix={latest.mix} fy={fy} />}
      {share && (!byBoth || view === 1) && <SectorRing share={share} name={name} />}
      <p className="stm-caption">
        {latest && (!byBoth || view === 0)
          ? `Sales by the segments it reports in its ${fy} results filing on NSE${latest.mix.by === "region" ? ", which it splits by place" : ""}. A company with one business reports no split.`
          : "Its latest full year's sales against the other NSE-listed companies in its sector. Not market share: unlisted companies, imports and rivals' sales in other sectors aren't counted."}
        {!latest && " This company's filings don't split its sales by segment."}
      </p>
    </div>
  );
}
