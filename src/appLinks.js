// A jocularinsights.in link opened on a phone with the app (Android App
// Links, app 1.4, 22 Nov 2026): Android hands the address to the app, which
// opens the website's start page; this takes the page to the address the
// link was for. The app's manifest claims the site's links and
// /.well-known/assetlinks.json (http-server.js) confirms the app is ours.
const SITE_HOST = "jocularinsights.in";

// the page inside the app for a link, or null for one that isn't ours
export function linkPath(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || (u.hostname !== SITE_HOST && u.hostname !== `www.${SITE_HOST}`)) return null;
    return `${u.pathname}${u.search}${u.hash}` || "/";
  } catch { return null; }
}

export function listenForAppLinks() {
  if (!window.Capacitor?.isNativePlatform?.()) return () => {};
  let cancelled = false;
  let handle;
  const go = url => {
    const path = linkPath(url);
    if (path && path !== `${location.pathname}${location.search}${location.hash}`) location.assign(path);
  };
  import("@capacitor/app").then(async ({ App }) => {
    // opened by a link: once per launch, so a reload doesn't open it again
    const launch = await App.getLaunchUrl().catch(() => null);
    let seen = null;
    try { seen = sessionStorage.getItem("launchLink"); } catch {}
    if (launch?.url && seen !== launch.url) {
      try { sessionStorage.setItem("launchLink", launch.url); } catch {}
      go(launch.url);
    }
    // a link while the app is already open
    const h = await App.addListener("appUrlOpen", e => go(e.url));
    if (cancelled) h.remove(); else handle = h;
  }).catch(() => {});
  return () => { cancelled = true; handle?.remove(); };
}
