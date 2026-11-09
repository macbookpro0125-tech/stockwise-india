# Fits Apple's two spring numbers — damping (1 = no overshoot) and response
# (seconds) — and a start delay to measurements taken from the recording
# (track.py, capsule.py), by trying every combination on a grid.
#
#   python3 -I scripts/tabbar/fit.py
#
# The samples below are the 9 Nov 2026 recording's: the drop's width (pt)
# shrinking back to the capsule, and growing from it, ms after the touch.
# Put new measurements in and fit them the same way. (The trip itself was
# fitted from track.py's centres the same way: damping 0.9, response 0.331s.)
# The shrink fit gives what ships (liquidLens.js SHRINK, SHRINK_AFTER). The
# growth fit here is only a starting point: what ships (GROW, response 0.3s,
# damping 0.8) was settled by filming our bar against the recording, since our
# drop's target width also stretches with speed and follows the capsule under
# it, which this simple model leaves out.
import math

def spring(t, w, z):
    """0 → 1 for a spring of angular frequency w and damping ratio z, t seconds in."""
    if t <= 0: return 0.0
    if abs(z - 1) < 1e-6: return 1 - (1 + w * t) * math.exp(-w * t)
    if z < 1:
        wd = w * math.sqrt(1 - z * z)
        return 1 - math.exp(-z * w * t) * (math.cos(wd * t) + z * w / wd * math.sin(wd * t))
    r1 = -w * (z - math.sqrt(z * z - 1)); r2 = -w * (z + math.sqrt(z * z - 1))
    return 1 - (r2 * math.exp(r1 * t) - r1 * math.exp(r2 * t)) / (r2 - r1)

def fit(samples, start, end, dampings, ws, delays):
    best = None
    for z in dampings:
        for w in ws:
            for s in delays:
                e = sum((start + (end - start) * spring((t - s) / 1000, w, z) - y) ** 2 for t, y in samples)
                if best is None or e < best[0]: best = (e, z, w, s)
    e, z, w, s = best
    return z, 2 * math.pi / w, s, math.sqrt(e / len(samples)), lambda t: start + (end - start) * spring((t - s) / 1000, w, z)

shrink = [(202, 110.3), (218, 108.7), (235, 105.3), (252, 102), (285, 96), (302, 93.3), (318, 90.7), (335, 88.7), (352, 87), (368, 85.7), (385, 84.3), (402, 83.7), (418, 83), (435, 82.3)]
z, resp, s, rms, f = fit(shrink, 112.3, 84.5, [x / 100 for x in range(40, 101, 2)], [x / 2 for x in range(16, 80)], range(120, 215, 5))
print(f"shrink: starts {s}ms, damping {z}, response {resp:.3f}s (rms {rms:.2f}pt)")
print("  ", " ".join(f"{t}:{y}/{f(t):.1f}" for t, y in shrink))

# growing: two taps measured — from Discover's capsule (84.5pt) toward the drop
# (113.5), and from Watchlist's (97) toward 113 — fitted as one spring, since
# the drop grows the same way from any tab
grow_a = [(14, 85.7), (30, 87.3), (47, 89.7), (64, 92.3), (80, 95), (97, 97.3), (114, 99.3), (130, 103.3), (147, 106), (164, 108.3), (180, 111), (214, 113.7)]
grow_b = [(18, 97), (35, 97.7), (52, 98.3), (68, 108), (85, 110.3), (102, 112.3), (118, 112.3)]
best = None
for z in [x / 100 for x in range(50, 121, 5)]:
    for w in [x / 2 for x in range(10, 120)]:
        for s in range(-10, 60, 5):
            e = sum((84.5 + (113.5 - 84.5) * spring((t - s) / 1000, w, z) - y) ** 2 for t, y in grow_a) + sum((97 + (113.0 - 97) * spring((t - s) / 1000, w, z) - y) ** 2 for t, y in grow_b)
            if best is None or e < best[0]: best = (e, z, w, s)
e, z, w, s = best
print(f"grow (both taps): starts {s}ms, damping {z}, response {2 * math.pi / w:.3f}s (rms {math.sqrt(e / (len(grow_a) + len(grow_b))):.2f}pt)")
