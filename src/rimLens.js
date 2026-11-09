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
//
// A frame's share of that has to stay small (9 Nov 2026, "it looks laggy"):
// the graphics chip works it out where there is one (WebGL), and the canvas
// keeps one size for the whole bar, so a frame never reallocates it. Without
// WebGL it's done here, visiting only the band's own pixels, row by row.

export const BAND = 11; // px in from the edge that the bending reaches
const DEPTH = 8; // px further in that the very edge looks
const SPREAD = [1, 0.88, 0.74]; // red, green, blue

// The same sum, worked out by the graphics chip (WebGL): a frame then costs
// the page next to nothing, however big the drop. Each pixel of the drop's
// rim looks back along its normal into the tabs' picture, as draw() below
// does pixel by pixel where there's no WebGL.
const VERTEX = `
attribute vec2 a_unit;
uniform vec4 u_rect; // the drop, in the canvas's pixels: x, y, width, height
uniform vec2 u_canvas;
void main() {
  vec2 p = u_rect.xy + a_unit * u_rect.zw;
  gl_Position = vec4(p.x / u_canvas.x * 2.0 - 1.0, 1.0 - p.y / u_canvas.y * 2.0, 0.0, 1.0);
}`;
const FRAGMENT = `
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_srcSize;
uniform float u_sd, u_od, u_canvasH, u_depth, u_band, u_dark;
uniform vec4 u_drop; // L, R, y, h on the bar
uniform vec3 u_spread;
float ink(vec2 p) { return texture2D(u_src, p * u_sd / u_srcSize).a; }
void main() {
  vec2 p = vec2(u_drop.x + gl_FragCoord.x / u_od, u_drop.z + (u_canvasH - gl_FragCoord.y) / u_od);
  float r = u_drop.w * 0.5, x0 = u_drop.x + r, x1 = max(x0, u_drop.y - r);
  vec2 dv = vec2(p.x - clamp(p.x, x0, x1), p.y - (u_drop.z + r));
  float dist = length(dv), din = r - dist;
  if (din < 0.0 || din >= u_band || dist < 0.001) discard;
  float t = 1.0 - din / u_band;
  vec2 n = dv / dist * u_depth * t * t;
  vec3 a = vec3(ink(p - n * u_spread.x), ink(p - n * u_spread.y), ink(p - n * u_spread.z));
  float al = max(a.r, max(a.g, a.b));
  if (al < 0.004) discard;
  vec3 col = u_dark > 0.5 ? a / al : 1.0 - a / al;
  gl_FragColor = vec4(col * al, al);
}`;

function gpuDrawer(canvas) {
  let gl = null;
  try { gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }); } catch { gl = null; }
  if (!gl) return null;
  let prog = null, u = {}, tex = null, lost = false, last = null;
  function init() {
    const shader = (type, text) => { const sh = gl.createShader(type); gl.shaderSource(sh, text); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null; };
    const vs = shader(gl.VERTEX_SHADER, VERTEX), fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    for (const name of ["u_rect", "u_canvas", "u_src", "u_srcSize", "u_sd", "u_od", "u_canvasH", "u_depth", "u_band", "u_dark", "u_drop", "u_spread"]) u[name] = gl.getUniformLocation(prog, name);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(prog, "a_unit");
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.uniform1i(u.u_src, 0);
    gl.uniform1f(u.u_band, BAND);
    gl.uniform3f(u.u_spread, SPREAD[0], SPREAD[1], SPREAD[2]);
    if (last) upload(last.picture, last.info);
    return true;
  }
  // the tabs' picture, straight from its canvas: no pixels read back here
  function upload(picture, info) {
    last = { picture, info };
    if (lost || !tex) return false;
    try {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, gl.ALPHA, gl.UNSIGNED_BYTE, picture);
    } catch { return false; }
    gl.uniform2f(u.u_srcSize, info.w, info.h);
    gl.uniform1f(u.u_sd, info.dpr);
    gl.uniform1f(u.u_dark, info.dark ? 1 : 0);
    return true;
  }
  if (!init()) return null;
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); lost = true; });
  canvas.addEventListener("webglcontextrestored", () => { lost = !init(); });
  return {
    ok: () => !lost,
    upload,
    draw(L, R, y, h, g, od, cw, ch) {
      if (lost) return;
      const W = canvas.width, H = canvas.height;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(u.u_rect, 0, 0, cw, ch);
      gl.uniform2f(u.u_canvas, W, H);
      gl.uniform1f(u.u_canvasH, H);
      gl.uniform1f(u.u_od, od);
      gl.uniform1f(u.u_depth, DEPTH * g);
      gl.uniform4f(u.u_drop, L, R, y, h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

export function createRimLens(nav, canvas) {
  const gpu = gpuDrawer(canvas);
  const ctx = gpu ? null : canvas.getContext("2d");
  let src = null; // the tabs' picture: { a (alpha per pixel, without WebGL), w, h, dpr, dark }
  let spots = null; // where the icons and names sit, measured: { W, H, dpr, dark, icons[], labels[] }
  const icons = new Map(); // an icon's drawing (its SVG) → its image, decoded once
  let picture = null; // the canvas the tabs are drawn into
  let out = null; // the canvas's pixels, the whole bar's size (without WebGL)
  let used = { w: 0, h: 0 }; // the part the last frame drew
  let od = 1; // the canvas's pixels per px
  let token = 0;
  const dprNow = () => Math.min(3, window.devicePixelRatio || 1);

  // the canvas, as big as the bar: the drop is never bigger
  function size(W, H) {
    spots = null; // the tabs may have moved: measured again at the next build
    const dpr = dprNow();
    const cw = Math.max(1, Math.ceil(W * dpr)), ch = Math.max(1, Math.ceil(H * dpr));
    if (canvas.width === cw && canvas.height === ch && od === dpr && (gpu || out)) return;
    od = dpr;
    canvas.width = cw; canvas.height = ch;
    // shown at exactly its own pixels, never stretched
    canvas.style.width = `${cw / dpr}px`; canvas.style.height = `${ch / dpr}px`;
    if (ctx) out = ctx.createImageData(cw, ch);
    used = { w: 0, h: 0 };
  }

  // where each icon and name sits on the bar, and whether the ink is light
  // (the dark theme): read from the page only when the bar's layout or theme
  // changes, never while the drop is moving
  function measure() {
    const W = nav.clientWidth, H = nav.clientHeight;
    if (!W || !H) return null;
    const box = nav.getBoundingClientRect();
    const s = box.width / W || 1; // the bar may be swelling
    const at = el => { const b = el.getBoundingClientRect(); return { x: (b.left - box.left) / s, y: (b.top - box.top) / s, w: b.width / s, h: b.height / s }; };
    let dark = false;
    const places = [], labels = [];
    for (const face of nav.querySelectorAll(".btb-tab .btb-face")) {
      const svg = face.querySelector("svg");
      places.push(svg ? at(svg) : null);
      const label = face.querySelector(".btb-label");
      if (!label) { labels.push(null); continue; }
      const cs = getComputedStyle(label);
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(cs.color);
      if (m) dark = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) > 128;
      // the baseline, from a zero-size mark set on it
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      label.appendChild(probe);
      const base = (probe.getBoundingClientRect().bottom - box.top) / s;
      probe.remove();
      labels.push({ x: at(label).x, base, font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, text: label.textContent });
    }
    return { W, H, dpr: dprNow(), dark, icons: places, labels };
  }

  const decoded = text => {
    let icon = icons.get(text);
    if (!icon) {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      icon = { img, ok: false };
      icon.ready = img.decode().then(() => { icon.ok = true; }, () => {});
      icons.set(text, icon);
    }
    return icon;
  };

  // the tabs' drawing — icons, filled or not as they are now, and names —
  // alpha only. Cheap enough to redo mid-trip, when the open tab changes:
  // each icon's drawing is decoded the first time it's seen, and the
  // picture goes to the graphics chip as it is.
  async function build() {
    const my = ++token;
    if (!spots) spots = measure();
    if (!spots) return;
    const now = [...nav.querySelectorAll(".btb-tab .btb-face")].map(face => {
      const svg = face.querySelector("svg");
      return svg ? decoded(new XMLSerializer().serializeToString(svg).replace(/currentColor/g, "#000")) : null;
    });
    if (now.some(i => i && !i.ok)) {
      await Promise.all(now.map(i => i?.ready));
      if (my !== token || !spots) return;
    }
    const { W, H, dpr, dark } = spots;
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    picture ??= document.createElement("canvas");
    if (picture.width !== w || picture.height !== h) { picture.width = w; picture.height = h; }
    // (drawn by the processor, not the graphics chip: the same edges, pixel
    // for pixel, as the tabs' own icons and names)
    const c = picture.getContext("2d", { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    now.forEach((icon, i) => { const r = spots.icons[i]; if (icon?.ok && r) c.drawImage(icon.img, r.x, r.y, r.w, r.h); });
    c.fillStyle = "#000";
    c.textBaseline = "alphabetic";
    for (const l of spots.labels) if (l) { c.font = l.font; c.fillText(l.text, l.x, l.base); }
    if (gpu) {
      const info = { w, h, dpr, dark };
      src = gpu.upload(picture, info) ? info : null;
      return;
    }
    const data = c.getImageData(0, 0, w, h).data;
    const a = new Uint8Array(w * h);
    for (let i = 0, k = 3; i < a.length; i++, k += 4) a[i] = data[k];
    src = { a, w, h, dpr, dark };
  }

  // the rim of the drop at (L..R, y..y+h) on the bar, bent by g (0..1)
  function draw(L, R, y, h, g) {
    if (!src || g < 0.005 || R - L < 2) return;
    const CW = canvas.width, CH = canvas.height;
    const cw = Math.min(CW, Math.max(1, Math.round((R - L) * od))), ch = Math.min(CH, Math.max(1, Math.round(h * od)));
    if (gpu) { gpu.draw(L, R, y, h, g, od, cw, ch); return; }
    if (!out) return;
    const { a: A, w: SW, h: SH, dpr: sd, dark } = src;
    const o = out.data, stride = CW * 4;
    // clear what the last frame drew (the drop changes size every frame)
    const clearW = Math.max(used.w, cw), clearH = Math.max(used.h, ch);
    for (let j = 0; j < clearH; j++) o.fill(0, j * stride, j * stride + clearW * 4);
    used = { w: cw, h: ch };
    const r = h / 2, cy = y + r, x0 = L + r, x1 = Math.max(x0, R - r), depth = DEPTH * g;
    const ri = r - BAND; // the inside edge of the band, as a radius
    const sample = (px, py) => {
      const fx = px - 0.5, fy = py - 0.5, ix = Math.floor(fx), iy = Math.floor(fy);
      if (ix < 0 || iy < 0 || ix + 1 >= SW || iy + 1 >= SH) return 0;
      const tx = fx - ix, ty = fy - iy, k = iy * SW + ix;
      return ((A[k] * (1 - tx) + A[k + 1] * tx) * (1 - ty) + (A[k + SW] * (1 - tx) + A[k + SW + 1] * tx) * ty) / 255;
    };
    const pixel = (i, j, py, dy) => {
      const px = L + (i + 0.5) / od;
      const qx = px < x0 ? x0 : px > x1 ? x1 : px;
      const dx = px - qx, dist = Math.sqrt(dx * dx + dy * dy), din = r - dist;
      if (din < 0 || din >= BAND || dist < 1e-3) return;
      const t = 1 - din / BAND, d = depth * t * t, nx = dx / dist, ny = dy / dist;
      const aR = sample((px - nx * d * SPREAD[0]) * sd, (py - ny * d * SPREAD[0]) * sd);
      const aG = sample((px - nx * d * SPREAD[1]) * sd, (py - ny * d * SPREAD[1]) * sd);
      const aB = sample((px - nx * d * SPREAD[2]) * sd, (py - ny * d * SPREAD[2]) * sd);
      const al = aR > aG ? (aR > aB ? aR : aB) : (aG > aB ? aG : aB);
      if (al < 0.004) return;
      const k = j * stride + i * 4;
      // each colour covered as much as it is bent onto the ink: drawn so
      // that over the drop's white it comes out exactly so (light), or
      // over its dark glass (dark)
      if (dark) { o[k] = 255 * aR / al; o[k + 1] = 255 * aG / al; o[k + 2] = 255 * aB / al; }
      else { o[k] = 255 * (1 - aR / al); o[k + 1] = 255 * (1 - aG / al); o[k + 2] = 255 * (1 - aB / al); }
      o[k + 3] = 255 * al;
    };
    // each row: only its stretch of the band — all of it near the top and
    // bottom, its two ends lower down — not the drop's whole width
    const col = x => Math.round((x - L) * od - 0.5); // the pixel whose middle is nearest x
    for (let j = 0; j < ch; j++) {
      const py = y + (j + 0.5) / od, dy = py - cy, ady = Math.abs(dy);
      if (ady > r) continue;
      const outer = Math.sqrt(r * r - dy * dy);
      const from = Math.max(0, col(x0 - outer) - 1), to = Math.min(cw - 1, col(x1 + outer) + 1);
      if (ady >= ri) { for (let i = from; i <= to; i++) pixel(i, j, py, dy); continue; }
      const inner = Math.sqrt(ri * ri - dy * dy);
      const a1 = Math.min(to, col(x0 - inner) + 1), b0 = Math.max(from, col(x1 + inner) - 1);
      for (let i = from; i <= a1; i++) pixel(i, j, py, dy);
      for (let i = Math.max(b0, a1 + 1); i <= to; i++) pixel(i, j, py, dy);
    }
    ctx.putImageData(out, 0, 0, 0, 0, clearW, clearH);
  }

  return { build, draw, size, invalidate: () => { spots = null; }, ready: () => !!src && (!gpu || gpu.ok()), gpu: !!gpu };
}
