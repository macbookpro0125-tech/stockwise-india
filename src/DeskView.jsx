import { useEffect, useState } from "react";
import { api } from "./api.js";
import { strategiesStore } from "./accountData.js";
import { DESK_COLUMNS } from "./screenShortcuts.js";
import ScreenDesk from "./ScreenDesk.jsx";
import MyDesk from "./MyDesk.jsx";

// The Desk, a page of its own (31 Oct 2026, "I want it separate page"): pick
// a list — every NSE company, a ready-made screen, one of your own or your
// watchlist — and walk it with the chart and the company beside it
// (ScreenDesk.jsx). A computer's; a phone has no room for three panes.

const ALL = "all", WATCH = "watch";
const read = () => { try { return localStorage.getItem("deskSource") || ALL; } catch { return ALL; } };

export default function DeskView({ onOpenStock }) {
  const [source, setSource] = useState(read);
  const [presets, setPresets] = useState([]);
  const [mine, setMine] = useState(() => strategiesStore.get());
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [market, setMarket] = useState(null);
  // the Desk as it comes, or the cards you arranged yourself
  const [mode, setMode] = useState(() => { try { return localStorage.getItem("deskMode") === "mine" ? "mine" : "desk"; } catch { return "desk"; } });
  useEffect(() => { try { localStorage.setItem("deskMode", mode); } catch {} }, [mode]);
  useEffect(() => { api.deskMarket().then(setMarket).catch(() => {}); }, []);

  useEffect(() => { try { localStorage.setItem("deskSource", source); } catch {} }, [source]);
  useEffect(() => { api.presets().then(l => setPresets(Array.isArray(l) ? l : [])).catch(() => {}); }, []);
  useEffect(() => {
    const fn = () => setMine(strategiesStore.get());
    window.addEventListener("customPresetsUpdated", fn);
    if (!strategiesStore.get().length) strategiesStore.load();
    return () => window.removeEventListener("customPresetsUpdated", fn);
  }, []);

  // the list picked, as a screen with the desk's figures
  useEffect(() => {
    let off = false;
    setRes(null); setError("");
    const run = async () => {
      if (source === ALL) return api.screen({ filters: [], columns: DESK_COLUMNS });
      if (source === WATCH) {
        const w = await api.watchlist();
        const symbols = (w.items ?? []).map(i => i.ticker);
        return symbols.length ? api.screen({ filters: [{ id: "symbols", values: symbols }], columns: DESK_COLUMNS }) : { results: [] };
      }
      const [kind, id] = source.split(":");
      const p = (kind === "mine" ? mine : presets).find(x => String(x.id) === id);
      if (!p) return null; // still loading the lists
      return api.screen(Array.isArray(p.filters) ? { filters: p.filters, columns: DESK_COLUMNS } : { ...p.criteria, columns: DESK_COLUMNS });
    };
    run().then(r => { if (!off && r) setRes(r); }).catch(e => { if (!off) setError(e?.message || "The list didn't load."); });
    return () => { off = true; };
  }, [source, presets.length, mine.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="desk-page" aria-label="Desk">
      <div className="desk-page-top">
        <h1>Desk</h1>
        <div className="desk-mode" role="group" aria-label="Desk layout">
          <button type="button" aria-pressed={mode === "desk"} onClick={() => setMode("desk")}>Desk</button>
          <button type="button" aria-pressed={mode === "mine"} onClick={() => setMode("mine")}>My desk</button>
        </div>
        <label className="desk-source">
          <span>List</span>
          <select value={source} onChange={e => setSource(e.target.value)}>
            <option value={ALL}>Every NSE company</option>
            <option value={WATCH}>Your watchlist</option>
            {mine.length > 0 && <optgroup label="Your screens">{mine.map(p => <option key={p.id} value={`mine:${p.id}`}>{p.name}</option>)}</optgroup>}
            {presets.length > 0 && <optgroup label="Ready-made screens">{presets.map(p => <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>)}</optgroup>}
          </select>
        </label>
      </div>
      {mode === "desk" && <MoodBar market={market} />}
      {error
        ? <div className="desk-empty" role="alert">{error}</div>
        : mode === "mine"
        ? <MyDesk rows={res?.results ?? []} market={market} onOpenStock={onOpenStock} MoodBar={MoodBar} />
        : <ScreenDesk rows={res?.results ?? []} loading={!res} onOpenStock={onOpenStock}
            empty={source === WATCH ? "Your watchlist is empty. Star a company to add it." : undefined} market={market} />}
    </section>
  );
}

// How the whole market stands: every company trading ₹1 crore a day or more,
// by the stage of its trend, and how many are over their 50- and 200-day
// averages. The word is from the 200-day share alone: 60% or more strong,
// under 40% weak, mixed between.
const STAGE_TONE = { advancing: "var(--green)", topping: "var(--yellow)", declining: "var(--red)", basing: "var(--brand-wise)" };
export function MoodBar({ market }) {
  if (!market) return <div className="mood mood-loading" role="status" aria-label="Loading the market's mood" />;
  if (!market.liquid) return null;
  const a200 = market.above200 ?? 0;
  const word = a200 >= 60 ? "Strong" : a200 < 40 ? "Weak" : "Mixed";
  const day = market.date ? new Date(`${market.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
  return (
    <section className="mood" aria-label="Market mood">
      <div className="mood-top">
        <span className={`mood-word ${word.toLowerCase()}`} title="From the share of companies over their 200-day average: 60% or more strong, under 40% weak">Market: {word}</span>
        {market.stageInfo.map(s => (
          <span key={s.id} className="mood-stage" title={s.about}>
            <i style={{ background: STAGE_TONE[s.id] }} />{s.label} <b>{market.stages[s.id].toLocaleString("en-IN")}</b>
            <small>{Math.round((market.stages[s.id] / market.liquid) * 100)}%</small>
          </span>
        ))}
        <span className="mood-meta">{Math.round(market.above50)}% over their 50-day · {Math.round(a200)}% over their 200-day · {market.liquid.toLocaleString("en-IN")} companies trading ₹{market.liquidCr} crore a day or more · close {day}</span>
      </div>
      <div className="mood-bar" aria-hidden="true">
        {market.stageInfo.map(s => <i key={s.id} style={{ flexGrow: market.stages[s.id], background: STAGE_TONE[s.id] }} />)}
      </div>
    </section>
  );
}
