import { useEffect, useState } from "react";
import { api } from "./api.js";
import { segmentMix } from "./statements.js";
import { useShown, PALETTE, fmtCrShort } from "./StatementCharts.jsx";

// Where the money comes from (24 Oct 2026): the company's revenue mix as a
// set of cards, each a ring that draws itself in with a legend beside it —
// tap a line and its slice lifts out. Every card says which filing it's from:
//  - By business: the segments in its results filing on NSE (₹, growth, and
//    margin where filed), the latest year or how the mix moved over the years;
//  - By product: its products or services with their share of turnover, from
//    its BRSR (company-extras.js brsrMarkets);
//  - Home and abroad: exports as a share of turnover (BRSR), with the states
//    and countries it sells in and its types of customers;
//  - Its share of the sector: against the other NSE-listed companies in its
//    sector (server/sector-share.js) — not market share, and it says so.
// A card with nothing filed isn't shown.

const MONO = { fontVariantNumeric: "tabular-nums" };
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const pctText = v => (v == null ? "—" : v < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`);
const fyOf = iso => `FY${iso.slice(2, 4)}`;

// A ring of slices (parts: { label, value, color }), drawn in when it comes
// into view; `active` lifts one slice out
function Ring({ parts, active, center, sub, size = 148 }) {
  const [ref, shown] = useShown();
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  const R = 54, C = 2 * Math.PI * R, gap = parts.length > 1 ? 1.6 : 0;
  let at = 0;
  return (
    <svg ref={ref} viewBox="0 0 140 140" width={size} height={size} className="mix-ring" aria-hidden="true">
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--s3)" strokeWidth="16" />
      {parts.map((p, i) => {
        const len = (p.value / total) * C;
        const start = at;
        at += len;
        const on = active == null || active === i;
        return (
          <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth={active === i ? 22 : 16}
            strokeDasharray={`${shown ? Math.max(len - gap, 0.5) : 0} ${C}`} strokeDashoffset={-start} transform="rotate(-90 70 70)"
            style={{ opacity: on ? 1 : 0.28, transition: reduced() ? "none" : `stroke-dasharray 760ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 90}ms, opacity 180ms, stroke-width 180ms` }} />
        );
      })}
      <text x="70" y={sub ? 68 : 75} textAnchor="middle" fontSize="21" fontWeight="600" fill="var(--t1)" style={MONO}>{center}</text>
      {sub && <text x="70" y="88" textAnchor="middle" fontSize="10" fill="var(--t3)">{sub}</text>}
    </svg>
  );
}

// A card: its ring beside a legend whose lines lift their slice
function MixCard({ title, source, parts, center, sub, lede, note, children, extra }) {
  const [active, setActive] = useState(null);
  const shownCenter = active == null ? center : pctText(parts[active].pct);
  const shownSub = active == null ? sub : parts[active].label.length > 16 ? `${parts[active].label.slice(0, 15)}…` : parts[active].label;
  return (
    <section className="mix-card">
      <header className="mix-head"><h3>{title}</h3>{extra}</header>
      {lede && <p className="mix-lede">{lede}</p>}
      {children ?? (
        <div className="mix-body">
          <Ring parts={parts} active={active} center={shownCenter} sub={shownSub} />
          <ul className="mix-legend">
            {parts.map((p, i) => (
              <li key={p.label}>
                <button type="button" className={`mix-line${active === i ? " on" : ""}`} onClick={() => setActive(active === i ? null : i)} onPointerEnter={e => { if (e.pointerType === "mouse") setActive(i); }} onPointerLeave={e => { if (e.pointerType === "mouse") setActive(null); }} aria-pressed={active === i}>
                  <span className="mix-dot" style={{ background: p.color }} />
                  <span className="mix-name">{p.label}</span>
                  <span className="mix-pct" style={MONO}>{pctText(p.pct)}</span>
                  {p.detail && <span className="mix-detail" style={MONO}>{p.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="mix-note">{note}</p>}
      <p className="mix-source">{source}</p>
    </section>
  );
}

// How the segments' shares moved, year by year: one 100% bar a year, the
// same colour for a segment throughout
function MixOverYears({ years, colorOf }) {
  const [ref, shown] = useShown();
  return (
    <div ref={ref} className="mix-years">
      {years.map((y, row) => (
        <div key={y.fyEnd} className="mix-year">
          <span className="mix-year-label" style={MONO}>{fyOf(y.fyEnd)}</span>
          <span className="mix-year-bar">
            {y.mix.parts.map((p, i) => (
              <span key={p.name} title={`${p.name}: ${pctText(p.sharePct)} · ${fmtCrShort(p.revenueCr)}`} style={{ width: `${p.sharePct}%`, background: colorOf(p.name), transform: shown ? "none" : "scaleX(0)", transition: reduced() ? "none" : `transform 620ms cubic-bezier(0.22, 1, 0.36, 1) ${row * 90 + i * 30}ms` }} />
            ))}
          </span>
        </div>
      ))}
      <ul className="mix-keys">
        {[...new Set(years.flatMap(y => y.mix.parts.map(p => p.name)))].map(n => <li key={n}><span className="mix-dot" style={{ background: colorOf(n) }} />{n}</li>)}
      </ul>
    </div>
  );
}

function BusinessCard({ years }) {
  const [view, setView] = useState("latest");
  const latest = years[0];
  const names = [...new Set(years.flatMap(y => y.mix.parts.map(p => p.name.toLowerCase())))];
  const colorOf = name => PALETTE[names.indexOf(name.toLowerCase()) % PALETTE.length];
  const parts = latest.mix.parts.map(p => ({
    label: p.name, value: p.revenueCr, pct: p.sharePct, color: colorOf(p.name),
    detail: [fmtCrShort(p.revenueCr), p.growthPct != null ? `${p.growthPct >= 0 ? "▲" : "▼"} ${Math.abs(p.growthPct).toFixed(0)}%` : null, p.marginPct != null ? `margin ${Math.round(p.marginPct)}%` : null].filter(Boolean).join(" · "),
  }));
  const top = parts[0];
  const region = latest.mix.by === "region";
  return (
    <MixCard
      title={region ? "By region" : "By business"}
      lede={region ? <><strong>{pctText(top.pct)}</strong> of its {fyOf(latest.h.fyEnd)} sales came from <strong>{top.label}</strong>.</> : <><strong>{top.label}</strong> brought in <strong>{pctText(top.pct)}</strong> of its {fyOf(latest.h.fyEnd)} sales.</>}
      parts={parts} center={fmtCrShort(latest.mix.total).replace(" Cr", "")} sub="Cr of sales"
      extra={years.length > 1 && (
        <div className="mix-toggle" role="tablist" aria-label="View">
          {[["latest", "Latest"], ["years", "Over the years"]].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? "on" : undefined} onClick={() => setView(id)}>{label}</button>)}
        </div>
      )}
      source={`The segments in its ${fyOf(latest.h.fyEnd)} results filing on NSE.${parts.some(p => p.detail.includes("▲") || p.detail.includes("▼")) ? " ▲▼ against the year before." : ""}`}
    >
      {view === "years" ? <MixOverYears years={years.slice(0, 5)} colorOf={colorOf} /> : null}
    </MixCard>
  );
}

export default function StockBusiness({ m, symbol, name }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.panel(symbol, "profile").then(x => { if (!cancelled) setProfile(x?.profile ?? null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [symbol]);

  const history = m?.history ?? [];
  const years = history.map((h, i) => ({ fyEnd: h.fyEnd, h, mix: segmentMix(h, history[i + 1]) })).filter(y => y.mix);
  const fy = profile?.report?.fy;
  const products = (profile?.products ?? []).filter(p => p.pct > 0);
  const productParts = products.length >= 2 ? products.map((p, i) => ({ label: p.name, value: p.pct, pct: p.pct, color: PALETTE[i % PALETTE.length] })) : null;
  const productRest = productParts ? 100 - products.reduce((t, p) => t + p.pct, 0) : 0;
  if (productParts && productRest >= 1) productParts.push({ label: "Everything else", value: productRest, pct: productRest, color: "var(--t3)" });
  const ex = profile?.exportsPct;
  const homeParts = ex != null && ex >= 0 && ex <= 100 ? [
    { label: "In India", value: 100 - ex, pct: 100 - ex, color: "var(--accent)" },
    { label: "Exports", value: ex, pct: ex, color: "#5B8DEF" },
  ].filter(p => p.value > 0) : null;
  const served = profile?.marketsServed;
  const share = m?.sectorShare;
  const shareParts = share ? [
    ...share.top.map(c => ({ label: c.name, value: c.sharePct, pct: c.sharePct, color: c.symbol === m.symbol ? "var(--accent)" : "color-mix(in srgb, var(--t3) 55%, transparent)" })),
    ...(100 - share.top.reduce((t, c) => t + c.sharePct, 0) >= 0.5 ? [{ label: `The other ${share.companies - share.top.length}`, value: 100 - share.top.reduce((t, c) => t + c.sharePct, 0), pct: 100 - share.top.reduce((t, c) => t + c.sharePct, 0), color: "var(--s3)" }] : []),
  ] : null;

  if (!years.length && !productParts && !homeParts && !shareParts) return null;
  return (
    <div id="sec-business" className="ss-section" data-tab="overview">
    <h2 className="sd-h2">Where the money comes from. <span>What it sells, where, and its share of the sector.</span></h2>
    <div className="mix-grid">
      {years.length > 0 && <BusinessCard years={years} />}
      {productParts && (
        <MixCard title="By product" parts={productParts} center={pctText(products[0].pct)} sub="its biggest"
          lede={<><strong>{products[0].name}</strong> is {pctText(products[0].pct)} of its turnover.</>}
          source={`Its products and services with their share of turnover, from its ${fy ?? "latest"} Business Responsibility & Sustainability Report on NSE.`} />
      )}
      {homeParts && (
        <MixCard title="Home and abroad" parts={homeParts} center={pctText(ex)} sub="exported"
          lede={ex < 1 ? <>It sells almost all of it in India.</> : <><strong>{pctText(ex)}</strong> of its turnover is exports; <strong>{pctText(100 - ex)}</strong> is sold in India.</>}
          note={[
            served && (served.states != null || served.countries != null) && `Sells in ${[served.states != null && `${served.states} Indian states`, served.countries != null && `${served.countries} countries`].filter(Boolean).join(" and ")}.`,
            profile?.customers && `Its customers: ${profile.customers}`,
          ].filter(Boolean).join(" ") || null}
          source={`Exports as a share of turnover, from its ${fy ?? "latest"} Business Responsibility & Sustainability Report on NSE.`} />
      )}
      {shareParts && (
        <MixCard title="Its share of the sector" parts={shareParts} center={pctText(share.sharePct)} sub={`#${share.rank} of ${share.companies}`}
          lede={<><strong>{name}</strong> is number <strong>{share.rank}</strong> of {share.companies} listed {share.sector} companies by sales.</>}
          source="Its latest full year's sales against the other NSE-listed companies in its sector. Not market share: unlisted companies, imports and rivals' sales in other sectors aren't counted." />
      )}
    </div>
    </div>
  );
}
