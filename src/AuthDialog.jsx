import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pause, Play } from "lucide-react";
import AuthForm from "./AuthForm.jsx";
import Orbit from "./Orbit.jsx";
import { Logo } from "./site.jsx";
import "./auth.css";

// Sign in and sign up, as a full-window dialog (asked for 16 Oct 2026, after a
// trading site's): on the left a large panel with Earth from orbit (Orbit.jsx)
// and one line of ours; on the right the logo, a close button and the steps
// (AuthForm.jsx). Esc or the close button returns to the page; focus goes to
// the dialog and back to what opened it. On a phone the panel becomes a band.
export default function AuthDialog({ mode, onModeChange, onAuthed, onClose }) {
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const opener = document.activeElement;
    const key = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input, button.auth-choice")?.focus();
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="auth-dialog" role="dialog" aria-modal="true" aria-label={mode === "signup" ? "Create your account" : "Sign in"}>
      <div className="auth-visual">
        <Orbit horizon={0.64} paused={paused} />
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
          <AuthForm onAuthed={onAuthed} mode={mode} onModeChange={onModeChange} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
