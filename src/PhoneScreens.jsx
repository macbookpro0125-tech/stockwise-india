import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, ShieldCheck, Landmark, Percent, Tag, Scale, HandCoins, RotateCcw, TrendingUp, TrendingDown, ChevronsUp, Crown, Zap,
  Sprout, Rocket, Globe, Building2, Building, Mountain, ArrowUpRight, SlidersHorizontal, ChevronRight, ChevronLeft, Star, Search, Plus,
} from "lucide-react";
import { api } from "./api.js";
import { KINDS, kindOf } from "./strategyAbout.js";
import { strategiesStore } from "./accountData.js";
import { screensHome, useScreensHome, whenOpened } from "./screensHome.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { cardName } from "./stockName.js";
import { AdCard, useAdFeed } from "./ads.jsx";
import { tick } from "./haptics.js";

// Discover's first page on a phone (asked for 26 Oct 2026, after ten rounds of
// mock-ups): "Screeners" — the ones starred at the top, as cards that swipe,
// each saying which companies joined or left since it was last opened; then
// the ones opened lately on this phone; then the rest, a few at a time, with
// every screener a tap away on "All screeners" (in groups, each with its
// star). Calm on purpose: one plain line icon per screener, colour only where
// it means something (a group's dot, joined and left, the stars).

// One plain line icon a screener is known by (no tile, no colour)
const ICONS = {
  high_quality_compounders: BadgeCheck, defensive_bluechips: ShieldCheck, sound_banks: Landmark, ofss_style_filter: Percent,
  undervalued_growth: Tag, net_net_value: Scale, debt_paydown: HandCoins, turnaround_plays: RotateCcw, fallen_quality: TrendingDown,
  psu_value: Building, near_highs_cheap: Mountain, doubled_in_year: TrendingUp, up_every_timeframe: ChevronsUp, top_gainers: ArrowUpRight,
  dividend_aristocrats: Crown, dividend_growth: Sprout, momentum_growth: Zap, small_cap_multibaggers: Rocket,
  fii_favorites: Globe, dii_backed: Building2,
};
export const ScreenIcon = ({ p, size = 22 }) => {
  const I = ICONS[p.id] ?? SlidersHorizontal;
  return <I size={size} strokeWidth={1.75} aria-hidden="true" />;
};
const GROUP_HUE = { quality: "var(--accent)", value: "#A08BFF", income: "#F5C451", momentum: "#FF9F43", owners: "#5AA9FF", yours: "var(--accent)", other: "var(--t3)" };

const OPEN_ALL = "screensAll";
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const dateOf = iso => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null);
const n = v => Number(v).toLocaleString("en-IN");

// How many companies each screener has at the latest close, and its three
// best, counted four at a time so the first rows fill in quickly
function useCounts(list) {
  const [counts, setCounts] = useState({});
  const [pricesDate, setPricesDate] = useState(null);
  const key = JSON.stringify(list.map(p => [p.id, p.filters]));
  useEffect(() => {
    let stop = false;
    const queue = list.filter(p => Array.isArray(p.filters));
    const worker = async () => {
      for (let p = queue.shift(); p && !stop; p = queue.shift()) {
        try {
          const res = await api.screen({ filters: p.filters, countOnly: true, top: 3, ...(p.sort && { sort: p.sort }) });
          if (stop) return;
          setCounts(c => ({ ...c, [p.id]: { matched: res.matched, top: res.top ?? [] } }));
          if (res.snapshot?.pricesDate) setPricesDate(res.snapshot.pricesDate);
        } catch {
          if (!stop) setCounts(c => ({ ...c, [p.id]: { failed: true, top: [] } }));
        }
      }
    };
    for (let i = 0; i < 4; i++) worker();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [counts, pricesDate];
}

const companies = c => (c?.matched != null ? `${n(c.matched)} ${c.matched === 1 ? "company" : "companies"}` : c?.failed ? "—" : null);

function Logos({ top, size = 30 }) {
  if (!top?.length) return null;
  return (
    <span className="ps-logos" aria-hidden="true">
      {top.slice(0, 3).map((c, i) => <span key={c.symbol} style={{ zIndex: 3 - i }}><CompanyLogo symbol={c.symbol} size={size} fallback={c.name} /></span>)}
    </span>
  );
}

function StarButton({ p }) {
  const on = screensHome.isFavourite(p.id);
  return (
    <button type="button" className={`ps-star${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? `Remove ${p.name} from favourites` : `Add ${p.name} to favourites`}
      onClick={e => { e.stopPropagation(); tick(); screensHome.toggle(p.id); }}>
      <Star size={20} strokeWidth={1.75} fill={on ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

// A row of the grouped lists: icon, name, how many companies, then a badge
// or a star
function Row({ p, count, trail, onOpen }) {
  return (
    <li className="ps-row">
      <button type="button" className="ps-row-open" onClick={() => onOpen(p)}>
        <span className="ps-row-icon"><ScreenIcon p={p} /></span>
        <span className="ps-row-text">
          <span className="ps-row-name">{p.name}</span>
          <span className="ps-row-sub">{companies(count) ?? <span className="sc-skel" style={{ width: 80 }} aria-hidden="true" />}</span>
        </span>
      </button>
      {trail}
    </li>
  );
}

const changeBadge = ch => (ch?.joinedCount > 0
  ? <span className="ps-new">{ch.joinedCount} new</span>
  : null);

// A starred screener: its name and size; what joined or left since it was
// last opened, only when something did; then its day, every day (26 Oct
// 2026: "is that useful then?") — how its companies moved at the last close,
// the best and the worst, and which report results in the coming week
const pct = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
const tone = v => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");
const weekday = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const rupees = v => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v < 100 ? 2 : 0 })}`;

// Results this week, three at a time, moving on by itself every few seconds
// (26 Oct 2026: "these should change automatically and the price also")
const SHOWN = 3;
function ResultsTicker({ results, total }) {
  const [at, setAt] = useState(0);
  const pages = Math.ceil(results.length / SHOWN);
  useEffect(() => {
    if (pages < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setAt(i => (i + 1) % pages), 4000);
    return () => clearInterval(t);
  }, [pages]);
  const page = results.slice(at * SHOWN, at * SHOWN + SHOWN);
  return (
    <span className="ps-fav-results">
      <span className="ps-fav-since">
        Results this week{total > 1 ? ` · ${total}` : ""}
        {pages > 1 && <span className="ps-tick-dots" aria-hidden="true">{Array.from({ length: pages }, (_, i) => <i key={i} className={i === at ? "on" : ""} />)}</span>}
      </span>
      <span className="ps-results-list" key={at}>
        {page.map(r => (
          <span key={r.symbol} className="ps-result">
            <span className="ps-change-name">{cardName(r.name || r.symbol)} <small>{weekday(r.date)}</small></span>
            {r.cmp != null && <span className="ps-price">{rupees(r.cmp)}</span>}
            {r.ret1d != null && <em className={`ps-move ${tone(r.ret1d)}`}>{pct(r.ret1d)}</em>}
          </span>
        ))}
      </span>
    </span>
  );
}

function FavouriteCard({ p, count, change, day, closeDate, onOpen }) {
  const changed = (change?.joinedCount ?? 0) + (change?.leftCount ?? 0);
  const rows = [...(change?.joined ?? []).slice(0, 2).map(c => ({ ...c, how: "Joined" })), ...(change?.left ?? []).slice(0, 2).map(c => ({ ...c, how: "Left" }))].slice(0, 3);
  const more = changed - rows.length;
  const since = dateOf(change?.seenAt);
  const movers = day ? [day.best && { ...day.best, way: "best" }, day.worst && { ...day.worst, way: "worst" }].filter(Boolean) : [];
  return (
    <button type="button" className="ps-fav" onClick={() => onOpen(p)} aria-label={`Open ${p.name}`}>
      <span className="ps-fav-head">
        <span>
          <span className="ps-fav-name">{p.name}</span>
          <span className="ps-row-sub">{companies(count) ?? "\u00a0"}</span>
        </span>
        <Logos top={count?.top} />
      </span>
      {changed > 0 && (
        <span className="ps-fav-changes">
          <span className="ps-fav-since">Since you opened it{since ? `, ${since}` : ""}</span>
          {rows.map(c => (
            <span key={c.how + c.symbol} className="ps-change">
              <CompanyLogo symbol={c.symbol} size={22} fallback={c.name} />
              <span className="ps-change-name">{cardName(c.name || c.symbol)}</span>
              <em className={c.how === "Joined" ? "joined" : "left"}>{c.how}</em>
            </span>
          ))}
          {more > 0 && <span className="ps-fav-since">and {more} more</span>}
        </span>
      )}
      {day && (
        <span className="ps-fav-changes ps-fav-day">
          {day.avg1d != null && (
            <span className="ps-fav-since">
              <em className={`ps-move ${tone(day.avg1d)}`}>{pct(day.avg1d)}</em> on average{closeDate ? ` at the ${closeDate} close` : " at the last close"}
            </span>
          )}
          {movers.map(m => (
            <span key={m.way} className="ps-change">
              <CompanyLogo symbol={m.symbol} size={22} fallback={m.name} />
              <span className="ps-change-name">{cardName(m.name || m.symbol)}</span>
              {m.cmp != null && <span className="ps-price">{rupees(m.cmp)}</span>}
              <em className={`ps-move ${tone(m.ret1d)}`}>{pct(m.ret1d)}</em>
            </span>
          ))}
          {day.resultsCount > 0 && <ResultsTicker results={day.results} total={day.resultsCount} />}
        </span>
      )}
      <span className="ps-fav-go" aria-hidden="true"><ChevronRight size={16} /></span>
    </button>
  );
}

export default function PhoneScreens({ onSelect, onNewScreen, continueCard = null, theme = "dark" }) {
  const [presets, setPresets] = useState([]);
  const [custom, setCustom] = useState(strategiesStore.get);
  const { favourites, changes, today, pricesDate: closeIso, recents } = useScreensHome();
  const [all, setAll] = useState(() => !!window.history.state?.[OPEN_ALL]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [favAt, setFavAt] = useState(0);

  useEffect(() => { api.presets().then(setPresets).catch(() => {}); }, []);
  useEffect(() => {
    const fn = () => setCustom(strategiesStore.get());
    window.addEventListener("customPresetsUpdated", fn);
    return () => window.removeEventListener("customPresetsUpdated", fn);
  }, []);
  // "All screeners" is a history entry: Back (the browser's or Android's) returns
  useEffect(() => {
    const fn = () => setAll(!!window.history.state?.[OPEN_ALL]);
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);
  useAdFeed("strategies", theme, "medium");

  const list = [...presets, ...custom];
  const byId = new Map(list.map(p => [p.id, p]));
  const [counts, pricesDate] = useCounts(list);

  const open = p => { screensHome.opened(p.id); if (p.custom) strategiesStore.acknowledge(p.id); onSelect(p); };
  const showAll = k => {
    setKind(k ?? "all"); setQuery("");
    window.history.pushState({ ...(window.history.state ?? {}), [OPEN_ALL]: true }, "");
    setAll(true);
    window.scrollTo(0, 0);
  };
  const closeAll = () => { if (window.history.state?.[OPEN_ALL]) window.history.back(); else setAll(false); };

  const favs = favourites.map(id => byId.get(id)).filter(Boolean);
  const recent = recents.filter(r => byId.has(r.id)).slice(0, 6);
  // a starred one opened lately shows in both (26 Oct 2026: "Recently opened only shows one")
  const shownIds = new Set([...favs.map(p => p.id), ...recent.map(r => r.id)]);
  const rest = list.filter(p => !shownIds.has(p.id));
  const brandNew = !favs.length && !recent.length;

  // The favourites rail: which card is in view, for its dots
  const railRef = useRef(null);
  const onRail = () => {
    const rail = railRef.current, first = rail?.firstElementChild;
    if (!first) return;
    const at = Math.round(rail.scrollLeft / (first.getBoundingClientRect().width + 12));
    if (at !== favAt) { setFavAt(at); tick(); }
  };

  if (all) {
    const q = query.trim().toLowerCase();
    const kinds = [["all", "All"], ["favourites", "Favourites"], ...KINDS.map(k => [k[0], k[1]]), ...(custom.length ? [["yours", "Yours"]] : [])];
    const match = p => !q || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q);
    const groups = (kind === "favourites"
      ? [{ id: "favourites", label: "Favourites", items: favs }]
      : [...KINDS.map(([id, label]) => ({ id, label, items: list.filter(p => kindOf(p)[0] === id) })), { id: "yours", label: "Yours", items: custom }]
        .filter(g => kind === "all" || g.id === kind))
      .map(g => ({ ...g, items: g.items.filter(match) })).filter(g => g.items.length);
    return (
      <div className="ps ps-all">
        <button type="button" className="ps-back" onClick={closeAll}><ChevronLeft size={18} aria-hidden="true" /> Screeners</button>
        <div className="ps-title-row">
          <h2 className="phone-title">All screeners</h2>
          <button type="button" className="ps-round" onClick={onNewScreen} aria-label="New screener"><Plus size={20} aria-hidden="true" /></button>
        </div>
        <label className="ps-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" placeholder={`Search ${list.length || ""} screeners`} value={query} onChange={e => setQuery(e.target.value)} aria-label="Search screeners" enterKeyHint="search" autoComplete="off" />
        </label>
        <div className="ps-tabs" role="group" aria-label="Show one group">
          {kinds.map(([id, label]) => <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>)}
        </div>
        {!list.length && <div className="ps-group skeleton-pulse" style={{ height: 220 }} aria-hidden="true" />}
        {list.length > 0 && !groups.length && <p className="ps-empty">{kind === "favourites" && !q ? "Tap the star on any screener to keep it at the top of Screeners." : `No screener matches “${query.trim()}”.`}</p>}
        {groups.map((g, gi) => (
          <section key={g.id} aria-labelledby={`ps-g-${g.id}`}>
            <h3 className="ps-h" id={`ps-g-${g.id}`}><i className="ps-dot" style={{ background: GROUP_HUE[g.id] ?? GROUP_HUE.yours }} aria-hidden="true" />{g.label}</h3>
            <ul className="ps-group">
              {g.items.map(p => <Row key={p.id} p={p} count={counts[p.id]} onOpen={open} trail={<StarButton p={p} />} />)}
            </ul>
            {gi === 1 && <AdCard feed="strategies" slot="screens-all" size="medium" />}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="ps">
      <h2 className="phone-title">Screeners</h2>
      <p className="ps-meta">{list.length ? `${list.length} screeners` : " "}{pricesDate ? ` · NSE close, ${dateOf(pricesDate)}` : ""}</p>
      {continueCard}

      <div className="ps-h-row">
        <h3 className="ps-h">Favourites</h3>
        {favs.length > 0 && <button type="button" className="ps-link" onClick={() => showAll("favourites")}>Edit</button>}
      </div>
      {favs.length ? (
        <>
          <div className="ps-favs" ref={railRef} onScroll={onRail} role="group" aria-label="Your favourite screeners">
            {favs.map(p => <FavouriteCard key={p.id} p={p} count={counts[p.id]} change={changes[p.id]} day={today[p.id]} closeDate={dateOf(closeIso ?? pricesDate)} onOpen={open} />)}
          </div>
          {favs.length > 1 && <div className="ps-dots" aria-hidden="true">{favs.map((p, i) => <i key={p.id} className={i === Math.min(favAt, favs.length - 1) ? "on" : ""} />)}</div>}
        </>
      ) : (
        <div className="ps-fav ps-fav-empty">
          <span className="ps-fav-name">Keep your screeners here</span>
          <span className="ps-row-sub">Star a screener and it stays at the top, with the companies that joined or left since you last looked.</span>
          <button type="button" className="ps-pill" onClick={() => showAll("all")}>Browse all {list.length || ""}</button>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h3 className="ps-h">Recently opened</h3>
          <div className="ps-recents" role="group" aria-label="Screeners you opened lately">
            {recent.map(r => {
              const p = byId.get(r.id);
              return (
                <button key={r.id} type="button" className="ps-recent" onClick={() => open(p)}>
                  <ScreenIcon p={p} size={24} />
                  <span className="ps-row-name">{p.name}</span>
                  <span className="ps-row-sub">{whenOpened(r.at)}{counts[p.id]?.matched != null ? ` · ${n(counts[p.id].matched)} cos` : ""}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="ps-h-row">
        <h3 className="ps-h">{brandNew ? "Start with one of these" : "More screeners"}</h3>
        <button type="button" className="ps-link" onClick={() => showAll("all")}>See all</button>
      </div>
      <ul className="ps-group" data-tour="strategies">
        {!list.length && [0, 1, 2].map(i => <li key={i} className="ps-row"><span className="sc-skel" style={{ width: "70%", height: 18 }} aria-hidden="true" /></li>)}
        {(brandNew ? rest.slice(0, 4) : rest.slice(0, 5)).map(p => (
          <Row key={p.id} p={p} count={counts[p.id]} onOpen={open}
            trail={brandNew ? <StarButton p={p} /> : <span className="ps-trail">{changeBadge(changes[p.id])}<ChevronRight size={17} aria-hidden="true" /></span>} />
        ))}
      </ul>
      <AdCard feed="strategies" slot="screens-home" size="medium" />
    </div>
  );
}

// Opening "All screeners" from elsewhere (the + sheet's Browse, Settings)
export const PHONE_SCREENS_ALL = OPEN_ALL;
