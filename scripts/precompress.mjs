// After vite build: each script and stylesheet in dist/assets also as .br,
// compressed once at brotli's best (22 Nov 2026: Cloudflare's on-the-fly
// brotli sent the main script as 276 KB, more than gzip's 266 KB; at quality
// 11 it's about 215 KB). http-server.js serveStatic sends the .br file to a
// browser that accepts br. Asset names carry a content hash, so a .br never
// goes stale.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const dir = new URL("../dist/assets/", import.meta.url).pathname;
let before = 0, after = 0, n = 0;
for (const name of readdirSync(dir)) {
  if (!/\.(js|css|svg|json)$/.test(name)) continue;
  const file = join(dir, name);
  if (statSync(file).size < 1024) continue;
  const raw = readFileSync(file);
  const br = brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } });
  writeFileSync(`${file}.br`, br);
  before += raw.length; after += br.length; n++;
}
console.log(`precompressed ${n} files: ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB brotli`);
