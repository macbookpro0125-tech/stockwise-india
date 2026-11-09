# The capsule's width and height in the recording at given moments: walks out
# from a tab's centre along several rows while the pixels stay capsule grey.
#
#   VIDEO=<recording.mp4> python3 -I scripts/tabbar/capsule.py <t>:<centre x> …
#
# E.g. 13.5:445 (Explore's capsule at rest, 9 Nov 2026 recording). Rows and
# limits are that recording's (bar from y ~2186 to ~2372, x 63..1062).
import os, subprocess, sys
V = os.environ["VIDEO"]
T = os.environ.get("FRAMES", "/tmp/stockwise-tabbar/frames")
W, H, Y0 = 1126, 260, 2150

def load(t):
    out = subprocess.run([T, V, "raw", str(t), "/tmp/_capsule.rgb", "0", str(Y0), str(W), str(H)], capture_output=True, text=True).stdout.split()
    return float(out[0]), open("/tmp/_capsule.rgb", "rb").read()

def px(d, x, y):
    o = ((y - Y0) * W + x) * 3
    return d[o], d[o + 1], d[o + 2]

for arg in sys.argv[1:]:
    t, cx = arg.split(":"); t = float(t); cx = int(cx)
    at, d = load(t)
    def grey(x, y):
        r, g, b = px(d, x, y)
        return (r * 299 + g * 587 + b * 114) // 1000 < 243
    rows = {}
    for y in [2202, 2210, 2230, 2260, 2280, 2300, 2340, 2350, 2357]:
        L = cx
        while L > 63 and (grey(L - 1, y) or grey(L - 2, y) or grey(L - 3, y)): L -= 1
        R = cx
        while R < 1062 and (grey(R + 1, y) or grey(R + 2, y) or grey(R + 3, y)): R += 1
        rows[y] = (L, R, R - L + 1)
    top = 2280
    while top > 2187 and grey(cx, top - 1): top -= 1
    bottom = 2280
    while bottom < 2372 and grey(cx, bottom + 1): bottom += 1
    print(f"t={at:.3f} centre {cx} rows {rows} | down the middle: top {top} bottom {bottom} height {bottom - top + 1}")
