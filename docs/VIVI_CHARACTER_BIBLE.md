# VIVI — character bible v1

## Family and proportions

One reusable adult family, not bespoke illustrations per post. `CharacterFigure.tsx` renders SVG silhouettes from [`characters.ts`](../src/assets/characters/characters.ts): skin, hair, clothing, trouser, build and hair shape. Standard figures use a 56×100 unit box; tall figures scale 1.08, small memory children 0.78. Shared head and body landmarks keep animations and camera staging consistent.

Ten [SVG contact sheets](../src/assets/characters/sheets) show every named character in front, back, left and right views across eight poses. They are generated from the exact runtime vector component with `node --import tsx scripts/generate-character-sheets.tsx`, so reference art and product art stay aligned.

| ID | Read | Use |
|---|---|---|
| young_adult_masc_01 | warm jacket, dark short hair | player or peer |
| young_adult_masc_02 | tall, green layer, wavy hair | friend / partner |
| young_adult_fem_01 | dark long hair, plum layer | friend / partner |
| young_adult_fem_02 | tall, cropped hair, terracotta | peer / colleague |
| adult_masc_01 | cool jacket, restrained profile | director / parent |
| adult_fem_01 | olive layer, wavy hair | partner / authority |
| older_adult_01 | gray hair, olive layer | older relative |
| anonymous_01 | subdued silhouette | uncertain stranger |
| memory_child_01 | short hair, smaller build | non-romantic memory echo |
| memory_child_02 | long hair, smaller build | non-romantic memory echo |

The current renderer supports front, back, left, right facing and idle, walk, sit, look_at_phone, talk, wait, turn, leave pose parameters. These are production-ready vector variations for staging, with restrained deformation. A full jointed walk cycle and seated perspective artwork are next art tasks, not claimed as complete.

## Emotion through body

Use a delayed turn, a glance away, a grip on a phone, a seat at the edge of a sofa, or a pause at a doorway. Avoid facial animation dependence. A character should read at 30–60px high; eyes are minimal and disappear from back view. Nervousness can be one extra step toward or away from the other person; betrayal can be the sudden width of a table.

## Spacing presets

`intimate_close` 42 units; `normal_conversation` 90; `awkward_distance` 170; `confrontation` 115; `across_table` 145; `doorway_separation` 210; `walking_side_by_side` 65; `one_person_leaving` 235; `public_group` 130. These are authored baselines, scaled to the 1000×600 world. Keep clear paths around them and check overlap at mobile crop.

## Direction sheet

Front: gaze and chest visible. Back: hair mass and shoulders, no face. Left/right: one cheek/eye only; mirror cautiously when clothing or held objects are asymmetric. Walk should have separated feet and modest head bob. Sit lowers the center of mass. Look-at-phone brings both hands toward the light source. Talk opens one arm. Wait has asymmetric weight. Turn rotates head before torso. Leave should increase distance before the camera cuts.

Romantic and relationship sample roles are adults. Memory children only depict childhood recollection, never intimate or sexual content.
