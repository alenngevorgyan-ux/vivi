# VIVI — visual bible v2

Supersedes the v1 production grammar where the two disagree. Everything below is
implemented on `polish/claude-vivi-cinematic-v1`; nothing here is aspirational.

## The change in one line

A world is no longer a picture a figure stands on top of. It is four layers a
figure stands *inside*.

## Layer contract

[`SceneArt.tsx`](../src/assets/worlds/SceneArt.tsx) exports four layers plus a
flattened composite. The runtime stacks them; feed cards and stills use the
composite, which has no figures to separate.

| Layer | Holds | Painted |
|---|---|---|
| `SceneBackdrop` | Architecture, windows, doors, distant light | Behind everyone |
| `SceneMidground` | Floor, furniture, structures, light that lands on the floor | Behind figures |
| *(depth band)* | Figures and loose props, sorted by `y` | — |
| `SceneForeground` | One gentle occluder a figure can pass behind | In front of figures |
| `SceneLighting` | Base darkness, light pools, vignette, film tooth | On top of all |

Coordinates stay the 1000 × 600 world. **Every wall meets its floor at y = 284**
(47%), because the walkable polygon starts at 48% — a horizon lower than that put
the player visually inside the wall.

`SceneState` carries what the art reacts to: `active`, `doorState`, `phoneLit`,
`elevatorText`, `clockText`, `dim`. Art never reads a story id.

## Lighting is subtractive

Each hero world paints **darkness first**, then carves light back out of it with
`mix-blend-mode: screen`. Nothing is evenly lit.

| World | Warm source | Cold source | Third source |
|---|---|---|---|
| `apartment_night` | Floor lamp, left, with a hot core | Bathroom light: a seam under the closed door, a floor-wide spill when open | Phone screen, when lit |
| `hallway_night` | Two tired ceiling practicals | Elevator seam, brightening on the cue | — |
| `office_night` | Distant city window | Flat overhead office wash | Presentation screen spill reaching the floor |

The vignette is a **full-frame rect** filled with a radial gradient. Drawn as an
inset ellipse — as it first was — its own rim is visible as a ring across the
picture.

## Texture

One `feTurbulence` fractal-noise filter per layer set, drawn at `opacity 0.055`
in `overlay`. A tiled dot pattern was tried first and read as a regular lattice
on flat floors, which is worse than no texture at all.

## Figures

[`CharacterFigure.tsx`](../src/assets/characters/CharacterFigure.tsx) keeps the
56 × 100 box so staging distances and sheets stay valid, and rebuilds everything
inside it.

- **Proportion:** head is roughly one sixth of standing height (`HEAD_RY 8`,
  ground at 95). Stylised, but adult.
- **Limbs:** both arms and both legs are solved as two segments from the same
  landmarks, so a pose is data, not a new path.
- **Walk:** alternating thigh swing with knee flexion on the swing leg, arm
  counter-swing against the legs, and a pelvis that sits lowest at double
  support. Review it as art with `node --import tsx scripts/generate-walk-strip.tsx`.
- **Idle:** two slow unsynchronised oscillators (breath ≈ 3.4 s, weight shift
  ≈ 5.6 s). Deliberately near the threshold of notice.
- **Back view:** hair becomes one mass and the face disappears entirely.
- **Mirroring is SVG geometry**, not a CSS transform. The CSS version lost its
  origin when the element was nested, which left every left-facing figure
  unrendered.

Poses: `idle`, `walk`, `sit`, `look_at_phone`, `talk`, `wait`, `turn`, `leave`,
`hesitate`. Sitting lowers the whole upper body; raising only the pelvis stretched
the torso by half its length.

## Depth and scale

- Figures and props are sorted by `y` and painted back to front.
- `--depth` scales a figure from 0.86 at the back of the floor to 1.08 at the front.
- **Figure size is derived from stage width** (`stageWidth × 0.098`, clamped to
  44–130 px). Fixed pixel sizes made a figure a tenth of a desktop frame and
  nearly half a phone frame.

## Interface restraint

During the tense section the world is full-bleed and the interface is: an
in-world dot per action, a proximity prompt, a commit chip, and a small subtitle.
No pill buttons with labels in the scene, no action grid beside it, and the HUD
clock appears **only** while something is actually counting down — the office and
station already show the time on a wall.

Social chrome (resonance, bookmark, share) fades out on entry and returns once
the player has committed.

## Mobile

Phones get a 4:3 frame; the camera widens by 0.78 to keep the same amount of
world legible. Touch controls sit **below** the stage. A stage stretched to a
portrait viewport crops the composition down to a strip of wall.

## What v1 said that still holds

Palette families, type (Newsreader / Inter / IBM Plex Mono), radii, the editorial
feed treatment, and the rule that a world template supplies most of a scene's
structure. The ten palettes in `tokens.ts` are unchanged.
