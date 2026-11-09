#!/bin/bash
# The recording's frames for one tab switch, cut to the same strip film.mjs
# films (y 2140..2420 at 3x) and numbered the same way: our frame k is
# (k+1)/60 s after the finger went down, so the recording's is t0 + (k+1)/60.
#
#   VIDEO=<recording.mp4> scripts/tabbar/refframes.sh <outDir> <t0>
#
# t0: the moment the recording's finger goes down (9 Nov 2026 recording:
# 12.790 for the switch Watchlist → Explore, "transition G").
# Needs the frames tool: swiftc -O scripts/tabbar/frames.swift -o /tmp/stockwise-tabbar/frames
set -e
V="${VIDEO:?set VIDEO to the screen recording}"
T="${FRAMES:-/tmp/stockwise-tabbar/frames}"
D="$1"; T0="$2"
mkdir -p "$D"; rm -f "$D"/*.png
tmp=$(mktemp -d)
for k in $(seq -1 29); do
  t=$(python3 -c "print(round($T0 + ($k+1)/60, 4))")
  rm -f "$tmp"/*.png
  "$T" "$V" frames "$tmp" "$t" "$t" 1 1 0 2140 1125 280 >/dev/null
  f=$(ls "$tmp"/*.png | head -1); kk=$(printf "%02d" "$k"); [ "$k" -lt 0 ] && kk=-1
  mv "$f" "$D/f_$kk.png"
done
rm -rf "$tmp"
ls "$D" | wc -l
