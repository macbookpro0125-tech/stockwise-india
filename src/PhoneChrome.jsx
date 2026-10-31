import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Plus, Search, X, SlidersHorizontal, BellPlus, Star, BriefcaseBusiness, FileUp, ChevronRight, ChevronLeft } from "lucide-react";
import { api } from "./api.js";
import { chrome, usePanel, useScrolledPast, NEW_SCREEN_EVENT } from "./phoneChrome.js";
import { usePhone } from "./phoneTabs.js";
import { portfolioStore } from "./stores.js";
import { useWatchlist, toggleWatch } from "./watchlist.js";
import { tick } from "./haptics.js";
import StockSearchBar from "./StockSearchBar.jsx";
import AddHoldingModal from "./AddHoldingModal.jsx";
import { lazyPage } from "./lazyPage.js";
const ImportHoldingsModal = lazyPage(() => import("./ImportHoldingsModal.jsx"));
import CreateAlertModal from "./CreateAlertModal.jsx";
import { BrandMark } from "./site.jsx";

// A phone's top bar and what it opens (asked for 26 Oct 2026, after Reddit's
// app): a round menu button on the left — Settings, from the left, also by a
// swipe in from the screen's left edge — the search, with the app's mark in
// it, and + on the right, for everything that can be made. Scrolled past,
// the menu and a search-and-+ capsule float over the page.

export function MenuButton({ dot = false, className = "" }) {
  return (
    <button type="button" className={`pc-round ${className}`.trim()} onClick={() => { tick(); chrome.open("settings"); }} aria-label={dot ? "Settings, an alert's price was reached" : "Settings"}>
      <Menu size={20} strokeWidth={1.9} aria-hidden="true" />
      {dot && <i className="pc-dot" aria-hidden="true" />}
    </button>
  );
}

export function PlusButton({ className = "" }) {
  return (
    <button type="button" className={`pc-round ${className}`.trim()} onClick={() => { tick(); chrome.open("create"); }} aria-label="Create">
      <Plus size={21} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}

const focusSearch = () => {
  window.scrollTo({ top: 0, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  setTimeout(() => document.querySelector(".app-header-search input")?.focus(), 250);
};

// Past the top bar: the menu on the left, search and + on the right, floating
export function PhoneFloatingBar({ dot, hidden = false }) {
  const phone = usePhone();
  const past = useScrolledPast(72);
  if (!phone) return null;
  return (
    <div className={`pc-float${past && !hidden ? " show" : ""}`} aria-hidden={!past || hidden || undefined}>
      <MenuButton dot={dot} className="pc-glass" />
      <span className="pc-capsule pc-glass">
        <button type="button" onClick={focusSearch} aria-label="Search stocks" tabIndex={past ? undefined : -1}><Search size={20} strokeWidth={1.9} aria-hidden="true" /></button>
        <i aria-hidden="true" />
        <button type="button" onClick={() => { tick(); chrome.open("create"); }} aria-label="Create" tabIndex={past ? undefined : -1}><Plus size={21} strokeWidth={1.9} aria-hidden="true" /></button>
      </span>
    </div>
  );
}

// Slides a panel away before it goes, as the filters sheet does
const SLIDE_MS = 340;

function useClosing(open) {
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setClosing(false); return; }
    if (!shown) return;
    setClosing(true);
    const t = setTimeout(() => { setShown(false); setClosing(false); }, 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return [shown, closing];
}

const OPTIONS = [
  { id: "screen", Icon: SlidersHorizontal, hue: "var(--accent)", title: "New screener", about: "Pick your own filters and save it" },
  { id: "alert", Icon: BellPlus, hue: "#F5C451", title: "Price alert", about: "Get told when a stock hits your price" },
  { id: "watch", Icon: Star, hue: "#F5C451", title: "Add to watchlist", about: "Follow a company's results and news" },
];
const PORTFOLIO = [
  { id: "holding", Icon: BriefcaseBusiness, hue: "#5AA9FF", title: "Add a holding", about: "A stock you own, its quantity and price" },
  { id: "import", Icon: FileUp, hue: "#A08BFF", title: "Import from your broker", about: "Zerodha, Groww, Upstox, Angel One or any CSV or Excel file" },
];

// + : everything that can be made, in one sheet from the bottom
export function CreateSheet({ onTab }) {
  const panel = usePanel();
  const [shown, closing] = useClosing(panel === "create");
  const [step, setStep] = useState(null); // null | "alert" | "watch" — picking a company
  const [modal, setModal] = useState(null); // { kind: "holding" | "import" | "alert", stock? }
  const [toast, setToast] = useState("");
  const watched = useWatchlist();
  useEffect(() => { if (panel !== "create") setStep(null); }, [panel]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  const choose = id => {
    tick();
    if (id === "screen") { chrome.close(); onTab("discover"); setTimeout(() => window.dispatchEvent(new Event(NEW_SCREEN_EVENT)), 60); }
    else if (id === "alert" || id === "watch") setStep(id);
    else { chrome.close(); setModal({ kind: id }); }
  };
  const picked = async symbol => {
    const kind = step;
    let stock = { symbol, name: symbol, cmp: null };
    try { const d = await api.stock(symbol); stock = { symbol, name: d.name ?? symbol, cmp: d.cmp ?? d.price ?? null }; } catch {}
    chrome.close();
    if (kind === "alert") setModal({ kind: "alert", stock });
    else {
      if (!watched.has(symbol)) await toggleWatch(symbol, stock.cmp).catch(() => {});
      setToast(`${stock.name} is on your watchlist`);
    }
  };

  const row = o => (
    <button key={o.id} type="button" className="pc-opt" onClick={() => choose(o.id)}>
      <span className="pc-opt-icon" style={{ color: o.hue }}><o.Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
      <span className="pc-opt-text"><span className="pc-opt-title">{o.title}</span><span className="pc-opt-about">{o.about}</span></span>
      <ChevronRight size={16} className="pc-opt-go" aria-hidden="true" />
    </button>
  );

  return (
    <>
      {shown && createPortal(
        <div className={`pc-sheet-wrap${closing ? " closing" : ""}`}>
          <div className="pc-scrim" onClick={() => chrome.close()} />
          <div className="pc-sheet" role="dialog" aria-modal="true" aria-label={step ? "Pick a company" : "Create"}>
            <i className="pc-handle" aria-hidden="true" />
            <div className="pc-sheet-head">
              {step && <button type="button" className="pc-round pc-small" onClick={() => setStep(null)} aria-label="Back"><ChevronLeft size={18} aria-hidden="true" /></button>}
              <h2>{step === "alert" ? "Alert on which company?" : step === "watch" ? "Watch which company?" : "Create"}</h2>
              <button type="button" className="pc-round pc-small" onClick={() => chrome.close()} aria-label="Close"><X size={17} aria-hidden="true" /></button>
            </div>
            {step ? (
              <div className="pc-pick"><StockSearchBar key={step} onAnalyze={picked} placeholder="Search a company" /></div>
            ) : (
              <>
                <div className="pc-box">{OPTIONS.map(row)}</div>
                <p className="pc-label">Portfolio</p>
                <div className="pc-box">{PORTFOLIO.map(row)}</div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
      {modal?.kind === "holding" && <AddHoldingModal onClose={() => setModal(null)} onSave={async h => { await api.addHolding(h); setModal(null); portfolioStore.refresh(); onTab("portfolio"); }} />}
      {modal?.kind === "import" && <Suspense fallback={null}><ImportHoldingsModal onClose={() => setModal(null)} onImported={() => { setModal(null); portfolioStore.refresh(); onTab("portfolio"); }} /></Suspense>}
      {modal?.kind === "alert" && <CreateAlertModal stock={modal.stock} onClose={made => { setModal(null); if (made) setToast(`Alert set on ${modal.stock.name}`); }} />}
      {toast && createPortal(<div className="pc-toast" role="status">{toast}</div>, document.body)}
    </>
  );
}

// Settings from the left: the menu button, or a swipe to the right from the
// left side of the screen; it slides over the page following the finger, and
// a swipe back (or a tap beside it) closes it
export function SettingsDrawer({ children, enabled = true }) {
  const phone = usePhone();
  const panel = usePanel();
  const open = panel === "settings";
  // One position for the panel and the page beside it, in px open (0 to its
  // width): a finger sets it while dragging, and both glide to the end it's
  // let go towards on the same curve (26 Oct 2026: "the closing and opening
  // is not smooth, it can't close when I move it left")
  const [shown, setShown] = useState(open);
  const [entered, setEntered] = useState(false);
  const [drag, setDrag] = useState(null);
  const ref = useRef(null);
  const wrap = useRef(null);
  const gesture = useRef(null);
  const width = () => ref.current?.offsetWidth ?? Math.min(340, window.innerWidth * 0.86);

  // in: drawn closed for a frame, then glides open; out: glides shut, then goes
  useEffect(() => {
    if (open) {
      setShown(true);
      let b; const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setEntered(true)); });
      return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
    }
    setEntered(false);
    const t = setTimeout(() => setShown(false), SLIDE_MS + 40);
    return () => clearTimeout(t);
  }, [open]);

  // Where a let-go finger sends it: past a third of the way, or a flick
  const settle = (g, x) => {
    const dt = Math.max(1, performance.now() - g.t);
    const speed = (x - g.lx) / dt; // px per ms, + is towards open
    const at = g.at;
    setDrag(null);
    const toOpen = Math.abs(speed) > 0.35 ? speed > 0 : at > width() * (g.opening ? 0.3 : 0.7);
    if (toOpen) { if (g.opening) chrome.open("settings"); tick(); setEntered(true); }
    else if (g.opening) { setEntered(false); setTimeout(() => setShown(false), SLIDE_MS + 40); } // never opened: nothing to close
    else chrome.close();
  };
  const follow = (g, x) => {
    if (performance.now() - g.t > 16) { g.lx = g.x2 ?? g.x; g.t = performance.now(); }
    g.x2 = x;
    g.at = Math.max(0, Math.min(width(), (g.opening ? 0 : width()) + (x - g.x)));
    setDrag(g.at);
  };

  // A swipe to the right that starts on the left side of the screen, on any
  // page (on an iPhone the very edge is Safari's own Back swipe, which a page
  // can't take over, so it needn't start at the edge). Not on anything that
  // moves sideways itself — the card rows, a chart, the tab bar, a field —
  // and an up-and-down scroll stays a scroll.
  useEffect(() => {
    if (!phone || !enabled) return;
    const sideways = el => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.matches?.("input, textarea, select, [contenteditable], canvas, .bottom-tab-bar, [role='slider'], [role='listbox']")) return true;
        const ox = getComputedStyle(n).overflowX;
        if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };
    const down = e => {
      if (chrome.current() || e.touches.length !== 1) return;
      if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
      const t = e.touches[0];
      if (t.clientX > window.innerWidth * 0.45 || sideways(e.target)) return;
      gesture.current = { x: t.clientX, y: t.clientY, lx: t.clientX, t: performance.now(), at: 0, opening: true, live: false };
    };
    const move = e => {
      const g = gesture.current;
      if (!g?.opening) return;
      const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.live) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return; }
        if (dx < 14 || dx < Math.abs(dy) * 1.4) return;
        g.live = true; g.x = t.clientX; // from here, so it doesn't jump
        setShown(true); setEntered(true);
      }
      // it's the panel's now: the page doesn't scroll under the finger
      if (e.cancelable) e.preventDefault();
      follow(g, t.clientX);
    };
    const up = e => {
      const g = gesture.current;
      if (!g?.opening) return;
      gesture.current = null;
      if (g.live) settle(g, e.changedTouches[0]?.clientX ?? g.x2 ?? g.x);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [phone, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // While open: a swipe left anywhere — on the panel or the page beside it —
  // closes it, following the finger; a scroll up and down stays a scroll
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const down = e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      gesture.current = { x: t.clientX, y: t.clientY, lx: t.clientX, t: performance.now(), at: width(), opening: false, live: false };
    };
    const move = e => {
      const g = gesture.current;
      if (!g || g.opening) return;
      const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.live) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return; }
        if (dx > -10 || -dx < Math.abs(dy) * 1.2) return;
        g.live = true; g.x = t.clientX;
      }
      if (e.cancelable) e.preventDefault();
      follow(g, t.clientX);
    };
    const up = e => {
      const g = gesture.current;
      if (!g || g.opening) return;
      gesture.current = null;
      if (g.live) settle(g, e.changedTouches[0]?.clientX ?? g.x2 ?? g.x);
    };
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", up);
    el.addEventListener("touchcancel", up);
    return () => {
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", up);
      el.removeEventListener("touchcancel", up);
    };
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const esc = e => { if (e.key === "Escape") chrome.close(); };
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; };
  }, [open]);

  // How far open it is now, and the page moved over by as much, as the Claude
  // app's does (index.css .pc-pushed)
  const at = drag ?? (shown && entered && open ? width() : 0);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--pc-shift", `${at}px`);
    root.classList.toggle("pc-pushed", shown);
    root.classList.toggle("pc-dragging", drag != null);
  }, [at, shown, drag]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { document.documentElement.classList.remove("pc-pushed", "pc-dragging"); document.documentElement.style.removeProperty("--pc-shift"); }, []);

  if (!phone || !shown) return null;
  const w = ref.current?.offsetWidth ?? Math.min(340, window.innerWidth * 0.86);
  const still = drag != null ? " dragging" : "";
  return createPortal(
    <div ref={wrap} className={`pc-drawer-wrap${still}`}>
      <div className="pc-scrim" style={{ opacity: at / w }} onClick={() => chrome.close()} />
      <aside ref={ref} className="pc-drawer" style={{ transform: `translate3d(${at - w}px, 0, 0)` }} role="dialog" aria-modal="true" aria-label="Settings">
        <div className="pc-drawer-head">
          <BrandMark size={null} className="pc-drawer-mark" />
          <span className="pc-drawer-brand">Jocular Insights</span>
          <button type="button" className="pc-round pc-small pc-drawer-close" onClick={() => chrome.close()} aria-label="Close settings"><X size={17} aria-hidden="true" /></button>
        </div>
        <Suspense fallback={<div role="status" className="pc-loading">Loading settings…</div>}>{children}</Suspense>
      </aside>
    </div>,
    document.body,
  );
}
