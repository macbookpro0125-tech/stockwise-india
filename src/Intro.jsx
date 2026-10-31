import { useEffect, useMemo, useRef, useState } from "react";

// The opening (31 Oct 2026, "I want this kind of opening when I open my
// app… make something cool"): the JI tile rising out of a navy field with a
// teal glow, faint rays and drifting sparks; a ring that fills as the app
// really gets ready; three lines that type themselves out and tick when what
// they name has loaded (the app, the latest NSE close, the ready-made
// screens) — facts from the server, nothing staged; then the name, and the
// whole of it dissolves into the app.
//
// When: each start of the phone app; in a browser once a visit, on the front
// page. Never for a test browser or a search engine (navigator.webdriver), nor
// with reduced motion. A tap skips it. At most 2.6 s, however slow the server.
const MIN_MS = 1700, MAX_MS = 2600;

function wanted() {
  if (typeof window === "undefined") return false;
  if (navigator.webdriver || /bot|crawl|spider|lighthouse/i.test(navigator.userAgent)) return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  if (new URLSearchParams(location.search).has("nointro")) return false;
  if (document.documentElement.classList.contains("in-app")) return true;
  if (location.pathname !== "/") return false;
  try {
    if (sessionStorage.getItem("introSeen")) return false;
    sessionStorage.setItem("introSeen", "1");
  } catch {}
  return true;
}

const shortDay = d => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

// the facts, straight from the server, given up on after the longest the opening lasts
async function facts() {
  const ctl = new AbortController();
  const stop = setTimeout(() => ctl.abort(), MAX_MS - 300);
  try {
    const r = await fetch("/api/public/screens", { signal: ctl.signal });
    if (!r.ok) return null;
    const d = await r.json();
    return { date: d.pricesDate ?? null, screens: d.screens?.length ?? null };
  } catch {
    return null;
  } finally {
    clearTimeout(stop);
  }
}

// set before the app's first effects run, so what waits for the opening
// (StarFilm.jsx's 3D scene) knows to wait; cleared, with an "intro-leaving"
// event, the moment the opening starts to go
function decide() {
  const yes = wanted();
  if (yes) window.__introActive = true;
  return yes;
}

export default function Intro() {
  const [on, setOn] = useState(decide);
  const [leaving, setLeaving] = useState(false);
  const [app, setApp] = useState(false);
  const [f, setF] = useState(undefined); // undefined: still asking; null: no answer
  const started = useRef(performance.now());
  // the ring creeps on by itself (to 80% over the shortest opening) so it never
  // sits still; each real step that's done lifts it at least that far
  const [creep, setCreep] = useState(0);
  // how many lines have finished typing (each takes its turn: index.css .intro-lines li);
  // a line ticks only once it's typed, so the ring and the lines finish together
  const [typed, setTyped] = useState(0);
  const done = useRef(false);

  // eighteen sparks, each its own place, size, speed and delay
  const sparks = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 37 + 11) % 100}%`, top: `${40 + ((i * 53) % 55)}%`,
    size: 1.5 + ((i * 7) % 3), dur: `${3.2 + ((i * 13) % 20) / 10}s`, delay: `${-((i * 17) % 30) / 10}s`,
  })), []);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    window.__introActive = false;
    window.dispatchEvent(new Event("intro-leaving"));
    setTimeout(() => setOn(false), 520);
  };

  useEffect(() => {
    if (!on) return;
    const t1 = setTimeout(() => setApp(true), 380);
    const typing = [1110, 1390, 1670].map((ms, i) => setTimeout(() => setTyped(i + 1), ms));
    const tick = setInterval(() => setCreep(Math.min(0.8, ((performance.now() - started.current) / MIN_MS) * 0.8)), 90);
    facts().then(setF);
    const cap = setTimeout(finish, MAX_MS);
    return () => { clearTimeout(t1); clearTimeout(cap); clearInterval(tick); typing.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // everything in (or given up on) and the opening has had its moment: away
  useEffect(() => {
    if (!on || !app || f === undefined) return;
    const left = Math.max(0, MIN_MS - (performance.now() - started.current));
    const t = setTimeout(finish, left);
    return () => clearTimeout(t);
  }, [app, f]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!on) return null;
  const lines = [
    { text: "Opening your research desk", ok: app && typed > 0 },
    { text: f?.date ? `Prices · NSE close of ${shortDay(f.date)}` : "Prices · NSE's daily close", ok: !!f?.date && typed > 1, failed: f === null },
    { text: f?.screens ? `${f.screens} ready-made screens` : "Ready-made screens", ok: !!f?.screens && typed > 2, failed: f === null },
  ];
  const progress = leaving ? 1 : Math.max(creep, lines.filter(l => l.ok).length / 3);
  const pctShown = Math.min(100, Math.round(progress * 100));
  const R = 64, C = 2 * Math.PI * R;
  return (
    <div className={`intro${leaving ? " leaving" : ""}`} role="status" aria-label="Opening Jocular Insights" onClick={finish}>
      <div className="intro-glow" aria-hidden="true" />
      <div className="intro-rays" aria-hidden="true" />
      <div className="intro-sparks" aria-hidden="true">
        {sparks.map((s, i) => <i key={i} style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDuration: s.dur, animationDelay: s.delay }} />)}
      </div>
      <div className="intro-core" aria-hidden="true">
        <svg className="intro-ring" viewBox="0 0 160 160" width="160" height="160">
          <circle cx="80" cy="80" r={R} className="intro-ring-track" />
          <circle cx="80" cy="80" r={R} className="intro-ring-fill" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - Math.min(1, progress)) }} />
        </svg>
        <img className="intro-mark" src="/jocular-insights-mark.svg" alt="" width="92" height="92" decoding="sync" />
      </div>
      <div className="intro-name" aria-hidden="true">Jocular <span>Insights</span></div>
      <div className="intro-tag" aria-hidden="true">Indian stock market research</div>
      <ul className="intro-lines" aria-hidden="true">
        {lines.map((l, i) => (
          <li key={i} className={l.ok ? "ok" : l.failed ? "failed" : ""} style={{ animationDelay: `${0.55 + i * 0.28}s` }}>
            <span className="intro-tick">{l.ok ? "✓" : "·"}</span><span className="intro-text">{l.text}</span>
          </li>
        ))}
      </ul>
      <div className="intro-bar" aria-hidden="true">
        <span className="intro-bar-track"><span style={{ width: `${pctShown}%` }} /></span>
        <span className="intro-bar-label">Getting ready · {pctShown}%</span>
      </div>
    </div>
  );
}
