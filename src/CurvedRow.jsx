import { useEffect, useId, useRef, useState } from "react";

// A row of tiles that streams from right to left round the inside of a
// cylinder (16 Oct 2026, ported from "Scroll Tilted Grid", TiltedGridHero, to
// this app's plain JSX and CSS: no Tailwind or TypeScript here). The centre
// faces you flat, the ends bend toward you and fade into the page.
//
// A box can't bend, so each tile is cut into SLICES vertical strips, each a
// flat facet of the cylinder showing its share of the tile. The strips sit
// still inside their tile, each turned its own few degrees round the
// cylinder's axis, and the tile (preserve-3d) is what moves: one rotateY
// about that axis carries the whole tile along the arc. A tile is one
// animation, so its strips never drift apart. Only a tile's delay differs,
// and that sets where on the arc it sits. Transform-only, on the compositor;
// the fade is a mask. A tile takes its next item each time it wraps, out of
// sight, so every item plays through however few tiles the frame needs.
//
// Here the tiles are rendered by `render(item)` (a strategy card on Discover)
// instead of images; each strip shows its slice of the same rendered tile.
// onPick(item): a click on a tile; hovering pauses the row (a pointer that
// can hover). The row is decorative for screen readers and the keyboard
// (aria-hidden): what it shows must also be reachable another way.

const SLICES = 16;   // strips per tile: few enough to stay light, enough that no facet shows
const CAMERA = 1.6;  // camera distance, × the cylinder's radius: just past the axis, so the ends swell
const MAX_WIDTH = 55; // a tile is never wider than this share of the row (a phone still shows neighbours)

// Cylinder radius, as a share of the row's width, that puts the frame's edge
// `bend` radians round the arc as seen through the camera
const arc = bend => (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));

// Lays the loop on the cylinder: how many tiles, and in degrees the arc a
// tile-height spans (unit), how far round a tile's centre can go before it's
// off-screen (limit), and where the loop's ends sit (sweep)
function measure(width, height, tile, aspect, gap, bend) {
  const h = Math.min((tile / 100) * height, ((MAX_WIDTH / 100) * width) / aspect);
  const radius = width * arc(bend);
  if (!(h > 0) || !(radius > 0)) return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  const deg = rad => (rad * 180) / Math.PI;
  const unit = deg(h / radius);
  const pitch = (aspect + gap / 100) * unit;
  const limit = deg(bend) + (aspect * unit) / 2;
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch))); // capped, for a sliver of a row
  const round = n => +n.toFixed(4);
  const sweep = round((columns * pitch) / 2);
  return { columns, sweep, unit: round(unit), limit: round(Math.min(sweep, limit)) };
}

export default function CurvedRow({
  items, render, onPick,
  speed = 4,           // seconds for the row to move on by one tile
  tileHeight = 26,     // % of the row's height
  aspectRatio = 16 / 9,
  gap = 6,             // % of a tile's height
  axis = 56,           // the row's vertical centre, % of its height
  curve = 80,          // how far round the frame's edge has bent, degrees (5–85)
  fade = 12,           // the fade at each end, % of the width
  className = "", children,
}) {
  const ref = useRef(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const orbit = `cr-o-${id}`, tile = `cr-t-${id}`;
  const bend = (Math.min(85, Math.max(5, curve)) * Math.PI) / 180;

  // null until measured: the band stays hidden till then, so a first paint
  // laid out for the wrong size never shows
  const [layout, setLayout] = useState(null);
  // the item each tile shows, as a place in the run; changes only as a tile
  // wraps, out of sight
  const [shown, setShown] = useState({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const next = measure(width, height, tileHeight, aspectRatio, gap, bend);
      setLayout(prev => (prev?.columns === next.columns && prev.sweep === next.sweep && prev.unit === next.unit ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tileHeight, aspectRatio, gap, bend]);

  const { columns, sweep, unit, limit } = layout ?? measure(1200, 560, tileHeight, aspectRatio, gap, bend);

  // every length is a multiple of the tile's height (--cr-u), which follows
  // the row's height until MAX_WIDTH caps it on narrow screens
  const u = n => `calc(${+n.toFixed(4)} * var(--cr-u))`;
  const r = 100 * arc(bend);
  const radius = `${+r.toFixed(3)}cqw`;
  // out to the axis, round it, back in: a box sits on the cylinder at that angle
  const turn = deg => `translateZ(${radius}) rotateY(${+deg.toFixed(4)}deg) translateZ(-${radius})`;

  // beyond `limit` a tile is wholly off-screen, so it's hidden there (that's
  // where it wraps, and where tiles swing round behind the camera)
  const hide = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);
  const share = aspectRatio / SLICES;
  const duration = columns * speed;
  // The animation lives in the stylesheet, not inline: an inline `animation`
  // would outrank the rules that pause it. A tile's own delay is a variable.
  const css =
    `@keyframes ${orbit}{from{transform:${turn(-sweep)}}to{transform:${turn(sweep)}}` +
    `0%,${hide}%,${100 - hide}%,100%{visibility:hidden}${hide + 0.001}%,${100 - hide - 0.001}%{visibility:visible}}` +
    `.${tile}{animation:${orbit} ${duration}s linear var(--cr-delay) infinite}` +
    // paused rather than removed: every tile is already placed by its delay, so it freezes as a still
    `@media(prefers-reduced-motion:reduce){.${tile}{animation-play-state:paused}}` +
    `@media(hover:hover) and (pointer:fine){.cr-root:hover .${tile}{animation-play-state:paused}}`;

  const mask = `linear-gradient(90deg,transparent,#000 ${fade}%,#000 ${100 - fade}%,transparent)`;
  const n = Math.max(items.length, 1);

  return (
    <div ref={ref} className={`cr-root ${className}`} style={{ "--cr-u": `min(${tileHeight}cqh, ${+(MAX_WIDTH / aspectRatio).toFixed(4)}cqw)` }}>
      <style>{css}</style>
      <div className="cr-band" aria-hidden="true" style={{
        opacity: layout && items.length ? 1 : 0,
        perspective: `${+(r * CAMERA).toFixed(3)}cqw`, // one vanishing point on the row's centre line
        perspectiveOrigin: `50% ${axis}%`,
        maskImage: mask, WebkitMaskImage: mask,
      }}>
        {items.length > 0 && Array.from({ length: columns }, (_, t) => {
          const first = columns - 1 - t; // tiles numbered in the order they come on
          const item = items[(shown[t] ?? first) % n];
          return (
            <div key={t} className={`${tile} cr-tile`} onClick={() => onPick?.(item)} style={{
              left: `calc(50% - ${u(aspectRatio / 2)})`, top: `calc(${axis}% - ${u(0.5)})`,
              width: u(aspectRatio), height: u(1),
              "--cr-delay": `${-t * speed}s`,
            }} onAnimationIteration={e => {
              const lap = Math.round(e.elapsedTime / duration); // whole loops, missed events included
              setShown(prev => { const next = lap * columns + first; return prev[t] === next ? prev : { ...prev, [t]: next }; });
            }}>
              {Array.from({ length: SLICES }, (_, k) => (
                <div key={k} className={`cr-strip${k === 0 ? " cr-first" : ""}${k === SLICES - 1 ? " cr-last" : ""}`} style={{
                  left: u((aspectRatio - share) / 2),
                  // a pixel wider than its share, so neighbouring facets overlap and no hairline opens
                  width: k === SLICES - 1 ? u(share) : `calc(${u(share)} + 1px)`,
                  height: u(1),
                  transform: turn((aspectRatio / 2 - (k + 0.5) * share) * unit),
                }}>
                  <div className="cr-face" style={{ left: u(-k * share), width: u(aspectRatio), height: u(1) }}>{render(item)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}
