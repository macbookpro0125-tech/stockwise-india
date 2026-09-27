import { useState, useMemo, useCallback, useEffect } from "react";
import { api } from "./api.js";
import PresetCards from "./PresetCards.jsx";
import CriteriaPanel, { BLANK_CRITERIA, countActiveFilters } from "./CriteriaPanel.jsx";
import ResultsTable from "./ResultsTable.jsx";

// The original's Discover screen (stock-screener/src/Discovery.jsx): strategy
// cards, the filter panel, Find Stocks, results. One change in behaviour: the
// screen runs on this app's own stored filings and answers in well under a
// second, so picking a strategy runs it straight away instead of asking for a
// second click on Find Stocks.

function loadSavedCriteria() {
  try {
    const saved = localStorage.getItem("discoveryCriteria");
    return saved ? { ...BLANK_CRITERIA, ...JSON.parse(saved) } : null;
  } catch { return null; }
}

function readCustomPresets() {
  try { return JSON.parse(localStorage.getItem("customPresets") || "[]"); } catch { return []; }
}

function writeCustomPresets(list) {
  try { localStorage.setItem("customPresets", JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event("customPresetsUpdated"));
}

function Modal({ onClose, width = 340, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 28, width, maxWidth: "90vw", boxShadow: "var(--sh-lg)", animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) both" }}>
        {children}
      </div>
    </div>
  );
}

export default function DiscoverView({ onOpenStock }) {
  const [criteria, setCriteria] = useState(() => loadSavedCriteria() ?? BLANK_CRITERIA);
  const [activePresetId, setActivePresetId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [executionTime, setExecutionTime] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  const activeFilters = useMemo(() => countActiveFilters(criteria), [criteria]);

  useEffect(() => {
    try { localStorage.setItem("discoveryCriteria", JSON.stringify(criteria)); } catch {}
  }, [criteria]);

  const runSearch = useCallback(async (c) => {
    setLoading(true);
    setError("");
    setSearched(true);
    const started = performance.now();
    try {
      const res = await api.screen(c);
      setResults(res);
      setExecutionTime(performance.now() - started);
      if (window.innerWidth <= 640) setPanelOpen(false);
    } catch (e) {
      setError(e.message || "Screen failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePresetSelect = useCallback(preset => {
    const next = { ...BLANK_CRITERIA, ...preset.criteria };
    setActivePresetId(preset.id);
    setCriteria(next);
    runSearch(next);
  }, [runSearch]);

  const handleCriteriaChange = useCallback(next => {
    setCriteria(next);
    setActivePresetId(null);
    setError("");
  }, []);

  const confirmSavePreset = () => {
    const name = savePresetName.trim();
    if (!name) return;
    writeCustomPresets([...readCustomPresets(), {
      id: `custom_${Date.now()}`, name, icon: "📌",
      description: `${activeFilters} active filters`,
      criteria: { ...criteria }, custom: true,
    }]);
    setSavePresetName("");
    setShowSaveModal(false);
  };

  const handleUpdatePreset = presetId => {
    writeCustomPresets(readCustomPresets().map(p => (p.id === presetId ? { ...p, criteria: { ...criteria }, description: `${activeFilters} active filters` } : p)));
  };

  const handleRenamePreset = (presetId, newName) => {
    writeCustomPresets(readCustomPresets().map(p => (p.id === presetId ? { ...p, name: newName } : p)));
  };

  const handleDuplicatePreset = preset => {
    writeCustomPresets([...readCustomPresets(), { ...preset, id: `custom_${Date.now()}`, name: `${preset.name} (copy)`, criteria: { ...preset.criteria }, custom: true }]);
  };

  const handleExportCriteria = () => {
    navigator.clipboard.writeText(JSON.stringify(criteria, null, 2))
      .then(() => setCopyFeedback("Copied!"))
      .catch(() => setCopyFeedback("Copy failed"))
      .finally(() => setTimeout(() => setCopyFeedback(""), 2000));
  };

  const handleImportCriteria = () => {
    try {
      const parsed = JSON.parse(importText.trim());
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Invalid");
      handleCriteriaChange({ ...BLANK_CRITERIA, ...parsed });
      setShowImportModal(false);
      setImportText("");
      setImportError("");
    } catch {
      setImportError("Invalid JSON — paste criteria exported from this app");
    }
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 80px" }}>

      {showSaveModal && (
        <Modal onClose={() => setShowSaveModal(false)}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)", marginBottom: 6, letterSpacing: "-0.02em" }}>Save as Preset</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>{activeFilters} active filters will be saved</div>
          <input
            autoFocus type="text" placeholder="e.g. My Pharma Screen"
            value={savePresetName}
            onChange={e => setSavePresetName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmSavePreset(); if (e.key === "Escape") setShowSaveModal(false); }}
            className="input-base"
            style={{ marginBottom: 16, fontSize: 15 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={confirmSavePreset} disabled={!savePresetName.trim()} className="btn-primary" style={{ flex: 1 }}>Save</button>
            <button onClick={() => setShowSaveModal(false)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal onClose={() => { setShowImportModal(false); setImportError(""); }} width={420}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--t1)", marginBottom: 6, letterSpacing: "-0.02em" }}>Import Criteria</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16 }}>Paste JSON exported from this app</div>
          <textarea
            autoFocus
            value={importText}
            onChange={e => { setImportText(e.target.value); setImportError(""); }}
            placeholder='{"revenue_growth_min": 10, "roe_min": 15, ...}'
            className="mono"
            style={{
              width: "100%", height: 140, padding: 12, borderRadius: 10,
              border: `1px solid ${importError ? "var(--red)" : "var(--bdr2)"}`,
              background: "var(--s1)", color: "var(--t1)", fontSize: 13,
              resize: "vertical", outline: "none",
            }}
          />
          {importError && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>{importError}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={handleImportCriteria} disabled={!importText.trim()} className="btn-primary" style={{ flex: 1 }}>Apply Criteria</button>
            <button onClick={() => { setShowImportModal(false); setImportError(""); }} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
          </div>
        </Modal>
      )}

      <div style={{ animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) both" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Strategies
        </div>

        <PresetCards
          onSelect={handlePresetSelect}
          activePresetId={activePresetId}
          onSavePreset={() => setShowSaveModal(true)}
          onUpdatePreset={handleUpdatePreset}
          onRenamePreset={handleRenamePreset}
          onDuplicatePreset={handleDuplicatePreset}
        />

        {/* ── Criteria panel ── */}
        <div style={{
          border: "1px solid var(--bdr2)", borderRadius: 14, marginBottom: 16,
          overflow: "hidden", background: "var(--s2)",
          boxShadow: panelOpen ? "var(--sh-xs)" : "none",
        }}>
          <button
            onClick={() => setPanelOpen(o => !o)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              background: panelOpen ? "rgba(0,224,190,0.03)" : "transparent",
              border: "none", cursor: "pointer",
              borderBottom: panelOpen ? "1px solid var(--bdr)" : "none",
              transition: "background 150ms",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: panelOpen ? "var(--t1)" : "var(--t2)", letterSpacing: "-0.01em" }}>
                Filters
              </span>
              {activeFilters > 0 && (
                <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 999, fontWeight: 700, background: "var(--accent)", color: "#07070E" }}>
                  {activeFilters}
                </span>
              )}
            </div>
            <span style={{
              width: 22, height: 22, borderRadius: 6, background: "var(--s3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, color: "var(--t3)",
              transform: panelOpen ? "rotate(180deg)" : "none",
              transition: "transform 200ms var(--ease)",
            }}>▼</span>
          </button>
          {panelOpen && (
            <div style={{ padding: "14px 16px" }}>
              <CriteriaPanel criteria={criteria} onChange={handleCriteriaChange} activeFilters={activeFilters} />
              <div style={{ display: "flex", gap: 6, paddingTop: 8, borderTop: "1px solid var(--bdr)", marginTop: 8 }}>
                <button onClick={handleExportCriteria} className="btn-ghost" style={{ height: 28, padding: "0 12px", fontSize: 10, borderRadius: 7 }}>
                  {copyFeedback || "Export JSON"}
                </button>
                <button onClick={() => setShowImportModal(true)} className="btn-ghost" style={{ height: 28, padding: "0 12px", fontSize: 10, borderRadius: 7 }}>
                  Import JSON
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── CTA row ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
          <button
            onClick={() => runSearch(criteria)}
            disabled={loading || activeFilters === 0}
            className="btn-primary"
            style={{ height: 42, padding: "0 28px", fontSize: 14, borderRadius: 11 }}
          >
            {loading ? (
              <>
                <span style={{ width: 13, height: 13, border: "2px solid rgba(7,7,14,0.2)", borderTopColor: "#07070E", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                Scanning…
              </>
            ) : "Find Stocks"}
          </button>
          {activeFilters === 0 && (
            <span style={{ fontSize: 11, color: "var(--t3)" }}>Set at least one filter to search</span>
          )}
          {results && !loading && (
            <span style={{ fontSize: 11, color: "var(--t3)" }}>
              Screening {results.total.toLocaleString("en-IN")} NSE companies with current filings
            </span>
          )}
        </div>

        {results?.jobs?.loadingMarket && (
          <div style={{ padding: "12px 18px", borderRadius: 12, marginBottom: 16, background: "rgba(0,224,190,0.07)", border: "1px solid rgba(0,224,190,0.25)", color: "var(--accent)", fontSize: 13, lineHeight: 1.6 }}>
            Market data is still loading
            {results.jobs.running === "first load" && results.jobs.progress
              ? <> — {results.jobs.progress.done.toLocaleString("en-IN")} of {results.jobs.progress.total.toLocaleString("en-IN")} companies read from NSE so far</>
              : <> — prices first, then every company's filings (about 2 hours)</>}.
            {" "}Results only cover what's loaded; run the screen again later for the whole market.
          </div>
        )}

        {error && (
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--red-dim)", border: "1px solid var(--red-bdr)", color: "var(--red)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            <strong>Error — </strong>{error}
          </div>
        )}

        {(searched || loading) && !error && (
          <ResultsTable
            matches={results?.results}
            loading={loading}
            onAnalyze={onOpenStock}
            totalMatches={results?.matched}
            queryUsed={results?.queryUsed}
            unsupported={results?.unsupported}
            notes={results?.notes}
            executionTime={executionTime}
            snapshot={results?.snapshot}
            netNet={!!(criteria.net_net || criteria.net_net_graham)}
          />
        )}

        {!searched && !loading && (
          <div style={{ textAlign: "center", padding: "56px 0", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.15 }}>◎</div>
            <p style={{ fontSize: 14, color: "var(--t2)", marginBottom: 4, fontWeight: 500, letterSpacing: "-0.01em" }}>
              Pick a strategy or set your own filters
            </p>
            <p style={{ fontSize: 12, color: "var(--t3)", margin: 0 }}>
              then tap Find Stocks to scan the Indian market
            </p>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", marginTop: 48, lineHeight: 1.8, letterSpacing: "-0.01em" }}>
        Data from NSE filings and daily prices · Educational use only · Not financial advice · Consult a SEBI-registered advisor
      </p>
    </div>
  );
}
