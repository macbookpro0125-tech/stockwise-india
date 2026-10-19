import type { CapacitorConfig } from "@capacitor/cli";

// The Android and iPhone apps (17 Oct 2026): a native shell around the live
// site, so the app is always the same version as the website, plus what a
// website can't do — AdMob's ad cards and rewarded ads (src/ads.jsx).
//
// APP_URL: the site the app opens. The live site, https://jocularinsights.in,
// by default (19 Oct 2026); for a local copy on the Android emulator,
// http://10.0.2.2:<port> (the emulator's name for this computer) — plain
// http is allowed only for that.
const url = process.env.APP_URL ?? "https://jocularinsights.in";
const local = /^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?$/.test(url);

const config: CapacitorConfig = {
  appId: "com.jocularinsights.app",
  appName: "Jocular Insights",
  // Shown only if the site can't be reached at first start
  webDir: "dist",
  server: {
    url,
    // No connection: our own page from inside the app (public/app-offline.html),
    // which goes back to the site once it can
    errorPath: `app-offline.html?to=${encodeURIComponent(url)}`,
    cleartext: local,
    // Links to other sites (NSE filings, Google sign-in) open in the browser
    allowNavigation: [],
  },
  plugins: {
    // Light clock and icons from launch, on the dark theme; the page switches
    // them with its theme (App.jsx)
    SystemBars: { style: "DARK" },
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: local,
  },
};

export default config;
