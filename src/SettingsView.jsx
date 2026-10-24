import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Heart, Bookmark, ChartLine, Zap, Moon, Image, Compass, Download, ShieldCheck, FileText, LogOut, Trash2, BookOpen, Mail, Star, Bell, Users } from "lucide-react";
import { navigate } from "./site.jsx";
import { problemMailto } from "./help.js";
import { useLogosShown, setLogosShown } from "./CompanyLogo.jsx";
import { installState, onInstallChange, promptInstall } from "./installApp.js";
import { strategiesStore } from "./accountData.js";
import { alertsStore } from "./stores.js";
import { DeleteAccountModal } from "./AccountMenu.jsx";
import { supportAdsAvailable, useAdsOn, watchSupportAd } from "./ads.jsx";
import { showStrategiesOfKind } from "./PresetCards.jsx";
import { canRate, openStorePage } from "./rateApp.js";
import { canPush, pushOn, turnPushOn, turnPushOff } from "./push.js";
import { useWeeklyEmail } from "./weeklyEmail.js";

// A phone's Settings tab (17 Oct 2026): the account, the theme and the pages
// that don't fit the five-tab bar, as grouped lists — the Account menu's
// items, on a page of their own. On a computer the Account menu in the
// header does this.

function Row({ icon: Icon, tint, label, detail, onClick, href, danger, children }) {
  const inner = (
    <>
      <span className="st-icon" style={{ "--tint": tint }} aria-hidden="true"><Icon size={17} strokeWidth={2.2} /></span>
      <span className="st-text">
        <span className="st-label">{label}</span>
        {detail && <span className="st-detail">{detail}</span>}
      </span>
      {children ?? <ChevronRight size={18} className="st-chevron" aria-hidden="true" />}
    </>
  );
  if (href) return <a className={`st-row${danger ? " danger" : ""}`} href={href} onClick={e => { e.preventDefault(); navigate(href); window.scrollTo(0, 0); }}>{inner}</a>;
  return <button type="button" className={`st-row${danger ? " danger" : ""}`} onClick={onClick}>{inner}</button>;
}

function Switch({ on, label, detail, onChange, icon, tint }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="st-row" onClick={() => onChange(!on)}>
      <span className="st-icon" style={{ "--tint": tint }} aria-hidden="true">{icon}</span>
      <span className="st-text"><span className="st-label">{label}</span>{detail && <span className="st-detail">{detail}</span>}</span>
      <span className="st-switch" data-on={on} aria-hidden="true"><span /></span>
    </button>
  );
}

const Group = ({ title, children }) => (
  <section className="st-group" aria-label={title}>
    {title && <h3 className="st-group-title">{title}</h3>}
    <div className="st-card">{children}</div>
  </section>
);

export default function SettingsView({ account, theme, onToggleTheme, onTab, onLogout, onDeleted, onTour }) {
  const who = account?.email || account?.phone || null;
  const logos = useLogosShown();
  const [install, setInstall] = useState(installState);
  const [iosHint, setIosHint] = useState(false);
  useEffect(() => onInstallChange(() => setInstall(installState())), []);
  const [saved, setSaved] = useState(() => strategiesStore.get().length);
  useEffect(() => {
    const on = () => setSaved(strategiesStore.get().length);
    window.addEventListener("customPresetsUpdated", on);
    return () => window.removeEventListener("customPresetsUpdated", on);
  }, []);
  const alerts = alertsStore.use();
  const triggered = (alerts ?? []).filter(x => x.enabled && x.triggered).length;
  const alertsDetail = triggered ? `${triggered} price${triggered === 1 ? "" : "s"} reached` : alerts?.length ? `${alerts.length} set` : "Get told when a price is reached";
  const [confirming, setConfirming] = useState(false);
  // Phone notifications, in the Android app (push.js)
  const [push, setPush] = useState(pushOn);
  const [pushNote, setPushNote] = useState(null);
  const switchPush = async want => {
    setPushNote(null);
    try {
      if (!want) { await turnPushOff(); setPush(false); return; }
      if (await turnPushOn()) setPush(true);
      else setPushNote("Notifications are off for this app in Android's settings");
    } catch (e) {
      setPushNote(e.message || "Couldn't turn them on. Try again in a moment");
    }
  };
  const weekly = useWeeklyEmail();
  const adsOn = useAdsOn();
  const [support, setSupport] = useState(null); // null | "loading" | "thanks" | "closed" | error text

  const supportUs = async () => {
    setSupport("loading");
    try { setSupport((await watchSupportAd()) ? "thanks" : "closed"); }
    catch (e) { setSupport(e.message || "No ad is available right now."); }
  };
  const supportDetail = {
    loading: "Loading an ad…",
    thanks: "Thank you — that helps keep the app free.",
    closed: "Closed before the end. No problem at all.",
  }[support] ?? (support || "A short ad, when you choose. Nothing is ever locked behind one.");

  return (
    <div className="st-page">
      {who && (
        <div className="st-account">
          <span className="st-avatar" aria-hidden="true">{(account.name || who).trim().charAt(0).toUpperCase()}</span>
          <span style={{ minWidth: 0 }}>
            {account.name && <span className="st-account-name">{account.name}</span>}
            <span className={account.name ? "st-account-sub" : "st-account-name"}>{who}</span>
          </span>
        </div>
      )}

      {adsOn && supportAdsAvailable() && (
        <Group title="Support the app">
          <Row icon={Heart} tint="#F04461" label="Watch an ad" detail={supportDetail} onClick={support === "loading" ? undefined : supportUs} />
        </Group>
      )}

      <Group title="Library">
        <Row icon={Bookmark} tint="#14B892" label="Your strategies" detail={saved ? `${saved} saved` : "Save a screen to keep it here"}
          onClick={() => { showStrategiesOfKind(saved ? "yours" : "all"); onTab("discover"); }} />
        {/* Alerts gave its tab to Explore on a phone (23 Oct 2026) */}
        <Row icon={Bell} tint="#F59E0B" label="Alerts" detail={alertsDetail} onClick={() => onTab("alerts")} />
        <Row icon={ChartLine} tint="#3B82F6" label="Strategy performance" detail="How past picks have moved" onClick={() => onTab("performance")} />
        {account?.features?.momentum && <Row icon={Zap} tint="#F59E0B" label="Momentum" onClick={() => onTab("momentum")} />}
        {account?.features?.owner && <Row icon={Users} tint="#6366F1" label="Visitors" detail="Who's using the site, counted anonymously" onClick={() => onTab("visitors")} />}
      </Group>

      {(canPush() || weekly.available) && (
        <Group title="Notifications">
          {canPush() && <Switch on={push} label="Phone notifications" onChange={switchPush} icon={<Bell size={17} strokeWidth={2.2} />} tint="#14B892"
            detail={pushNote ?? "News from your watchlist's companies, results reminders, and alerts when a price is reached"} />}
          {weekly.available && <Switch on={weekly.on} label="Weekly email" onChange={weekly.set} icon={<Mail size={17} strokeWidth={2.2} />} tint="#6366F1"
            detail={weekly.note ?? "Sunday mornings: your watchlist's week, its news, and results coming up"} />}
        </Group>
      )}

      <Group title="Display">
        <Switch on={theme === "dark"} label="Dark mode" onChange={onToggleTheme} icon={<Moon size={17} strokeWidth={2.2} />} tint="#6366F1" />
        <Switch on={logos} label="Company logos" onChange={setLogosShown} icon={<Image size={17} strokeWidth={2.2} />} tint="#0EA5E9" />
      </Group>

      <Group title="Help">
        <Row icon={BookOpen} tint="#0EA5E9" label="How the figures work" detail="Where they come from, and when they change" href="/help" />
        <Row icon={Mail} tint="#F59E0B" label="Report a problem" detail="Or ask a question. An email opens with the app's version filled in" onClick={() => { window.location.href = problemMailto(); }} />
        {onTour && <Row icon={Compass} tint="#14B892" label="Take the tour" onClick={() => { onTab("discover"); onTour(); }} />}
        {(install === "prompt" || install === "ios") && (
          <Row icon={Download} tint="#8B5CF6" label="Install the app"
            detail={install === "ios" && iosHint ? "In Safari, tap Share, then Add to Home Screen." : "Open it from your home screen, full screen"}
            onClick={() => (install === "prompt" ? promptInstall() : setIosHint(h => !h))} />
        )}
      </Group>

      <Group title="About">
        {canRate() && <Row icon={Star} tint="#F5B800" label="Rate the app" detail="On Google Play. It helps others find it" onClick={openStorePage} />}
        <Row icon={ShieldCheck} tint="#10B981" label="Privacy policy" href="/privacy" />
        <Row icon={FileText} tint="#64748B" label="Disclaimer" detail="An educational tool, not investment advice" href="/disclaimer" />
      </Group>

      <Group>
        <Row icon={LogOut} tint="#64748B" label="Sign out" onClick={onLogout}><span /></Row>
        <Row icon={Trash2} tint="#EF4444" label="Delete account…" danger onClick={() => setConfirming(true)}><span /></Row>
      </Group>

      <p className="st-foot">Jocular Insights · NSE stock research</p>

      {confirming && createPortal(<DeleteAccountModal who={who} hasPassword={account?.hasPassword !== false} onClose={() => setConfirming(false)} onDeleted={onDeleted} />, document.body)}
    </div>
  );
}
