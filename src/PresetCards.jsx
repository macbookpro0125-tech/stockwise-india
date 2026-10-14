import { useState, useEffect } from "react";
import { Plus, Ellipsis } from "lucide-react";
import { api } from "./api.js";
import { strategiesStore } from "./accountData.js";

// Ported from stock-screener's src/components/PresetCards.jsx. The strategy
// list comes from the server (the original 13 presets and Up on Every Timeframe); the user's own are saved to
// their account (accountData.js) — the original kept them in the browser. This app: one accent and a line icon per
// card, rather than the original's ten rotating colours and emoji.

const tint = pct => `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;

const loadCustomPresets = () => strategiesStore.get();

export default function PresetCards({ onSelect, activePresetId, onSavePreset, onUpdatePreset, onRenamePreset, onDuplicatePreset }) {
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

  return (
    <div className="preset-strip" style={{ marginBottom: 24, position: "relative" }}>
      <div className="preset-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none", maskImage: "linear-gradient(to right, transparent 0, black 0, black calc(100% - 48px), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0, black 0, black calc(100% - 48px), transparent 100%)" }}>
        <style>{`.preset-scroll::-webkit-scrollbar{display:none}`}</style>

        {allPresets.map(p => {
          const active = p.id === activePresetId;
          const isCustom = !!p.custom;

          return (
            <div key={p.id} className="preset-card-wrap" style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                title={p.description}
                className="preset-card"
                aria-pressed={active}
                style={{
                  flexShrink: 0,
                  // Flat tiles, as TradingView lists screener presets: name and
                  // a two-line note, the chosen one outlined; no icon, no glow
                  width: 172,
                  padding: "10px 12px",
                  borderRadius: 4,
                  border: active ? "1px solid var(--accent)" : "1px solid var(--bdr)",
                  background: active ? tint(8) : "var(--s2)",
                  cursor: "pointer",
                  textAlign: "left",
                  position: "relative",
                  transition: "background 120ms, border-color 120ms",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--s3)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--s2)"; }}
              >
                <span style={{
                  display: "block",
                  fontSize: 13, fontWeight: 600,
                  color: active ? "var(--accent)" : "var(--t1)",
                  marginBottom: 3,
                  lineHeight: 1.3,
                }}>
                  {p.name}
                </span>

                <span className="preset-desc" style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {p.description}
                </span>
              </button>

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
                  borderRadius: 4, padding: 4, minWidth: 150,
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
                      color: item.color || "var(--t2)", border: 0, background: "transparent", borderRadius: 4,
                      transition: "background 100ms",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--s4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >{item.label}</button>
                  ))}
                </div>
              )}

              {isCustom && renaming === p.id && (
                <div onClick={e => e.stopPropagation()} style={{ position: "absolute", inset: 0, background: "var(--s2)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
                  <input
                    autoFocus
                    aria-label={`Rename ${p.name}`}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(p.id); if (e.key === "Escape") setRenaming(null); }}
                    onBlur={() => commitRename(p.id)}
                    style={{
                      width: "100%", height: 32, padding: "6px 10px", borderRadius: 4,
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
              flexShrink: 0,
              padding: "0 14px", borderRadius: 4,
              border: "1px dashed var(--bdr3)",
              background: "transparent",
              cursor: "pointer", color: "var(--t2)", fontSize: 12, fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              transition: "background 120ms",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--s3)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <Plus size={14} aria-hidden="true" />Save as preset
          </button>
        )}
      </div>
    </div>
  );
}
