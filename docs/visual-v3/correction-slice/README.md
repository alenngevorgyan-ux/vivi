# Vivi V3 — The Correction · visual vertical slice

Frozen direction: **The Remembered Room + Painted Mass characters** (see `../characters-v2/`).
Production-target compositions and the visual ↔ runtime handoff for the first V3 gold-standard story.
Exported from the Claude Design canvas, page "The Correction", 2026-10-03.

## Boards (`boards/`, 2400 px wide JPG)

| Board | Content |
|---|---|
| C01_Storyboard | Full sequence, 15 frames / 8 beats |
| C02_Desk | 01 Desk final frame + arrival vs observation + 390 |
| C03_Meeting | 02 Meeting final frame + attention reading + 390 |
| C04_Hallway | 03 Hallway final frame + leaving frame |
| C05_Return | 04 Return final frame + before/after continuity |
| C06_Decision | 05 Decision frame + observe / select / commit states |
| C07_Enactment | 06 Speak / private request / silence, begin + stop |
| C08_Boundary | 07 Truth boundary, 4-second sequence |
| C09_Reveal | 08 Author reveal, 4-step climax |
| C10_Mobile | 390 px versions of the six key frames |
| C11_Desktop | Desktop compositions, title-safe, line and intent zones |
| C12_Layers | Asset breakdown / layer stack |
| C13_Staging | Top-down staging and portal geometry |
| C14_Blocking | Actor blocking map, beat by beat |
| C15_Attention | Attention / interaction overlay (no hotspot dots) |
| C16_Handshake | Visual ↔ runtime handshake per scene |
| C17_Frozen | Final / frozen vs still requires illustrator pass |

## Frames

- `frames/desktop/` — 16 masters, 1920×1080, lossless WebP (F01…F08).
- `frames/mobile/` — 6 masters, 780×1688 (390×844 @2x), lossless WebP (M01…M08).
- `frames/layers/` — decision-frame layer plates: graphite, paint, attention mask, actors (transparent).

## Source

- `source/` — canvas artboards (`C*.dc.html`) and `canvas.json`. Artboards reference the frame images as canvas assets (`/_blob/…`).
- `generator/` — Python used to build the frames and boards (rig, scene camera, poses, layers). Not runtime code.
