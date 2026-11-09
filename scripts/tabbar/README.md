# Checking the phone tab bar

The tools used on 9 Nov 2026 to match the phone tab bar to iOS 26's own (from
the owner's screen recording of TradingView), and to make its bubble smooth.
The bar itself is `src/Header.jsx` (BottomTabBar), `src/liquidLens.js` (the
motion), `src/rimLens.js` (the drop's bending rim) and the last block of
`src/index.css`; what was matched and measured is in `handoff/STATUS.md`
("Live (9 Nov)" and "Live (9 Nov, night)").

Everything here writes to `/tmp/stockwise-tabbar` (or `$OUT`), never into the
repo. The browser scripts start their own private copy of the app (a
throwaway accounts database, no data jobs, no Telegram or email keys — see
`app.mjs`) and drive the system Chrome through Playwright, so run
`npm run build` first. None of them touch the live site.

## Does it still look like iOS?

The recording (9 Nov 2026, 1126×2436, iPhone at 3x):
`/Users/salman/.claude/uploads/e95c299a-512b-4b60-b749-40f5ed14dd50/1b5dfdfc-ScreenRecording_11-09-2026_00-21-46_1.MP4`.
Its switch from the first tab to the second ("transition G") starts at
12.790 s; film ours from tab 0 to tab 1 to compare like with like.

```bash
swiftc -O scripts/tabbar/frames.swift -o /tmp/stockwise-tabbar/frames
```

```bash
VIDEO=/path/to/recording.MP4 scripts/tabbar/refframes.sh /tmp/stockwise-tabbar/ref-G 12.790
```

```bash
node scripts/tabbar/film.mjs light 0 1 3 30 ours --text
```

```bash
node scripts/tabbar/compose.mjs /tmp/stockwise-tabbar/ref-G /tmp/stockwise-tabbar/film/ours /tmp/stockwise-tabbar/side-by-side.png --full 2 5 8 11 14 17
```

| Script | What it does |
|---|---|
| `frames.swift` | Frames from a recording at exact times: single frames, contact sheets, raw pixel rows (top row first), a row over time. |
| `refframes.sh` | The recording's frames for one switch, cut to the bar's strip and numbered like ours (frame k = (k+1)/60 s after the touch). |
| `film.mjs` | Our bar filmed one 60 Hz frame at a time on a manual clock, at the recording's scale; also writes each frame's centre, width, height, glass, swell and frost. `--white` plain page, `--text` the recording's headline behind the bar, `--cpu` no WebGL. |
| `compose.mjs` | The recording's frames beside ours, a row per moment (`--full`: the bubble at full size). |
| `diff.mjs` | Two films compared frame by frame (largest difference, mean, pixels off by more than 12); writes the worst frame, or `FRAME=f_18.png`, with its difference. |
| `zoom.mjs` | One small area of several frames, enlarged without smoothing. |
| `pixels.mjs` | The colour at named points of two images. |
| `track.py` | The recording's bubble along one row of pixels, frame by frame (where the grey, the colour and the ink are). |
| `vtrack.py` | Its top and bottom edges over a trip (the height's wobble). |
| `capsule.py` | The capsule's width and height at given moments. |
| `fit.py` | Apple's spring numbers (damping, response) and a start delay fitted to such measurements. |

The Python tools read the recording through the frames tool: set `VIDEO`
(and `FRAMES` if the tool isn't at `/tmp/stockwise-tabbar/frames`). Their
rows and thresholds are the 9 Nov recording's; check them on another.

Compare films only when they were made the same way: Chrome without WebGL
(`--cpu`) draws the whole page a little differently.

## Is it smooth?

```bash
node scripts/tabbar/timing.mjs 4 switch
```

```bash
node scripts/tabbar/timing.mjs 4 bubble
```

```bash
node scripts/tabbar/trace.mjs 4 bubble
```

`timing.mjs` taps ten times by touch on a phone-sized Chrome slowed 4× (a
stand-in for a slower phone; `1` is this computer's speed) and reports frames
drawn in the first 600 ms (36 = every one), the longest gap, the bubble's own
work per frame, the long frames with the scripts in them, and how soon the
new page showed. `bubble` swallows the tap so only the bubble moves.
`trace.mjs` splits the main thread's time into script, style, layout, paint
and layering; add `noshine`, `nofaces` or `noblur` to see what a part of the
drop costs.

9 Nov 2026, 4× slower:

| | Before | After |
|---|---|---|
| Bubble alone: frames of 36 | 33 | 36 |
| Bubble's work per frame | ~15 ms | 0.4 ms |
| Tab switch: frames of 36 | 29 | 33 |
| Tab switch: longest gap | 75 ms | 43 ms |
| New page after the finger lifts (1×) | 41 ms | 34–42 ms |

What's left in a switch is the new page's own start-up (Discover's night-sky
header restyles the whole page; its charts measure themselves), after the
drop has landed at full speed. Safari runs page animation at 60 fps even on
120 Hz iPhones unless its "Prefer Page Rendering Updates near 60fps" setting
is off; this Mac has no Safari engine to test in (no Xcode, no simulator), so
the last word is the owner's iPhone.

## Does it still behave?

```bash
node scripts/tabbar/check.mjs
```

```bash
node scripts/tabbar/holdtap.mjs
```

`check.mjs`: the bubble centred on the open tab's icon at 320/375/390/430 px
wide (within 0.1 px), a trip frame by frame, rapid taps ending on the last
one tapped, folding while reading down, hiding while a field is focused,
the light theme, reduced motion. `holdtap.mjs`: presses of 30–400 ms,
by mouse and by touch, each opening its tab. The e2e tests (M-H16, M-H18,
M-H21 in `e2e/mobile.spec.js`) cover the rest.
