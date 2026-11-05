import { useEffect, useState } from "react";
import { Search, Bell, Sun, Moon } from "lucide-react";
import { tabsFor, useTabBadges } from "./Header.jsx";
import { BrandMark } from "./site.jsx";
import StockSearchBar from "./StockSearchBar.jsx";
import AccountMenu from "./AccountMenu.jsx";

// A computer's top bar (5 Nov 2026, replacing the bar down the left), made
// clean and flat after TradingView's (6 Nov 2026: "this looks clean, I need
// like this for the top bar"): straight on the page, edge to edge — the
// mark, a rounded search, the pages as plain words, then the alerts bell,
// light and dark, and the account. Once the page scrolls it takes a quiet
// backing. The other pages (Performance, Momentum, Visitors) are in the
// account menu. A phone keeps its own top bar and bottom tabs (Header.jsx).

const PAGES = ["discover", "workspace", "desk", "markets", "explore", "map", "watchlist", "portfolio"];
const LABEL = { map: "Map" };
const MORE = ["performance", "momentum", "visitors"];

export default function TopBar({ tab, onTab, account, onLogout, onDeleted, onSearch, theme, onToggleTheme, onTour }) {
  const badges = useTabBadges();
  const all = tabsFor(account);
  const byId = Object.fromEntries(all.map(t => [t.id, t]));
  const pages = PAGES.filter(id => byId[id]);
  const more = MORE.filter(id => byId[id]).map(id => ({ id, label: byId[id].label, on: tab === id }));
  const reached = badges.alerts.badgeColor === "var(--yellow)";

  // a backing once the page has scrolled under it
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // a narrow window has a search button: it opens the field, focused, over
  // the pages; it goes again once you leave it
  const [searching, setSearching] = useState(false);
  const openSearch = () => {
    setSearching(true);
    requestAnimationFrame(() => document.querySelector(".tb-search input")?.focus());
  };

  return (
    <div className={`tb${scrolled ? " tb-scrolled" : ""}${searching ? " tb-searching" : ""}`}>
      {/* the site's name as the page's top heading, as the old header had it */}
      <h1 className="sr-only">Jocular Insights</h1>
      <a href="/" className="tb-logo" aria-label="Jocular Insights home" onClick={e => { e.preventDefault(); onTab("discover"); }}>
        <BrandMark size={null} className="tb-mark" />
        <span className="tb-word">Jocular <span>Insights</span></span>
      </a>
      <div className="tb-search" data-tour="search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setSearching(false), 200); }}>
        <StockSearchBar onAnalyze={onSearch} placeholder="Search stocks" />
      </div>
      <nav className="tb-nav" aria-label="Pages" data-tour="tabs">
        {pages.map(id => {
          const on = tab === id, b = badges[id] ?? {};
          return (
            <button key={id} type="button" className={`tb-tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => onTab(id)}>
              {LABEL[id] ?? byId[id].label}
              {b.news && <><i className="tb-news" aria-hidden="true" /><span className="sr-only">, new from your companies</span></>}
            </button>
          );
        })}
      </nav>
      <span className="tb-space" />
      <div className="tb-end">
        <button type="button" className="tb-ib tb-search-ib" onClick={openSearch} aria-label="Search stocks"><Search size={19} aria-hidden="true" /></button>
        <button type="button" className={`tb-ib${tab === "alerts" ? " on" : ""}`} onClick={() => onTab("alerts")} aria-label={`Alerts${reached ? ", a price was reached" : ""}`} title="Alerts">
          <Bell size={19} aria-hidden="true" />{reached && <i className="tb-dot" aria-hidden="true" />}
        </button>
        <button type="button" className="tb-ib tb-theme" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
          {theme === "dark" ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </button>
        <AccountMenu account={account} onLogout={onLogout} onDeleted={onDeleted} onTour={onTour} avatar={!!account} pages={more} onTab={onTab} />
      </div>
    </div>
  );
}
