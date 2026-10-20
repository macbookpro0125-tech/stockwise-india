import { createElement, useEffect, useState } from "react";

// Ads (17 Oct 2026): only in the Android and iPhone apps (Capacitor), from
// Google AdMob — a small ad card among the strategies and among the stock
// rows, and "Watch an ad" in Settings for anyone who wants to support the
// app. Nothing is ever locked behind an ad. The website, and the web app
// installed from it, show none.
//
// The server says whether ads are on and which ad units to use
// (/api/app-config, from ADS=off|test|live), so they can be switched without
// a new app release. "test" asks Google for its sample ads, which earn
// nothing and are safe to tap.
//
// The rule (20 Oct 2026): ads are cards among lists, plus the rewarded ad a
// person starts themselves from Settings. Never a banner over the page, a
// full-screen ad between screens, an ad when the app opens, a paid tier, or a
// loan or credit offer. Reviews of other Indian screeners are full of
// complaints about exactly those (replica/fixes.md); src/adsRule.test.js
// fails if one of those AdMob formats is used.
//
// ?ads=preview on the website shows a grey placeholder where each card would
// go, to check the layout; it lasts for the browser tab.

const nativeApp = () => typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
const platform = () => window.Capacitor?.getPlatform?.() ?? "web";

const PREVIEW_KEY = "jocular-ads-preview";
function previewing() {
  try {
    if (new URLSearchParams(window.location.search).get("ads") === "preview") sessionStorage.setItem(PREVIEW_KEY, "1");
    return sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch { return false; }
}

// "native" (the store app, ads on), "preview" (placeholders), or null
let mode = typeof window === "undefined" ? null : nativeApp() ? undefined : previewing() ? "preview" : null;

// The plugin, the config and consent, once: null when there are no ads
let setup = null;
function adsSetup() {
  if (setup) return setup;
  setup = (async () => {
    if (!nativeApp()) return null;
    const config = await fetch("/api/app-config", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const ads = config?.ads;
    if (!ads || (ads.mode !== "test" && ads.mode !== "live")) return null;
    const units = ads.units?.[platform()] ?? {};
    if (!units.native && !units.rewarded) return null;
    const plugin = await import("@capacitor-community/admob");
    const { AdMob, AdmobConsentStatus } = plugin;
    // Google's consent form where the law asks for one (the EU, the UK)
    let consent = await AdMob.requestConsentInfo().catch(() => null);
    if (consent?.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) consent = await AdMob.showConsentForm().catch(() => consent);
    if (consent && !consent.canRequestAds) return null;
    await AdMob.initialize();
    return { plugin, testing: ads.mode === "test", units };
  })().catch(() => null);
  return setup;
}

export function useAdsOn() {
  const [on, setOn] = useState(mode === "preview" || mode === "native");
  useEffect(() => {
    if (mode !== undefined) return;
    let live = true;
    adsSetup().then(s => { mode = s ? "native" : null; if (live) setOn(!!s); });
    return () => { live = false; };
  }, []);
  return on;
}

// ── Native ad cards ─────────────────────────────────────────────────────────
// One feed per list on screen (the plugin allows two at once, three ads in
// each). The ads are native views laid over the page, so they're hidden
// while anything covers the list (pauseAds) and the feed is closed with the
// list.
const feeds = new Map(); // feedId -> Promise<feed | null>
let paused = 0;

const cssColor = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const hex = v => (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v) ? v : undefined);

// size: "medium" (picture or video, 320 px tall), used in both lists — the
// plugin's "small" (120 px) clips its Install button on Android
export function useAdFeed(feedId, theme, size = "small") {
  const on = useAdsOn();
  useEffect(() => {
    if (!feedId || !on || mode !== "native") return;
    let closed = false;
    const opening = adsSetup().then(async s => {
      if (!s?.units.native) return null;
      const { NativeAdFeed, NativeAdTemplate } = s.plugin;
      const feed = await NativeAdFeed.create({
        feedId,
        template: size === "medium" ? NativeAdTemplate.Medium : NativeAdTemplate.Small,
        adId: s.units.native, isTesting: s.testing,
        // In the app's own colours, read from the theme
        style: {
          backgroundColor: hex(cssColor("--s2")), borderColor: hex(cssColor("--s4")), borderWidth: 1, cornerRadius: 16,
          headlineColor: hex(cssColor("--t1")), headlineFontSize: 16, bodyColor: hex(cssColor("--t2")), bodyFontSize: 13,
          callToActionBackgroundColor: hex(cssColor("--accent")), callToActionTextColor: hex(cssColor("--on-accent")), callToActionFontSize: 13,
        },
      });
      if (paused) await feed.pause().catch(() => {});
      if (closed) { await feed.destroy().catch(() => {}); return null; }
      return feed;
    }).catch(() => null);
    feeds.set(feedId, opening);
    return () => {
      closed = true;
      if (feeds.get(feedId) === opening) feeds.delete(feedId);
      opening.then(feed => feed?.destroy().catch(() => {}));
    };
  }, [on, feedId, theme, size]);
  return on;
}

// While a sheet, a dialog or the tour covers the page, and while a company
// page is open over the kept list
export function useAdPause(active) {
  // The first render in a native app happens before the remote ad config has
  // arrived. Subscribe to the same setup state as the feed so an overlay
  // opened during that window still pauses ads once setup completes.
  const on = useAdsOn();
  useEffect(() => {
    if (!active || !on || mode !== "native") return;
    if (paused++ === 0) feeds.forEach(f => f.then(feed => feed?.pause().catch(() => {})));
    return () => {
      if (--paused === 0) feeds.forEach(f => f.then(feed => feed?.resume()));
    };
  }, [active, on]);
}

// A card-sized ad in a list. slot: a key for this place in the list that
// stays the same while the list does (the plugin's rule)
export function AdCard({ feed, slot, size = "small", className = "" }) {
  const on = useAdsOn();
  if (!on) return null;
  if (mode === "preview") {
    return (
      <div className={`ad-card ad-preview ad-${size} ${className}`} role="note" aria-label="Ad space">
        <span className="ad-tag">Ad</span>
        <span className="ad-preview-icon" aria-hidden="true" />
        <span className="ad-preview-lines" aria-hidden="true"><i /><i /><i /></span>
      </div>
    );
  }
  return (
    <div className={`ad-card ${className}`}>
      {createElement("capacitor-admob-native", { "feed-id": feed, "slot-key": slot, class: `ad-native ad-${size}` })}
    </div>
  );
}

// ── Watch an ad to support the app ──────────────────────────────────────────
// Resolves true when the ad was watched to the end, false when it was closed
// early, and throws when no ad could be loaded
export async function watchSupportAd() {
  const s = await adsSetup();
  if (!s?.units.rewarded) throw new Error("No ad is available right now.");
  const { AdMob, RewardAdPluginEvents } = s.plugin;
  await AdMob.prepareRewardVideoAd({ adId: s.units.rewarded, isTesting: s.testing });
  // The plugin answers only when the reward is earned; closing the ad early
  // is the Dismissed event (which also follows a watched one, later)
  let close;
  const closed = new Promise(resolve => { close = () => resolve(false); });
  const handles = await Promise.all([
    AdMob.addListener(RewardAdPluginEvents.Dismissed, close),
    AdMob.addListener(RewardAdPluginEvents.FailedToShow, close),
  ]);
  try {
    return await Promise.race([AdMob.showRewardVideoAd().then(() => true), closed]);
  } finally {
    handles.forEach(h => h.remove());
  }
}

export const supportAdsAvailable = () => mode === "native";
