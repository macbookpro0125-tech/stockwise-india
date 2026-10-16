// The front page's star film, drawn live with WebGL2 (16 Oct 2026, "make it
// from scratch, 4K, clarity when it zooms"). Nothing here is a picture: the
// sky, every star, the constellation lines and the one star the camera flies
// into are computed per pixel each frame, at the screen's own resolution, so
// the film stays sharp at any zoom and on any screen — 4K and beyond.
//
// The story, by scroll progress p (0 → 1):
//   0.00  a night sky; one star a little brighter than the rest
//   0.06  the camera starts to fly forward through the field — one star per
//         NSE company — near stars streaming past with real depth
//   0.29  each strategy draws a constellation of teal lines around that star
//   0.47  close to the star, six arcs draw around it — the six areas of its score
//   0.66  the page shows the fair value and the price levels around it (HTML)
//   0.55+ the star opens into the page: its colour spreads from the star with a
//         teal edge until it is the page's own background (light or dark theme)
// The stars keep real star colours (white, warm, blue-white); the app's teal
// is for what the interface draws: lines, the ring, the opening edge.
// The stars, lines and arcs are decoration, not data: positions are
// seeded, only the counts (companies, strategies) are the app's own.

const FOV = 55; // degrees, across the screen's shorter side
const HERO = [-28, 22, -260];
const C0 = [0, 0, 40];
const D_END = 1.55; // distance from the star at the end of the push
const HERO_R = 0.32; // the star's radius, world units

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const c01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
const seg = (p, a, b) => ease(c01((p - a) / (b - a)));
const mix = (a, b, t) => a + (b - a) * t;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = a => scl(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function seeded(seed) { // mulberry32: the same sky on every visit
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Where the camera is and what it looks at, for progress p
export function cameraAt(p, reduce = false) {
  const toHero = sub(C0, HERO), d0 = len(toHero), back = nrm(toHero);
  // less motion: the camera holds back far enough to see the constellations
  const e = reduce ? 0.22 : ease(c01((p - 0.06) / 0.86));
  const d = d0 * Math.pow(D_END / d0, e); // a steady zoom: equal scroll, equal magnification
  const eye = add(HERO, scl(back, d));
  const look = reduce ? 1 : seg(p, 0.04, 0.55);
  const target = lerp3([0, 0, -200], HERO, look);
  const roll = reduce ? 0 : (seg(p, 0, 1) - 0.5) * 0.05; // a slight bank, radians
  return { eye, target, roll, dist: d };
}

// The story's stages for scroll progress p: what the lines, the ring and the
// light are doing. The film uses these; the sign-in panel sets its own.
export function stagesAt(p) {
  return {
    lines: p, lineFade: 1 - seg(p, 0.5, 0.57),          // constellations drawn by p, then gone
    boost: 0.6 + 1.2 * seg(p, 0.2, 0.62), yield: 1 - seg(p, 0.54, 0.6), // the star's brightness, and its glare giving way
    ring: c01((p - 0.47) / 0.115), ringFade: 1 - seg(p, 0.6, 0.645),   // the score's six arcs
    reveal: seg(p, 0.56, 0.74), vfull: seg(p, 0.74, 0.82), rimFade: 1 - seg(p, 0.72, 0.8), // the page opening
  };
}

// The sign-in panel's camera: held back from the star where the
// constellations show, drifting slowly, and moved a little by the pointer
// (look: -1…1 each way) so near stars shift more than far ones — real depth
export function panelCamera(t, look = [0, 0], dist = 118) {
  const back = nrm(sub(C0, HERO));
  const ux = nrm(cross(back, [0, 1, 0])), uy = cross(ux, back);
  const drift = [Math.sin(t * 0.05) * 2.5, Math.cos(t * 0.037) * 1.6];
  const ox = drift[0] - look[0] * 6, oy = drift[1] - look[1] * 4;
  const eye = add(add(HERO, scl(back, dist)), add(scl(ux, ox), scl(uy, oy)));
  return { eye, target: HERO, roll: 0, dist };
}

// ── shaders ──
const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 a_pos; out vec2 v_uv;
void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0., 1.); }`;

const NOISE = `
float h1(vec3 p){ p = fract(p * 0.3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h3(vec3 p){ return vec3(h1(p), h1(p + 19.19), h1(p + 47.77)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h1(i), h1(i + vec3(1,0,0)), f.x), mix(h1(i + vec3(0,1,0)), h1(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h1(i + vec3(0,0,1)), h1(i + vec3(1,0,1)), f.x), mix(h1(i + vec3(0,1,1)), h1(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = .5, s = 0.; for (int k = 0; k < 5; k++){ s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }`;

// The sky, in two parts. Its colour — deep navy, a faint band of the galaxy,
// warmth around the star — is soft, so it is drawn at a quarter of the
// resolution and scaled up (NEB_FS). The far stars are drawn at full
// resolution over it (SKY_FS). Both work by direction: too far to move as the
// camera flies, and never pixelated.
const NEB_FS = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform vec3 u_r, u_u, u_f; uniform vec2 u_tan; uniform vec3 u_hd;
${NOISE}
void main(){
  vec2 n = v_uv * 2. - 1.;
  vec3 d = normalize(u_f + n.x * u_tan.x * u_r + n.y * u_tan.y * u_u);
  // the app's navy (#080810 → #141424), its lavender, and a little of its teal
  vec3 col = mix(vec3(.031, .031, .063), vec3(.07, .07, .13), smoothstep(-.7, .9, d.y));
  vec3 bn = normalize(vec3(.35, .9, .25));                 // the galaxy's plane
  float band = exp(-pow(dot(d, bn) / .32, 2.));
  col += band * smoothstep(.42, .95, fbm(d * 3.2 + 4.)) * vec3(.13, .13, .28) * .8;
  col += band * smoothstep(.55, 1.05, fbm(d * 7.5 + 11.)) * vec3(.66, .66, .75) * .06;
  col -= band * smoothstep(.6, .9, fbm(d * 5.1 + 3.)) * .03;  // dust lanes
  col += pow(max(dot(d, u_hd), 0.), 60.) * vec3(.22, .17, .11) * .5; // the star's warmth on the sky
  o = vec4(col, band);
}`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_neb;
uniform vec3 u_r, u_u, u_f; uniform vec2 u_tan; uniform float u_pxr, u_dpr, u_t, u_tw;
float h1(vec3 p){ p = fract(p * 0.3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 h3(vec3 p){ return vec3(h1(p), h1(p + 19.19), h1(p + 47.77)); }
float layer(vec3 d, float sc, float dens, float bright){
  vec3 p = d * sc, i = floor(p); vec3 r = h3(i);
  if (r.x > dens) return 0.;
  vec3 sp = normalize(i + .15 + .7 * h3(i + 7.1)) * sc;
  float px = length(p - sp) / sc * u_pxr;            // distance in device px
  float s = .62 * u_dpr;                              // a crisp point, ~0.6 css px
  float tw = 1. + u_tw * .25 * sin(u_t * (1. + 3. * r.z) + r.y * 60.);
  return bright * pow(r.y, 2.2) * tw * exp(-px * px / (2. * s * s));
}
void main(){
  vec2 n = v_uv * 2. - 1.;
  vec3 d = normalize(u_f + n.x * u_tan.x * u_r + n.y * u_tan.y * u_u);
  vec4 neb = texture(u_neb, v_uv);
  float band = neb.a;
  float st = layer(d, 300., .010 + .02 * band, 1.1) + layer(d, 820., .004 + .012 * band, .7);
  vec3 col = neb.rgb + st * vec3(.957, .957, 1.);          // #F4F4FF
  col += (h1(vec3(gl_FragCoord.xy, u_t)) - .5) / 255.;    // dither: no banding on wide screens
  o = vec4(col, 1.);
}`;

// The near stars, one per company: real points in 3D, so they grow, brighten
// and stream past as the camera flies through them
const STAR_VS = `#version 300 es
in vec2 a_c; in vec3 a_p; in float a_b; in vec3 a_col; in float a_ph; in float a_lit;
uniform mat4 u_vp; uniform vec3 u_eye; uniform vec2 u_res; uniform float u_dpr, u_t, u_tw, u_p, u_lines, u_fade;
out vec2 v_q; out vec3 v_col; out float v_a, v_s, v_rad, v_sp;
void main(){
  vec4 c = u_vp * vec4(a_p, 1.);
  float d = distance(a_p, u_eye);
  if (c.w < .3) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float tw = 1. + u_tw * .16 * sin(u_t * (1.1 + a_ph * 2.3) + a_ph * 40.);
  float lit = 1. + 1.4 * smoothstep(a_lit, a_lit + .025, u_p) * u_lines;
  float app = a_b * 60. / d * lit;
  float s = .5 + .55 * sqrt(min(app, 9.));                 // core, css px
  float rad = min(s * 5. + 9. * sqrt(min(app, 9.)), 150.);
  v_q = a_c * rad; v_rad = rad; v_s = s; v_col = a_col;
  v_a = clamp(app, 0., 2.2) * tw * smoothstep(1.2, 7., d) * u_fade;
  v_sp = smoothstep(.55, 1.6, app);
  vec2 ndc = c.xy / c.w;
  gl_Position = vec4(ndc + a_c * rad * u_dpr * 2. / u_res, 0., 1.);
}`;
const STAR_FS = `#version 300 es
precision highp float;
in vec2 v_q; in vec3 v_col; in float v_a, v_s, v_rad, v_sp; out vec4 o;
void main(){
  float r = length(v_q);
  float core = exp(-r * r / (2. * v_s * v_s));
  float halo = .07 / (1. + r * r / (v_s * v_s * 10.));
  vec2 a = abs(v_q);
  float spike = v_sp * .35 * (exp(-a.y / (.45)) * exp(-a.x / (v_rad * .35)) + exp(-a.x / (.45)) * exp(-a.y / (v_rad * .35)));
  float e = smoothstep(v_rad, v_rad * .55, r);
  float i = (core + (halo + spike) * e) * v_a;
  o = vec4(mix(v_col, vec3(1.), core * .6) * i, 0.);
}`;

// The constellation lines: each drawn from star to star as the scroll moves,
// a crisp teal line with a soft glow, in screen pixels at any zoom
const LINE_VS = `#version 300 es
in vec2 a_c; in vec3 a_a; in vec3 a_b; in vec2 a_w;
uniform mat4 u_vp; uniform vec3 u_eye; uniform vec2 u_res; uniform float u_dpr, u_p, u_fade;
out float v_d, v_a;
void main(){
  float k = smoothstep(a_w.x, a_w.y, u_p);
  vec3 b = mix(a_a, a_b, k);
  vec4 ca = u_vp * vec4(a_a, 1.), cb = u_vp * vec4(b, 1.);
  if (k <= 0. || ca.w < .6 || cb.w < .6) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec2 pa = (ca.xy / ca.w * .5 + .5) * u_res, pb = (cb.xy / cb.w * .5 + .5) * u_res;
  vec2 dir = pb - pa; float L = length(dir); dir = L > .001 ? dir / L : vec2(1., 0.);
  vec2 n = vec2(-dir.y, dir.x);
  float w = 7. * u_dpr;
  vec2 pos = mix(pa, pb, a_c.x) + n * a_c.y * w + dir * (a_c.x * 2. - 1.) * w * .5;
  v_d = a_c.y * w / u_dpr;
  float near = min(distance(a_a, u_eye), distance(b, u_eye));
  v_a = u_fade * smoothstep(2., 10., near);
  gl_Position = vec4(pos / u_res * 2. - 1., 0., 1.);
}`;
const LINE_FS = `#version 300 es
precision highp float;
in float v_d, v_a; out vec4 o;
void main(){
  float core = exp(-v_d * v_d / (2. * .5 * .5)), glow = .28 * exp(-v_d * v_d / (2. * 2.4 * 2.4));
  vec3 teal = vec3(0., .878, .745);                        // the app's accent, #00E0BE
  o = vec4((teal * glow + mix(teal, vec3(.9, 1., .98), .55) * core) * v_a, 0.);
}`;

// The star itself, the score ring, the level line and the light that becomes
// the page — per pixel, around the star's position on screen
const OVER_FS = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform vec2 u_res, u_h; uniform float u_hr, u_dpr, u_t, u_tw, u_rot, u_vis;
// the story's stages (stagesAt() for the film; the sign-in panel sets its own)
uniform float u_boost, u_yield, u_ring, u_ringFade, u_reveal, u_vfull, u_rimFade;
uniform vec3 u_page;                                 // the page's --bg, per theme
${NOISE}
float arc(float d, float w){ return exp(-d * d / (2. * w * w)); }
float sg(float p, float a, float b){ float t = clamp((p - a) / (b - a), 0., 1.); return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
void main(){
  vec2 res = u_res / u_dpr;                          // css px
  vec2 fp = gl_FragCoord.xy / u_dpr, h = u_h / u_dpr;
  vec2 q = fp - h;
  float r = length(q), R = max(u_hr / u_dpr, .35);
  float md = min(res.x, res.y);
  float a = atan(q.y, q.x);
  // The star: a disc, warmer at its rim; a corona held close; four fine rays
  // that shorten as the camera arrives
  float disc = smoothstep(R + .8, R - .8, r);
  vec3 photo = mix(vec3(1.), vec3(1., .86, .62), pow(clamp(r / R, 0., 1.), 3.));
  float wob = .9 + .1 * sin(a * 7. + u_t * .3) * sin(a * 13. - u_t * .2 + u_rot);
  float cor = exp(-max(r - R, 0.) / (R * .75 + 2.)) * .85 + (R * 2.5 + 5.) / (r + R * 2.5 + 5.) * .1;
  float ray = 0.;
  for (int k = 0; k < 4; k++){ float ang = float(k) * .7853982; float dd = abs(sin(a - ang)) * r; ray += exp(-dd * dd / (2. * .55 * .55)); }
  ray *= exp(-r / (R * 5. + 55.)) * (1. - smoothstep(25., 110., R));
  float boost = u_boost;
  float flick = 1. + u_tw * .05 * sin(u_t * 1.7);
  float yield = u_yield;                               // the glare gives way as the page opens
  vec3 star = (photo * disc * 1.15 + vec3(1., .9, .74) * cor * wob * boost * flick + vec3(1., .96, .9) * ray * .5 * boost) * u_vis * yield;
  // The score: six arcs drawn one after another around the star, clear of its glare
  float RR = max(R * 3.4 + 18., md * .15);
  float ring = 0.;
  for (int k = 0; k < 6; k++){
    float s = sg(u_ring, .148 * float(k), .148 * float(k) + .261);
    float start = 1.5708 - float(k) * 1.0472 - .07;   // clockwise from the top
    float span = (1.0472 - .14) * s;
    float rel = mod(start - a + 12.56637, 6.28319);
    ring += step(rel, span) * step(.0001, s) * (arc(r - RR, .6) + .25 * arc(r - RR, 3.5));
  }
  ring *= u_ringFade;
  // The light: a disc of it spreading from the star until it is the page,
  // with a warm edge as it travels
  vec2 far2 = max(h, res - h);
  float reach = length(far2) + md * .35;
  // a crisp edge, so the page arrives clean; a fine teal line rides it
  float vr = u_reveal * reach;
  float v = vr > 0. ? 1. - smoothstep(vr - 1.5, vr + .5, r) : 0.;
  v = max(v, u_vfull);
  float rimOn = step(.001, vr) * u_rimFade;
  float rim = (arc(r - vr, .9) + .35 * arc(r - vr - 6., 10.)) * rimOn;
  vec3 teal = vec3(0., .878, .745);
  vec3 glow = star + teal * ring * 1.3 + teal * rim;
  // Premultiplied over the scene (blend ONE, ONE_MINUS_SRC_ALPHA): the stars
  // show through until the page covers them. (The price levels that follow
  // are HTML, labelled, in StarFilm.jsx.)
  o = vec4(glow * (1. - v) + u_page * v, v);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ""); u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}

// The field: one star per company, spread through the space the camera flies
// into, and one constellation per strategy, converging on the star
function buildField(companies, strategies) {
  const rand = seeded(20261016);
  const stars = [];
  const pathA = C0, pathB = HERO, ab = sub(pathB, pathA), abLen2 = dot(ab, ab);
  while (stars.length < companies) {
    const depth = 8 + 460 * Math.pow(rand(), 0.72);     // distance ahead of the start
    const z = C0[2] - depth;
    const spread = depth * 1.08 + 12;
    const x = (rand() * 2 - 1) * spread, y = (rand() * 2 - 1) * spread;
    const pt = [x, y, z];
    const t = c01(dot(sub(pt, pathA), ab) / abLen2);
    if (len(sub(pt, lerp3(pathA, pathB, t))) < 3.2) continue;   // keep the flight path clear
    const b = 0.16 + 2.3 * Math.pow(rand(), 4);
    const k = rand();
    const col = k < 0.16 ? [0.74, 0.84, 1.0] : k < 0.72 ? [1.0, 0.97, 0.92] : [1.0, 0.86, 0.66]; // real star colours: blue-white, white, warm
    stars.push({ p: pt, b, col, ph: rand(), lit: 9 });
  }
  // Constellations: one small group per strategy, set in a crown around the
  // flight path a little short of the star, so the camera flies through them.
  // Each is a short walk inward; the one ending nearest the star links into it.
  // Their stars are taken from the field (moved), so the count stays one per company.
  const lines = [];
  const axis = nrm(sub(HERO, C0));
  let ux = nrm(cross(axis, [0, 1, 0])), uy = cross(ux, axis);
  const taken = new Set();
  const take = () => { let i; do i = Math.floor(rand() * stars.length); while (taken.has(i)); taken.add(i); return stars[i]; };
  for (let c = 0; c < strategies; c++) {
    const phi = (c / strategies) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const rho = 16 + rand() * 30, along = -(18 + rand() * 60); // before the star, on the way in
    const n = 4 + Math.floor(rand() * 3);
    const chain = [];
    let pos = add(add(HERO, scl(axis, along)), add(scl(ux, Math.cos(phi) * rho), scl(uy, Math.sin(phi) * rho)));
    for (let k = 0; k < n; k++) {
      const st = take();
      st.p = pos; st.b = 0.55 + rand() * 1.2;
      chain.push(st);
      // the next star: a short step, drifting inward and around
      const toAxis = sub(add(HERO, scl(axis, dot(sub(pos, HERO), axis))), pos);
      const inward = len(toAxis) > 10 ? 0.55 : -0.6; // never into the flight path
      const step = 5 + rand() * 6;
      const wander = add(scl(ux, (rand() - 0.5) * 2), add(scl(uy, (rand() - 0.5) * 2), scl(axis, (rand() - 0.5) * 1.6)));
      pos = add(pos, scl(nrm(add(scl(nrm(toAxis), inward), wander)), step));
    }
    const w0 = 0.285 + c * (0.1 / Math.max(1, strategies));
    const stepW = 0.011;
    const toHero = len(sub(chain[chain.length - 1].p, HERO)) < 34;
    const segs = chain.length - 1 + (toHero ? 1 : 0);
    for (let k = 0; k < segs; k++) {
      const a = chain[k].p, b = k + 1 < chain.length ? chain[k + 1].p : HERO;
      const ws = w0 + k * stepW;
      lines.push({ a, b, w: [ws, ws + stepW * 1.5] });
      chain[k].lit = Math.min(chain[k].lit, ws);
    }
    chain[chain.length - 1].lit = Math.min(chain[chain.length - 1].lit, w0 + (chain.length - 1) * stepW);
  }
  return { stars, lines };
}

// preserve: keep the last frame readable (the 4K export reads it back)
// theme: { page: [r, g, b] } in 0–1, the page's --bg
export function createStarScene(canvas, { companies = 2252, strategies = 13, reduce = false, preserve = false, theme } = {}) {
  let page = theme?.page ?? [0.031, 0.031, 0.063];
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: preserve, powerPreference: "high-performance" });
  if (!gl) return null;
  let sky, starP, lineP, over, neb;
  try {
    sky = program(gl, QUAD_VS, SKY_FS); over = program(gl, QUAD_VS, OVER_FS); neb = program(gl, QUAD_VS, NEB_FS);
    starP = program(gl, STAR_VS, STAR_FS); lineP = program(gl, LINE_VS, LINE_FS);
  } catch (e) { console.warn("star film: shaders", e); return null; }

  // a full-screen triangle pair
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, corner);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const lcorner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lcorner);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); // a_pos, both full-screen passes
  let starVao, lineVao, nStars = 0, nLines = 0;
  const bufs = [];
  function upload(field) {
    for (const b of bufs.splice(0)) gl.deleteBuffer(b);
    if (starVao) gl.deleteVertexArray(starVao); if (lineVao) gl.deleteVertexArray(lineVao);
    const attr = (prog, vao, name, data, size, divisor) => {
      gl.bindVertexArray(vao);
      const b = gl.createBuffer(); bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog.p, name); if (loc < 0) return;
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, divisor);
    };
    const S = field.stars; nStars = S.length;
    starVao = gl.createVertexArray();
    gl.bindVertexArray(starVao); gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    let loc = gl.getAttribLocation(starP.p, "a_c"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    attr(starP, starVao, "a_p", new Float32Array(S.flatMap(s => s.p)), 3, 1);
    attr(starP, starVao, "a_b", new Float32Array(S.map(s => s.b)), 1, 1);
    attr(starP, starVao, "a_col", new Float32Array(S.flatMap(s => s.col)), 3, 1);
    attr(starP, starVao, "a_ph", new Float32Array(S.map(s => s.ph)), 1, 1);
    attr(starP, starVao, "a_lit", new Float32Array(S.map(s => s.lit)), 1, 1);
    const L = field.lines; nLines = L.length;
    lineVao = gl.createVertexArray();
    gl.bindVertexArray(lineVao); gl.bindBuffer(gl.ARRAY_BUFFER, lcorner);
    loc = gl.getAttribLocation(lineP.p, "a_c"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    attr(lineP, lineVao, "a_a", new Float32Array(L.flatMap(l => l.a)), 3, 1);
    attr(lineP, lineVao, "a_b", new Float32Array(L.flatMap(l => l.b)), 3, 1);
    attr(lineP, lineVao, "a_w", new Float32Array(L.flatMap(l => l.w)), 2, 1);
    gl.bindVertexArray(null);
  }
  let counts = [companies, strategies];
  upload(buildField(companies, strategies));

  let W = 1, H = 1, dpr = 1, NW = 1, NH = 1;
  const nebTex = gl.createTexture(), nebFbo = gl.createFramebuffer();
  function resize(cssW, cssH, ratio) {
    dpr = ratio; W = Math.max(1, Math.round(cssW * dpr)); H = Math.max(1, Math.round(cssH * dpr));
    canvas.width = W; canvas.height = H;
    NW = Math.max(1, Math.ceil(W / 4)); NH = Math.max(1, Math.ceil(H / 4));
    gl.bindTexture(gl.TEXTURE_2D, nebTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NW, NH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.bindFramebuffer(gl.FRAMEBUFFER, nebFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, nebTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function matrices(cam) {
    const f = nrm(sub(cam.target, cam.eye));
    let r = nrm(cross(f, [0, 1, 0])), u = cross(r, f);
    const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
    [r, u] = [add(scl(r, cr), scl(u, sr)), add(scl(u, cr), scl(r, -sr))];
    const base = Math.tan(FOV * Math.PI / 360);
    const tanX = W >= H ? base * W / H : base, tanY = W >= H ? base : base * H / W;
    const n = 0.05, fa = 2000;
    // view-projection, column-major
    const P = [1 / tanX, 0, 0, 0, 0, 1 / tanY, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
    const V = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, cam.eye), -dot(u, cam.eye), dot(f, cam.eye), 1];
    const VP = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + rr] * V[c * 4 + k]; VP[c * 4 + rr] = s; }
    // the star on screen
    const rel = sub(HERO, cam.eye), zc = dot(rel, f);
    const hx = dot(rel, r) / zc / tanX, hy = dot(rel, u) / zc / tanY;
    const hero = [(hx * 0.5 + 0.5) * W, (hy * 0.5 + 0.5) * H];
    const heroR = HERO_R / zc * (H / 2) / tanY;
    return { cam, VP, r, u, f, tanX, tanY, hero, heroR, vis: zc > 0 ? 1 : 0, hd: nrm(rel) };
  }

  // o: { camera, stages } to override the film's (the sign-in panel)
  function render(p, t, o = {}) {
    const st = o.stages ?? stagesAt(p);
    const m = matrices(o.camera ?? cameraAt(p, reduce));
    const tw = reduce ? 0 : 1;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    // the sky's colour, at a quarter of the resolution
    gl.bindFramebuffer(gl.FRAMEBUFFER, nebFbo); gl.viewport(0, 0, NW, NH);
    gl.useProgram(neb.p); gl.bindVertexArray(quadVao);
    gl.uniform3fv(neb.u.u_r, m.r); gl.uniform3fv(neb.u.u_u, m.u); gl.uniform3fv(neb.u.u_f, m.f);
    gl.uniform2f(neb.u.u_tan, m.tanX, m.tanY); gl.uniform3fv(neb.u.u_hd, m.hd);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    // the far stars over it, at full resolution
    gl.useProgram(sky.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, nebTex); gl.uniform1i(sky.u.u_neb, 0);
    gl.uniform3fv(sky.u.u_r, m.r); gl.uniform3fv(sky.u.u_u, m.u); gl.uniform3fv(sky.u.u_f, m.f);
    gl.uniform2f(sky.u.u_tan, m.tanX, m.tanY);
    gl.uniform1f(sky.u.u_pxr, (H / 2) / m.tanY); gl.uniform1f(sky.u.u_dpr, dpr); gl.uniform1f(sky.u.u_t, t); gl.uniform1f(sky.u.u_tw, tw);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // stars and lines, added light
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const lineFade = st.lineFade;
    gl.useProgram(lineP.p); gl.bindVertexArray(lineVao);
    gl.uniformMatrix4fv(lineP.u.u_vp, false, m.VP); gl.uniform3fv(lineP.u.u_eye, m.cam.eye);
    gl.uniform2f(lineP.u.u_res, W, H); gl.uniform1f(lineP.u.u_dpr, dpr); gl.uniform1f(lineP.u.u_p, st.lines); gl.uniform1f(lineP.u.u_fade, lineFade);
    if (lineFade > 0) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nLines);
    gl.useProgram(starP.p); gl.bindVertexArray(starVao);
    gl.uniformMatrix4fv(starP.u.u_vp, false, m.VP); gl.uniform3fv(starP.u.u_eye, m.cam.eye);
    gl.uniform2f(starP.u.u_res, W, H); gl.uniform1f(starP.u.u_dpr, dpr); gl.uniform1f(starP.u.u_t, t); gl.uniform1f(starP.u.u_tw, tw);
    gl.uniform1f(starP.u.u_p, st.lines); gl.uniform1f(starP.u.u_lines, lineFade); gl.uniform1f(starP.u.u_fade, 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nStars);
    // the star, the score, the level, the light
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(over.p); gl.bindVertexArray(quadVao);
    gl.uniform2f(over.u.u_res, W, H); gl.uniform2f(over.u.u_h, m.hero[0], m.hero[1]);
    gl.uniform1f(over.u.u_hr, m.heroR); gl.uniform1f(over.u.u_dpr, dpr);
    for (const [k, v] of [["u_boost", st.boost], ["u_yield", st.yield], ["u_ring", st.ring], ["u_ringFade", st.ringFade], ["u_reveal", st.reveal], ["u_vfull", st.vfull], ["u_rimFade", st.rimFade]]) gl.uniform1f(over.u[k], v);
    gl.uniform1f(over.u.u_t, t); gl.uniform1f(over.u.u_tw, tw); gl.uniform1f(over.u.u_rot, 0); gl.uniform1f(over.u.u_vis, m.vis * (st.hero ?? 1)); // hero 0: the sign-in panel draws its own
    gl.uniform3fv(over.u.u_page, page);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  return {
    resize,
    render,
    setTheme(th) { page = th.page; },
    setCounts(c, s) { if (c === counts[0] && s === counts[1]) return; counts = [c, s]; upload(buildField(c, s)); },
    // Free what this scene made, but keep the context: React may set the film
    // up again on the same canvas (StrictMode), and a lost context stays lost
    destroy() {
      for (const b of bufs.splice(0)) gl.deleteBuffer(b);
      for (const b of [quad, corner, lcorner]) gl.deleteBuffer(b);
      for (const v of [quadVao, starVao, lineVao]) if (v) gl.deleteVertexArray(v);
      for (const pr of [sky, over, neb, starP, lineP]) gl.deleteProgram(pr.p);
      gl.deleteTexture(nebTex); gl.deleteFramebuffer(nebFbo);
    },
  };
}
