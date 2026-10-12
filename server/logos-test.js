// Checks for company logos: which addresses may be fetched, which icons are
// picked, and which files count as images.
import { isPublicAddress, imageType, iconCandidates } from "./logos.js";

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok: ${msg}`);
  else { failures++; console.error(`FAIL: ${msg}`); }
}

assert(["8.8.8.8", "13.233.1.9", "2606:4700::1111"].every(isPublicAddress), "ordinary internet addresses are allowed");
assert(!["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"].some(isPublicAddress),
  "loopback, private, link-local (cloud metadata), carrier-grade NAT and mapped private addresses are refused");

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const ico = Buffer.concat([Buffer.from([0, 0, 1, 0]), Buffer.alloc(12)]);
assert(imageType(png) === "image/png" && imageType(ico) === "image/x-icon", "PNG and ICO are recognised by their first bytes");
assert(imageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')) == null, "SVG is never accepted (it can carry script)");
assert(imageType(Buffer.from("<!doctype html><html><body>Not found</body></html>")) == null, "an HTML error page served as an icon is refused");

const html = `<head>
  <link rel="icon" href="/favicon-32.png" sizes="32x32">
  <link rel='shortcut icon' href='/old.ico'>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <link rel="mask-icon" href="/pinned.png">
  <link rel="apple-touch-icon" sizes="180x180" href="https://cdn.example.com/touch.png?v=2&amp;x=1">
  <link rel="stylesheet" href="/site.css">
</head>`;
const picks = iconCandidates(html, "https://www.example.com/en/home");
assert(picks[0] === "https://cdn.example.com/touch.png?v=2&x=1", "the touch icon comes first");
assert(picks[1] === "https://www.example.com/favicon-32.png" && picks.includes("https://www.example.com/old.ico"), "then the largest declared icon, relative links resolved");
assert(!picks.some(u => /\.svg|pinned|site\.css/.test(u)), "SVG icons, mask icons and stylesheets are skipped");
assert(picks.at(-1) === "https://www.example.com/favicon.ico", "/favicon.ico is the last resort");

if (failures) { console.error(`${failures} logo check(s) failed`); process.exit(1); }
console.log("\nAll logo checks passed.");
