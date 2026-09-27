import { useState, useEffect } from "react";
import { api } from "./api.js";

// Ported from stock-screener's src/components/PresetCards.jsx. The strategy
// list comes from the server (the same 13 presets); custom presets are saved in
// this browser, as in the original.

const ACCENT_COLORS = [
  "#00E0BE", "#F59E0B", "#818CF8", "#3B82F6",
  "#F43F5E", "#10B981", "#F97316", "#06B6D4",
  "#84CC16", "#EC4899",
];

function loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem("customPresets") || "[]"); } catch { return []; }
}

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
    try { localStorage.setItem("customPresets", JSON.stringify(next)); } catch {}
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

        {allPresets.map((p, i) => {
          const active = p.id === activePresetId;
          const isCustom = !!p.custom;
          const accentColor = isCustom ? "#818CF8" : ACCENT_COLORS[i % ACCENT_COLORS.length];

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              title={p.description}
              style={{
                flexShrink: 0,
                width: 148,
                padding: "14px 14px 12px",
                borderRadius: 14,
                border: active ? `1.5px solid ${accentColor}40` : "1px solid var(--bdr2)",
                background: active ? `${accentColor}0D` : "var(--s2)",
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
                transition: "all 150ms",
                boxShadow: active ? `0 0 0 1px ${accentColor}30, 0 4px 20px ${accentColor}15` : "none",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--s3)"; e.currentTarget.style.borderColor = "var(--bdr3)"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "var(--s2)"; e.currentTarget.style.borderColor = "var(--bdr2)"; } }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `${accentColor}18`,
                border: `1px solid ${accentColor}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, marginBottom: 10,
              }}>
                {p.icon}
              </div>

              <div style={{
                fontSize: 12, fontWeight: 600,
                color: active ? accentColor : "var(--t1)",
                marginBottom: 3, letterSpacing: "-0.01em",
                lineHeight: 1.3,
                transition: "color 150ms",
              }}>
                {p.name}
              </div>

              <div style={{ fontSize: 10.5, color: "var(--t3)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {p.description}
              </div>

              {active && (
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  width: 6, height: 6, borderRadius: "50%",
                  background: accentColor,
                  boxShadow: `0 0 6px ${accentColor}`,
                }} />
              )}

              {isCustom && (
                <span
                  onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id); }}
                  role="button"
                  tabIndex={0}
                  style={{
                    position: "absolute", top: 6, right: 6,
                    color: "var(--t3)", cursor: "pointer",
                    fontSize: 14, padding: "2px 6px", borderRadius: 4,
                    lineHeight: 1,
                  }}
                >⋯</span>
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
              padding: "14px 14px 12px", borderRadius: 14,
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
              fontSize: 16, color: "var(--t3)",
            }}>+</span>
            <span style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", lineHeight: 1.3 }}>Save as<br />preset</span>
          </button>
        )}
      </div>
    </div>
  );
}
