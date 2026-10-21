// A light tick when a choice changes (asked for 21 Oct 2026, from another
// app's tab bar: "when we change in between it gives a small vibration").
// Each device has its own way:
//   the Android app   its own haptics (@capacitor/haptics), a light impact
//   Chrome on Android the browser's vibrate(), a few milliseconds
//   Safari on iPhone  no vibrate(); but a switch (<input type=checkbox
//                     switch>, iOS 17.4+) ticks when it's toggled, so a
//                     hidden one is toggled — only inside a tap
//   a computer        nothing
// Call it from the tap's own handler (a click), or iOS won't tick.
import { Capacitor, registerPlugin } from "@capacitor/core";

export function hapticRoute({ nativeHaptics, vibrate, touch, appleTouch }) {
  if (nativeHaptics) return "native";
  if (!touch) return null;
  if (vibrate) return "vibrate";
  if (appleTouch) return "switch";
  return null;
}

const Haptics = registerPlugin("Haptics");
let route;
function detect() {
  const nav = typeof navigator === "undefined" ? {} : navigator;
  const touch = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
  return hapticRoute({
    nativeHaptics: Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Haptics"),
    vibrate: typeof nav.vibrate === "function",
    touch,
    // an iPhone or iPad (an iPad says it's a Mac, with touch points)
    appleTouch: /iPhone|iPad|iPod/.test(nav.userAgent ?? "") || (/Macintosh/.test(nav.userAgent ?? "") && nav.maxTouchPoints > 1),
  });
}

let iosSwitch = null;
function switchTick() {
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function tick() {
  try {
    route ??= detect();
    if (route === "native") Haptics.impact({ style: "LIGHT" }).catch(() => {});
    else if (route === "vibrate") navigator.vibrate(8);
    else if (route === "switch") switchTick();
  } catch {
    // a tick is a nicety: never let it break a tap
  }
}
