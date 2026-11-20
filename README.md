[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=badge)
[![rank](https://make.fun/badge/gta6-cover-art-01/Samot72/gta6-cover-art-01-entry-r6/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=badge)
[![reward](https://make.fun/badge/gta6-cover-art-01/Samot72/gta6-cover-art-01-entry-r6/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=badge)

# Director's Cut — One-Photo Autopilot

**One photograph in, finished GTA-style cover out — in one click.** Director's Cut is a cover-art
studio with an autopilot director: drop a photo and it analyses the frame (saliency, skin tones,
light), picks the layout, anchors a face-aware crop that never decapitates the subject, chooses a
colour grade from the photo's own light, sets the title in the frame's empty band, tags the cast —
and then **shows its work** in a Director's Notes panel that audits every decision in plain words:

> *Face found top centre → the lead crop is anchored on it, clamped so the frame never cuts the
> hairline. The frame runs 13% magenta — neon light. Grade: Neon Nights. The bottom band is the
> emptiest → the title rides there in Neon Band, set clear of every face.*

## What it does

- **One-click autopilot** — photo → analysed → directed → finished cover. One photo becomes a
  three-panel triptych (portrait crop, detail crop, wide); several photos become an ensemble wall.
- **Face-aware smart crop** — saliency + skin-tone subject detection (skin weight 0.65, threshold
  0.58, centroid fallback); crop windows are clamped so a detected face is always fully in frame.
- **Grade from the light** — golden hour → Vice Sunset, neon → Neon Nights, daylight → Press
  Clean, night → Midnight Chrome. 9 grades in all, each a real per-pixel transform.
- **20 title treatments** — chrome stacks, neon signs, block poster, ghost outline, stencil —
  scored against the photograph's empty band so lettering never fights a face.
- **Cast role tags** — skin-bearing panels are billed as THE LEAD / SUPPORTING with cast names;
  empty frames are tagged LOCATION and billed as Leonida itself.
- **Director's Notes** — every decision (layout, crop, grade, title, tags) written down with the
  measured numbers behind it. The audit is a feature, not a log file.
- **3 remix dice** — re-roll the crop, the grade or the title independently; the rest of the
  cover stands.
- **Full manual override** — 8 layouts, any photo per panel, crop focus/zoom sliders, caption
  and tagline editing, role and cast-name editing, live preview.
- **Poster furniture** — Director's Cut seal, press stars + review quote, barcode, billing block,
  18 rating box, white panel keylines, grade-coloured glow and vignette.
- **Export PNG at 1080×1080, 1080×1350 and 1920×1080.** Fully offline; photos are read on your
  own machine and never uploaded. Original artwork and lettering only — no game logos, art or fonts.

## Run it

```sh
node serve.ts          # then open http://localhost:8080
```

Or serve `app/` with any static file server and open `app/index.html`. The studio opens on a
sample sunset photograph, already directed; load your own photos to direct yours.

## How it is built

| File | Job |
| --- | --- |
| `app/src/analyze.js` | Pixel intelligence: saliency grid, skin-tone detection, subject/face boxes, light classification, empty-band finder. Pure functions on RGBA buffers. |
| `app/src/director.js` | The autopilot: turns measurements into a cover plan (layout, crops, grade, title, cast tags) and writes the Director's Notes. Remix dice live here too. |
| `app/src/render.js` | Draws a plan onto any Canvas 2D context — graded panels, lettering, furniture. Shared by the browser and the screenshot renderer. |
| `app/src/scenes.js` | Showcase scenes: the cover, the Notes audit, before/after, the remix wall. The screenshots below are these scenes. |
| `app/src/grades.js` · `layouts.js` · `titles.js` | 9 grades, 8 layouts, 20 title treatments, as data. |
| `app/src/main.js` | The editor: intake, overrides, dice, exports. |
| `main.ts` | Hands the entry in: copies `app/` + `screenshots/` to the output and writes `dossier.json` with the kit's `buildDossier`. |
| `tools/` | Build-time only: `process-samples.mjs` produces the shipped sample photos in-session; `shoot.mjs` renders the screenshots with the app's own scene code via `@napi-rs/canvas`. |

The four sample photographs under `app/samples/` are AI-generated, photographic, and free to use;
they were resized, enhanced and re-encoded by `tools/process-samples.mjs` — not shipped raw.

## Screenshots

1. `screenshots/1-cover.jpg` — the directed cover, landscape (shows largest on the contact sheet).
2. `screenshots/2-notes.jpg` — the Director's Notes audit beside the cover it explains.
3. `screenshots/3-before-after.jpg` — one raw pier photograph → the finished cover.
4. `screenshots/4-remix.jpg` — the remix wall: crop, grade and title re-rolled one at a time.

MIT licensed (see `LICENSE`).
