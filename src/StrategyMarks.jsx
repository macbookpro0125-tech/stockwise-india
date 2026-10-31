import { PresetIcon } from "./icons.jsx";

// A bold, solid mark for each built-in strategy — the strategy cards on
// Discover's first page show these rather than a line icon in a box, so each
// screen is recognisable at a glance. Drawn on a 40×40 grid; each has its own
// colour. Unknown ones (and your own) fall back to the line icon.

const W = "#fff";
const MARKS = {
  high_quality_compounders: ["#12B886", <>
    <rect x="4" y="24" width="6" height="12" rx="1.5" />
    <rect x="13" y="17" width="6" height="19" rx="1.5" />
    <rect x="22" y="10" width="6" height="26" rx="1.5" />
    <rect x="31" y="3" width="6" height="33" rx="1.5" />
  </>],
  dividend_aristocrats: ["#F59F00", <>
    <path d="M7 26v5c0 2.8 5.8 5 13 5s13-2.2 13-5v-5" opacity=".6" />
    <ellipse cx="20" cy="26" rx="13" ry="5" />
    <path d="M7 17v5c0 2.8 5.8 5 13 5s13-2.2 13-5v-5" opacity=".6" />
    <ellipse cx="20" cy="17" rx="13" ry="5" />
    <path d="M7 8v5c0 2.8 5.8 5 13 5s13-2.2 13-5V8" opacity=".6" />
    <ellipse cx="20" cy="8" rx="13" ry="5" />
  </>],
  undervalued_growth: ["#7C5CFC", <>
    <path d="M11 5h18l7 10-16 21L4 15z" />
    <path d="M4 15h32M14 5l-3 10 9 21 9-21-3-10" fill="none" stroke={W} strokeOpacity=".5" strokeWidth="1.6" strokeLinejoin="round" />
  </>],
  defensive_bluechips: ["#2F80ED", <>
    <path d="M20 3l14 5v10c0 9-6 16-14 19C12 34 6 27 6 18V8z" />
    <path d="M13.5 19.5l4.5 4.5 8.5-9" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </>],
  small_cap_multibaggers: ["#E64980", <>
    <path d="M16 3c1.4 8 4.8 11.4 13 13-8.2 1.6-11.6 5-13 13-1.4-8-4.8-11.4-13-13 8.2-1.6 11.6-5 13-13z" />
    <path d="M31 23c.7 4 2.2 5.4 6 6.1-3.8.7-5.3 2.1-6 6.1-.7-4-2.2-5.4-6-6.1 3.8-.7 5.3-2.1 6-6.1z" opacity=".6" />
  </>],
  ofss_style_filter: ["#94B91A", <>
    {[0, 45, 90, 135].map(a => <rect key={a} x="16.5" y="3" width="7" height="34" rx="3.5" transform={`rotate(${a} 20 20)`} />)}
  </>],
  momentum_growth: ["#F76707", <>
    <path d="M24 2L7 23h11.5L15 38l18-22.5H21.5z" />
  </>],
  turnaround_plays: ["#1C9BD8", <>
    <path d="M32 21a12 12 0 1 1-4.2-9.1" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
    <path d="M33.5 15.5L22.6 15l8.4-9.8z" />
  </>],
  psu_value: ["#4C6EF5", <>
    <path d="M20 3L4 12v3h32v-3z" />
    <rect x="7" y="17" width="5" height="13" rx="1" />
    <rect x="17.5" y="17" width="5" height="13" rx="1" />
    <rect x="28" y="17" width="5" height="13" rx="1" />
    <rect x="4" y="32" width="32" height="5" rx="1.5" />
  </>],
  dividend_growth: ["#2FB344", <>
    <path d="M20 37V19" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <path d="M20 23C20 14 14 8 5 8c0 9 6 15 15 15z" />
    <path d="M20 18c0-8 5-14 14-14 0 8-5 14-14 14z" opacity=".65" />
  </>],
  fii_favorites: ["#0CA5B0", <>
    <circle cx="20" cy="20" r="16.5" />
    <path d="M3.5 20h33M20 3.5c-4.6 4.6-6.5 10-6.5 16.5S15.4 31.9 20 36.5c4.6-4.6 6.5-10 6.5-16.5S24.6 8.1 20 3.5z" fill="none" stroke={W} strokeOpacity=".55" strokeWidth="2" />
  </>],
  dii_backed: ["#9C36B5", <>
    <rect x="4" y="22" width="14" height="14" rx="3" />
    <rect x="22" y="22" width="14" height="14" rx="3" opacity=".7" />
    <rect x="13" y="5" width="14" height="14" rx="3" opacity=".85" />
  </>],
  net_net_value: ["#D6336C", <>
    {[0, 45, 90, 135, 180, 225, 270, 315].map(a => <circle key={a} cx={20 + 11 * Math.cos(a * Math.PI / 180)} cy={20 + 11 * Math.sin(a * Math.PI / 180)} r="6" />)}
    <circle cx="20" cy="20" r="11" />
    <circle cx="20" cy="20" r="4.5" fill={W} />
  </>],
  up_every_timeframe: ["#2B8A3E", <>
    <path d="M8 34l12-11 12 11" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
    <path d="M8 21L20 10l12 11" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
  </>],
  // a peak with a flag on it: at the high
  near_highs_cheap: ["#0B7285", <>
    <path d="M2 37L15.5 14l7 11 4.5-6.5L38 37z" />
    <rect x="14.5" y="3" width="2.4" height="12" rx="1.2" />
    <path d="M16.5 3.5h9l-2.6 3.3 2.6 3.3h-9z" opacity=".7" />
  </>],
  // the debt bars falling while the business line climbs over them
  debt_paydown: ["#364FC7", <>
    <rect x="4" y="9" width="8" height="27" rx="1.5" opacity=".5" />
    <rect x="16" y="18" width="8" height="18" rx="1.5" opacity=".5" />
    <rect x="28" y="27" width="8" height="9" rx="1.5" opacity=".5" />
    <path d="M5 29l11-8 7 3 12-15" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
  </>],
  // a badge with a downward arrow: good, and down
  fallen_quality: ["#A61E4D", <>
    <circle cx="20" cy="20" r="17" />
    <path d="M20 10v19M12.5 21.5L20 29l7.5-7.5" fill="none" stroke={W} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
  </>],
  // a bank: a pediment over three columns on a step
  sound_banks: ["#B0721C", <>
    <path d="M20 3l17 9H3z" />
    <rect x="6" y="15" width="5" height="15" rx="1" />
    <rect x="17.5" y="15" width="5" height="15" rx="1" />
    <rect x="29" y="15" width="5" height="15" rx="1" />
    <rect x="3" y="32" width="34" height="5" rx="1.5" />
  </>],
  // a podium, an arrow rising from its top step
  top_gainers: ["#E8590C", <>
    <rect x="3" y="26" width="11" height="11" rx="1.5" opacity=".55" />
    <rect x="14.5" y="18" width="11" height="19" rx="1.5" />
    <rect x="26" y="30" width="11" height="7" rx="1.5" opacity=".55" />
    <path d="M20 13V3M15 8l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </>],
  // a bar, and one twice its height
  doubled_in_year: ["#5C940D", <>
    <rect x="5" y="22" width="12" height="14" rx="2" opacity=".55" />
    <rect x="23" y="8" width="12" height="28" rx="2" />
    <path d="M11 17l9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55" />
  </>],
};

// 31 Oct 2026: the four screens from the daily prices
// short bars, then one tall one (a day's volume against usual days)
MARKS.unusual_volume = ["#0CA678", <>
  <rect x="3" y="27" width="6" height="9" rx="1.5" opacity=".55" />
  <rect x="11" y="25" width="6" height="11" rx="1.5" opacity=".55" />
  <rect x="19" y="28" width="6" height="8" rx="1.5" opacity=".55" />
  <rect x="29" y="4" width="8" height="32" rx="1.5" />
</>];
// a box with a rising arrow (shares taken as delivery)
MARKS.delivery_spike = ["#D9480F", <>
  <path d="M4 17h32v17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
  <path d="M2 11h36v6H2z" opacity=".6" />
  <path d="M20 31V22M15.5 26l4.5-4.5 4.5 4.5" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
</>];
// a rising line dipping back to touch its average
MARKS.pullback_50dma = ["#1C7ED6", <>
  <path d="M3 33C12 30 22 24 37 13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".5" />
  <path d="M3 28l9-10 7 6 6-15 7 12" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  <circle cx="32" cy="21" r="4" />
</>];
// two lines, one pulling ahead of the other
MARKS.beating_market = ["#AE3EC9", <>
  <path d="M3 32l10-6 8 2 16-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
  <path d="M3 28l10-10 8 3 14-17" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  <path d="M28 4h7v7" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
</>];

// a line climbing through a ceiling (a breakout to a new high)
MARKS.breaking_out = ["#F08C00", <>
  <path d="M3 12h34" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 3" opacity=".55" />
  <path d="M3 34l9-8 6 4 8-12 6 2 5-16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  <circle cx="37" cy="4.5" r="3.5" />
</>];

export const markColor = id => MARKS[id]?.[0] ?? null;

export default function StrategyMark({ preset, size = 40 }) {
  const mark = MARKS[preset.id];
  if (!mark) return <span className="strategy-mark-fallback" style={{ width: size, height: size }}><PresetIcon preset={preset} size={Math.round(size * 0.6)} strokeWidth={2.2} /></span>;
  return (
    <svg className="strategy-mark" width={size} height={size} viewBox="0 0 40 40" fill="currentColor" style={{ color: mark[0], flexShrink: 0 }} aria-hidden="true">
      {mark[1]}
    </svg>
  );
}
