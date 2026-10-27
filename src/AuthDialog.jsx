import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pause, Play } from "lucide-react";
import AuthForm from "./AuthForm.jsx";
import SkyPanel from "./SkyPanel.jsx";
import StrategyMark from "./StrategyMarks.jsx";
import { Logo } from "./site.jsx";
import "./auth.css";

// What's inside, drawn small in the app's own shapes — no figures: the
// six-part score ring, the fair-value gauge, a strategy's mark (16 Oct 2026,
// "the sky side should show what the app is")
const ScoreRing = () => (
  <svg viewBox="0 0 40 40" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5].map(k => {
      const a0 = -Math.PI / 2 + k * Math.PI / 3 + 0.09, a1 = a0 + Math.PI / 3 - 0.18;
      const p = a => `${(20 + 14 * Math.cos(a)).toFixed(2)} ${(20 + 14 * Math.sin(a)).toFixed(2)}`;
      return <path key={k} d={`M${p(a0)}A14 14 0 0 1 ${p(a1)}`} fill="none" stroke="#00E0BE" strokeWidth="3.4" strokeLinecap="round" opacity={k < 5 ? 1 : 0.25} />;
    })}
    <circle cx="20" cy="20" r="3.2" fill="#fff" />
  </svg>
);
const Gauge = () => (
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M7 27a13 13 0 0 1 26 0" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M7 27a13 13 0 0 1 9.5-12.5" fill="none" stroke="#00E0BE" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M20 27L12.5 17.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="20" cy="27" r="2.6" fill="#fff" />
  </svg>
);
const POINTS = [
  { icon: <ScoreRing />, title: "A quality score for every company", line: "Every NSE company, scored on its own filings." },
  { icon: <Gauge />, title: "A fair value from its own history", line: "Its usual P/E on this year's earnings — and your own price levels, if you want them." },
  { icon: <StrategyMark preset={{ id: "dividend_aristocrats" }} size={26} />, title: "Strategies ready to run", line: "Start from a classic screen, or build your own." },
];

// Sign in and sign up, as a full-window dialog (asked for 16 Oct 2026, after a
// trading site's): on the left a large panel with the front page's live star
// sky (SkyPanel.jsx), which draws its constellations as the form fills in and
// closes the star's score ring when you're in; on the right the logo, a close
// button and the steps (AuthForm.jsx). Esc or the close button returns to the
// page; focus goes to the dialog and back to what opened it. While it's open
// the film behind it rests (html.auth-open). On the sky, three tiles say
// what's inside; the logo sits with the form. On a phone the sky fills the
// top and the steps rise from the bottom as a sheet, near the thumb.
// reason: why it opened, said above the form (a company page's "Add to
// watchlist" — 27 Oct 2026)
export default function AuthDialog({ mode, onModeChange, onAuthed, onClose, reason = null }) {
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  // In: the ring closes for a moment, then the app (straight away for less motion)
  const done = useCallback(user => {
    setSuccess(true);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => onAuthed(user), still ? 0 : 850);
  }, [onAuthed]);

  useEffect(() => {
    const opener = document.activeElement;
    const key = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input, button.auth-choice")?.focus();
    document.documentElement.classList.add("auth-open");
    return () => {
      document.documentElement.classList.remove("auth-open");
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="auth-dialog" role="dialog" aria-modal="true" aria-label={mode === "signup" ? "Create your account" : "Sign in"}>
      <div className="auth-visual">
        <SkyPanel className="auth-sky" progress={progress} success={success} paused={paused} />
        <p className="auth-visual-line">Read the filings first.<br />Then decide.</p>
        <ul className="auth-points">
          {POINTS.map((p, i) => (
            <li key={p.title} style={{ "--i": i }}>
              <span className="auth-point-icon">{p.icon}</span>
              <span><b>{p.title}</b><span>{p.line}</span></span>
            </li>
          ))}
        </ul>
        <button type="button" className="auth-pause" onClick={() => setPaused(p => !p)} aria-label={paused ? "Play the animation" : "Pause the animation"}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
      <div className="auth-side">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
        <div className="auth-body">
          <div className="auth-brand"><Logo size={19} /></div>
          {reason && <p className="auth-reason">{reason}</p>}
          <AuthForm onAuthed={done} onProgress={setProgress} mode={mode} onModeChange={onModeChange} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
