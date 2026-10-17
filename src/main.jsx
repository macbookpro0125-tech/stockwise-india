import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Inter, served with the app rather than from Google Fonts (no third-party
// request); the optical-size axis tightens it at heading sizes
import "@fontsource-variable/inter/opsz.css";
import "./index.css";
import { installGlow } from "./glow.js";
import "./installApp.js"; // early: the browser offers installing soon after load

installGlow();

// The installed app's frame (public/sw.js) — built copies only: the dev server
// serves source files that change on every save
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
