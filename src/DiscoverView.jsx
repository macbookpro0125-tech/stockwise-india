import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, ChevronLeft, ChevronRight, Bookmark, Share } from "lucide-react";
import { api } from "./api.js";
import PresetCards, { presetRules } from "./PresetCards.jsx";
import { NewsTile } from "./NewsView.jsx";
import { useAdPause } from "./ads.jsx";
import { strategiesStore, browserLeftovers, moveLeftovers, discardLeftovers } from "./accountData.js";
import ResultsTable from "./ResultsTable.jsx";
import ScreensHome from "./ScreensHome.jsx";
import FilterPanel, { isActiveFilter } from "./screener/FilterPanel.jsx";
import StrategyPicker from "./StrategyPicker.jsx";
import { returnScroll } from "./returnScroll.js";
import MetricPicker from "./screener/MetricPicker.jsx";
import { useScreenerMeta, DEFAULT_COLUMNS, OLD_DEFAULT_COLUMNS } from "./screener/meta.js";

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

// The user's own strategies, kept with their account (accountData.js)
const readCustomPresets = () => strategiesStore.get();
const writeCustomPresets = list => strategiesStore.set(list);

// Strategies and notes left in this browser from before they moved to
// accounts: the person signed in decides whether they're theirs
function BrowserLeftovers() {
  const [left, setLeft] = useState(browserLeftovers);
  const [busy, setBusy] = useState(false);
  if (!left) return null;
  const what = [left.strategyCount && `${left.strategyCount} saved strateg${left.strategyCount === 1 ? "y" : "ies"}`, left.noteCount && `${left.noteCount} stock note${left.noteCount === 1 ? "" : "s"}`].filter(Boolean).join(" and ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: "color-mix(in srgb, var(--accent) 7%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)", fontSize: 12.5, color: "var(--t1)", lineHeight: 1.5 }}>
      <span style={{ flex: "1 1 260px" }}>This browser has {what} from before they were kept with accounts. Move them to your account so they show on every device?</span>
      <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); await moveLeftovers(); setLeft(null); }} style={{ height: 30, padding: "0 12px", fontSize: 12 }}>{busy ? "Moving…" : "Move to my account"}</button>
      <button className="btn-ghost" disabled={busy} onClick={() => { discardLeftovers(); setLeft(null); }} style={{ height: 30, padding: "0 12px", fontSize: 12 }}>They're not mine — discard</button>
    </div>
  );
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


// The periods a ranked strategy's switch offers (Top Gainers)
const PERIOD_WORDS = { ret1d: "1 day", ret1w: "1 week", ret1m: "1 month", ret3m: "3 months", ret6m: "6 months", ret1y: "1 year", ret3y: "3 years", ret5y: "5 years" };
export default function DiscoverView({ onOpenStock, theme, onOpenNews }) {
  const { meta, error: metaError, retry: retryMeta } = useScreenerMeta();
  // A shared link wins; else the last screen. null until the first screen
  // says what the old saved criteria became.
  const [filters, setFilters] = useState(() => filtersFromLink() ?? read("screenerFilters", null));
  // The link has done its job once applied — a reload shouldn't undo later changes
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("screen")) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const [columns, setColumns] = useState(() => {
    const saved = read("screenerColumns", DEFAULT_COLUMNS);
    return Array.isArray(saved) && saved.join() === OLD_DEFAULT_COLUMNS.join() ? DEFAULT_COLUMNS : saved;
  });
  const [activePresetId, setActivePresetId] = useState(null);
  const [activePresetName, setActivePresetName] = useState(null);
  const [activePresetAbout, setActivePresetAbout] = useState(null);
  // A strategy that ranks by a measure (Top Gainers, 22 Oct 2026): what the
  // list is sorted by, the periods its switch offers, and n — bumped on each
  // pick, so the table re-sorts even when the same measure comes again
  const [ranking, setRanking] = useState({ sort: null, periods: null, n: 0 });
  useEffect(() => {
    let lastCheck = 0;
    const check = () => {
      if (document.visibilityState === "hidden" || Date.now() - lastCheck < 5 * 60 * 1000) return;
      lastCheck = Date.now();
      strategiesStore.checkMatches().catch(() => {});
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, []);

  // Discover is two pages, as a screener's list of screens then a screen:
  // first the strategies (a grid on a computer, a list on a phone), then the
  // chosen one's filters and stocks (asked for 15 Oct 2026: one page of
  // strategies, filters, sort and results was confusing). The browser's Back
  // button returns from the stocks to the strategies (a history entry marks
  // the stocks page); a shared screen link opens straight on its stocks.
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 640px)");
    if (!mq) return;
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [phoneStep, setPhoneStep] = useState(() => (window.history.state?.discoverStep === "stocks" || filtersFromLink() ? "stocks" : "strategies"));
  useEffect(() => {
    const back = () => setPhoneStep(window.history.state?.discoverStep === "stocks" ? "stocks" : "strategies");
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  // Which of Discover's two is showing, for the header: its tab row shows on
  // the stock lists, not on the start page (Header.jsx, index.css). Before
  // paint, so the row never flashes on the start page.
  useLayoutEffect(() => {
    document.documentElement.dataset.discoverStep = phoneStep;
    return () => { delete document.documentElement.dataset.discoverStep; };
  }, [phoneStep]);
  // Where the strategies page was when a list opened, to come back to it
  const strategiesY = useRef(null);
  const showStocks = () => {
    if (phoneStep === "strategies") strategiesY.current = window.scrollY;
    if (window.history.state?.discoverStep !== "stocks") window.history.pushState({ ...(window.history.state ?? {}), discoverStep: "stocks" }, "");
    setPhoneStep("stocks");
    window.scrollTo(0, 0);
  };
  // Back from a list: the strategies on screen — where you left them, or the
  // top of their grid — not the intro you'd have to scroll past (asked for
  // 20 Oct 2026). The strategies load again on the way back, so the page
  // grows for a moment: keep placing it each frame until it holds still
  // (2 s at most), and stop the moment you scroll yourself.
  const lastStep = useRef(phoneStep);
  useLayoutEffect(() => {
    const from = lastStep.current;
    lastStep.current = phoneStep;
    if (!(from === "stocks" && phoneStep === "strategies")) return;
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
    const target = () => {
      const grid = document.getElementById("popular-strategies");
      return returnScroll(strategiesY.current, grid ? grid.getBoundingClientRect().top + window.scrollY : null, headerH);
    };
    let frame = 0, still = 0, done = false;
    const until = performance.now() + 2000;
    const stop = () => { done = true; cancelAnimationFrame(frame); };
    const place = () => {
      if (done) return;
      const y = target();
      const reachable = y <= document.documentElement.scrollHeight - window.innerHeight + 1;
      if (Math.abs(window.scrollY - y) > 1) { window.scrollTo(0, y); still = 0; } else if (reachable) still++;
      if (still >= 8 || performance.now() > until) return stop();
      frame = requestAnimationFrame(place);
    };
    place();
    const yours = ["wheel", "touchstart", "keydown", "pointerdown"];
    yours.forEach(e => window.addEventListener(e, stop, { passive: true, once: true }));
    return () => { stop(); yours.forEach(e => window.removeEventListener(e, stop)); };
  }, [phoneStep]);
  const showStrategies = () => {
    if (window.history.state?.discoverStep === "stocks") window.history.back();
    else setPhoneStep("strategies");
  };
  const [results, setResults] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [executionTime, setExecutionTime] = useState(null);
  const [picker, setPicker] = useState(null); // "filter" | "column"
  // The filters drawer on a computer; open from the start on a shared link
  const [filtersOpen, setFiltersOpen] = useState(() => !!filtersFromLink());
  const [sheetOpen, setSheetOpen] = useState(false); // phones: filters in a full-screen sheet
  const [sheetClosing, setSheetClosing] = useState(false);
  // Slides the sheet back down before it goes (index.css .filter-sheet.closing)
  const closeSheet = () => {
    setSheetClosing(true);
    const ms = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 200 : 250;
    setTimeout(() => { setSheetOpen(false); setSheetClosing(false); window.scrollTo(0, 0); }, ms);
  };
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  // The store app's ad cards are native views over the page: hidden while a
  // sheet or dialog covers the list (ads.jsx)
  useAdPause(sheetOpen || showSaveModal || showImportModal || !!picker);

  useEffect(() => { if (filters) write("screenerFilters", filters); }, [filters]);
  useEffect(() => { write("screenerColumns", columns); }, [columns]);
  // ── Filters drawer (computer): opens while the pointer is on the Filters
  // button or the drawer and closes a moment after it leaves (asked 16 Oct
  // 2026: "open when the mouse goes there, otherwise closed"). A click opens
  // it too (keyboard, touch laptops); a click elsewhere or Esc closes it. It
  // never closes mid-drag on a slider, or while the metric picker or import
  // it opened is up.
  const drawerRef = useRef(null);
  const filtersBtnRef = useRef(null);
  const closeTimer = useRef(0);
  const dragging = useRef(false);
  const hoverable = useMemo(() => !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches, []);
  // The drawer grows out of the button: its top-left corner sits where the
  // button is (index.css .filters-drawer)
  const cancelClose = () => { clearTimeout(closeTimer.current); closeTimer.current = 0; };
  const openDrawer = () => {
    cancelClose();
    const b = filtersBtnRef.current?.getBoundingClientRect(), d = drawerRef.current;
    if (b && d && b.width) { d.style.setProperty("--drawer-top", `${Math.max(b.top, 12)}px`); d.style.setProperty("--drawer-left", `${b.left}px`); }
    setFiltersOpen(true);
  };
  const leaveDrawer = () => {
    if (!hoverable || closeTimer.current) return;
    closeTimer.current = setTimeout(() => { closeTimer.current = 0; if (!dragging.current) setFiltersOpen(false); }, 350);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => { if (!filtersOpen) cancelClose(); }, [filtersOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!filtersOpen) return;
    const down = e => {
      if (drawerRef.current?.contains(e.target)) { dragging.current = true; return; }
      if (filtersBtnRef.current?.contains(e.target) || picker || showImportModal) return;
      setFiltersOpen(false);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (!drawerRef.current?.matches(":hover")) leaveDrawer();
    };
    const key = e => { if (e.key === "Escape" && !picker && !showImportModal) { setFiltersOpen(false); filtersBtnRef.current?.focus(); } };
    // Wherever the pointer goes: on the button or drawer it stays; anywhere
    // else it closes a moment later (also when it opened by itself, from a
    // shared link, without the pointer ever entering it)
    const move = e => {
      if (dragging.current || picker || showImportModal) return;
      if (drawerRef.current?.contains(e.target) || filtersBtnRef.current?.contains(e.target)) cancelClose();
      else leaveDrawer();
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerdown", down); document.removeEventListener("pointerup", up); document.removeEventListener("keydown", key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersOpen, picker, showImportModal]);

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

  const changeFilters = useCallback(next => {
    setFilters(next); setActivePresetId(null); setActivePresetName(null); setActivePresetAbout(null);
    setRanking(r => (r.periods ? { ...r, periods: null } : r)); // your own filters now: the list keeps its order
  }, []);
  // Gain over another period: the return filter and the order both move to it
  const pickPeriod = id => {
    setFilters(fs => fs.map(f => (ranking.periods?.includes(f.id) ? { ...f, id } : f)));
    setRanking(r => ({ ...r, sort: id, n: r.n + 1 }));
  };

  const applyPreset = useCallback(async preset => {
    if (preset.custom) strategiesStore.acknowledge(preset.id);
    setActivePresetId(preset.id);
    setActivePresetName(preset.name ?? null);
    setActivePresetAbout(preset.description ?? null);
    setRanking(r => ({ sort: preset.sort ?? null, periods: preset.periods ?? null, n: r.n + 1 }));
    if (Array.isArray(preset.filters)) { setFilters(preset.filters.map(f => ({ ...f }))); return; }
    // Saved before filters existed: the server turns its criteria into filters
    const res = await run({ ...preset.criteria, columns: shownColumnIds });
    if (res?.filters) setFilters(res.filters);
  }, [run, shownColumnIds]);

  // The ready-made strategies for the curved row at the top of Discover
  const [ribbon, setRibbon] = useState([]);
  useEffect(() => { api.presets().then(list => setRibbon(Array.isArray(list) ? list : [])).catch(() => {}); }, []);

  // The strategy wheel beside the screen's name (computer): your filters
  // when you've changed them, the whole market, the ready-made strategies,
  // then your own. Settling on one opens it, as its card would.
  const [ownStrategies, setOwnStrategies] = useState(readCustomPresets);
  useEffect(() => {
    const update = () => setOwnStrategies(readCustomPresets());
    window.addEventListener("customPresetsUpdated", update);
    return () => window.removeEventListener("customPresetsUpdated", update);
  }, []);
  const wheelPresets = useMemo(() => [...ribbon, ...ownStrategies.map(p => ({ ...p, custom: true }))], [ribbon, ownStrategies]);
  const yours = !activePresetId && (filters ?? []).some(isActiveFilter);
  const wheelItems = useMemo(() => [
    ...(yours ? [{ id: "__yours", label: "Your filters" }] : []),
    { id: "__all", label: "Whole market" },
    ...wheelPresets.map(p => ({ id: p.id, label: p.name })),
  ], [yours, wheelPresets]);
  const wheelValue = activePresetId ?? (yours ? "__yours" : "__all");
  const pickFromWheel = id => {
    if (id === "__yours") return;
    if (id === "__all") return changeFilters([]);
    const preset = wheelPresets.find(p => p.id === id);
    if (preset) applyPreset(preset);
  };

  // A strategy chosen on the front page before signing in ("Open screen" in
  // the film, ?strategy=<id>): open it as its card would, once, then drop it
  // from the address
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("strategy");
    if (!id) return;
    const u = new URL(window.location.href);
    u.searchParams.delete("strategy");
    window.history.replaceState(window.history.state, "", u.pathname + u.search);
    api.presets().then(list => {
      const preset = list?.find(p => p.id === id);
      if (preset) { applyPreset(preset); showStocks(); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Your own strategies (saved to the account) ──
  const confirmSavePreset = () => {
    const name = savePresetName.trim();
    if (!name) return;
    writeCustomPresets([...readCustomPresets(), {
      id: `custom_${Date.now()}`, name, icon: "📌", custom: true,
      description: `${activeCount} filter${activeCount === 1 ? "" : "s"}`,
      filters: filters.filter(isActiveFilter),
    }]).then(() => strategiesStore.checkMatches()).catch(() => {});
    setSavePresetName("");
    setShowSaveModal(false);
  };
  const handleUpdatePreset = id => writeCustomPresets(readCustomPresets().map(p => (p.id === id ? { ...p, newMatches: 0, filters: filters.filter(isActiveFilter), criteria: undefined, description: `${activeCount} filters` } : p))).then(() => strategiesStore.checkMatches()).catch(() => {});
  const handleRenamePreset = (id, name) => writeCustomPresets(readCustomPresets().map(p => (p.id === id ? { ...p, name } : p)));
  const handleDuplicatePreset = p => {
    const copy = { ...p };
    delete copy.newMatches;
    delete copy.checkedAt;
    writeCustomPresets([...readCustomPresets(), { ...copy, id: `custom_${Date.now()}`, name: `${p.name} (copy)`, custom: true }])
      .then(() => strategiesStore.checkMatches()).catch(() => {});
  };

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
    <div className="screener-page" style={{ padding: "var(--page-top, 24px) var(--page-x) 16px" }}>
      {showSaveModal && (
        <Modal onClose={() => setShowSaveModal(false)}>
          <div style={{ fontSize: 17, fontWeight: 500, color: "var(--t1)", marginBottom: 6, letterSpacing: "-0.02em" }}>Save as a strategy</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>{activeCount} filter{activeCount === 1 ? "" : "s"} will be saved to your account</div>
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
          <div style={{ fontSize: 17, fontWeight: 500, color: "var(--t1)", marginBottom: 6, letterSpacing: "-0.02em" }}>Import filters</div>
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
        <div className={`filter-sheet${sheetClosing ? " closing" : ""}`}>
          <div className="filter-sheet-body">{panel}</div>
          <div className="filter-sheet-foot">
            <button className="btn-primary" onClick={closeSheet} disabled={sheetClosing} style={{ width: "100%" }}>
              {updating ? "Updating…" : `Show ${matched != null ? matched.toLocaleString("en-IN") : ""} results`}
            </button>
          </div>
        </div>,
        document.body,
      )}

      <div style={{ animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>
        <BrowserLeftovers />
        {phoneStep === "strategies" && (() => {
          const newScreen = () => { changeFilters([]); setActivePresetName("New screen"); setFiltersOpen(false); showStocks(); };
          // The screen already set comes first
          const continueCard = activeCount > 0 && (
            <button type="button" onClick={showStocks} className="phone-continue glow" style={{ margin: isPhone ? "12px 0 0" : "28px 0 0" }}>
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 450, color: "var(--t1)" }}>Continue with your filters</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--t3)", marginTop: 2 }}>
                  {`${activeCount} filter${activeCount === 1 ? "" : "s"}${matched != null ? ` · ${matched.toLocaleString("en-IN")} stocks` : ""}`}
                </span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          );
          const cards = (
            <div data-tour="strategies">
              <PresetCards
                layout={isPhone ? "stack" : "grid"}
                theme={theme}
                meta={meta}
                onSelect={preset => { applyPreset(preset); setFiltersOpen(false); showStocks(); }} // a ready-made screen opens to its results, full width
                activePresetId={activePresetId}
                onSavePreset={null}
                onUpdatePreset={handleUpdatePreset}
                onRenamePreset={handleRenamePreset}
                onDuplicatePreset={handleDuplicatePreset}
              />
            </div>
          );
          // The screener's home: a hero, three ways in, then the strategies as
          // big cards (ScreensHome.jsx); on a phone the hero in short and the
          // strategies as a list
          return (
            <ScreensHome
              ribbon={ribbon}
              onPickStrategy={preset => { applyPreset(preset); setFiltersOpen(false); showStocks(); }}
              compact={isPhone}
              meta={meta}
              total={results?.total}
              onStart={newScreen}
              onCreate={newScreen}
              continueCard={continueCard || null}
              newsTile={onOpenNews && !isPhone ? <NewsTile onOpen={id => onOpenNews(id)} onSeeAll={() => onOpenNews(null)} /> : null}
            >{cards}</ScreensHome>
          );
        })()}

        {/* A computer: back to the strategies on a pill pinned under the
            header, so it's in reach however far down the list you are */}
        {phoneStep === "stocks" && !isPhone && (
          <button type="button" onClick={showStrategies} className="screen-back-pin" aria-label="Back to all strategies">
            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" /> All strategies
          </button>
        )}

        {/* Second page: back to the strategies, and which screen this is —
            its name, what it looks for, and Save */}
        {phoneStep === "stocks" && (
          <header className="screen-head">
            {isPhone && (
              <button type="button" onClick={showStrategies} className="screen-back" aria-label="Back to all strategies">
                <ChevronLeft size={17} aria-hidden="true" /> Strategies
              </button>
            )}
            <div className="screen-head-row">
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* A computer: the name is the strategy wheel itself — the
                    strategy on its pill, the others above and below to
                    scroll to (one name, in one place) */}
                <h2 className={`screen-title${wheelItems.length > 1 ? " sr-only" : ""}`}>{activePresetName ?? (activeCount > 0 ? "Your filters" : "Whole market")}</h2>
                {wheelItems.length > 1 && (
                  <StrategyPicker presets={wheelPresets} items={wheelItems} value={wheelValue} onPick={pickFromWheel}
                    meta={meta} filters={filters} phone={isPhone}
                    stats={{ matched: results?.matched ?? null, universe: results?.total ?? null, pricesDate: results?.snapshot?.pricesDate ?? null }}
                    onEditRules={() => (isPhone ? setSheetOpen(true) : setFiltersOpen(true))} />
                )}
                {/* A phone keeps the list clean: the strategy's line, rules,
                    count and dates are on its ⓘ page */}
                {!(isPhone && wheelItems.length > 1) && <p className="screen-about">
                  {activePresetAbout ?? (activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} of your own.` : "Every NSE company. Add a filter to narrow it down.")}
                </p>}
                {/* A phone: the screen's rules as chips under it (the
                    computer's drawer lists them) */}
                {isPhone && activeCount > 0 && wheelItems.length <= 1 && (
                  <div className="ph-rules ph-rules-on" aria-label="This screen's filters">
                    {presetRules({ filters: filters.filter(isActiveFilter) }, meta).map(r => <span key={r} className="ph-rule">{r}</span>)}
                  </div>
                )}
              </div>
              {!isPhone && (
                <div className="screen-actions">
                  <button type="button" onClick={handleShare} disabled={!activeCount} title="Copy a link that opens this screen" className="btn-ghost tb-btn">
                    <Share size={14} aria-hidden="true" /> {copyFeedback || "Share"}
                  </button>
                  {activeCount > 0 && (
                    <button type="button" className="btn-primary tb-btn" onClick={() => setShowSaveModal(true)}>
                      <Bookmark size={14} aria-hidden="true" /> Save as strategy
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>
        )}

        {phoneStep === "stocks" && (
        <div className="screener screener-side-closed">
          {/* The filters drawer: over the table, beside the Filters button */}
          {!isPhone && (
            <aside ref={drawerRef} id="filters-drawer" className={`filters-drawer${filtersOpen ? " open" : ""}`} aria-label="Filters"
              inert={!filtersOpen} onMouseEnter={openDrawer} onMouseLeave={leaveDrawer}>
              {panel}
              <div className="filters-drawer-foot">
                <button onClick={() => setShowImportModal(true)} className="btn-ghost" style={{ height: 30, padding: "0 12px", fontSize: 12 }}>Import filters</button>
              </div>
            </aside>
          )}

          <main style={{ minWidth: 0 }}>
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

            {ranking.periods && (
              <div className="period-switch" role="group" aria-label="Biggest gain over">
                <span className="period-switch-label">Gain over</span>
                {ranking.periods.map(id => (
                  // the one picked kept in view on a phone, where the row scrolls
                  <button key={id} type="button" className="ph-chip" aria-pressed={ranking.sort === id} onClick={() => pickPeriod(id)}
                    ref={el => { if (el && ranking.sort === id) el.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>{PERIOD_WORDS[id] ?? id}</button>
                ))}
              </div>
            )}

            <ResultsTable
              theme={theme}
              sortTo={ranking}
              matches={results?.results}
              loading={!results && !error}
              onAnalyze={onOpenStock}
              totalMatches={results?.matched}
              hideCountOnPhone={wheelItems.length > 1}
              filters={filters}
              onFiltersChange={changeFilters}
              universe={activeCount > 0 ? results?.total : null}
              queryUsed={results?.queryUsed}
              // The counts sit under each filter in the sidebar; one line here says why
              notes={results?.notes?.length ? ["Companies without data for a filter are left out — the sidebar shows how many are known for each."] : []}
              executionTime={executionTime}
              snapshot={results?.snapshot}
              netNet={(filters ?? []).some(f => f.id === "mcapToNcav" && isActiveFilter(f))}
              columns={shownColumns}
              filteredIds={(filters ?? []).filter(f => !f.values && isActiveFilter(f)).map(f => f.id)}
              onEditColumns={meta ? () => setPicker("column") : null}
              updating={updating}
              // Hover or click opens the drawer; on a narrow window, the full-screen sheet
              filtersButton={!isPhone ? (
                <button ref={filtersBtnRef} data-tour="filters" className={`btn-ghost tb-btn filters-btn${filtersOpen ? " on" : ""}`}
                  aria-expanded={filtersOpen} aria-controls="filters-drawer"
                  onMouseEnter={() => { if (hoverable && window.innerWidth > 900) openDrawer(); }}
                  onMouseLeave={leaveDrawer}
                  onClick={() => (window.innerWidth <= 900 ? setSheetOpen(true) : filtersOpen && !hoverable ? setFiltersOpen(false) : openDrawer())}>
                  <SlidersHorizontal size={14} aria-hidden="true" /> Filters{activeCount > 0 && <span className="filters-count">{activeCount}</span>}
                </button>
              ) : null}
              phoneFilters={isPhone ? (
                <button data-tour="filters" className="btn-ghost" onClick={() => setSheetOpen(true)} style={{ height: 36, fontSize: 13 }}>
                  <SlidersHorizontal size={14} /> Filters{activeCount > 0 && <span style={{ marginLeft: 2, fontSize: 10.5, padding: "0 7px", borderRadius: 999, fontWeight: 500, background: "var(--accent)", color: "var(--on-accent)" }}>{activeCount}</span>}
                </button>
              ) : null}
              meta={meta}
            />
          </main>
        </div>
        )}
      </div>

    </div>
  );
}
