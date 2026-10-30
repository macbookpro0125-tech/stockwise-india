import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Inter, served with the app rather than from Google Fonts (no third-party
// request); the optical-size axis tightens it at heading sizes
import "@fontsource-variable/inter/opsz.css";
import "./index.css";
import { installGlow } from "./glow.js";
import { installFastNumbers } from "./fastNumbers.js";
import { onReconnecting } from "./api.js";
import "./installApp.js"; // early: the browser offers installing soon after load

installFastNumbers();
installGlow();

// Android draws a frosted blur again for every frame of a scroll: measured in
// the app on 26 Oct 2026, 61-66% of frames came too late with it, 4% without.
// There the glass goes clear, with the floating parts a little more solid
// (index.css html.no-blur); an iPhone keeps the blur, which it draws smoothly
if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add("no-blur");

// A company page includes the same public figures as JSON beside its
// crawlable HTML. Read them before React replaces #root so the first client
// render can keep the page visible while the session check runs.
try {
  const data = document.getElementById("public-stock-data");
  if (data) window.__PUBLIC_STOCK__ = JSON.parse(data.textContent);
  // and a company's financials, results or call page, /explore or /news (PublicHtmlPage.jsx)
  const page = document.getElementById("public-page-data");
  if (page) window.__PUBLIC_PAGE__ = JSON.parse(page.textContent);
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

// Once the app has drawn itself, the root is shown (index.html keeps it
// unseen in the app till then, so the search engines' page doesn't flash)
function Drawn() {
  useEffect(() => { document.documentElement.classList.add("app-drawn"); }, []);
  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <ReconnectNotice />
    <Drawn />
  </StrictMode>
);
// started: the page's guard (index.html) shows no "didn't start" message
window.__appStarted = true;
// Counted as a visit only now the page has started in a browser, which most
// robots never do (server/visits.js): the page and the link it came from
try {
  fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: location.pathname, referrer: document.referrer }), keepalive: true, credentials: "omit" }).catch(() => {});
} catch {}
document.getElementById("boot-guard")?.remove();
