import { useState } from "react";
import { Layers, ArrowRight, SlidersHorizontal, PencilLine } from "lucide-react";
import { fmtRs, levelsFromFairValue, LEVEL_LIMITS, DEFAULT_LEVEL_SETTINGS } from "../server/levels.js";
import { useMyLevels, saveLevelSettings, setStockLevels, clearStockLevels } from "./myLevels.js";

// The Valuation tab's price levels — the user's own (myLevels.js): off until
// they turn them on, from four numbers they choose (the app's old formula is
// only the starting point), or typed by hand for this one stock. The same
// levels then show on the chart, watchlist, portfolio, Discover, compare,
// export, alerts and the position worksheet.

const card = { border: "1px solid var(--bdr2)", borderRadius: 12, padding: 18, marginBottom: 12, background: "var(--s2)", boxShadow: "var(--sh-xs)" };
const input = { width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--bdr2)", borderRadius: 8, fontSize: 13.5, outline: "none", background: "var(--s1)", color: "var(--t1)", boxSizing: "border-box", fontFamily: "inherit", fontVariantNumeric: "tabular-nums" };
const label = { fontSize: 11.5, color: "var(--t2)", marginBottom: 5, display: "block", fontWeight: 500 };
const note = { fontSize: 12, color: "var(--t2)", margin: "0 0 12px", lineHeight: 1.55 };

const SETTINGS = [
  ["mos", "Margin of safety", "Level 1, this far under today's fair value"],
  ["step", "Gap between levels", "Level 2 one gap under level 1, level 3 two"],
  ["stop", "Stop under level 3", "Your stop, this far under level 3"],
  ["upper", "Upper over the 2-year value", "Your upper level, this far over it"],
];
const HAND = [["target", "Upper level"], ["p1", "Level 1"], ["p2", "Level 2"], ["p3", "Level 3"], ["stopLoss", "Stop"]];

export default function MyLevelsCard({ symbol, fv, levels, price, priceLabel, fv2Label = "2-year" }) {
  const mine = useMyLevels();
  const { settings } = mine;
  const own = !!mine.stocks[symbol];
  const [mode, setMode] = useState(null); // null | "settings" | "hand"
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = next => {
    setError("");
    if (next === "settings") setDraft(Object.fromEntries(Object.keys(LEVEL_LIMITS).map(k => [k, String(settings[k] ?? DEFAULT_LEVEL_SETTINGS[k])])));
    if (next === "hand") {
      const start = levels ?? levelsFromFairValue(fv, settings) ?? {};
      setDraft(Object.fromEntries(HAND.map(([k]) => [k, start[k] > 0 ? String(start[k]) : ""])));
    }
    setMode(next);
  };
  const run = async fn => {
    setBusy(true); setError("");
    try { await fn(); setMode(null); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const below = v => (fv?.fv25 > 0 && v > 0 ? `${Math.abs(Math.round((1 - v / fv.fv25) * 100))}% ${v <= fv.fv25 ? "under" : "over"} today's FV` : "");
  const over2y = v => (fv?.fv27 > 0 && v > 0 ? `${Math.abs(Math.round((v / fv.fv27 - 1) * 100))}% ${v >= fv.fv27 ? "over" : "under"} the ${fv2Label} FV` : "");
  const preview = mode === "settings" ? levelsFromFairValue(fv, draft) : null;

  const buttons = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {fv && <button type="button" className={levels || settings.enabled ? "btn-ghost" : "btn-primary"} style={{ height: 32, fontSize: 12.5 }} onClick={() => open("settings")}>
        <SlidersHorizontal size={14} /> {settings.enabled ? "Change my settings" : "Turn on my levels"}
      </button>}
      <button type="button" className="btn-ghost" style={{ height: 32, fontSize: 12.5 }} onClick={() => open("hand")}><PencilLine size={14} /> {own ? "Edit this stock's levels" : "Set this stock by hand"}</button>
      {own && <button type="button" className="btn-ghost" style={{ height: 32, fontSize: 12.5 }} disabled={busy} onClick={() => run(() => clearStockLevels(symbol))}>{settings.enabled && fv ? "Use my settings instead" : "Clear this stock's levels"}</button>}
    </div>
  );

  return (
    <div style={card} data-tour="levels">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <Layers size={16} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 14, fontWeight: 450, color: "var(--t1)" }}>Your price levels</span>
        {levels && <span style={{ fontSize: 11, color: "var(--t3)" }}>{own ? "· set by hand" : `· ${settings.mos}% margin · ${settings.step}% gaps · stop ${settings.stop}% · upper ${settings.upper}%`}</span>}
      </div>

      {mode === "settings" ? (
        <>
          <p style={note}>Your numbers, used for every stock with a fair value. The boxes start at the formula the app used before; change any of them.</p>
          <div className="ss-grid-4">
            {SETTINGS.map(([k, name, hint]) => (
              <label key={k} style={{ display: "block", minWidth: 0 }}>
                <span style={label}>{name} %</span>
                <input type="number" inputMode="decimal" min={LEVEL_LIMITS[k][0]} max={LEVEL_LIMITS[k][1]} step="0.5" aria-label={`${name} %`} value={draft[k] ?? ""} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} style={input} />
                <span style={{ display: "block", fontSize: 10.5, color: "var(--t3)", marginTop: 3 }}>{hint} ({LEVEL_LIMITS[k][0]}–{LEVEL_LIMITS[k][1]}%)</span>
              </label>
            ))}
          </div>
          {preview && (
            <p style={{ fontSize: 11.5, color: "var(--t3)", margin: "10px 0 0", fontVariantNumeric: "tabular-nums" }}>
              For this stock: upper {fmtRs(preview.target)} · level 1 {fmtRs(preview.p1)} · level 2 {fmtRs(preview.p2)} · level 3 {fmtRs(preview.p3)} · stop {fmtRs(preview.stopLoss)}
            </p>
          )}
          {error && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: "8px 0 0" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" className="btn-primary" style={{ height: 32, fontSize: 12.5 }} disabled={busy} onClick={() => run(() => saveLevelSettings({ ...draft, enabled: true }))}>{settings.enabled ? "Save" : "Save and turn on"}</button>
            {settings.enabled && <button type="button" className="btn-ghost" style={{ height: 32, fontSize: 12.5 }} disabled={busy} onClick={() => run(() => saveLevelSettings({ ...settings, enabled: false }))}>Turn off my levels</button>}
            <button type="button" className="btn-ghost" style={{ height: 32, fontSize: 12.5 }} disabled={busy} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </>
      ) : mode === "hand" ? (
        <>
          <p style={note}>Your own five prices for {symbol}, in order from the top. They replace your settings for this stock only.</p>
          <div className="ss-grid-fv" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
            {HAND.map(([k, name]) => (
              <label key={k} style={{ display: "block", minWidth: 0 }}>
                <span style={label}>{name} (₹)</span>
                <input type="number" inputMode="decimal" min="0" step="any" aria-label={`${name} price`} value={draft[k] ?? ""} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} style={input} />
              </label>
            ))}
          </div>
          {error && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: "8px 0 0" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" className="btn-primary" style={{ height: 32, fontSize: 12.5 }} disabled={busy} onClick={() => run(() => setStockLevels(symbol, Object.fromEntries(HAND.map(([k]) => [k, Number(draft[k])]))))}>Save</button>
            <button type="button" className="btn-ghost" style={{ height: 32, fontSize: 12.5 }} disabled={busy} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </>
      ) : levels ? (
        <>
          {[
            { label: `Your upper level · ${over2y(levels.target)}`, price: levels.target, color: "var(--red)" },
            { label: `Your level 1 · ${below(levels.p1)}`, price: levels.p1, color: "var(--accent)" },
            { label: `Your level 2 · ${below(levels.p2)}`, price: levels.p2, color: "var(--accent)" },
            { label: `Your level 3 · ${below(levels.p3)}`, price: levels.p3, color: "var(--accent)" },
            { label: `Your stop · ${below(levels.stopLoss)}`, price: levels.stopLoss, color: "var(--red)" },
          ].filter(r => r.price > 0).sort((a, b) => b.price - a.price).map(rung => {
            const isHere = price > 0 && Math.abs(price - rung.price) / rung.price < 0.03;
            return (
              <div key={rung.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderRadius: 6, marginBottom: 4, fontSize: 13, background: isHere ? "var(--yellow-dim)" : "transparent", border: isHere ? "1px dashed var(--yellow)" : "1px solid var(--bdr)" }}>
                {/* On the amber "you are here" tint, plain red is 4.1:1 in dark;
                    blending toward --t1 keeps it red and clears 4.5:1 in both themes */}
                <span style={{ color: isHere && rung.color === "var(--red)" ? "color-mix(in srgb, var(--red) 80%, var(--t1))" : rung.color, fontWeight: 500 }}>{rung.label.replace(/ · $/, "")}</span>
                <span style={{ fontWeight: 400, color: "var(--t1)" }}>{fmtRs(rung.price)}</span>
              </div>
            );
          })}
          {price > 0 && (
            <div style={{ borderTop: "2px solid var(--accent)", margin: "10px 0 0", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 400 }}>
              <span style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}><ArrowRight size={16} strokeWidth={2.2} /> {priceLabel || "Your price"}</span>
              <span style={{ color: "var(--accent)" }}>{fmtRs(price)}</span>
            </div>
          )}
          {buttons}
        </>
      ) : (
        <>
          <p style={{ ...note, margin: 0 }}>
            {fv
              ? <>Price levels are off. The app doesn't set levels for you: choose your own margin of safety under today's fair value ({fmtRs(fv.fv25)}), the gap between levels, your stop and your upper level, and your levels show on the chart, watchlist, portfolio, alerts and the position worksheet. Or type this stock's levels by hand.</>
              : <>There's no fair value for this company, so your settings can't make levels for it. You can type its levels by hand.</>}
          </p>
          {buttons}
        </>
      )}
    </div>
  );
}
