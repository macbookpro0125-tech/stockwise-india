import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
// Inter, served with the app rather than from Google Fonts (no third-party
// request); the optical-size axis tightens it at heading sizes
import "@fontsource-variable/inter/opsz.css";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
