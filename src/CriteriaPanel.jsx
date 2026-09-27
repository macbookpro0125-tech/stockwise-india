import { useState } from "react";

// Ported from stock-screener's src/components/CriteriaPanel.jsx — same eight
// sections, same sliders, ranges and hints, plus a visible net-net switch
// (the original only set it from its preset).

export const BLANK_CRITERIA = {
  revenue_growth_min: 0, roe_min: 0, opm_min: 0, roce_min: 0,
  debt_to_equity_max: 3, promoter_holding_min: 0, fii_holding_min: 0, dii_holding_min: 0,
  exclude_pledged: false, pe_max: 100, market_cap_min: null, market_cap_max: null, sectors: [],
  dividend_yield_min: 0, near_52w_low_pct: null, pct_below_52w_high_min: null,
  piotroski_min: 0, profit_growth_5y_min: 0, fcf_positive: false,
};

// Same count as the original's countActiveFilters, plus the net-net flag its
// preset sets.
export function countActiveFilters(c) {
  let n = 0;
  if (c.revenue_growth_min > 0) n++;
  if (c.roe_min > 0) n++;
  if (c.opm_min > 0) n++;
  if (c.roce_min > 0) n++;
  if (c.debt_to_equity_max < 2) n++;
  if (c.promoter_holding_min > 0) n++;
  if (c.fii_holding_min > 0) n++;
  if (c.dii_holding_min > 0) n++;
  if (c.exclude_pledged) n++;
  if (c.pe_max < 100) n++;
  if (c.market_cap_min) n++;
  if (c.market_cap_max) n++;
  if (c.dividend_yield_min > 0) n++;
  if (c.near_52w_low_pct > 0) n++;
  if (c.pct_below_52w_high_min > 0) n++;
  if (c.piotroski_min > 0) n++;
  if (c.profit_growth_5y_min > 0) n++;
  if (c.fcf_positive) n++;
  if (c.net_net || c.net_net_graham) n++;
  return n;
}

function Section({ title, number, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--bdr2)", marginBottom: 6 }}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px",
          background: open ? "rgba(0,224,190,0.04)" : "var(--s2)",
          border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid var(--bdr)" : "none",
          transition: "background 150ms",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: open ? "rgba(0,224,190,0.15)" : "var(--s3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: open ? "var(--accent)" : "var(--t3)",
            flexShrink: 0, transition: "all 150ms",
          }}>{number}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: open ? "var(--accent)" : "var(--t2)", letterSpacing: "-0.01em" }}>
            {title}
          </span>
        </div>
        <span style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, color: "var(--t3)",
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 200ms var(--ease)",
          flexShrink: 0,
        }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: "18px 18px 4px", background: "var(--s2)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit = "%", onChange, hint, disabled = false }) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const trackStyle = {
    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--s4) ${pct}%, var(--s4) 100%)`,
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: disabled ? "var(--t3)" : "var(--t1)", letterSpacing: "-0.01em" }}>{label}</span>
        <span className="mono" style={{
          fontSize: 12, fontWeight: 700, color: disabled ? "var(--t3)" : "var(--accent)",
          background: disabled ? "var(--s3)" : "rgba(0,224,190,0.08)",
          padding: "2px 9px", borderRadius: 6, minWidth: 42, textAlign: "center",
        }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        style={trackStyle}
      />
      {hint && (
        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 7, lineHeight: 1.6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function CheckRow({ checked, onToggle, children, disabled = false }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 12, cursor: disabled ? "not-allowed" : "pointer",
      padding: "12px 14px", borderRadius: 10,
      border: `1px solid ${checked ? "rgba(0,224,190,0.25)" : "var(--bdr2)"}`,
      background: checked ? "rgba(0,224,190,0.05)" : "var(--s1)",
      marginBottom: 16, transition: "all 150ms",
    }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
      <span style={{ fontSize: 13, color: disabled ? "var(--t3)" : checked ? "var(--t1)" : "var(--t2)", fontWeight: checked ? 500 : 400 }}>
        {children}
      </span>
    </label>
  );
}

export default function CriteriaPanel({ criteria, onChange, activeFilters }) {
  const set = (key, val) => onChange({ ...criteria, [key]: val });
  const toggle = key => onChange({ ...criteria, [key]: !criteria[key] });

  const inputStyle = {
    width: "100%", height: 40, padding: "0 14px",
    border: "1px solid var(--bdr2)", borderRadius: 10,
    fontSize: 13, outline: "none",
    background: "var(--s1)", color: "var(--t1)",
    fontFamily: "inherit",
    transition: "border-color 150ms, box-shadow 150ms",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

      <Section title="Growth" number="1" defaultOpen>
        <Slider
          label="Min Revenue Growth (3Y CAGR)"
          value={criteria.revenue_growth_min || 0} min={0} max={30}
          onChange={v => set("revenue_growth_min", v)}
          hint="Sales growth compounded over 3 years"
        />
      </Section>

      <Section title="Profitability" number="2">
        <Slider label="Min ROE (5Y avg)" value={criteria.roe_min || 0} min={0} max={40} onChange={v => set("roe_min", v)} hint="Average return on equity over 5 years" />
        <Slider label="Min OPM (Operating Margin)" value={criteria.opm_min || 0} min={0} max={50} onChange={v => set("opm_min", v)} hint="Keep at 0 to include banks/NBFCs — they don't report OPM." />
      </Section>

      <Section title="Business Quality" number="3">
        <Slider label="Min ROCE" value={criteria.roce_min || 0} min={0} max={50} onChange={v => set("roce_min", v)} hint="Return on capital employed" />
        <Slider label="Max Debt / Equity" value={criteria.debt_to_equity_max ?? 2} min={0} max={3} step={0.1} unit="x" onChange={v => set("debt_to_equity_max", v)} hint="Banks/NBFCs naturally run 5–10x D/E — set to 3x to include them." />
      </Section>

      <Section title="Ownership" number="4">
        <Slider label="Min Promoter Holding" value={criteria.promoter_holding_min || 0} min={0} max={90} onChange={v => set("promoter_holding_min", v)} hint="40–65% is ideal. Below 30% = promoters selling out." />
        <Slider label="Min FII Holding" value={criteria.fii_holding_min || 0} min={0} max={50} onChange={v => set("fii_holding_min", v)} hint="Foreign institutional investors. High FII = global confidence in the stock." />
        <Slider label="Min DII Holding" value={criteria.dii_holding_min || 0} min={0} max={50} onChange={v => set("dii_holding_min", v)} hint="Domestic mutual funds & insurance. High DII = strong local institutional backing." />
        <CheckRow checked={!!criteria.exclude_pledged} onToggle={() => toggle("exclude_pledged")}>
          Exclude stocks with pledged shares &gt; 5%
        </CheckRow>
      </Section>

      <Section title="Valuation" number="5">
        <Slider label="Max P/E Ratio" value={criteria.pe_max || 100} min={5} max={100} unit="x" onChange={v => set("pe_max", v)} hint="IT 20–30x · FMCG 40–60x · Pharma 25–40x · Banks use P/B not P/E" />
        <Slider label="Min Dividend Yield" value={criteria.dividend_yield_min || 0} min={0} max={8} step={0.5} onChange={v => set("dividend_yield_min", v)} hint="Trailing 12-month dividend yield" />
        <CheckRow checked={!!criteria.net_net} onToggle={() => toggle("net_net")}>
          Net-net only — market cap below net current assets (Graham)
        </CheckRow>
      </Section>

      <Section title="Universe Filters" number="6" defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Min Market Cap (Rs Cr)</div>
            <input type="number" value={criteria.market_cap_min || ""} onChange={e => set("market_cap_min", e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 1000" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Max Market Cap (Rs Cr)</div>
            <input type="number" value={criteria.market_cap_max || ""} onChange={e => set("market_cap_max", e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 100000" style={inputStyle} />
          </div>
        </div>
      </Section>

      <Section title="52-Week Range" number="7" defaultOpen={false}>
        <Slider label="Near 52W Low — max % above low" value={criteria.near_52w_low_pct || 0} min={0} max={50} step={5} unit="%" onChange={v => set("near_52w_low_pct", v > 0 ? v : null)} hint="0 = off  ·  20 = within 20% of 52W low" />
        <Slider label="Off Peak — min % below 52W High" value={criteria.pct_below_52w_high_min || 0} min={0} max={60} step={5} unit="%" onChange={v => set("pct_below_52w_high_min", v > 0 ? v : null)} hint="0 = off  ·  30 = at least 30% off 52W peak" />
      </Section>

      <Section title="Cash Flow & Consistency" number="8" defaultOpen={false}>
        <Slider label="Min Piotroski Score" value={criteria.piotroski_min || 0} min={0} max={9} unit="" onChange={v => set("piotroski_min", v)} hint="0 = off · 9-point financial strength checklist. 7+ = strong, improving fundamentals. Not scored for banks and lenders." />
        <Slider label="Min Profit Growth (5Y CAGR)" value={criteria.profit_growth_5y_min || 0} min={0} max={30} onChange={v => set("profit_growth_5y_min", v)} hint="0 = off · Sustained profit growth filters out one-quarter wonders." />
        <CheckRow checked={!!criteria.fcf_positive} onToggle={() => toggle("fcf_positive")}>
          Positive free cash flow (last year)
        </CheckRow>
      </Section>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 2px 4px" }}>
        <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: "-0.01em" }}>
          {activeFilters} active filter{activeFilters !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => onChange({ ...BLANK_CRITERIA, debt_to_equity_max: 2 })}
          className="btn-ghost"
          style={{ height: 32, fontSize: 12 }}
        >
          Reset all
        </button>
      </div>
    </div>
  );
}
