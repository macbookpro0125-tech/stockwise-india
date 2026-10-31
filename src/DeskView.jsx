import { useEffect, useState } from "react";
import { api } from "./api.js";
import { strategiesStore } from "./accountData.js";
import { DESK_COLUMNS } from "./screenShortcuts.js";
import ScreenDesk from "./ScreenDesk.jsx";

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
      {error
        ? <div className="desk-empty" role="alert">{error}</div>
        : <ScreenDesk rows={res?.results ?? []} loading={!res} onOpenStock={onOpenStock}
            empty={source === WATCH ? "Your watchlist is empty. Star a company to add it." : undefined} />}
    </section>
  );
}
