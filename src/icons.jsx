import {
  TrendingUp, Coins, Gem, Shield, Rocket, Star, Zap, RefreshCw, Landmark, Sprout, Globe, Building2,
  Calculator, Bookmark, ChartLine, TriangleAlert, ArrowDownToLine, ArrowUpToLine, ArrowUpFromLine, Minus, ChevronsUp } from "lucide-react";

// Ported from stock-screener's src/components/icons.jsx — line icons rather
// than ★/🔔 glyphs, which render in whatever font the platform supplies and
// read as decoration rather than as buttons.

export function StarIcon({ filled, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
         stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

export function BellIcon({ filled, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M13.7 20a2 2 0 01-3.4 0" />
    </svg>
  );
}

// Icon-only square button, as in the original's results rows
export function actionButtonStyle({ active, activeColor, size = 30 }) {
  return {
    width: size, height: size, borderRadius: 8, padding: 0,
    border: `1px solid ${active ? activeColor : "var(--bdr3)"}`,
    background: active ? `color-mix(in srgb, ${activeColor} 14%, transparent)` : "var(--s3)",
    color: active ? activeColor : "var(--t2)",
    cursor: "pointer", transition: "all 120ms",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  };
}

// This app: the same for the strategies and the buy-ladder actions, whose
// emoji come from the server

const PRESET_ICONS = {
  high_quality_compounders: TrendingUp,
  dividend_aristocrats: Coins,
  undervalued_growth: Gem,
  defensive_bluechips: Shield,
  small_cap_multibaggers: Rocket,
  ofss_style_filter: Star,
  momentum_growth: Zap,
  turnaround_plays: RefreshCw,
  psu_value: Landmark,
  dividend_growth: Sprout,
  fii_favorites: Globe,
  dii_backed: Building2,
  net_net_value: Calculator,
  up_every_timeframe: ChevronsUp,
};

export function PresetIcon({ preset, ...props }) {
  const Icon = preset.custom ? Bookmark : PRESET_ICONS[preset.id] ?? ChartLine;
  return <Icon {...props} />;
}

// Where the price sits (server/levels.js pricePosition), by its zone
export function PositionIcon({ zone, ...props }) {
  const Icon = zone === "below-stop" ? TriangleAlert
    : zone === "far-above" || zone === "above-upper" ? ArrowUpToLine
      : zone?.startsWith("phase") ? ArrowDownToLine
        : zone === "above-phase1" ? ArrowUpFromLine
          : Minus;
  return <Icon {...props} />;
}
