// The ways in on the public pages a search or a post lands on (28 Oct 2026,
// "to see everything they need to log in so we gain them"): a card saying
// what a free account adds, a slim bar on a phone once the top has scrolled
// by, and the sign-up box right on the page, saying why it opened — as a
// company's public page does (PublicStock.jsx). Signed in, none of it shows.
// After signing in or up, the app.
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import AuthDialog from "./AuthDialog.jsx";

// [open(why, mode), the box] — one per page
export function useJoin() {
  const [auth, setAuth] = useState(null);
  const open = (why = null, mode = "signup") => setAuth({ why, mode });
  const box = auth && (
    <AuthDialog mode={auth.mode} onModeChange={mode => setAuth(a => ({ ...a, mode }))} reason={auth.why}
      onAuthed={() => window.location.assign("/")} onClose={() => setAuth(null)} />
  );
  return [open, box];
}

// What an account adds, in a few lines, and its button
export function JoinCard({ title, points, why, cta = "Create a free account", onJoin }) {
  return (
    <section className="pj-card" aria-label={title}>
      <h2>{title}</h2>
      <ul>{points.map(p => <li key={p}><Check size={16} aria-hidden="true" /><span>{p}</span></li>)}</ul>
      <button type="button" className="btn-primary pj-cta" onClick={() => onJoin(why)}>{cta}</button>
      <p className="pj-small">Free while in early access. No card needed.</p>
    </section>
  );
}

// A phone: a slim bar into a free account once the page's top has gone by
export function JoinBar({ label, cta = "Free account", why, onJoin }) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > 700);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className={`ps-sticky${past ? " on" : ""}`} aria-hidden={!past}>
      <span><b>{label}</b></span>
      <button type="button" className="btn-primary" tabIndex={past ? undefined : -1} onClick={() => onJoin(why)}>{cta}</button>
    </div>
  );
}
