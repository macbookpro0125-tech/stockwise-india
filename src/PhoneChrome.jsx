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
import ImportHoldingsModal from "./ImportHoldingsModal.jsx";
import CreateAlertModal from "./CreateAlertModal.jsx";

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
      {modal?.kind === "import" && <ImportHoldingsModal onClose={() => setModal(null)} onImported={() => { setModal(null); portfolioStore.refresh(); onTab("portfolio"); }} />}
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
  const [shown, closing] = useClosing(open);
  const [drag, setDrag] = useState(null); // px the drawer is pulled from its rest
  const ref = useRef(null);
  const gesture = useRef(null);
  const width = () => ref.current?.offsetWidth ?? Math.min(340, window.innerWidth * 0.86);

  // A swipe to the right that starts on the left side of the screen, on any
  // page (26 Oct 2026: on an iPhone the very edge is Safari's own Back swipe,
  // which a page can't take over, so it needn't start at the edge). Not on
  // anything that moves sideways itself — the card rows, a chart, the tab
  // bar, a field — and an up-and-down scroll stays a scroll.
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
      gesture.current = { x: t.clientX, y: t.clientY, opening: true, live: false };
    };
    const move = e => {
      const g = gesture.current;
      if (!g?.opening) return;
      const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.live) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return; }
        if (dx < 14 || dx < Math.abs(dy) * 1.4) return;
        g.live = true;
        chrome.open("settings");
      }
      // it's the panel's now: the page doesn't scroll under the finger
      if (e.cancelable) e.preventDefault();
      setDrag(Math.min(0, dx - width()));
    };
    const up = e => {
      const g = gesture.current;
      gesture.current = null;
      if (!g?.opening || !g.live) return;
      const dx = (e.changedTouches[0]?.clientX ?? g.x) - g.x;
      setDrag(null);
      if (dx < width() * 0.3) chrome.close(); else tick(); // settled open: a tick
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
  }, [phone, enabled]);

  // While open: a swipe left on it closes it, following the finger
  const onTouchStart = e => { const t = e.touches[0]; gesture.current = { x: t.clientX, y: t.clientY, opening: false, live: false }; };
  const onTouchMove = e => {
    const g = gesture.current;
    if (!g || g.opening) return;
    const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.live) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return; }
      if (dx > -12) return;
      g.live = true;
    }
    setDrag(Math.min(0, dx));
  };
  const onTouchEnd = e => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.opening || !g.live) return;
    const dx = (e.changedTouches[0]?.clientX ?? g.x) - g.x;
    setDrag(null);
    if (-dx > width() * 0.3) chrome.close();
  };
  useEffect(() => {
    if (!open) return;
    const esc = e => { if (e.key === "Escape") chrome.close(); };
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; };
  }, [open]);

  // The page moves over to make room, as the Claude app's does (26 Oct 2026:
  // "it should not overlap, it should move the screen"): everything in the
  // app shifts right by as much of the panel as shows (index.css .pc-pushed)
  useEffect(() => {
    const root = document.documentElement;
    const w = width();
    const shift = !shown || closing ? 0 : drag != null ? Math.max(0, w + drag) : w;
    root.style.setProperty("--pc-shift", `${shift}px`);
    root.classList.toggle("pc-pushed", shown || drag != null);
    root.classList.toggle("pc-dragging", drag != null);
  }, [shown, closing, drag]);
  useEffect(() => () => { document.documentElement.classList.remove("pc-pushed", "pc-dragging"); document.documentElement.style.removeProperty("--pc-shift"); }, []);

  if (!phone || (!shown && drag == null)) return null;
  const pulled = drag != null ? { transform: `translateX(${drag}px)`, transition: "none" } : undefined;
  const fade = drag != null ? { opacity: Math.max(0, 1 + drag / width()), transition: "none" } : undefined;
  return createPortal(
    <div className={`pc-drawer-wrap${closing ? " closing" : ""}`}>
      <div className="pc-scrim" style={fade} onClick={() => chrome.close()} />
      <aside ref={ref} className="pc-drawer" style={pulled} role="dialog" aria-modal="true" aria-label="Settings"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <button type="button" className="pc-round pc-small pc-drawer-close" onClick={() => chrome.close()} aria-label="Close settings"><X size={17} aria-hidden="true" /></button>
        <Suspense fallback={<div role="status" className="pc-loading">Loading settings…</div>}>{children}</Suspense>
      </aside>
    </div>,
    document.body,
  );
}
