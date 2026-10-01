// credentials: "include" on every call — the session lives in an httpOnly
// cookie (server/http-server.js), so the browser must be told to send it;
// fetch omits cookies on same-origin requests through the Vite proxy by
// default only for cross-origin, but being explicit here means this still
// works once the API moves to its own subdomain in production.
async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  me: () => request("/api/auth/me"),
  signup: (email, password) => request("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  deleteAccount: (password) => request("/api/auth/delete-account", { method: "POST", body: JSON.stringify({ password }) }),
  presets: () => request("/api/presets"),
  metrics: () => request("/api/metrics"),
  marketStrip: () => request("/api/market-strip"),
  stats: () => request("/api/stats"),
  screen: (criteria) => request("/api/screen", { method: "POST", body: JSON.stringify(criteria) }),
  stock: (symbol) => request(`/api/stock/${encodeURIComponent(symbol)}`),
  prices: (symbol, range) => request(`/api/stock/${encodeURIComponent(symbol)}/prices?range=${range}`),
  // The stock page's other panels: technicals, shareholding, filings, news, peers
  panel: (symbol, name) => request(`/api/stock/${encodeURIComponent(symbol)}/${name}`),
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),
  currentPrices: (symbols) => request(`/api/prices?symbols=${symbols.map(encodeURIComponent).join(",")}`),
  watchlist: () => request("/api/watchlist"),
  addWatch: (ticker, price) => request("/api/watchlist", { method: "POST", body: JSON.stringify({ ticker, price }) }),
  setWatchNote: (ticker, note) => request(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "PUT", body: JSON.stringify({ note }) }),
  removeWatch: (ticker) => request(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" }),
  portfolio: () => request("/api/portfolio"),
  addHolding: (h) => request("/api/portfolio", { method: "POST", body: JSON.stringify(h) }),
  updateHolding: (id, h) => request(`/api/portfolio/${id}`, { method: "PUT", body: JSON.stringify(h) }),
  removeHolding: (id) => request(`/api/portfolio/${id}`, { method: "DELETE" }),
  performance: () => request("/api/performance"),
  takePerformanceSnapshot: () => request("/api/performance/snapshot", { method: "POST" }),
  listAlerts: (live = false) => request(`/api/alerts${live ? "?live=1" : ""}`),
  createAlert: (alert) => request("/api/alerts", { method: "POST", body: JSON.stringify(alert) }),
  updateAlert: (id, patch) => request(`/api/alerts/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  deleteAlert: (id) => request(`/api/alerts/${id}`, { method: "DELETE" }),
};
