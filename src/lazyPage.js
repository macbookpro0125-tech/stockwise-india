import { lazy } from "react";

// React.lazy, plus one reload when the file can't be fetched. Each deploy
// renames the build's files; a tab opened before it asks for the old names,
// and without this it showed a blank page until reloaded by hand (found on
// 12 Oct 2026, once screens began loading on demand). The flag stops a
// reload loop if the file is truly missing.
const FLAG = "stockwise-chunk-reload";

export function lazyPage(load) {
  return lazy(() => load().then(
    mod => {
      try { sessionStorage.removeItem(FLAG); } catch { /* storage blocked */ }
      return mod;
    },
    err => {
      let reloaded = true;
      try { reloaded = sessionStorage.getItem(FLAG) === "1"; if (!reloaded) sessionStorage.setItem(FLAG, "1"); } catch { /* storage blocked: don't risk a loop */ }
      if (!reloaded) {
        window.location.reload();
        return new Promise(() => {}); // the page is going away
      }
      throw err;
    },
  ));
}
