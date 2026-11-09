// The tab bar drop's rim as a lens (liquidLens.js; 9 Nov 2026, "check the
// bubble correctly"). iOS 26's drop bends what lies under its rim: each point
// there shows what's a little further in — the further, the nearer the edge —
// so the tabs stretch outward toward it, and the colours part, red bent a
// little more than blue. A page can't bend what's behind it, but it can bend
// its own tabs: they're drawn once into a hidden canvas (again when the open
// tab or the theme changes), and each frame the rim's pixels are worked out
// from it. Only the rim band is drawn here; the drop's middle shows the tabs
// as they are (index.css .btb-lens-mid), and the two meet where the bending
// has faded to nothing.

export const BAND = 11; // px in from the edge that the bending reaches
const DEPTH = 8; // px further in that the very edge looks
const SPREAD = [1, 0.88, 0.74]; // red, green, blue

export function createRimLens(nav, canvas) {
  const ctx = canvas.getContext("2d");
  let src = null; // { a: alpha per pixel, w, h, dpr, dark }
  let out = null;
  let token = 0;

  // the tabs' drawing — icons and names — as it sits on the bar, alpha only
  async function build() {
    const my = ++token;
    const W = nav.clientWidth, H = nav.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const box = nav.getBoundingClientRect();
    const s = box.width / W || 1; // the bar may be swelling
    const at = el => { const b = el.getBoundingClientRect(); return { x: (b.left - box.left) / s, y: (b.top - box.top) / s, w: b.width / s, h: b.height / s }; };
    const faces = [...nav.querySelectorAll(".btb-tab .btb-face")];
    let dark = false;
    const icons = await Promise.all(faces.map(face => {
      const svg = face.querySelector("svg");
      if (!svg) return null;
      const r = at(svg);
      const text = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, "#000");
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      return img.decode().then(() => ({ img, r })).catch(() => null);
    }));
    if (my !== token) return;
    const off = document.createElement("canvas");
    off.width = Math.round(W * dpr); off.height = Math.round(H * dpr);
    const c = off.getContext("2d");
    c.scale(dpr, dpr);
    for (const i of icons) if (i) c.drawImage(i.img, i.r.x, i.r.y, i.r.w, i.r.h);
    for (const face of faces) {
      const label = face.querySelector(".btb-label");
      if (!label) continue;
      const cs = getComputedStyle(label);
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(cs.color);
      if (m) dark = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) > 128;
      // the baseline, from a zero-size mark set on it
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      label.appendChild(probe);
      const base = (probe.getBoundingClientRect().bottom - box.top) / s;
      probe.remove();
      c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      c.fillStyle = "#000";
      c.textBaseline = "alphabetic";
      c.fillText(label.textContent, at(label).x, base);
    }
    const data = c.getImageData(0, 0, off.width, off.height).data;
    const a = new Uint8Array(off.width * off.height);
    for (let i = 0, k = 3; i < a.length; i++, k += 4) a[i] = data[k];
    src = { a, w: off.width, h: off.height, dpr, dark };
  }

  // the rim of the drop at (L..R, y..y+h) on the bar, bent by g (0..1)
  function draw(L, R, y, h, g) {
    if (!src || g < 0.005 || R - L < 2) return;
    const { a: A, w: SW, h: SH, dpr, dark } = src;
    const cw = Math.max(1, Math.round((R - L) * dpr)), ch = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch; out = null;
      // shown at exactly its own pixels, never stretched to the drop
      canvas.style.width = `${cw / dpr}px`; canvas.style.height = `${ch / dpr}px`;
    }
    if (!out) out = ctx.createImageData(cw, ch);
    const o = out.data;
    o.fill(0);
    const r = h / 2, cy = y + r, x0 = L + r, x1 = R - r, depth = DEPTH * g;
    const sample = (px, py) => {
      const fx = px - 0.5, fy = py - 0.5, ix = Math.floor(fx), iy = Math.floor(fy);
      if (ix < 0 || iy < 0 || ix + 1 >= SW || iy + 1 >= SH) return 0;
      const tx = fx - ix, ty = fy - iy, k = iy * SW + ix;
      return ((A[k] * (1 - tx) + A[k + 1] * tx) * (1 - ty) + (A[k + SW] * (1 - tx) + A[k + SW + 1] * tx) * ty) / 255;
    };
    for (let j = 0; j < ch; j++) {
      const py = y + (j + 0.5) / dpr, dy = py - cy;
      for (let i = 0; i < cw; i++) {
        const px = L + (i + 0.5) / dpr;
        const qx = px < x0 ? x0 : px > x1 ? x1 : px;
        const dx = px - qx, dist = Math.sqrt(dx * dx + dy * dy), din = r - dist;
        if (din < 0 || din >= BAND || dist < 1e-3) continue;
        const t = 1 - din / BAND, d = depth * t * t, nx = dx / dist, ny = dy / dist;
        const aR = sample((px - nx * d * SPREAD[0]) * dpr, (py - ny * d * SPREAD[0]) * dpr);
        const aG = sample((px - nx * d * SPREAD[1]) * dpr, (py - ny * d * SPREAD[1]) * dpr);
        const aB = sample((px - nx * d * SPREAD[2]) * dpr, (py - ny * d * SPREAD[2]) * dpr);
        const al = aR > aG ? (aR > aB ? aR : aB) : (aG > aB ? aG : aB);
        if (al < 0.004) continue;
        const k = (j * cw + i) * 4;
        // each colour covered as much as it is bent onto the ink: drawn so
        // that over the drop's white it comes out exactly so (light), or
        // over its dark glass (dark)
        if (dark) { o[k] = 255 * aR / al; o[k + 1] = 255 * aG / al; o[k + 2] = 255 * aB / al; }
        else { o[k] = 255 * (1 - aR / al); o[k + 1] = 255 * (1 - aG / al); o[k + 2] = 255 * (1 - aB / al); }
        o[k + 3] = 255 * al;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  return { build, draw };
}
