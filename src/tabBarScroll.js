// When the phone's tab bar folds into one round button (Header.jsx
// BottomTabBar), as in Reddit's app: reading down the page folds it, any real
// move back up opens it, and near the top it's always open. Movement is
// measured from where the last change was decided (the anchor), so a slow
// scroll of a few pixels per event adds up, and a few pixels of wobble don't
// flip it back and forth.
export const OPEN_NEAR_TOP = 60;    // px: always open this close to the top
export const COLLAPSE_AFTER = 120;  // px: never folded before this far down
const STEP = 24;                    // px of movement that counts as a scroll

export function scrollStep({ collapsed, anchor }, y) {
  if (y <= OPEN_NEAR_TOP) return { collapsed: false, anchor: y };
  const moved = y - anchor;
  if (Math.abs(moved) < STEP) return { collapsed, anchor };
  return { collapsed: moved > 0 ? y > COLLAPSE_AFTER : false, anchor: y };
}
