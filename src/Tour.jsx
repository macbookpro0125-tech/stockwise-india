import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A guided tour: the page dims, one part at a time is lit up, and a card says
// what it is. Steps point at elements by their data-tour name (the first one
// that's visible — phones have their own tab bar and filter button); a step
// without a target is a card in the middle of the screen.

export const APP_TOUR = [
  { title: "Welcome to Stockwise India", body: "A one-minute look at what's where. Use Next to go through it, or skip — you can take it again any time from the Account menu." },
  { target: "search", title: "Find any company", body: "Search every NSE-listed company by name or symbol. On a keyboard, press / to jump here." },
  { target: "strategies", title: "Start from a strategy", body: "Each card is a ready-made screen, such as High Quality Compounders. Pick one, then change any of its filters." },
  { target: "filters", title: "Filters", body: "Add or change filters — ROE, debt, promoter holding, valuation and many more. The results update as you go." },
  { target: "row", title: "One company per row", body: "Quality (out of 100) is how strong the business is, worked out from its NSE filings. Research adds valuation and risk. Click or tap a company's name to open its full page." },
  { target: "row-actions", title: "Save it, or get an alert", body: "The star adds it to your Watchlist. The bell tells you when the price reaches a level you set — it's on each row on a computer, and on the company's page on a phone." },
  { target: "tabs", title: "Your other pages", body: "Watchlist: companies you saved. Portfolio: what you own, with your gain or loss. Performance: how each strategy's past picks have done. Alerts: your price alerts." },
  { target: "account", title: "Your account", body: "Sign out, delete your account, or take this tour again. The button beside it switches between light and dark." },
  { title: "You're all set", body: "Open any company to see its scores, fair value, financials and NSE filings. A short tour of that page shows the first time you open one." },
];

export const STOCK_TOUR = [
  { target: "stock-actions", title: "The company's page", body: "Everything about one company. Watch adds it to your Watchlist; Alert tells you when the price reaches a level you set." },
  { target: "research", title: "Research scores", body: "Quality: how strong the business is, out of 100. Overall research score: quality and valuation together. Open \"Why this score?\" to see every check and its reason." },
  { target: "override", title: "Check or change the numbers", body: "EPS, P/E and growth come from the company's NSE filings. Type your own to test a view — the price levels on this page follow. The research score always uses the filings." },
  { target: "valuation", title: "Ways to value it", body: "Valuation methods worked out from reported figures. Show assumptions lets you change each one. These are estimates, not price targets." },
  { target: "thesis", title: "What to watch", body: "Strengths and cautions from the filings, what to check in the next results, and your own notes — saved to your account." },
  { target: "position", title: "Where the price sits", body: "Today's price against the levels worked out from fair value. It describes the price; it never tells you to buy or sell." },
  { target: "filings", title: "News and NSE filings", body: "The company's own announcements to NSE, newest first. Read full filing opens the document and quotes the key lines." },
  { title: "That's the company page", body: "Back (top left) returns to your list. Your browser's back button works too." },
];

const PAD = 6;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function visibleTarget(name) {
  if (!name) return null;
  return [...document.querySelectorAll(`[data-tour="${name}"]`)].find(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }) ?? null;
}

// How far down the screen the sticky header (and a company page's action
// bar) reach — a part under them isn't really in view. 0 for a part that is
// itself in one of those bars.
function coveredTop(el) {
  let bottom = 0;
  for (const bar of document.querySelectorAll(".app-header, [data-sticky-top]")) {
    if (bar.contains(el)) return 0;
    const r = bar.getBoundingClientRect();
    if (r.height > 0 && r.top < 200) bottom = Math.max(bottom, r.bottom);
  }
  return bottom;
}

const sameRect = (a, b) => a && b && ["top", "left", "width", "height", "cover"].every(k => Math.abs(a[k] - b[k]) < 0.5);

export default function Tour({ steps: allSteps, onFinish }) {
  // Steps whose part isn't on this page (a company with no price levels, say)
  // are left out rather than shown pointing at nothing
  const [steps] = useState(() => allSteps.filter(s => !s.target || visibleTarget(s.target)));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cardH, setCardH] = useState(200);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const next = () => (last ? onFinish("done") : setI(n => n + 1));
  const back = () => setI(n => Math.max(0, n - 1));

  // Bring the part into view, then follow it while the page scrolls or resizes
  useEffect(() => {
    const el = visibleTarget(step?.target);
    if (!el) { setRect(null); return; }
    // Bringing a row's buttons into view slides the results table sideways;
    // it slides back when the tour moves on
    const slid = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (p.scrollWidth > p.clientWidth && /(auto|scroll)/.test(getComputedStyle(p).overflowX)) slid.push([p, p.scrollLeft]);
    }
    // Glide when the part is already on screen; jump when it isn't, so the
    // card never waits over a half-scrolled page for its part to arrive
    const r0 = el.getBoundingClientRect();
    const onScreen = r0.bottom > 0 && r0.top < window.innerHeight && r0.right > 0 && r0.left < window.innerWidth;
    const behavior = reduced || !onScreen ? "auto" : "smooth";
    const cover = coveredTop(el);
    // A part taller than the room left starts just under the header, so its
    // top — usually the headline numbers — is what's in view
    if (r0.height > window.innerHeight - cover - 220) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      window.scrollBy({ top: el.getBoundingClientRect().top - cover - 12, behavior: "auto" });
    } else el.scrollIntoView({ block: "center", inline: "nearest", behavior });
    let frame;
    const follow = () => {
      const r = el.getBoundingClientRect();
      const next = { top: r.top, left: r.left, width: r.width, height: r.height, cover: coveredTop(el) };
      setRect(prev => (sameRect(prev, next) ? prev : next));
      setView(prev => (prev.w === window.innerWidth && prev.h === window.innerHeight ? prev : { w: window.innerWidth, h: window.innerHeight }));
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => {
      cancelAnimationFrame(frame);
      // Instantly, and only where this step moved it — a smooth slide here
      // would fight the next step's own scroll
      for (const [p, left] of slid) if (Math.abs(p.scrollLeft - left) > 2) p.scrollLeft = left;
    };
  }, [step?.target, reduced]);

  // A card in the middle of the screen has no part to follow, so the window
  // size is watched separately
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [i, view.w]);
  useEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [i]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onFinish("skip");
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!step) return null;

  // The lit-up box, kept on screen even when the part is taller than it
  const hole = rect && (() => {
    // Never light up the header over a part that has scrolled under it
    const top = Math.max(rect.top - PAD, rect.cover ? rect.cover + 4 : 8), bottom = Math.min(rect.top + rect.height + PAD, view.h - 8);
    const left = Math.max(rect.left - PAD, 8), right = Math.min(rect.left + rect.width + PAD, view.w - 8);
    return bottom - top > 4 && right - left > 4 ? { top, left, width: right - left, height: bottom - top } : null;
  })();

  // The card: below the part if it fits, else above, else over its lower
  // edge; on a phone, docked to whichever end of the screen is clear
  const phone = view.w < 640;
  const cardW = Math.min(380, view.w - 32);
  let cardPos;
  if (!hole) cardPos = { top: Math.max(16, (view.h - cardH) / 2), left: (view.w - cardW) / 2 };
  else if (phone) cardPos = hole.top + hole.height / 2 > view.h * 0.5 ? { top: 16, left: 16 } : { top: view.h - cardH - 16, left: 16 };
  else {
    const left = Math.min(Math.max(hole.left + hole.width / 2 - cardW / 2, 16), view.w - cardW - 16);
    if (hole.top + hole.height + 12 + cardH <= view.h - 16) cardPos = { top: hole.top + hole.height + 12, left };
    else if (hole.top - 12 - cardH >= 16) cardPos = { top: hole.top - 12 - cardH, left };
    else cardPos = { top: view.h - cardH - 16, left };
  }
  const move = reduced ? "none" : `top 300ms ${EASE}, left 300ms ${EASE}, width 300ms ${EASE}, height 300ms ${EASE}`;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      {/* Catches clicks so the page underneath isn't changed mid-tour */}
      <div style={{ position: "absolute", inset: 0, background: hole ? "transparent" : "rgba(6, 8, 14, 0.62)" }} />
      {hole && (
        <div style={{
          position: "fixed", ...hole, borderRadius: 12, pointerEvents: "none", transition: move,
          boxShadow: "0 0 0 2px var(--accent), 0 0 0 9999px rgba(6, 8, 14, 0.62)",
        }} />
      )}
      <div ref={cardRef} style={{
        position: "fixed", ...cardPos, width: phone ? view.w - 32 : cardW, boxSizing: "border-box", transition: move,
        background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "16px 18px 14px", boxShadow: "var(--sh-lg)",
      }}>
        <div key={i} style={{ animation: reduced ? "none" : "fadeUp 260ms cubic-bezier(0,0,0.2,1) backwards" }}>
          <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>{i + 1} of {steps.length}</div>
          <div id="tour-title" style={{ fontSize: 15, fontWeight: 650, color: "var(--t1)", letterSpacing: "-0.01em", marginBottom: 6 }}>{step.title}</div>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--t2)", margin: 0 }}>{step.body}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          {!last && <button type="button" onClick={() => onFinish("skip")} style={{ background: "none", border: "none", padding: "6px 2px", fontSize: 12.5, color: "var(--t3)", cursor: "pointer", fontFamily: "inherit" }}>Skip tour</button>}
          <span style={{ flex: 1 }} />
          {i > 0 && <button type="button" onClick={back} className="btn-ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}>Back</button>}
          <button ref={nextRef} type="button" onClick={next} className="btn-primary" style={{ height: 32, padding: "0 16px", fontSize: 12.5 }}>{last ? "Done" : i === 0 && !step.target ? "Start" : "Next"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
