# The bubble's top and bottom edges in the recording, frame by frame, a little
# either side of its centre (the centres come from track.py): how its height
# wobbles — flatter at speed, taller as it slows.
#
#   VIDEO=<recording.mp4> python3 -I scripts/tabbar/vtrack.py
#
# The centres below are the 9 Nov 2026 recording's switch Watchlist → Explore
# ("transition G"), in its pixels; the bar's top is near y 2186 there.
import os, subprocess
V = os.environ["VIDEO"]
T = os.environ.get("FRAMES", "/tmp/stockwise-tabbar/frames")
CENTRES = {12.775: 222, 12.792: 224, 12.808: 237, 12.825: 256, 12.842: 279, 12.858: 308, 12.875: 335, 12.892: 360, 12.908: 380, 12.925: 396, 12.942: 409, 12.958: 419, 12.975: 427, 12.992: 431, 13.008: 435, 13.025: 437, 13.042: 439, 13.058: 440, 13.075: 441, 13.092: 442, 13.108: 443, 13.125: 444, 13.142: 444, 13.175: 445, 13.225: 445, 13.275: 445}
for t, x in sorted(CENTRES.items()):
    edges = []
    for dx in (-30, 30):
        out = subprocess.run([T, V, "raw", str(t), "/tmp/_vtrack.rgb", str(x + dx), "2170", "1", "220"], capture_output=True, text=True).stdout.split()
        d = open("/tmp/_vtrack.rgb", "rb").read()
        px = [(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]) for i in range(220)]
        L = [(p[0] * 299 + p[1] * 587 + p[2] * 114) / 1000 for p in px]
        ch = [max(p) - min(p) for p in px]
        # the first strong change going down from just inside the bar's rim, and up from its bottom
        top = next((2170 + i for i in range(20, 58) if L[i] < 237 or ch[i] >= 20), None)
        bottom = next((2170 + i for i in range(204, 166, -1) if L[i] < 237 or ch[i] >= 20), None)
        edges.append((top, bottom))
    print(f"{float(out[0]):.3f} centre {x} edges {edges} height {[(b - a + 1) if a and b else None for a, b in edges]}")
