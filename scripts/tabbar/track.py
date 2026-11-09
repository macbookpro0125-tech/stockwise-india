# Follows iOS's bubble across the recording along one row of pixels: per
# frame, the runs of capsule grey, of colour (the drop's rim) and of dark ink.
#
#   VIDEO=<recording.mp4> python3 -I scripts/tabbar/track.py <start s> <end s> <step s> <row y>
#
# E.g. the 9 Nov 2026 recording, Watchlist → Explore: 12.775 13.3 0.0167 2280.
# The thresholds (grey 200..242 and nearly colourless; colour = channels 25+
# apart) suit that recording's light theme; re-check them on another.
import os, subprocess, sys
V = os.environ["VIDEO"]
T = os.environ.get("FRAMES", "/tmp/stockwise-tabbar/frames")
W = 1126

def row(t, y):
    out = subprocess.run([T, V, "raw", str(t), "/tmp/_track.rgb", "0", str(y), str(W), "1"], capture_output=True, text=True).stdout.split()
    d = open("/tmp/_track.rgb", "rb").read()
    return float(out[0]), [(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]) for i in range(W)]

def runs(mask, minlen=3):
    out, s = [], None
    for i, m in enumerate(mask + [False]):
        if m and s is None: s = i
        if not m and s is not None:
            if i - s >= minlen: out.append((s, i - 1))
            s = None
    return out

t0, t1, step, y = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4])
t = t0
while t <= t1 + 1e-6:
    at, r = row(t, y)
    L = [(p[0] * 299 + p[1] * 587 + p[2] * 114) // 1000 for p in r]
    ch = [max(p) - min(p) for p in r]
    grey = runs([200 < l < 242 and c < 12 for l, c in zip(L, ch)], 8)
    colour = runs([c >= 25 for c in ch], 2)
    dark = runs([l < 200 for l in L], 1)
    print(f"{at:7.3f} grey {grey} | colour {colour[:8]} | dark {[d for d in dark if d[1] - d[0] < 6][:12]}")
    t += step
