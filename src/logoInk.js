// Is a loaded company logo worth showing on its white tile? (CompanyLogo.jsx)
// The server already hides the logos a full scan found blank or banner-shaped
// (server/logos.js, 22 Oct 2026); this catches any that come later — a white
// logo on a clear background vanishes on white, a wide banner shrinks to a
// strip. Either way the company's letters show instead.

// The share of pixels that show on white: each RGBA pixel laid over white,
// counted when any channel is visibly darker than white
export function inkShare(rgba) {
  const n = Math.floor(rgba.length / 4);
  if (!n) return 0;
  let ink = 0;
  for (let i = 0; i < n * 4; i += 4) {
    const a = rgba[i + 3] / 255;
    const over = c => c * a + 255 * (1 - a);
    if (over(rgba[i]) < 235 || over(rgba[i + 1]) < 235 || over(rgba[i + 2]) < 235) ink++;
  }
  return ink / n;
}

export function logoVisible({ ink, w, h }) {
  const aspect = w && h ? w / h : 1;
  return ink >= 0.01 && aspect <= 2.5 && aspect >= 0.4;
}

// The check on a loaded <img> (same-origin, so its pixels can be read); true
// when it can't be checked, so nothing is hidden by mistake
export function imageLooksVisible(img) {
  try {
    const size = 24;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    const s = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    g.drawImage(img, (size - img.naturalWidth * s) / 2, (size - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    return logoVisible({ ink: inkShare(g.getImageData(0, 0, size, size).data), w: img.naturalWidth, h: img.naturalHeight });
  } catch {
    return true;
  }
}
