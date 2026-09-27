import { useState, useEffect } from "react";
import { api } from "./api.js";

// One shared, refreshable copy of a signed-in user's data (portfolio, alerts),
// so the tab counts in the header and the tab itself agree without each
// fetching separately. The watchlist has its own store (watchlist.js) because
// its stars update optimistically.
function createStore(load) {
  let value = null;
  let pending = null;
  const listeners = new Set();
  const refresh = () => {
    pending ??= load()
      .then(v => { value = v; listeners.forEach(fn => fn(v)); })
      .catch(() => {})
      .finally(() => { pending = null; });
    return pending;
  };
  function use() {
    const [v, setV] = useState(value);
    useEffect(() => {
      listeners.add(setV);
      if (value) setV(value); else refresh();
      return () => listeners.delete(setV);
    }, []);
    return v;
  }
  const reset = () => { value = null; };
  return { use, refresh, reset };
}

export const portfolioStore = createStore(() => api.portfolio());
export const alertsStore = createStore(() => api.listAlerts());
