import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, MessagesSquare, Newspaper, Building2, Wrench, ExternalLink, Play, Search } from "lucide-react";
import { api } from "./api.js";
import { webLinks, searchName, SEARCH_ALL } from "./webLinks.js";
import { useOnScreen } from "./popPlace.js";

// A company page's "Around the web" (24 Oct 2026: "show tweets, Reddit and
// YouTube videos about the stock in one place; in one click search the whole
// internet"): its recent YouTube videos, played here in YouTube's own player
// (server/videos.js, when the server has a YouTube key), then a search for it
// on each site people talk about it — X, Reddit, ValuePickr, the news, NSE,
// its concalls — each opening in a new tab, and Search all for the main four.

const GROUP_ICON = [MessagesSquare, Newspaper, Building2, Wrench];
const ago = iso => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
};

function Video({ v }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="atw-video">
      <div className="atw-frame">
        {playing
          ? <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          : (
            <button type="button" className="atw-thumb" onClick={() => setPlaying(true)} aria-label={`Play: ${v.title}`}>
              {v.thumb && <img src={v.thumb} alt="" loading="lazy" decoding="async" />}
              <span className="atw-play" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
            </button>
          )}
      </div>
      <a className="atw-vtitle" href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer">{v.title}</a>
      <span className="atw-vmeta">{[v.channel, ago(v.publishedAt)].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

export default function AroundTheWeb({ symbol, name }) {
  const [videos, setVideos] = useState(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let stop = false;
    setVideos(null);
    api.panel(symbol, "videos").then(d => { if (!stop) setVideos(d); }).catch(() => { if (!stop) setVideos({ on: false, videos: [] }); });
    return () => { stop = true; };
  }, [symbol]);
  const groups = webLinks({ name, symbol });
  const all = groups.flatMap(([, links]) => links);
  // each in a tab of its own; a browser lets the first through, and may ask before the rest
  const searchAll = () => {
    let opened = 0;
    for (const id of SEARCH_ALL) {
      // (not "noopener", which makes open() answer null even when it worked; cut off after instead)
      const w = window.open(all.find(l => l.id === id).url, "_blank");
      if (w) { w.opener = null; opened++; }
    }
    setBlocked(opened < SEARCH_ALL.length);
  };
  const shown = searchName(name, symbol);
  return (
    <div className="atw">
      <div className="atw-head">
        <p className="atw-lede">What people are saying about {shown} elsewhere: videos here, and a search on each site in one tap.</p>
        <button type="button" className="btn-primary atw-all" onClick={searchAll}><Search size={16} aria-hidden="true" />Search all</button>
      </div>
      {blocked && <p className="atw-blocked" role="status">Your browser stopped some of the tabs opening. Allow pop-ups for this site, or use the links below.</p>}

      {videos?.on && videos.videos.length > 0 && (
        <section className="atw-sec" aria-label="YouTube videos">
          <h3 className="atw-h">On YouTube <span>the last six months</span></h3>
          <div className="atw-videos">{videos.videos.map(v => <Video key={v.id} v={v} />)}</div>
        </section>
      )}
      {videos == null && <div className="atw-videos atw-skel" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} />)}</div>}

      {groups.map(([group, links], i) => {
        const Icon = GROUP_ICON[i] ?? Globe;
        return (
          <section key={group} className="atw-sec" aria-label={group}>
            <h3 className="atw-h"><Icon size={15} aria-hidden="true" />{group}</h3>
            <div className="atw-links">
              {links.map(l => (
                <a key={l.id} className="atw-link" href={l.url} target="_blank" rel="noopener noreferrer">
                  <span className="atw-link-main"><span className="atw-link-label">{l.label}</span><span className="atw-link-sub">{l.sub}</span></span>
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>
        );
      })}
      <p className="atw-note">Each link searches that site for {shown} and opens it in a new tab. What's there is the site's own, not checked here; X and Reddit posts can't be shown in the app without their paid APIs.</p>
    </div>
  );
}

// A watchlist card's globe button: the main searches for its stock in a menu
// (on the page itself, as a card's effects would clip it)
export function WebMenu({ symbol, name }) {
  const [open, setOpen] = useState(null);
  const box = useRef(null), pop = useRef(null);
  const links = webLinks({ name, symbol }).flatMap(([, l]) => l).filter(l => ["x", "reddit", "valuepickr", "youtube", "gnews", "concalls", "google"].includes(l.id));
  const toggle = e => {
    if (open) { setOpen(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 340;
    setOpen({ right: Math.max(8, window.innerWidth - r.right), ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) });
  };
  useOnScreen(pop, open, setOpen);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!box.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(null); };
    const esc = e => { if (e.key === "Escape") setOpen(null); };
    const gone = () => setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", gone, { passive: true });
    window.addEventListener("resize", gone);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", gone); window.removeEventListener("resize", gone); };
  }, [open]);
  return (
    <div className="wl-picker" ref={box}>
      <button type="button" className="wl-icon-btn" aria-label={`Search the web for ${name}`} title="Search the web" aria-expanded={!!open} onClick={toggle}><Globe size={15} /></button>
      {open && createPortal(
        <div ref={pop} className="wl-pop wl-pop-fixed" style={open} role="menu" aria-label={`Search the web for ${name}`}>
          {links.map(l => (
            <a key={l.id} role="menuitem" className="wl-pop-link" href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(null)}>
              {l.label}<ExternalLink size={13} aria-hidden="true" />
            </a>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
