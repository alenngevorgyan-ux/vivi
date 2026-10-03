# The Correction · source-safe production handoff (r3)

Geometry revision **correction-geo-r3** · asset revision **correction-assets-r3**.
Visual direction is unchanged: The Remembered Room + Painted Mass. Gold *The Correction* is the story authority; this package carries **no story copy in any raster**.

**Supersedes every earlier file in `docs/visual-v3/correction-slice/`.** Delete the previous r1/r2 contents (frames F01–F08, layers L1–L4, baked-label boards) before copying this tree in.

## Layout

```
correction-slice/
  README.md
  assets.json                 inventory: runtime_public / reference_only / private_reveal, sha256 each
  geometry/source.json        single Design geometry source of truth (per location, metres)
  runtime/plates/             16 plates: 3 locations × camera recipe × (graphite | paint), no actors, no text
  runtime/props/              summary_prop, display_texture, author_page (transparent PNG, no text)
  reference/frames/desktop/   22 composition references (not runtime)
  reference/frames/mobile/    18 portrait references at 390 CSS px (not runtime)
  reference/layers/           L3 attention mask + L4 actor layer, for reference only
  boards/                     C01–C18 board renders (JPG)
  source/                     C01–C18 .dc.html artboards + canvas.json (Claude Design canvas)
  generator/                  every script needed to regenerate the above
```

## Cast and source rules applied

- Three actors only: protagonist, Mira, director. The open plan is empty; extra chairs stay as furniture. In the corridor, the people seen through the glass are the same Mira and director, placed with the `see_through` transform. They are not proxies.
- No invented text: no project name, surname, “Planning”, draft number, numeric values, work-history claims or break duration. The monitor and display use a neutral chart texture with no values. The only approved visible title, **“Mira’s forecast”**, is live DOM placed on `display_surfaces.*.corners`.
- Private act: the protagonist asks **the director, now,** to clarify their credit privately afterward. The hero walks `seat_to_near_director` or `stand_to_near_director` to `near_director` [5.6, 5.4] and bends toward the seated director. The frame stops at the first words. Mira does not move, the meeting does not end, and nobody acknowledges anything.
- Public act: the hero begins to speak. No dialogue is drawn or written. The frame stops before any reaction.
- Pass: the hero stays in the selected preparation (seated or standing), with the summary face up in hand or on the lap. There is no agreement gesture and no face-down paper. Brief wording: “You let this question pass without speaking.”
- Reveal: one sequence for all three choices. Before the boundary only the public motif exists (`author_page` lined texture). The author account (voice shook, why, aftermath, causal ambiguity) is **host-supplied text after the boundary**, classified `private_reveal` in assets.json, with no file path, never preloaded, and never baked.
- Continuity: the summary is hero-owned in every beat. Cups, laptops and papers keep their geometry anchors on return. Mira and the director keep their roots after acceptance, and no NPC responds.

## Copy slots (live DOM only)

| key | status |
|---|---|
| display.title | APPROVED: “Mira’s forecast” |
| story.line, director.question, boundary.line | HOST: Gold copy, verbatim |
| intent.speak / intent.private / intent.pass | PLACEHOLDER: EDITORIAL COPY REQUIRED (full-meaning labels supplied) |
| confirm.speak / confirm.private / confirm.accept / confirm.back | PLACEHOLDER |
| confirm.pass | brief wording; verify against Gold |
| reveal.account / reveal.why / reveal.aftermath | PRIVATE: host-supplied after boundary |
| reveal.loading / reveal.retry / reveal.retry_action | PLACEHOLDER |

There is no “Ask Mira” intent anywhere.

## Geometry

`geometry/source.json` has one stable coordinate system per location: origin at the SW inner floor corner, x east, y up, z north, units in metres, and floor plane y = 0. Each location carries bounds (xMin/xMax/zMin/zMax), walkable polygons, obstacles, occluders, portals with jambs and thresholds, actor roots, object anchors, hero anchors (entry, own_seat, stand_near_entry, near_director; corridor reading/threshold), routes, display surface corners, attachment anchor names, camera_safe regions and the desktop and portrait camera recipes. The camera model is written into the file.

`portal_pairs` pairs open_plan P0 ↔ corridor P0 and corridor P1 ↔ meeting_room P1 with endpoints and transforms. `resolved_contradictions` lists every earlier conflicting bound and its authoritative value. `beats` lists, per beat, the hero anchor, route, stop point and attention targets [x, y, z, rx, ry].

Values are **not** normalised. Foundation derives the runtime 0–100 output.

## Generation order

1. `python3 geometry.py`: authoritative geometry (module; `to_json()`).
2. `python3 render3.py`: builds `fr3/*.html` for every frame, plate and layer from `frames2.py` scenes (which use `scene3d.py`, `rig.py`, `render.py`, `poses.py`, `hands.py`, `kit.py`, and `frames.py` for hero/Mira/director bodies and page wrapper).
3. `python3 shot2.py fr3/jobs.json`: Playwright/Chromium screenshots (transparent where the plate or layer needs alpha).
4. Encode PNG → WebP (q≈88) into `runtime/` and `reference/`; props stay PNG with alpha.
5. `python3 package3.py`: writes `geometry/source.json` and `assets.json` (sha256 per file).
6. `python3 build_r3.py local` → `python3 fit.py rout/jobs.json > rout/fit.json` → `python3 build_r3.py local` → `python3 shot2.py rout/jobs.json`: board previews with fitted heights. The self-audit runs inside `build_r3.py`.
7. `python3 build_r3.py live`: `.dc.html` artboards for the Design canvas (images resolve through `urls3.json`; canvas-only, not runtime).

`cast.py` is kept only because shared modules import it. The r3 scene generator never instantiates cast members.

**Dependencies:** Python 3.10+, numpy, Pillow, playwright (Chromium). **Fonts** (Google Fonts): Newsreader (400/500, italic), IBM Plex Sans (400/500), IBM Plex Mono (400).

## Source → frame mapping

| frame | beat | location | format | path |
|---|---|---|---|---|
| `D01_desk` | 01 desk | correction.open_plan | desktop 1920×1080 | `reference/frames/desktop/D01_desk.webp` |
| `D02_meeting` | 02 meeting | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D02_meeting.webp` |
| `D03_hallway` | 03 corridor/break | correction.corridor | desktop 1920×1080 | `reference/frames/desktop/D03_hallway.webp` |
| `D03a_leave` | 03 corridor/break | correction.corridor | desktop 1920×1080 | `reference/frames/desktop/D03a_leave.webp` |
| `D04a_return_seated` | 04 return | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D04a_return_seated.webp` |
| `D04b_return_standing` | 04 return | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D04b_return_standing.webp` |
| `D05a_decision_seated` | 05 decision | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D05a_decision_seated.webp` |
| `D05b_decision_standing` | 05 decision | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D05b_decision_standing.webp` |
| `D06a_speak_standing` | 06 act | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D06a_speak_standing.webp` |
| `D06a_speak_seated` | 06 act | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D06a_speak_seated.webp` |
| `D06b_private` | 06 act | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D06b_private.webp` |
| `D06c_pass_standing` | 06 act | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D06c_pass_standing.webp` |
| `D06c_pass_seated` | 06 act | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D06c_pass_seated.webp` |
| `D07a_held` | 07 truth boundary | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D07a_held.webp` |
| `D07b_withdraw` | 07 truth boundary | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D07b_withdraw.webp` |
| `D07_boundary_speak` | 07 truth boundary | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D07_boundary_speak.webp` |
| `D07_boundary_private` | 07 truth boundary | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D07_boundary_private.webp` |
| `D07_boundary_pass` | 07 truth boundary | correction.meeting_room | desktop 1920×1080 | `reference/frames/desktop/D07_boundary_pass.webp` |
| `D08a_lift` | 08 author reveal (public motif) | — | desktop 1920×1080 | `reference/frames/desktop/D08a_lift.webp` |
| `D08b_loading` | 08 author reveal (public motif) | — | desktop 1920×1080 | `reference/frames/desktop/D08b_loading.webp` |
| `D08c_reveal_layout` | 08 author reveal (public motif) | — | desktop 1920×1080 | `reference/frames/desktop/D08c_reveal_layout.webp` |
| `D08d_retry` | 08 author reveal (public motif) | — | desktop 1920×1080 | `reference/frames/desktop/D08d_retry.webp` |
| `M01_desk` | 01 desk | correction.open_plan | portrait 390×844 @2x | `reference/frames/mobile/M01_desk.webp` |
| `M02_meeting` | 02 meeting | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M02_meeting.webp` |
| `M03_hallway` | 03 corridor/break | correction.corridor | portrait 390×844 @2x | `reference/frames/mobile/M03_hallway.webp` |
| `M04a_return_seated` | 04 return | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M04a_return_seated.webp` |
| `M04b_return_standing` | 04 return | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M04b_return_standing.webp` |
| `M05a_decision_seated` | 05 decision | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M05a_decision_seated.webp` |
| `M05b_decision_standing` | 05 decision | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M05b_decision_standing.webp` |
| `M06a_speak_standing` | 06 act | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M06a_speak_standing.webp` |
| `M06a_speak_seated` | 06 act | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M06a_speak_seated.webp` |
| `M06b_private` | 06 act | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M06b_private.webp` |
| `M06c_pass_standing` | 06 act | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M06c_pass_standing.webp` |
| `M06c_pass_seated` | 06 act | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M06c_pass_seated.webp` |
| `M07_boundary_speak` | 07 truth boundary | correction.meeting_room | portrait 390×844 @2x | `reference/frames/mobile/M07_boundary_speak.webp` |
| `M08a_lift` | 08 author reveal (public motif) | — | portrait 390×844 @2x | `reference/frames/mobile/M08a_lift.webp` |
| `M08b_loading` | 08 author reveal (public motif) | — | portrait 390×844 @2x | `reference/frames/mobile/M08b_loading.webp` |
| `M08c_reveal_layout` | 08 author reveal (public motif) | — | portrait 390×844 @2x | `reference/frames/mobile/M08c_reveal_layout.webp` |
| `M08d_retry` | 08 author reveal (public motif) | — | portrait 390×844 @2x | `reference/frames/mobile/M08d_retry.webp` |

Reduced motion: every act (06*) and boundary (07*) frame works as a still. The reveal shows the D08c/M08c layout with no lift animation.

## Illustrator pass required

- All 16 plates are procedural placeholders in final perspective; they need painted material and light.
- Hero at large scale: coat folds, belt and collar need painted fold masses.
- Hands: act close-ups need painted authored hand states.
- Seated director and chair integration need an illustrated pose sheet.
- The attention-island edge needs a painted brush-edge set.
- Prop textures (summary_prop, display_texture, author_page) are neutral placeholders, and final art must stay text-free and number-free.

Repaint under the same asset ids, then rerun `package3.py` to refresh hashes.

## Self-audit (automated, `build_r3.py`)

| check | result | evidence |
|---|---|---|
| Only three actors (hero, Mira, director) | **PASS** | meeting actors = ['director', 'mira']; frames2 actor bodies = ['DIRECTOR', 'HERO', 'MIRA', 'b']; no cast/npc import in scene generator; open plan empty |
| No “Ask Mira” option | **PASS** | three intents only: intent.speak / intent.private (director) / intent.pass |
| No Mira movement after acceptance | **PASS** | Mira root fixed at [5.25, 6.85] yaw -58 in every meeting beat; no Mira route in geometry; private act routes hero only |
| No invented author account | **PASS** | reveal frames are motif only (author_page texture); account/why/aftermath are PRIVATE host slots |
| No Q4 / draft / numeric fabricated evidence | **PASS** | regex 'Q4|Draft\\s*\\d|Mira Hale|Planning|two nights|shared[- ]drive' not in scene generator; 0 <text> elements in raster generator |
| Exact director question preserved | **EXTERNAL** | slot director.question rendered as live DOM from host Gold copy, verbatim; nothing paraphrased or invented here |
| All three acts stop before reaction | **PASS** | D06a/b/c + M06 show the hero only beginning the act; Mira/director poses identical to 05; boundary fades NPC finish to 0 |
| Same author account for all choices | **PASS** | D07_boundary_speak/private/pass converge on one D08 sequence; one reveal.account slot, no per-choice variant |
| No private account text in public pre-boundary assets | **PASS** | private_reveal: 3 text slots, path null, preload false; no raster has text |
| Complete geometry export exists | **PASS** | geometry/source.json · correction-geo-r3 · 3 locations · missing keys: none |
| Asset hashes exist | **PASS** | 19 runtime + 42 reference entries with sha256; no /_blob paths |
| Mobile labels fit at 390px | **PASS** | C10 phones are true 390 CSS px; intents are wrapping <button>s in a 358px column, no ellipsis/nowrap |
