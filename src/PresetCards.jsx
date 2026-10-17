import { useState, useEffect } from "react";
import { Plus, Ellipsis, Search, ChevronRight } from "lucide-react";
import { api } from "./api.js";
import { PresetIcon } from "./icons.jsx";
import StrategyMark, { markColor } from "./StrategyMarks.jsx";
import StrategyCard from "./StrategyCard.jsx";
import { strategiesStore } from "./accountData.js";
import { AdCard, useAdFeed } from "./ads.jsx";

// Ported from stock-screener's src/components/PresetCards.jsx. The strategy
// list comes from the server (the original 13 presets and Up on Every Timeframe); the user's own are saved to
// their account (accountData.js) — the original kept them in the browser. This app: one accent and a line icon per
// card, rather than the original's ten rotating colours and emoji.

const tint = pct => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;

const loadCustomPresets = () => strategiesStore.get();

// A strategy's rules in words, for the cards on Discover's first page
// ("ROE ≥ 18% · ROCE ≥ 20% · +5 more"). The built-in ones keep their rules as
// the original's criteria (server/presets.js); saved ones as filters, named
// from the screener's metric list.
const inr = v => Number(v).toLocaleString("en-IN");
const CRITERIA = {
  revenue_growth_min: v => `Sales growth ≥ ${v}%`,
  roe_min: v => `ROE ≥ ${v}%`,
  opm_min: v => `OPM ≥ ${v}%`,
  roce_min: v => `ROCE ≥ ${v}%`,
  debt_to_equity_max: v => `D/E ≤ ${v}`,
  promoter_holding_min: v => `Promoter ≥ ${v}%`,
  pe_max: v => `P/E ≤ ${v}`,
  exclude_pledged: v => (v ? "No pledged shares" : null),
  dividend_yield_min: v => `Div yield ≥ ${v}%`,
  market_cap_min: v => `Mkt cap ≥ ₹${inr(v)} Cr`,
  market_cap_max: v => `Mkt cap ≤ ₹${inr(v)} Cr`,
  fii_holding_min: v => `FII ≥ ${v}%`,
  dii_holding_min: v => `DII ≥ ${v}%`,
  net_net: v => (v ? "Below net current assets" : null),
};
export function presetRules(p, meta) {
  if (Array.isArray(p.filters)) {
    return p.filters.map(f => {
      const def = meta?.byId.get(f.id);
      const name = def?.short || def?.label || f.id;
      if (f.values) return f.values.length ? `${name}: ${f.values.join(", ")}` : null;
      const unit = def?.unit === "%" ? "%" : "";
      if (f.min != null && f.max != null) return `${name} ${inr(f.min)}–${inr(f.max)}${unit}`;
      if (f.min != null) return `${name} ≥ ${inr(f.min)}${unit}`;
      if (f.max != null) return `${name} ≤ ${inr(f.max)}${unit}`;
      return null;
    }).filter(Boolean);
  }
  return Object.entries(p.criteria ?? {}).map(([k, v]) => CRITERIA[k]?.(v)).filter(Boolean);
}

// Each strategy's colour is its mark's (StrategyMarks.jsx); your own are teal
const hueOf = p => markColor(p.id) ?? "var(--accent)";

// The grid's strategies by kind, for the tabs over it and the label on each card
const KINDS = [
  ["quality", "Quality & growth", ["high_quality_compounders", "undervalued_growth", "small_cap_multibaggers", "ofss_style_filter", "debt_paydown"]],
  ["value", "Value", ["turnaround_plays", "psu_value", "net_net_value", "fallen_quality"]],
  ["income", "Income & safety", ["dividend_aristocrats", "dividend_growth", "defensive_bluechips"]],
  ["momentum", "Momentum", ["momentum_growth", "up_every_timeframe", "near_highs_cheap", "doubled_in_year"]],
  ["owners", "Big investors", ["fii_favorites", "dii_backed"]],
];
const kindOf = p => (p.custom ? ["yours", "Yours"] : KINDS.find(k => k[2].includes(p.id)) ?? ["other", "Other"]);

// Settings → Your strategies opens Discover on that kind
let kindOnOpen = "all";
export const showStrategiesOfKind = kind => { kindOnOpen = kind; };

// A phone's list (17 Oct 2026, after the Stock Screeners: India app): a
// search box and the kinds as chips over the cards; each card its mark, name,
// what it looks for and its first rules as chips, with how many stocks match;
// an ad card after the third strategy and then every sixth, in the store app
const AD_FIRST = 3, AD_EVERY = 6;
const PHONE_RULES = 3;

// layout: "strip" — one scrolling row (the original); "stack" — a phone's list;
// "grid" — Discover's first page on a computer: big cards with the rules, and
// how many stocks each matches at the latest close (counted by the server, one
// strategy after another, so the page itself isn't held up)
export default function PresetCards({ onSelect, activePresetId, onSavePreset, onUpdatePreset, onRenamePreset, onDuplicatePreset, layout = "strip", meta = null, onCount = null, theme = "dark" }) {
  const stacked = layout === "stack";
  const grid = layout === "grid";
  const [counts, setCounts] = useState({});
  const [tops, setTops] = useState({});
  const [kind, setKind] = useState(() => { const k = kindOnOpen; kindOnOpen = "all"; return k; });
  const [query, setQuery] = useState("");
  const [presets, setPresets] = useState([]);
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);
  const [menuOpen, setMenuOpen] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    api.presets().then(setPresets).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setCustomPresets(loadCustomPresets());
    window.addEventListener("customPresetsUpdated", handler);
    return () => window.removeEventListener("customPresetsUpdated", handler);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  const deleteCustom = (e, id) => {
    e.stopPropagation();
    const next = customPresets.filter(p => p.id !== id);
    strategiesStore.set(next);
    setCustomPresets(next);
    setMenuOpen(null);
  };

  const startRename = (e, p) => {
    e.stopPropagation();
    setRenaming(p.id);
    setRenameValue(p.name);
    setMenuOpen(null);
  };

  const commitRename = (id) => {
    const name = renameValue.trim();
    if (name && onRenamePreset) onRenamePreset(id, name);
    setRenaming(null);
  };

  const allPresets = [...presets, ...customPresets];

  useEffect(() => { if (presets.length) onCount?.(presets.length + customPresets.length); }, [presets.length, customPresets.length, onCount]);

  const countKey = grid || stacked ? JSON.stringify(allPresets.map(p => [p.id, p.filters])) : null;
  useEffect(() => {
    if (!(grid || stacked) || !allPresets.length) return;
    let stop = false;
    (async () => {
      for (const p of allPresets) {
        if (stop) return;
        if (!Array.isArray(p.filters)) continue;
        try {
          const res = await api.screen({ filters: p.filters, countOnly: true, top: grid ? 5 : 0 });
          if (!stop) { setCounts(c => ({ ...c, [p.id]: res.matched })); if (res.top) setTops(t => ({ ...t, [p.id]: res.top })); }
        } catch { /* the card just goes without a count */ }
      }
    })();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countKey]);

  useAdFeed(stacked ? "strategies" : null, theme, "medium");

  if (stacked) {
    const kinds = [["all", "All"], ...KINDS, ...(customPresets.length ? [["yours", "Yours"]] : [])]
      .filter(([id]) => id === "all" || allPresets.some(p => kindOf(p)[0] === id));
    const q = query.trim().toLowerCase();
    const shown = allPresets
      .filter(p => kind === "all" || kindOf(p)[0] === kind)
      .filter(p => !q || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q));
    return (
      <div className="ph-strategies">
        <label className="ph-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" placeholder="Search strategies" value={query} onChange={e => setQuery(e.target.value)}
            aria-label="Search strategies" enterKeyHint="search" autoComplete="off" />
        </label>
        <div className="ph-chips" role="group" aria-label="Show strategies of one kind">
          {kinds.map(([id, label]) => (
            <button key={id} type="button" className="ph-chip" aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>
          ))}
        </div>
        <p className="ph-count">{allPresets.length ? `${shown.length} ${shown.length === 1 ? "strategy" : "strategies"}` : "\u00a0"}</p>
        {!allPresets.length && [0, 1, 2].map(i => <div key={i} className="ph-card ph-card-skel skeleton-pulse" aria-hidden="true" />)}
        {allPresets.length > 0 && !shown.length && (
          <p className="ph-empty">No strategy matches “{query.trim()}”.</p>
        )}
        {shown.map((p, i) => {
          const count = counts[p.id];
          const rules = presetRules(p, meta);
          const ad = i + 1 === AD_FIRST || (i + 1 > AD_FIRST && (i + 1 - AD_FIRST) % AD_EVERY === 0);
          return (
            <div key={p.id} className="ph-card-wrap">
              <button type="button" className="ph-card" aria-pressed={p.id === activePresetId} onClick={() => onSelect(p)} style={{ "--hue": hueOf(p) }}>
                <span className="ph-card-top">
                  <span className="ph-mark" aria-hidden="true"><StrategyMark preset={p} size={26} /></span>
                  <span className="ph-card-text">
                    <span className="ph-card-name">{p.name}</span>
                    <span className="ph-card-about">{p.description}</span>
                  </span>
                </span>
                {rules.length > 0 && (
                  <span className="ph-rules">
                    {rules.slice(0, PHONE_RULES).map(r => <span key={r} className="ph-rule">{r}</span>)}
                    {rules.length > PHONE_RULES && <span className="ph-rule ph-rule-more">+{rules.length - PHONE_RULES}</span>}
                  </span>
                )}
                <span className="ph-card-foot">
                  <span className="ph-card-count">
                    {count == null ? <span className="sc-skel" style={{ width: 44 }} aria-hidden="true" /> : <><b>{count.toLocaleString("en-IN")}</b> {count === 1 ? "stock" : "stocks"} today</>}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </span>
              </button>
              {p.custom && (
                <button type="button" className="ph-card-menu" onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                  aria-label={`${p.name} strategy options`} aria-expanded={menuOpen === p.id}><Ellipsis size={18} /></button>
              )}
              {p.custom && menuOpen === p.id && (
                <div role="group" aria-label={`${p.name} strategy options`} className="ph-card-options" onClick={e => e.stopPropagation()}>
                  <button type="button" onClick={e => startRename(e, p)}>Rename</button>
                  <button type="button" onClick={e => { e.stopPropagation(); onDuplicatePreset?.(p); setMenuOpen(null); }}>Duplicate</button>
                  <button type="button" className="danger" onClick={e => deleteCustom(e, p.id)}>Delete</button>
                </div>
              )}
              {p.custom && renaming === p.id && (
                <div className="ph-card-rename" onClick={e => e.stopPropagation()}>
                  <input autoFocus aria-label={`Rename ${p.name}`} value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(p.id); if (e.key === "Escape") setRenaming(null); }} onBlur={() => commitRename(p.id)} />
                </div>
              )}
              {ad && <AdCard feed="strategies" slot={`strategies-after-${p.id}`} size="medium" />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    // stacked: phones' strategy list (index.css .preset-stack), one under another
    <div className={`preset-strip${stacked ? " preset-stack" : grid ? " preset-grid" : ""}`} style={{ marginBottom: layout === "strip" ? 24 : 0, position: "relative" }}>
      {grid && allPresets.length > 0 && (
        <div className="sc-kinds" role="group" aria-label="Show strategies of one kind">
          {[["all", "All"], ...KINDS, ...(customPresets.length ? [["yours", "Yours"]] : [])].map(([id, label]) => {
            const n = id === "all" ? allPresets.length : allPresets.filter(p => kindOf(p)[0] === id).length;
            return n > 0 && (
              <button key={id} type="button" className="sc-kind" aria-pressed={kind === id} onClick={() => setKind(id)}>
                {label} <span>{n}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="preset-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none", maskImage: "linear-gradient(to right, transparent 0, black 0, black calc(100% - 48px), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0, black 0, black calc(100% - 48px), transparent 100%)" }}>
        <style>{`.preset-scroll::-webkit-scrollbar{display:none}`}</style>

        {(grid && kind !== "all" ? allPresets.filter(p => kindOf(p)[0] === kind) : allPresets).map((p, shownIndex) => {
          const active = p.id === activePresetId;
          const isCustom = !!p.custom;

          const count = counts[p.id];
          return (
            <div key={p.id} className="preset-card-wrap" style={{ position: "relative", flexShrink: 0 }}>
              {grid ? (
                <StrategyCard p={p} kind={kindOf(p)[1]} count={count} top={tops[p.id]} featured={shownIndex === 0}
                  index={shownIndex} active={active} onSelect={onSelect} hue={hueOf(p)} />
              ) : (
              <button
                type="button"
                onClick={() => onSelect(p)}
                title={p.description}
                className="preset-card glow"
                aria-pressed={active}
                style={{
                  "--hue": hueOf(p),
                  flexShrink: 0,
                  width: 156,
                  padding: "14px 14px 13px",
                  borderRadius: 12,
                  border: active ? "1px solid var(--accent)" : "1px solid var(--bdr2)",
                  background: active ? tint(5) : "var(--s2)",
                  cursor: "pointer",
                  textAlign: "left",
                  position: "relative",
                  transition: "background 150ms, border-color 150ms, box-shadow 150ms",
                  boxShadow: active ? `0 0 0 3px ${tint(12)}` : "var(--sh-xs)",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = "var(--bdr3)"; e.currentTarget.style.boxShadow = "var(--sh-sm)"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = "var(--bdr2)"; e.currentTarget.style.boxShadow = "var(--sh-xs)"; } }}
              >
                <span className="preset-icon" style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: active ? tint(14) : "var(--s3)",
                  color: active ? "var(--accent)" : "var(--t2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 11,
                  transition: "background 150ms, color 150ms",
                }}>
                  {stacked ? <StrategyMark preset={p} size={22} /> : <PresetIcon preset={p} size={16} strokeWidth={2} />}
                </span>

                <span style={{
                  display: "block",
                  fontSize: 13, fontWeight: 600,
                  color: "var(--t1)",
                  marginBottom: 4, letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                }}>
                  {p.name}
                </span>

                <span className="preset-desc" style={{ fontSize: 11.5, color: "var(--t3)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {p.description}
                </span>
                {/* A phone's list: how many match, by the arrow */}
                {stacked && (
                  <span className="preset-count">
                    {count == null ? <span className="sc-skel" style={{ width: 28 }} aria-hidden="true" /> : <><b>{count.toLocaleString("en-IN")}</b> stocks</>}
                  </span>
                )}
              </button>
              )}

              {isCustom && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                  aria-label={`${p.name} strategy options`}
                  aria-expanded={menuOpen === p.id}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    color: "var(--t3)", cursor: "pointer",
                    padding: 2, borderRadius: 4, lineHeight: 0,
                    background: "var(--s2)", border: "1px solid var(--bdr2)",
                  }}
                ><Ellipsis size={16} /></button>
              )}
              {isCustom && menuOpen === p.id && (
                <div role="group" aria-label={`${p.name} strategy options`} onClick={e => e.stopPropagation()} style={{
                  position: "absolute", top: 32, right: 4, zIndex: 50,
                  background: "var(--s3)", border: "1px solid var(--bdr2)",
                  borderRadius: 10, padding: 4, minWidth: 150,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}>
                  {[
                    { label: "Rename", action: e => startRename(e, p) },
                    { label: "Update with current", action: e => { e.stopPropagation(); if (onUpdatePreset) onUpdatePreset(p.id); setMenuOpen(null); } },
                    { label: "Duplicate", action: e => { e.stopPropagation(); if (onDuplicatePreset) onDuplicatePreset(p); setMenuOpen(null); } },
                    { label: "Delete", action: e => deleteCustom(e, p.id), color: "var(--red)" },
                  ].map(item => (
                    <button key={item.label} type="button" onClick={item.action} style={{
                      display: "block", width: "100%", padding: "7px 12px", fontSize: 12,
                      textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                      color: item.color || "var(--t2)", border: 0, background: "transparent", borderRadius: 6,
                      transition: "background 100ms",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--s4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >{item.label}</button>
                  ))}
                </div>
              )}

              {isCustom && renaming === p.id && (
                <div onClick={e => e.stopPropagation()} style={{ position: "absolute", inset: 0, background: "var(--s2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
                  <input
                    autoFocus
                    aria-label={`Rename ${p.name}`}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(p.id); if (e.key === "Escape") setRenaming(null); }}
                    onBlur={() => commitRename(p.id)}
                    style={{
                      width: "100%", height: 32, padding: "6px 10px", borderRadius: 8,
                      border: "1px solid var(--accent)", background: "var(--s1)",
                      color: "var(--t1)", fontSize: 12, outline: "none",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {onSavePreset && (
          <button className="preset-card preset-save"
            onClick={onSavePreset}
            style={{
              flexShrink: 0, width: 120,
              padding: "14px 14px 12px", borderRadius: 12,
              border: "1px dashed var(--bdr3)",
              background: "transparent",
              cursor: "pointer",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 150ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--s2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: "var(--s3)", border: "1px solid var(--bdr2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--t3)",
            }}><Plus size={16} /></span>
            <span style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", lineHeight: 1.3 }}>Save as<br />preset</span>
          </button>
        )}
      </div>
    </div>
  );
}
