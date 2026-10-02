# Vivi Experience DSL — v1

The DSL is the only thing a model writes. It says *what kind of moment this is*;
the [Experience Compiler](VIVI_EXPERIENCE_COMPILER_V1.md) decides everything
about *how it looks, moves, sounds and plays*.

Source of truth: [`vocabulary.ts`](../src/engine/compiler/vocabulary.ts) (every
symbol) and [`dsl.ts`](../src/engine/compiler/dsl.ts) (shape, validation). The
model prompt is generated from the same vocabulary, so the prompt and the
validator cannot drift apart.

## Shape

One JSON object. Arrays are positional to keep output small.

```text
{
  "v": 1,                                   version
  "w": WORLD,                               where
  "g": GRAMMAR,                             what kind of human situation
  "t": TONE,                                optional; grammar default otherwise
  "c": [[ROLE, PRESENCE, count?]],          who (the player is implicit)
  "o": [OBJECT],                            key objects
  "e": [[EVENT, ...args]],                  what happens, in story order
  "a": [[VERB, TARGET|null, "label", "observation"?, "outcome"?]],   2–4 commitments
  "cg": CAMERA_GRAMMAR,                     optional
  "st": STAGING,                            optional
  "lp": LIGHTING,                           optional
  "x":  { "ti": title, "op": opening line, "cu": cue line, "pr": pressure line, "q": crowd question }
}
```

Stamped by the pipeline, never accepted from a model: `tr` (truth status) and
`lang`.

## Vocabulary

| Field | Values |
|---|---|
| `w` | `apt` `hall` `bar` `office` `station` `street` `home` `rental` `park` `bedroom` |
| `g` | `betrayal` `intrusion` `scrutiny` `credit` `find` `secret` `departure` `family` `temptation` `message` `stranger` `transition` |
| `t` | `restrained` `tense` `eerie` `tender` `raw` |
| role | `partner` `ex` `friend` `sibling` `parent` `relative` `child` `coworker` `boss` `colleague` `stranger` `neighbor` `host` `guest` `commuter` |
| presence | `on` in the room · `off` only through a phone/intercom · `bg` background figures (count 1–4) |
| object | `phone` `door` `photo` `document` `laptop` `envelope` `ticket` `clock` `screen` `letter` `keys` `intercom` `elevator` `board` `train` `bag` `window` |
| place | `bathroom` `front_door` `bedroom` `kitchen` `window` `sofa` `table` `stairs` `elevator` `exit` `screen` `platform` `bench` `bar` `corner` `street` `car` `balcony` `desk` `center` |
| sound | `shower` `rain` `music` `crowd` `footsteps` `traffic` `train` `tv` `knock` `voices` |
| verb | `read` `confront` `ask` `wait` `leave` `speak_up` `show` `call_help` `call` `answer` `follow` `return` `keep` `hide` `open` `lock` `board` `stay` `accept` `refuse` `tell` `comfort` `look` |
| `cg` | `intimate` `suspense` `scrutiny` `departure` `moral` `discovery` |
| `st` | the ten staging presets (`intimate_close` … `public_pressure`) |
| `lp` | `domestic_warm_night` `cold_hallway` `sterile_office` `rain_city` `family_evening` `hotel_unease` `station_midnight` `golden_hour` `party_low` |

Places are words, not slots. The compiler resolves each against the chosen
world (`door` is the bathroom in one room and the front door in another); a
place that does not exist in that world is a validation error.

## Events

| Event | Args | Meaning |
|---|---|---|
| `exit` | role, place? | a person leaves the room |
| `enter` | role, place? | a person comes in |
| `approach` | role | a person walks toward the player |
| `say` | role, "line" | a short line spoken aloud |
| `msg` | object, "text" | a message lands on a screen |
| `call` | object, role? | a phone or intercom rings |
| `typing` | object | someone is typing |
| `sound` / `stop` | sound | a source starts / stops — silence is an event |
| `handle` / `open` | place | a door handle moves / a door opens |
| `elevator` | `empty`? | an elevator climbs and stops |
| `clock` | "HH:MM" | a diegetic clock shows a time |
| `countdown` | object, seconds? | a board or clock counts down |
| `arrive` / `depart` | `train`·`bus`·`car` | a vehicle arrives / leaves |
| `light` | `flicker`·`dim`·`out` | the light changes |
| `notice` | object | an object catches the eye |
| `stare` | role or `crowd` | people turn to the player |
| `echo` | object | a memory waits at this object (MEMORY_ECHO) |

Events carry no time. Order is story order; the grammar assigns timing.

## Rules the validator enforces

- Unknown top-level or text fields are rejected (strict).
- Every enum is checked. Roles used by events/commitments must be in the cast.
  Places must exist in the world. Objects referenced anywhere are added to `o`.
- **Coordinates are rejected, never converted.** Keys such as `x`, `y`,
  `pos`, `zoom`, `left`, `atMs`, `duration` anywhere in the document, or a
  number where a place or target belongs, fail validation.
- 2–4 commitments, no duplicates. At most 6 cast entries and 9 events.
- Text is trimmed and length-limited (labels 48, lines 120, notes 160).
- `stored` mode (fixtures, saved posts) additionally requires `tr`.

## Truth

`tr` is one of `author_supplied`, `withheld`, `fictional_demo`, and the
reserved `documented_source`.

- It is **stripped from model output** before validation and stamped from the
  author's input afterwards. A model cannot upgrade `withheld`.
- `author_supplied` text is the author's own answer, preserved exactly. It is
  never sent to the model.
- Nothing given → `withheld`.
- Curated demos → `fictional_demo`.
- `documented_source` is only produced when the caller supplies source
  references; it is not offered to models and is otherwise unreachable.

## Example — The Message

The golden fixture ([`dslFixtures.ts`](../src/data/heroStories/dslFixtures.ts)):

```json
{"v":1,"w":"apt","g":"betrayal","t":"restrained","c":[["partner","on"]],"o":["phone"],
 "e":[["exit","partner","bathroom"],["sound","shower"],["msg","phone","I still smell like you."],["typing","phone"],["stop","shower"]],
 "a":[["read","phone","Open the message","The preview is still on the screen. You have not opened it.","You read the thread. A fragment becomes a fact, but context is still missing."],
      ["ask","partner","Ask them directly","Water runs. The handle is still.","You ask before looking. They can answer, but now they know what you saw."],
      ["wait","sofa","Wait and say nothing","You sit where you were. The phone buzzes again.","You let the screen go dark. The question survives the night."],
      ["leave","bedroom","Leave the room","You put distance between yourself and the phone.","You leave the room with no proof and a clear memory of the preview."]],
 "cg":"intimate","st":"normal_conversation",
 "x":{"ti":"The Message","op":"“I’m going to shower.” The door closes. Water starts.","cu":"The phone vibrates. “I still smell like you.”","pr":"The shower stops. Footsteps behind the bathroom door.","q":"Would you look at the phone?"}}
```

1150 bytes, ~337 tokens (estimate), most of it curated copy. Without the
optional `x` lines and with model-length observations it is roughly half that.
The partner's walk around the coffee table, the door, the shower bed, the
handle moving a second after the water stops, the door opening five seconds
later and the partner standing in the lit doorway are not in the DSL — they
are what one `["stop","shower"]` means in the `betrayal` grammar.

## Size

Measured by [`scripts/benchmark-experience-compiler.ts`](../scripts/benchmark-experience-compiler.ts)
over the 36-story corpus (deterministic semantics; token counts are estimates,
see `scripts/lib/tokens.ts`):

| | avg | max |
|---|---:|---:|
| DSL bytes | 626 | 956 |
| est. output tokens | 185 | 281 |
| est. input tokens (prompt + story + hints) | 777 | — |

The three golden fixtures are 322–350 estimated tokens. No authoritative model
usage has been recorded yet: run `npm run bench -- --live` with a valid
`GEMINI_API_KEY` to add provider-reported counts in separate columns.

## Versioning

`v` is `1`. Every compiled scenario and stored post carries
`provenance.dslVersion` and `compilerVersion`, and stored posts keep their DSL,
so a later compiler can recompile old programs. Bump `COMPILER_VERSION` when
the same DSL would compile to a materially different scene; bump the DSL
version only for incompatible shape changes.
