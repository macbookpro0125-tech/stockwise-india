import { useState, useEffect } from "react";
import { Plus, Ellipsis } from "lucide-react";
import { api } from "./api.js";
import { PresetIcon } from "./icons.jsx";
import { strategiesStore } from "./accountData.js";

// Ported from stock-screener's src/components/PresetCards.jsx. The strategy
// list comes from the server (the same 13 presets); the user's own are saved to
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
    <div style={{ marginBottom: 24, position: "relative" }}>
      <div className="preset-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none", maskImage: "linear-gradient(to right, transparent 0, black 0, black calc(100% - 48px), transparent 100%)", WebkitMaskImage: "linear-gradient(to right, transparent 0, black 0, black calc(100% - 48px), transparent 100%)" }}>
        <style>{`.preset-scroll::-webkit-scrollbar{display:none}`}</style>

        {allPresets.map(p => {
          const active = p.id === activePresetId;
          const isCustom = !!p.custom;

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              title={p.description}
              style={{
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
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: active ? tint(14) : "var(--s3)",
                color: active ? "var(--accent)" : "var(--t2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 11,
                transition: "background 150ms, color 150ms",
              }}>
                <PresetIcon preset={p} size={16} strokeWidth={2} />
              </div>

              <div style={{
                fontSize: 13, fontWeight: 600,
                color: "var(--t1)",
                marginBottom: 4, letterSpacing: "-0.01em",
                lineHeight: 1.3,
              }}>
                {p.name}
              </div>

              <div style={{ fontSize: 11.5, color: "var(--t3)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.description}
              </div>

              {isCustom && (
                <span
                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                  role="button"
                  tabIndex={0}
                  aria-label="Strategy options"
                  style={{
                    position: "absolute", top: 8, right: 8,
                    color: "var(--t3)", cursor: "pointer",
                    padding: 2, borderRadius: 4,
                    lineHeight: 0,
                  }}
                ><Ellipsis size={16} /></span>
              )}
              {isCustom && menuOpen === p.id && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: "absolute", top: 24, right: 4, zIndex: 50,
                  background: "var(--s3)", border: "1px solid var(--bdr2)",
                  borderRadius: 10, padding: 4, minWidth: 130,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}>
                  {[
                    { label: "Rename", action: e => startRename(e, p) },
                    { label: "Update with current", action: e => { e.stopPropagation(); if (onUpdatePreset) onUpdatePreset(p.id); setMenuOpen(null); } },
                    { label: "Duplicate", action: e => { e.stopPropagation(); if (onDuplicatePreset) onDuplicatePreset(p); setMenuOpen(null); } },
                    { label: "Delete", action: e => deleteCustom(e, p.id), color: "var(--red)" },
                  ].map(item => (
                    <div key={item.label} onClick={item.action} style={{
                      padding: "7px 12px", fontSize: 12, cursor: "pointer",
                      color: item.color || "var(--t2)", borderRadius: 6,
                      transition: "background 100ms",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--s4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >{item.label}</div>
                  ))}
                </div>
              )}

              {isCustom && renaming === p.id && (
                <div onClick={e => e.stopPropagation()} style={{ position: "absolute", inset: 0, background: "var(--s2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
                  <input
                    autoFocus
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
            </button>
          );
        })}

        {onSavePreset && (
          <button
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
