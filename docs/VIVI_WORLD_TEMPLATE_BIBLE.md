# VIVI — world template bible v1

The data registry [`src/world/templates/index.ts`](../src/world/templates/index.ts) supplies layout, semantic slots, walkable polygon, collisions, background and foreground layers, lighting, atmosphere, hero camera, object library and three shot compositions for every template. `SceneArt.tsx` supplies corresponding layered vector art. Coordinates use percentages of a 1000×600 world; the player should remain in the walkable polygon. Current proof runtime clamps movement to a safe band and does not yet resolve every collision listed below.

| Template | Semantic staging and sight line | Lighting / atmosphere | Example compositions |
|---|---|---|---|
| APARTMENT_NIGHT | sofa → phone table → bathroom, with window, kitchen, hall, front door, bedroom and decision center | amber practical vs plum window; shower and quiet room | separated wide / phone insert / doorway hold |
| HALLWAY_NIGHT | front door and intercom → long sight line → elevator; stairs, camera, emergency light, window | dirty overhead amber and cold elevator seam; motor and ventilation | vanishing point / intercom insert / handle hold |
| BAR_OR_PARTY | tables and crowd center; bar, bathroom corridor, phone area, quiet corner, exit at edges | warm islands, cool private pockets; music can stop | public wide / screen over shoulder / isolated two shot |
| OFFICE_NIGHT | presentation wall faces meeting table; director and coworker separated by laptop evidence | monitor cyan, distant city gold; projector fan | boardroom wide / evidence insert / director two shot |
| TRAIN_STATION | platform edge diagonal; bench, board, clock, train and exit | honey canopy, cool track; brakes and chime | platform wide / board insert / departing silhouette |
| CITY_RAIN | shelter to crossing, with car, window and wet pavement | reflected amber; rising rain and traffic | rain wide / reflection insert / distance two shot |
| FAMILY_HOME | document table vs stair door; photo wall and window | dusty daylight and table lamp; house settling | room wide / document insert / doorway separation |
| HOTEL_OR_RENTAL | entry leads to kitchen photo; balcony and bedroom create uncertain depth | rental practical vs cold balcony; fridge hum | arrival wide / photo insert / empty room hold |
| NEIGHBORHOOD_SUNSET | bench → path → bus stop; tree and rooftops make memory geography | low honey rim; cicadas and bus | street wide / walking two shot / empty bench |
| BEDROOM_NIGHT | bed and phone separated by floor; door, window and nightstand | phone spill and narrow window light; breath/fabric | room wide / phone insert / door frame |

## Template contract

Every slot has stable semantic ID and position. Modifiers attach to those IDs: `bathroom_door`, `phone_screen`, `elevator`, `meeting_clock`, `station_board`, `stair_door`. A plan chooses a template, populates some slots, marks some objects interactive, sets character staging, palette shifts and shot cues. Do not bake story outcomes into world art. The walkable polygon and collision list serve as authoring constraints; a later physics pass should implement polygon containment and individual collision shapes in the legacy world engine as well.

## Art assembly

Background = architecture and distant light. Midground = floor, furniture, interactive props and characters. Foreground = one gentle occluding shape (sofa arm, door frame, column, umbrella, leaves). Atmosphere = sparing haze and grain. Preserve one focal contrast source per shot. New story variations should first reuse these layers; custom art should be exceptional and reviewed for visual consistency.
