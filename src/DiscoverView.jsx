import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { PanelLeftClose, SlidersHorizontal } from "lucide-react";
import { api } from "./api.js";
import PresetCards from "./PresetCards.jsx";
import ResultsTable from "./ResultsTable.jsx";
import HowItWorks from "./HowItWorks.jsx";
import FilterPanel, { isActiveFilter } from "./screener/FilterPanel.jsx";
import MetricPicker from "./screener/MetricPicker.jsx";
import { useScreenerMeta, DEFAULT_COLUMNS } from "./screener/meta.js";

// The screener: filters in a sidebar beside the results, any of 99 metrics as
// a min–max filter, columns that follow the filters (plus any you add), and
// results that update as a filter changes — the whole market until a filter
// narrows it. The strategies are starting points: pick one and its filters
// appear in the sidebar, ready to change.

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };

// A screen as a link: its filters in the address, ?screen=… (base64url
// JSON), so it can be sent to someone and opens with the same filters
const toB64url = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)));
const compact = f => (f.values ? { id: f.id, values: f.values } : { id: f.id, ...(f.min != null && { min: f.min }), ...(f.max != null && { max: f.max }) });

function screenLink(filters) {
  return `${window.location.origin}/?screen=${toB64url(JSON.stringify(filters.map(compact)))}`;
}

function filtersFromLink() {
  try {
    const p = new URLSearchParams(window.location.search).get("screen");
    if (!p) return null;
    const list = JSON.parse(fromB64url(p));
    if (!Array.isArray(list)) return null;
    return list.filter(f => f && typeof f.id === "string")
      .map(f => (Array.isArray(f.values) ? { id: f.id, values: f.values.filter(v => typeof v === "string") } : { id: f.id, min: Number.isFinite(f.min) ? f.min : null, max: Number.isFinite(f.max) ? f.max : null }));
  } catch {
    return null;
  }
}

function readCustomPresets() { return read("customPresets", []); }
function writeCustomPresets(list) {
  write("customPresets", list);
  window.dispatchEvent(new Event("customPresetsUpdated"));
}

function Modal({ onClose, width = 340, children }) {
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 28, width, maxWidth: "100%", boxShadow: "var(--sh-lg)", animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards" }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function DiscoverView({ onOpenStock }) {
  const { meta, error: metaError, retry: retryMeta } = useScreenerMeta();
  // A shared link wins; else the last screen. null until the first screen
  // says what the old saved criteria became.
  const [filters, setFilters] = useState(() => filtersFromLink() ?? read("screenerFilters", null));
  // The link has done its job once applied — a reload shouldn't undo later changes
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("screen")) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const [columns, setColumns] = useState(() => read("screenerColumns", DEFAULT_COLUMNS));
  const [activePresetId, setActivePresetId] = useState(null);
  const [results, setResults] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [executionTime, setExecutionTime] = useState(null);
  const [picker, setPicker] = useState(null); // "filter" | "column"
  const [sideOpen, setSideOpen] = useState(() => read("screenerSideOpen", true));
  const [sheetOpen, setSheetOpen] = useState(false); // phones: filters in a full-screen sheet
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  useEffect(() => { if (filters) write("screenerFilters", filters); }, [filters]);
  useEffect(() => { write("screenerColumns", columns); }, [columns]);
  useEffect(() => { write("screenerSideOpen", sideOpen); }, [sideOpen]);

  // The table's columns: yours, then any metric you're filtering on
  const shownColumnIds = useMemo(() => {
    const ids = [...columns];
    for (const f of filters ?? []) if (!f.values && !ids.includes(f.id)) ids.push(f.id);
    return ids;
  }, [columns, filters]);
  const shownColumns = useMemo(() => (meta ? shownColumnIds.map(id => meta.byId.get(id)).filter(Boolean) : []), [meta, shownColumnIds]);
  const activeCount = (filters ?? []).filter(isActiveFilter).length;

  // ── Running the screen: debounced, and only the latest answer counts ──
  const latest = useRef(0);
  const run = useCallback(async body => {
    const n = ++latest.current;
    setUpdating(true);
    setError("");
    const started = performance.now();
    try {
      const res = await api.screen(body);
      if (n !== latest.current) return;
      setResults(res);
      setExecutionTime(performance.now() - started);
      return res;
    } catch (e) {
      if (n === latest.current) setError(e.message || "Screen failed");
    } finally {
      if (n === latest.current) setUpdating(false);
    }
  }, []);

  // First visit after the update: the old saved criteria become filters
  useEffect(() => {
    if (filters) return;
    const old = read("discoveryCriteria", null);
    if (!old) { setFilters([]); return; }
    run({ ...old, columns: DEFAULT_COLUMNS }).then(res => setFilters(res?.filters ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // null until the filters are known. Not "(filters ?? [])": on a first visit
  // filters go from null to [], and a key that read the same for both never
  // changed — so the first screen never ran and a new user's Discover sat on
  // its loading rows until a reload.
  const requestKey = filters ? JSON.stringify([filters.filter(isActiveFilter), shownColumnIds]) : null;
  useEffect(() => {
    if (!filters) return;
    const t = setTimeout(() => run({ filters: filters.filter(isActiveFilter), columns: shownColumnIds }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const changeFilters = useCallback(next => { setFilters(next); setActivePresetId(null); }, []);

  const applyPreset = useCallback(async preset => {
    setActivePresetId(preset.id);
    if (Array.isArray(preset.filters)) { setFilters(preset.filters.map(f => ({ ...f }))); return; }
    // Saved before filters existed: the server turns its criteria into filters
    const res = await run({ ...preset.criteria, columns: shownColumnIds });
    if (res?.filters) setFilters(res.filters);
  }, [run, shownColumnIds]);

  // ── The picker adds or removes a filter, or a column ──
  const pickerChosen = useMemo(() => new Set(picker === "filter" ? (filters ?? []).map(f => f.id) : shownColumnIds), [picker, filters, shownColumnIds]);
  // From the latest list each time, not the one this render saw: several
  // quick clicks would otherwise each add to the same old list, and only the
  // last would stick
  const togglePicked = id => {
    if (picker === "filter") {
      setFilters(prev => {
        const list = prev ?? [];
        return list.some(f => f.id === id) ? list.filter(f => f.id !== id) : [...list, id === "sector" ? { id, values: [] } : { id, min: null, max: null }];
      });
      setActivePresetId(null);
    } else {
      setColumns(prev => (prev.includes(id) ? prev.filter(c => c !== id) : (filters ?? []).some(f => f.id === id) ? prev : [...prev, id]));
    }
  };

  // ── Your own strategies (this browser) ──
  const confirmSavePreset = () => {
    const name = savePresetName.trim();
    if (!name) return;
    writeCustomPresets([...readCustomPresets(), {
      id: `custom_${Date.now()}`, name, icon: "📌", custom: true,
      description: `${activeCount} filter${activeCount === 1 ? "" : "s"}`,
      filters: filters.filter(isActiveFilter),
    }]);
    setSavePresetName("");
    setShowSaveModal(false);
  };
  const handleUpdatePreset = id => writeCustomPresets(readCustomPresets().map(p => (p.id === id ? { ...p, filters: filters.filter(isActiveFilter), criteria: undefined, description: `${activeCount} filters` } : p)));
  const handleRenamePreset = (id, name) => writeCustomPresets(readCustomPresets().map(p => (p.id === id ? { ...p, name } : p)));
  const handleDuplicatePreset = p => writeCustomPresets([...readCustomPresets(), { ...p, id: `custom_${Date.now()}`, name: `${p.name} (copy)`, custom: true }]);

  const handleShare = () => {
    navigator.clipboard.writeText(screenLink(filters.filter(isActiveFilter)))
      .then(() => setCopyFeedback("Link copied!"))
      .catch(() => setCopyFeedback("Copy failed"))
      .finally(() => setTimeout(() => setCopyFeedback(""), 2000));
  };
  const handleImport = async () => {
    try {
      // A share link pasted in
      const link = importText.trim().match(/[?&]screen=([A-Za-z0-9_-]+)/);
      if (link) {
        const list = JSON.parse(fromB64url(link[1]));
        if (!Array.isArray(list)) throw new Error("Invalid");
        changeFilters(list.filter(f => f && typeof f.id === "string").map(f => (f.values ? f : { id: f.id, min: f.min ?? null, max: f.max ?? null })));
        setShowImportModal(false); setImportText(""); setImportError("");
        return;
      }
      const parsed = JSON.parse(importText.trim());
      if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid");
      if (Array.isArray(parsed.filters) || Array.isArray(parsed)) {
        changeFilters((Array.isArray(parsed) ? parsed : parsed.filters).filter(f => f && typeof f.id === "string"));
      } else {
        // The older export: criteria, which the server turns into filters
        const res = await run({ ...parsed, columns: shownColumnIds });
        if (!res?.filters) throw new Error("Invalid");
        changeFilters(res.filters);
      }
      setShowImportModal(false);
      setImportText("");
      setImportError("");
    } catch {
      setImportError("That isn't a set of filters exported from this app");
    }
  };

  const panel = meta && filters ? (
    <FilterPanel
      meta={meta}
      filters={filters}
      onChange={changeFilters}
      onAddFilter={() => setPicker("filter")}
      onReset={() => changeFilters([])}
    />
  ) : metaError ? (
    <div style={{ fontSize: 13, color: "var(--red)" }}>
      Couldn't load the filters. <button className="btn-ghost" onClick={retryMeta} style={{ height: 28, fontSize: 12, marginLeft: 6 }}>Try again</button>
    </div>
  ) : (
    <div className="skeleton-pulse" style={{ height: 240, borderRadius: 12 }} />
  );

  const matched = results?.matched;

  return (
    <div className="screener-page" style={{ padding: "24px var(--page-x) 80px" }}>
      {showSaveModal && (
        <Modal onClose={() => setShowSaveModal(false)}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)", marginBottom: 6, letterSpacing: "-0.02em" }}>Save as a strategy</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>{activeCount} filter{activeCount === 1 ? "" : "s"} will be saved in this browser</div>
          <input
            autoFocus type="text" placeholder="e.g. My pharma screen"
            value={savePresetName} onChange={e => setSavePresetName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmSavePreset(); if (e.key === "Escape") setShowSaveModal(false); }}
            className="input-base" style={{ marginBottom: 16, fontSize: 15 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={confirmSavePreset} disabled={!savePresetName.trim()} className="btn-primary" style={{ flex: 1 }}>Save</button>
            <button onClick={() => setShowSaveModal(false)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal onClose={() => { setShowImportModal(false); setImportError(""); }} width={440}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)", marginBottom: 6, letterSpacing: "-0.02em" }}>Import filters</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16 }}>Paste a share link, or filters exported from this app</div>
          <textarea
            autoFocus value={importText}
            onChange={e => { setImportText(e.target.value); setImportError(""); }}
            placeholder="https://…/?screen=…"
            className="mono"
            style={{ width: "100%", height: 140, padding: 12, borderRadius: 10, border: `1px solid ${importError ? "var(--red)" : "var(--bdr2)"}`, background: "var(--s1)", color: "var(--t1)", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />
          {importError && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>{importError}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={handleImport} disabled={!importText.trim()} className="btn-primary" style={{ flex: 1 }}>Apply</button>
            <button onClick={() => { setShowImportModal(false); setImportError(""); }} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          </div>
        </Modal>
      )}

      {picker && meta && (
        <MetricPicker meta={meta} mode={picker} chosen={pickerChosen} onToggle={togglePicked} onClose={() => setPicker(null)} />
      )}

      {/* Phones: the filters open over the page, with the result count on the way back */}
      {sheetOpen && createPortal(
        <div className="filter-sheet">
          <div className="filter-sheet-body">{panel}</div>
          <div className="filter-sheet-foot">
            <button className="btn-primary" onClick={() => { setSheetOpen(false); window.scrollTo(0, 0); }} style={{ width: "100%" }}>
              {updating ? "Updating…" : `Show ${matched != null ? matched.toLocaleString("en-IN") : ""} results`}
            </button>
          </div>
        </div>,
        document.body,
      )}

      <div style={{ animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 17, fontWeight: 650, color: "var(--t1)", letterSpacing: "-0.02em", margin: 0 }}>Strategies</h2>
            <span style={{ fontSize: 13, color: "var(--t3)" }}>Pick one to start, then change any filter</span>
          </div>
          <HowItWorks />
        </div>

        <div data-tour="strategies">
        <PresetCards
          onSelect={applyPreset}
          activePresetId={activePresetId}
          onSavePreset={activeCount > 0 ? () => setShowSaveModal(true) : null}
          onUpdatePreset={handleUpdatePreset}
          onRenamePreset={handleRenamePreset}
          onDuplicatePreset={handleDuplicatePreset}
        />
        </div>

        <div className={`screener ${sideOpen ? "" : "screener-side-closed"}`}>
          {sideOpen && (
            <aside className="screener-side" aria-label="Filters" data-tour="filters">
              {panel}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 12, marginTop: 12, borderTop: "1px solid var(--bdr)" }}>
                <button onClick={() => setSideOpen(false)} className="btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 11.5 }}><PanelLeftClose size={13} /> Hide filters</button>
                <button onClick={handleShare} disabled={!activeCount} title="Copy a link that opens this screen" className="btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 11 }}>{copyFeedback || "Share link"}</button>
                <button onClick={() => setShowImportModal(true)} className="btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 11 }}>Import</button>
              </div>
            </aside>
          )}

          <main style={{ minWidth: 0 }}>
            <div className="screener-toolbar">
              <button data-tour="filters" className={`btn-ghost ${sideOpen ? "screener-filters-toggle" : ""}`} onClick={() => (window.innerWidth <= 900 ? setSheetOpen(true) : setSideOpen(true))} style={{ height: 34, fontSize: 12.5 }}>
                <SlidersHorizontal size={14} /> Filters{activeCount > 0 && <span style={{ marginLeft: 2, fontSize: 10.5, padding: "0 7px", borderRadius: 999, fontWeight: 700, background: "var(--accent)", color: "var(--on-accent)" }}>{activeCount}</span>}
              </button>
              {results && (
                <span style={{ fontSize: 12, color: "var(--t3)" }}>
                  {updating ? "Updating…" : activeCount === 0 ? `The whole market — ${results.total.toLocaleString("en-IN")} NSE companies with current filings. Add a filter or pick a strategy.` : `Screening ${results.total.toLocaleString("en-IN")} NSE companies with current filings`}
                </span>
              )}
            </div>

            {results?.jobs?.loadingMarket && (
              <div style={{ padding: "12px 18px", borderRadius: 12, marginBottom: 16, background: "color-mix(in srgb, var(--accent) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)", fontSize: 13, lineHeight: 1.6 }}>
                Market data is still loading
                {results.jobs.running === "first load" && results.jobs.progress
                  ? <> — {results.jobs.progress.done.toLocaleString("en-IN")} of {results.jobs.progress.total.toLocaleString("en-IN")} companies read from NSE so far</>
                  : <> — prices first, then every company's filings (about 2 hours)</>}.
                {" "}Results only cover what's loaded.
              </div>
            )}

            {error && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--red-dim)", border: "1px solid var(--red-bdr)", color: "var(--red)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                <strong>Error — </strong>{error}
              </div>
            )}

            <ResultsTable
              matches={results?.results}
              loading={!results && !error}
              onAnalyze={onOpenStock}
              totalMatches={results?.matched}
              queryUsed={results?.queryUsed}
              // The counts sit under each filter in the sidebar; one line here says why
              notes={results?.notes?.length ? ["Companies without data for a filter are left out — the sidebar shows how many are known for each."] : []}
              executionTime={executionTime}
              snapshot={results?.snapshot}
              netNet={(filters ?? []).some(f => f.id === "mcapToNcav" && isActiveFilter(f))}
              columns={shownColumns}
              onEditColumns={meta ? () => setPicker("column") : null}
            />
          </main>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", marginTop: 48, lineHeight: 1.8, letterSpacing: "-0.01em" }}>
        Data from NSE filings and daily prices · Educational use only · Not financial advice · Consult a SEBI-registered advisor
      </p>
    </div>
  );
}
