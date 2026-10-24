// The weekly email's switch (server/digest.js), shared by Settings on a phone
// and the Account menu on a computer: off until turned on; shown only when
// the site can send email and the account has an address.
import { useEffect, useState } from "react";
import { api } from "./api.js";

export function useWeeklyEmail() {
  const [state, setState] = useState({ on: false, available: false });
  const [note, setNote] = useState(null);
  useEffect(() => { api.weeklyEmail().then(setState).catch(() => {}); }, []);
  const set = async on => {
    setNote(null);
    setState(s => ({ ...s, on }));
    try { setState(await api.setWeeklyEmail(on)); }
    catch (e) { setState(s => ({ ...s, on: !on })); setNote(e.message || "Couldn't change it just now."); }
  };
  return { ...state, set, note };
}
