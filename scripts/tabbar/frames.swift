// Frames from a screen recording, exactly at the times asked (no rounding to
// the nearest keyframe): for measuring iOS's own tab bar against ours
// (scripts/tabbar/README.md). Build it once with the Xcode command line tools:
//   swiftc -O scripts/tabbar/frames.swift -o /tmp/stockwise-tabbar/frames
import AVFoundation
import AppKit

// frames <video> info                      → duration, frame rate, size
// frames <video> sheet <out.png> <start> <end> <step> <cols> <scale> [cropX cropY cropW cropH]
// frames <video> frames <outDir> <start> <end> <step> <scale> [cropX cropY cropW cropH]
// frames <video> line <t> <x0> <y0> <x1> <y1>  → "x y r g b" per pixel along a line
// frames <video> raw <t> <out.rgb> [cropX cropY cropW cropH] → raw RGB bytes, top row first
// frames <video> kymo <out.png> <start> <end> <step> <row y> <repeat> → one row over time
// Times in seconds, positions in the video's own pixels (3x on an iPhone).
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let track = asset.tracks(withMediaType: .video).first!
let dur = CMTimeGetSeconds(asset.duration)
let mode = a[2]
if mode == "info" {
  print("duration", dur, "fps", track.nominalFrameRate, "size", track.naturalSize, "transform", track.preferredTransform, "frames~", Int(dur * Double(track.nominalFrameRate)))
  exit(0)
}
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero

func grab(_ t: Double) -> (CGImage, Double)? {
  var actual = CMTime.zero
  guard let cg = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 6000), actualTime: &actual) else { return nil }
  return (cg, CMTimeGetSeconds(actual))
}
func crop(_ cg: CGImage, _ r: CGRect?) -> CGImage { guard let r = r else { return cg }; return cg.cropping(to: r) ?? cg }
func png(_ cg: CGImage, _ path: String) { let rep = NSBitmapImageRep(cgImage: cg); try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path)) }

if mode == "frames" {
  let out = a[3], start = Double(a[4])!, end = Double(a[5])!, step = Double(a[6])!, scale = Double(a[7])!
  let r: CGRect? = a.count > 11 ? CGRect(x: Double(a[8])!, y: Double(a[9])!, width: Double(a[10])!, height: Double(a[11])!) : nil
  var t = start
  while t <= min(end, dur) + 1e-6 {
    if let (cg, at) = grab(t) {
      var img = crop(cg, r)
      if scale != 1 {
        let w = Int(Double(img.width) * scale), h = Int(Double(img.height) * scale)
        let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.interpolationQuality = .high
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
        img = ctx.makeImage()!
      }
      png(img, String(format: "%@/f_%07.3f.png", out, at))
    }
    t += step
  }
  exit(0)
}
// frames.swift <video> line <t> <x0> <y0> <x1> <y1>  → "x y r g b" per pixel along a straight line
if mode == "line" {
  let t = Double(a[3])!, x0 = Int(a[4])!, y0 = Int(a[5])!, x1 = Int(a[6])!, y1 = Int(a[7])!
  guard let (cg, at) = grab(t) else { exit(1) }
  let w = cg.width, h = cg.height
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
  let buf = ctx.data!.assumingMemoryBound(to: UInt8.self)
  print("at", at)
  let n = max(abs(x1 - x0), abs(y1 - y0))
  for i in 0...n {
    let x = x0 + (x1 - x0) * i / max(n, 1), y = y0 + (y1 - y0) * i / max(n, 1)
    // this bitmap's rows run top-first (reading them bottom-up was an early bug)
    let o = (y * w + x) * 4
    print(x, y, buf[o], buf[o + 1], buf[o + 2])
  }
  exit(0)
}
// frames.swift <video> raw <t> <out.rgb> [cropX cropY cropW cropH] → raw RGB bytes, top row first
if mode == "raw" {
  let t = Double(a[3])!
  guard let (cg0, at) = grab(t) else { exit(1) }
  let r: CGRect? = a.count > 8 ? CGRect(x: Double(a[5])!, y: Double(a[6])!, width: Double(a[7])!, height: Double(a[8])!) : nil
  let cg = crop(cg0, r)
  let w = cg.width, h = cg.height
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
  let buf = ctx.data!.assumingMemoryBound(to: UInt8.self)
  var out = [UInt8](); out.reserveCapacity(w * h * 3)
  for y in 0..<h { let row = y; for x in 0..<w { let o = (row * w + x) * 4; out.append(buf[o]); out.append(buf[o + 1]); out.append(buf[o + 2]) } }
  FileManager.default.createFile(atPath: a[4], contents: Data(out))
  print(at, w, h)
  exit(0)
}
// frames.swift <video> kymo <out.png> <start> <end> <step> <row y> <repeat>
if mode == "kymo" {
  let out = a[3], start = Double(a[4])!, end = Double(a[5])!, step = Double(a[6])!, ry = Int(a[7])!, rep = Int(a[8])!
  var rows: [CGImage] = []; var times: [Double] = []
  var t = start
  while t <= min(end, dur) + 1e-6 { if let (cg, at) = grab(t) { rows.append(cg.cropping(to: CGRect(x: 0, y: ry, width: cg.width, height: 1))!); times.append(at) }; t += step }
  let w = rows[0].width, h = rows.count * rep
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  for (i, r) in rows.enumerated() { ctx.draw(r, in: CGRect(x: 0, y: h - (i + 1) * rep, width: w, height: rep)) }
  png(ctx.makeImage()!, out)
  print(times.map { String(format: "%.3f", $0) }.joined(separator: " "))
  exit(0)
}
if mode == "sheet" {
  let out = a[3], start = Double(a[4])!, end = Double(a[5])!, step = Double(a[6])!, cols = Int(a[7])!, scale = Double(a[8])!
  let r: CGRect? = a.count > 12 ? CGRect(x: Double(a[9])!, y: Double(a[10])!, width: Double(a[11])!, height: Double(a[12])!) : nil
  var imgs: [(CGImage, Double)] = []
  var t = start
  while t <= min(end, dur) + 1e-6 { if let (cg, at) = grab(t) { imgs.append((crop(cg, r), at)) }; t += step }
  guard let first = imgs.first?.0 else { print("no frames"); exit(1) }
  let cw = Int(Double(first.width) * scale), ch = Int(Double(first.height) * scale), label = 22, gap = 6
  let rows = (imgs.count + cols - 1) / cols
  let W = cols * (cw + gap) + gap, H = rows * (ch + label + gap) + gap
  let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(CGColor(red: 1, green: 0, blue: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  ctx.interpolationQuality = .high
  let ns = NSGraphicsContext(cgContext: ctx, flipped: false)
  NSGraphicsContext.current = ns
  for (n, (img, at)) in imgs.enumerated() {
    let c = n % cols, rr = n / cols
    let x = gap + c * (cw + gap), yTop = gap + rr * (ch + label + gap)
    let y = H - yTop - label - ch
    ctx.draw(img, in: CGRect(x: x, y: y, width: cw, height: ch))
    let s = NSAttributedString(string: String(format: "%.3fs", at), attributes: [.font: NSFont.monospacedSystemFont(ofSize: 15, weight: .bold), .foregroundColor: NSColor.black])
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(CGRect(x: x, y: H - yTop - label, width: cw, height: label))
    s.draw(at: NSPoint(x: x + 4, y: H - yTop - label + 3))
  }
  png(ctx.makeImage()!, out)
  print("frames", imgs.count, "cell", cw, ch)
  exit(0)
}
