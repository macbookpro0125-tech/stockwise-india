import { useEffect, useState } from "react";
import { api } from "./api.js";
import { strategiesStore } from "./accountData.js";
import { DESK_COLUMNS } from "./screenShortcuts.js";
import ScreenDesk from "./ScreenDesk.jsx";
import MyDesk from "./MyDesk.jsx";
import { MoodBar } from "./MoodBar.jsx";

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
  // whether the lists have come, so a list that's gone (a deleted screen) can be told from one still loading
  const [loaded, setLoaded] = useState({ presets: false, mine: strategiesStore.get().length > 0 });
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const [market, setMarket] = useState(null);
  // the Desk as it comes, or the cards you arranged yourself
  const [mode, setMode] = useState(() => { try { return localStorage.getItem("deskMode") === "mine" ? "mine" : "desk"; } catch { return "desk"; } });
  useEffect(() => { try { localStorage.setItem("deskMode", mode); } catch {} }, [mode]);
  useEffect(() => { api.deskMarket().then(setMarket).catch(() => {}); }, []);

  useEffect(() => { try { localStorage.setItem("deskSource", source); } catch {} }, [source]);
  useEffect(() => { api.presets().then(l => setPresets(Array.isArray(l) ? l : [])).catch(() => {}).finally(() => setLoaded(x => ({ ...x, presets: true }))); }, []);
  useEffect(() => {
    const fn = () => { setMine(strategiesStore.get()); setLoaded(x => ({ ...x, mine: true })); };
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
      if (!p) {
        // a screen that's gone (deleted, or renamed away): back to every company
        if (loaded[kind === "mine" ? "mine" : "presets"]) setSource(ALL);
        return null;
      }
      return api.screen(Array.isArray(p.filters) ? { filters: p.filters, columns: DESK_COLUMNS } : { ...p.criteria, columns: DESK_COLUMNS });
    };
    run().then(r => { if (!off && r) setRes(r); }).catch(e => { if (!off) setError(e?.message || "The list didn't load."); });
    return () => { off = true; };
  }, [source, presets.length, mine.length, loaded.presets, loaded.mine]); // eslint-disable-line react-hooks/exhaustive-deps

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

// the mood bar lives in MoodBar.jsx, shared with the Markets page
export { MoodBar };
