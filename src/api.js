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
  presets: () => request("/api/presets"),
  screen: (criteria) => request("/api/screen", { method: "POST", body: JSON.stringify(criteria) }),
  stock: (symbol) => request(`/api/stock/${encodeURIComponent(symbol)}`),
  prices: (symbol, range) => request(`/api/stock/${encodeURIComponent(symbol)}/prices?range=${range}`),
  // The stock page's other panels: technicals, shareholding, filings, news, peers
  panel: (symbol, name) => request(`/api/stock/${encodeURIComponent(symbol)}/${name}`),
  watchlist: () => request("/api/watchlist"),
  addWatch: (ticker) => request("/api/watchlist", { method: "POST", body: JSON.stringify({ ticker }) }),
  removeWatch: (ticker) => request(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" }),
  listAlerts: () => request("/api/alerts"),
  createAlert: (alert) => request("/api/alerts", { method: "POST", body: JSON.stringify(alert) }),
  deleteAlert: (id) => request(`/api/alerts/${id}`, { method: "DELETE" }),
};
