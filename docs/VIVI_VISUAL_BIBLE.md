# VIVI — visual bible v1

## Signature

Contemporary 2D illustrated dioramas, elevated side/top view, soft geometry, painterly light, selective detail and human scale. Editorial framing gives each world negative space. Warmth can cool quickly; this is not a permanent sunset palette. Avoid pixels, anime, heavy outlines, realism, stock photography and detail overload.

## Production grammar

- World template supplies 80–90% of visual structure: floor, wall or skyline, portals, furniture, depth planes and lighting anchors.
- A story varies objects, character appearance/pose, light, atmosphere, modifier state and camera. Do not order a unique generated illustration for every post.
- Background holds architecture; middle ground holds characters and interactable props; foreground occludes gently. Shadows ground characters. Paths should lead the eye to the object that matters.
- A single local source (phone, lamp, monitor, elevator seam, sunset) drives emphasis. Red is reserved for meaningful pressure rather than default danger decoration.
- Use silhouettes and posture to communicate emotional states at feed-card size. The screen itself must remain legible on mobile.

## Tokens

Source of truth: [`src/design/tokens.ts`](../src/design/tokens.ts), [`typography.ts`](../src/design/typography.ts), [`motion.ts`](../src/design/motion.ts).

| Family | Sky / dark | Wall / mid | Floor | Local light | Accent |
|---|---|---|---|---|---|
| Memory warm | `#c8a693` | `#eee0c8` | `#b58b70` | `#f7ce86` | `#a6664e` |
| Relationship night | `#30334b` | `#514455` | `#65515b` | `#f0b47d` | `#d48778` |
| Creepy domestic | `#182d3b` | `#526370` | `#3a5361` | `#cab185` | `#b95753` |
| Social tension | `#6d7370` | `#c6c3b7` | `#878b7e` | `#f0d6aa` | `#a7584d` |
| Work night | `#1f3747` | `#536a74` | `#354d59` | `#d5bb89` | `#c26055` |
| City rain | `#304454` | `#6a7981` | `#415965` | `#d7ad79` | `#bb7468` |

Paper `#f4efe7`, ink `#202629`, accent `#b85f49`. Display: Newsreader (human, literary); body: Inter (clear); signals: IBM Plex Mono (diegetic readouts and labels). Radius: 20px cards, 12px controls. Motion: 180ms gestures, 950ms camera ease, 1600ms reveal hold. Honor reduced motion with crossfades and persistent captions.

## Consumer surfaces

Feed is a printed editorial spread with one cinematic feature and a grid of distinct world windows. Cards carry hook, pillar and duration, never outcome. Create asks in plain language: “What happened?” and “What did you do?”, with the reveal withheld from players until commitment. Play keeps text below or outside the focal region, with small object-attached prompts. Reveal separates immediate consequence from author account. The advanced creator and legacy engine keep their technical treatment for now.

## Asset pipeline

`SceneArt.tsx` is layered SVG environment art rendered from the same palette as the template registry. `CharacterFigure.tsx` uses modular color, hair and build definitions. Four generated SVG storyboard sheets live in `src/assets/storyboards/`. Vector first; use optimized raster only for texture or a deliberate painted hero treatment. Review SVG at 390px, 768px and desktop widths before adding detail.
