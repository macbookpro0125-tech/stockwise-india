// When the Android app offers its notifications (23 Oct 2026): once, after a
// company is first starred, if the app can show them and they aren't on yet.
// The answer is kept on this phone; Settings has the switch either way.
const KEY = "push-asked";

export function shouldAskPush({ canPush, on, asked }) {
  return !!canPush && !on && !asked;
}

export const pushAsked = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
export const markPushAsked = () => { try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* asked again next time; no harm */ } };
