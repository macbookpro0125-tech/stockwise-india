import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Inter, served with the app rather than from Google Fonts (no third-party
// request); the optical-size axis tightens it at heading sizes
import "@fontsource-variable/inter/opsz.css";
import "./index.css";
import { installGlow } from "./glow.js";
import { onReconnecting } from "./api.js";
import "./installApp.js"; // early: the browser offers installing soon after load

installGlow();

// A company page includes the same public figures as JSON beside its
// crawlable HTML. Read them before React replaces #root so the first client
// render can keep the page visible while the session check runs.
try {
  const data = document.getElementById("public-stock-data");
  if (data) window.__PUBLIC_STOCK__ = JSON.parse(data.textContent);
} catch {}

// The installed app's frame (public/sw.js) — built copies only: the dev server
// serves source files that change on every save
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

// While a deploy swaps the server (20–30 s), requests wait it out (api.js):
// a small notice says so, rather than an error
function ReconnectNotice() {
  const [on, setOn] = useState(false);
  useEffect(() => onReconnecting(setOn), []);
  return on ? <div role="status" className="reconnect-notice">Jocular Insights is updating — reconnecting…</div> : null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <ReconnectNotice />
  </StrictMode>
);
// started: the page's guard (index.html) shows no "didn't start" message
window.__appStarted = true;
document.getElementById("boot-guard")?.remove();
