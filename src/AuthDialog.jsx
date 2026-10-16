import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pause, Play } from "lucide-react";
import AuthForm from "./AuthForm.jsx";
import SkyPanel from "./SkyPanel.jsx";
import { Logo } from "./site.jsx";
import "./auth.css";

// Sign in and sign up, as a full-window dialog (asked for 16 Oct 2026, after a
// trading site's): on the left a large panel with the front page's live star
// sky (SkyPanel.jsx), which draws its constellations as the form fills in and
// closes the star's score ring when you're in; on the right the logo, a close
// button and the steps (AuthForm.jsx). Esc or the close button returns to the
// page; focus goes to the dialog and back to what opened it. While it's open
// the film behind it rests (html.auth-open). On a phone the panel is a band.
export default function AuthDialog({ mode, onModeChange, onAuthed, onClose }) {
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
        <button type="button" className="auth-pause" onClick={() => setPaused(p => !p)} aria-label={paused ? "Play the animation" : "Pause the animation"}>
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
      <div className="auth-side">
        <div className="auth-top">
          <Logo />
          <button type="button" className="auth-close" onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="auth-body">
          <AuthForm onAuthed={done} onProgress={setProgress} mode={mode} onModeChange={onModeChange} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
