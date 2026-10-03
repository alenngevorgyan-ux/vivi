import json, math, os
import frames as F
from frames import POS, MR, DESK, meeting_room, desk_scene, hallway_scene, DEC_POSE, RET_POSE, SPEAK_POSE, APPROACH_POSE, MIRA_PACK, SILENT_POSE
from kit import page as _page, caption, gline, pencil


def page(*a, **k):
    return _page(*a, footer='VIVI V3 · THE CORRECTION · VERTICAL SLICE · PRODUCTION-TARGET FRAMES', **k)
from render import fmt

URL = json.load(open('urls.json'))
LOCAL = False  # preview mode uses local png


def src(n):
    return f'fr/{n}.png' if LOCAL else f'/_blob/{URL[n]}'


def img(n, w, extra=''):
    return f'<img src="{src(n)}" alt="{n}" style="display:block;width:{w}px;height:auto;{extra}">'


def framed(n, w, overlay='', vb=(1920, 1080), label=None):
    h = w * vb[1] / vb[0]
    ov = f'<svg viewBox="0 0 {vb[0]} {vb[1]}" width="{w}" height="{fmt(h)}" style="position:absolute;left:0;top:0" aria-hidden="true">{overlay}</svg>' if overlay else ''
    lab = f'<div class="num" style="position:absolute;left:10px;top:8px;background:#E4DAC6;padding:2px 6px">{label}</div>' if label else ''
    return f'<div style="position:relative;width:{w}px;height:{fmt(h)}px;outline:1px solid #c4b9a6">{img(n, w)}{ov}{lab}</div>'


def cap(n, t, d, w=None):
    return caption(n, t, d, w)


def note_row(items, w=520):
    return '<div style="display:flex;gap:50px;flex-wrap:wrap">' + ''.join(cap(n, t, d, w) for n, t, d in items) + '</div>'


EB = 'The Correction · V3 vertical slice'

# ------------------------------------------------------------------ anchors
_, IM = meeting_room('present')
_, IR = meeting_room('return', hero_pose=RET_POSE, hero_pos=POS['hero_stand'])
_, ID = desk_scene()
_, IH = hallway_scene(hero_pos=(-0.85, 4.7))
DA = json.load(open('fr/decision_anchors.json'))


def contour(cx, cy, rx, ry, col='#4E4A45', w=2, dash='', label=None, lx=0, ly=0, op=0.9):
    s = f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx)}" ry="{fmt(ry)}" fill="none" stroke="{col}" stroke-width="{w}" opacity="{op}" {("stroke-dasharray=" + chr(34) + dash + chr(34)) if dash else ""} filter="url(#pencil)"/>'
    if label:
        s += f'<text x="{fmt(cx + lx)}" y="{fmt(cy + ly)}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="30" fill="{col}" paint-order="stroke" stroke="#ECE4D2" stroke-width="6">{label}</text>'
    return s


def tag(x, y, t, col='#B5523A', size=22):
    return f'<text x="{fmt(x)}" y="{fmt(y)}" font-family="IBM Plex Mono, monospace" font-size="{size}" fill="{col}" paint-order="stroke" stroke="#ECE4D2" stroke-width="6" letter-spacing="1">{t}</text>'


SVGDEFS = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
           '<filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter>'
           '<pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#6E8B5E" stroke-width="1.4" opacity="0.6"/></pattern>'
           '<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#B5523A"/></marker>'
           '</defs></svg>')


# ================================================================== C01 storyboard
BEATS = [
    ('01', 'F01_desk', 'Desk · before the meeting', 'OBSERVE', 'The deck on the drive carries Mira’s name. The red line on the slide and on my printout bend at the same place.'),
    ('02', 'F02_meeting', 'Meeting · presentation', 'OBSERVE', 'Mira at the screen, the director at the table, me on the overflow chair by the glass. The slide is the brightest thing.'),
    ('03a', 'F03_hallway_leave', 'Break · leaving', 'MOVE', 'Through the glass door into the corridor, summary in hand. The chair by the glass stays empty.'),
    ('03', 'F03_hallway', 'Hallway · breathing room', 'OBSERVE', 'Daylight, wider paper, the meeting still visible through the glass. I can stop and read my own pages.'),
    ('04', 'F04_return', 'Return', 'MOVE', 'Same room, ten minutes later: cups moved, one laptop shut. I stand inside the door instead of sitting.'),
    ('05', 'F05_decision', 'Primary decision', 'DECIDE', '“Anything to add?” Three intentions hang on what they concern: my hand, Mira, the empty chair.'),
    ('06a', 'F06a_speak', 'Enact · speak now', 'ACT', 'The summary rises to shoulder height and the first words start. Stop before anyone answers.'),
    ('06b', 'F06b_private', 'Enact · ask privately', 'ACT', 'At the close I cross to Mira by the door and begin the request. Stop before she turns.'),
    ('06c', 'F06c_silence', 'Enact · let it stand', 'ACT', 'I sit, turn the summary face down and keep my hands on it. Silence is a confirmed act.'),
    ('07a', 'F07a_held', 'Boundary · held frame', 'BOUNDARY', '0.9 s. Grain locks. The room keeps its authored poses; nothing new is drawn.'),
    ('07b', 'F07b_withdraw', 'Boundary · paint withdraws', 'BOUNDARY', 'Colour leaves walls, then people, then the floor, edges first, toward the body.'),
    ('07', 'F07_boundary', 'Truth boundary', 'BOUNDARY', 'The room is graphite, the body is flat ink. “That is where your version stops.”'),
    ('08a', 'F08a_lift', 'Reveal · the page lifts', 'REVEAL', 'The only thing that stays real is the summary. It leaves the hand and comes toward the reader.'),
    ('08b', 'F08b_page', 'Reveal · the page', 'REVEAL', 'The paper fills the screen. A pencil loop finds the dip that took two nights.'),
    ('08', 'F08_reveal', 'Author reveal', 'REVEAL', 'A person speaks in first person, beside the page they actually printed.'),
]


def board_storyboard():
    cells = []
    for n, f, t, st, d in BEATS:
        cells.append(f'<div style="display:flex;flex-direction:column;gap:10px">{framed(f, 530)}'
                     f'<div style="display:flex;gap:10px;align-items:baseline"><span class="num">{n}</span><span class="cap"><b>{t}</b></span>'
                     f'<span class="num" style="margin-left:auto;color:#8a8279">{st}</span></div>'
                     f'<div class="cap" style="max-width:520px">{d}</div></div>')
    grid = f'<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:40px 26px">{"".join(cells)}</div>'
    rules = note_row([('A', 'One room, three times', 'The meeting room is one authored plate seen in beats 02, 04, 05, 06, 07. Only blocking, props and the paint island change. Never a reset.'),
                      ('B', 'One object travels', 'The printed summary is in every frame from 01 to 08 and becomes the author’s page. It is the visual spine of the story.'),
                      ('C', 'Nothing invented', 'No looks, no reactions, no consequences before the reveal. Others hold authored, neutral poses through every beat.'),
                      ('D', 'Paint is attention', 'The island is the only “UI” before the decision: it moves to what the player is attending to and joins related things.')], 520)
    return page('Correction storyboard', f'{EB} · board C01',
                'The Correction, start to reveal',
                'Fifteen frames, eight beats. Desk → meeting → hallway → return → decision → enactment → boundary → author. Every frame is a production-target composition at 1920×1080.',
                f'<div style="display:flex;flex-direction:column;gap:60px">{grid}{rules}</div>{SVGDEFS}', 2400, 2200)


# ================================================================== final frames
def final_board(code, name, title, heading, sub, frame, notes, extra='', h=2340):
    body = f'<div style="display:flex;flex-direction:column;gap:44px">{framed(frame, 2240)}{note_row(notes, 500)}{extra}</div>{SVGDEFS}'
    return page(name, f'{EB} · board {code}', heading, sub, body, 2400, h)


def board_desk():
    small = (f'<div style="display:flex;gap:40px;align-items:flex-start">'
             f'<div style="display:flex;flex-direction:column;gap:10px">{framed("F01_desk_pre", 640, label="ARRIVAL")}<div class="cap" style="max-width:620px">Before attention lands: paint only on the body, the desk and the lit monitor.</div></div>'
             f'<div style="display:flex;flex-direction:column;gap:10px">{framed("F01_desk", 640, label="OBSERVATION")}<div class="cap" style="max-width:620px">After two looks (monitor, then paper): the island joins them and memory draws one graphite loop on each kink.</div></div>'
             f'<div style="display:flex;flex-direction:column;gap:10px">{framed("M01_desk", 220, vb=(780, 1688), label="390")}</div></div>')
    return final_board('C02', 'Desk final', 'desk', 'Desk: the work recognises itself',
                       'No caption explains authorship. The player sees two copies of one unusual shape: the dip-and-recovery in the red line on Mira’s slide and on the printout in their own hand.',
                       'F01_desk', [
                           ('01', 'Hierarchy', '1 the body and the paper in hand · 2 the lit monitor · 3 the glass meeting room behind (where this is going) · 4 everything else in graphite.'),
                           ('02', 'Evidence, not UI', 'Slide title reads “Q4 Forecast · Mira Hale”. The printout reads “Q4 FORECAST · DRAFT 6”. Same line, same kink. The match is the discovery.'),
                           ('03', 'Hero prop', 'Stapled A4 summary, 4 pages, red line on page 1. It is a prop plate with real text and the only object that persists to the reveal.'),
                           ('04', 'Architecture', 'Open plan, window wall at the back, the meeting room’s glass box at right rear with its door: the next location is already in frame.')],
                       extra=small, h=2340)


def board_meeting():
    sx0, sy0, sx1, sy1 = IM['screen']
    ox, oy, hu = IM['hero']
    ov = (contour(ox + 10, oy - hu * 3.4, hu * 2.4, hu * 4.4, label='me, outside the table', lx=-80, ly=-hu * 4.6)
          + contour((sx0 + sx1) / 2, (sy0 + sy1) / 2, (sx1 - sx0) * 0.62, (sy1 - sy0) * 0.75, label='the room’s centre', lx=-120, ly=-(sy1 - sy0) * 0.85)
          + pencil(gline([(ox + hu * 2.2, oy - hu * 4.0), (sx0 - 30, (sy0 + sy1) / 2)], w=1.4, col='#4E4A45', op=0.8)))
    return final_board('C03', 'Meeting final', 'meeting', 'Meeting: I built this, but she owns the room',
                       'Public geometry does the work. The table and the lit slide are the centre; Mira stands at it, the director sits at it, colleagues face it. The hero sits on the overflow chair by the glass, 1.6 m from the table edge.',
                       'F02_meeting', [
                           ('01', 'Social centre', 'Table + screen. Everyone else is oriented to it. Nobody looks at the hero; nobody needs to.'),
                           ('02', 'Mira, not a villain', 'Speak pose, open hand to the slide, cool slate jacket, finish 0.9. Same lighting as everyone else.'),
                           ('03', 'Director', 'Seated at the table nearest the screen, leaning back, arm on the table. Older, darker jacket. Authority is posture.'),
                           ('04', 'Light', 'Even dimmed office light. The slide is the brightest object and casts a cool pool on the table. No underlight, no red.')],
                       extra=f'<div style="display:flex;gap:40px;align-items:flex-start"><div style="display:flex;flex-direction:column;gap:10px"><div class="eb">Attention reading (overlay, not in-game)</div>{framed("F02_meeting", 900, overlay=ov)}</div>'
                             f'<div style="display:flex;flex-direction:column;gap:10px">{framed("M02_meeting", 220, vb=(780, 1688), label="390")}</div></div>', h=2400)


def board_hallway():
    return final_board('C04', 'Hallway final', 'hallway', 'Hallway: ten minutes outside the room',
                       'The break must earn its place. It is the only frame with daylight, the widest paper, the slowest clip, and the first time the player can hold the summary and read it without anyone in front of them.',
                       'F03_hallway', [
                           ('01', 'Spatial relation', 'The meeting room is the glass wall on the right, its door 3 m away. The table, heads and screen glow stay visible in graphite through the glass.'),
                           ('02', 'Breathing room', 'Warm daylight bay, bench, plain wall. Calmer island, larger and softer edges. No corridor-shooter symmetry: camera offset left, vanishing point off-centre.'),
                           ('03', 'Stop and reconsider', 'Read pose: weight on one leg, head down, both hands on the pages. The summary is the hero object of this location.'),
                           ('04', 'Exit and re-entry', 'The same glass door is the portal both ways. Leaving (03a) and returning (04) use it; the player always knows where the room is.')],
                       extra=f'<div style="display:flex;gap:40px;align-items:flex-start"><div style="display:flex;flex-direction:column;gap:10px"><div class="eb">03a · leaving the room</div>{framed("F03_hallway_leave", 900)}</div></div>', h=2360)


def board_return():
    return final_board('C05', 'Return final', 'return', 'Return: the same meeting, ten minutes older',
                       'Continuity is carried by objects, not by text. Everything that did not move stays exactly where it was; three things changed, and the hero changed position.',
                       'F04_return', [
                           ('01', 'Changed blocking', 'Hero now stands inside the door, 0.6 m closer to the table, summary held at the hip. The overflow chair is visibly empty.'),
                           ('02', 'Time passed', 'One laptop closed, two cups moved, a paper squared on the table. Nothing else. Mira and the director keep their authored places.'),
                           ('03', 'Accumulated knowledge', 'The slide no longer needs a loop: the island includes the table edge between hero and slide. The player already knows.'),
                           ('04', 'Same identity', 'Same coat, belt, collar, hair mass, halo. Same prop in the same hand.')],
                       extra=f'<div style="display:flex;gap:40px"><div style="display:flex;flex-direction:column;gap:10px"><div class="eb">Before the break</div>{framed("F02_meeting", 1080)}</div>'
                             f'<div style="display:flex;flex-direction:column;gap:10px"><div class="eb">After the break</div>{framed("F04_return", 1080)}</div></div>', h=2440)


def board_decision():
    h, m, ch, d = DA['hand'], DA['mira'], DA['chair'], DA['director']
    # selected-intent overlay: underline + nearer crop
    sel = (f'<rect x="{fmt(h[0] - 520)}" y="{fmt(h[1] - 520)}" width="1500" height="844" fill="none" stroke="#4E4A45" stroke-width="3" stroke-dasharray="10 8"/>'
           + tag(h[0] - 500, h[1] - 530, 'CAMERA 2 STEPS NEARER', '#4E4A45')
           + pencil(gline([(h[0] + 136, h[1] - 158), (h[0] + 440, h[1] - 158)], w=3, col='#2b2724', op=1)))
    com = (f'<path d="M{fmt(DA["hero"][0] - 90)},{fmt(DA["hero"][1] - 560)} h-14 v600 h14 M{fmt(DA["hero"][0] + 150)},{fmt(DA["hero"][1] - 560)} h14 v600 h-14" fill="none" stroke="#B5523A" stroke-width="3"/>'
           + f'<text x="{fmt(DA["hero"][0] + 190)}" y="{fmt(DA["hero"][1] - 300)}" font-family="Newsreader, Georgia, serif" font-size="34" fill="#2b2724">Say it, now, in front of everyone.</text>'
           + f'<rect x="{fmt(DA["hero"][0] + 190)}" y="{fmt(DA["hero"][1] - 270)}" width="170" height="54" fill="#B5523A"/>'
           + f'<text x="{fmt(DA["hero"][0] + 214)}" y="{fmt(DA["hero"][1] - 234)}" font-family="IBM Plex Sans, sans-serif" font-size="24" fill="#F4EFE5">I’m sure</text>'
           + f'<text x="{fmt(DA["hero"][0] + 384)}" y="{fmt(DA["hero"][1] - 234)}" font-family="IBM Plex Sans, sans-serif" font-size="24" fill="#5a544c">Not yet</text>')
    states = (f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:30px">'
              f'<div style="display:flex;flex-direction:column;gap:10px">{framed("F05_decision", 700, label="A · OBSERVING THE CHOICE")}<div class="cap"><b>Three phrases, one style.</b> Same size, same graphite italic, same leader weight. Each hangs on what it concerns: my hand + pages, Mira, the empty chair.</div></div>'
              f'<div style="display:flex;flex-direction:column;gap:10px">{framed("F05_decision", 700, overlay=sel, label="B · SELECTED INTENT")}<div class="cap"><b>Selecting is reversible.</b> The chosen phrase gets a graphite underline; the camera eases two steps nearer that anchor. The room does not react.</div></div>'
              f'<div style="display:flex;flex-direction:column;gap:10px">{framed("F05_decision", 700, overlay=com, label="C · ACCEPTED COMMITMENT")}<div class="cap"><b>Commitment is separate.</b> The one rust mark of the slice: a bracket around the body, a sentence naming the act, a second confirm. Then 06 begins.</div></div></div>')
    return final_board('C06', 'Decision frame', 'decision', 'Decision: three intentions with equal dignity',
                       'The director’s question is the only line of dialogue on screen. Observation and preparation are over; the island now holds every anchor the three intentions need, and nothing else.',
                       'F05_decision', [
                           ('01', 'Speak publicly now', 'Anchored to the hero’s hand and the summary, the object that would be raised.'),
                           ('02', 'Ask privately', 'Anchored to Mira. On mobile, where she is off-frame, the leader runs to the frame edge on her side.'),
                           ('03', 'Remain silent', 'Anchored to the empty chair by the glass: silence is sitting back down, an act with a place.'),
                           ('04', 'No hierarchy', 'No phrase is first, larger, warmer or nearer the centre. Order of reading follows the room left to right, not preference.')],
                       extra=states, h=2320)


def board_enactment():
    cells = []
    for f, t, a, b in (('F06a_speak', 'Speak publicly now', 'Arm rises to shoulder height with the summary, head comes up, weight steps forward. The first words appear as the author’s typography would set them.', 'Stop when the sentence breaks off with a dash. Director, Mira and colleagues keep their exact authored poses.'),
                       ('F06b_private', 'Request a private clarification', 'At the close, hero crosses to Mira by the glass door, one hand lifting from the hip. The first words begin.', 'Stop at 1.1 m, mid-step. Mira is still walking toward the door in her authored clip, back three-quarter. No turn.'),
                       ('F06c_silence', 'Remain silent', 'Hero sits back on the overflow chair, turns the summary face down on the lap and rests both hands on it.', 'Stop when the hands settle. The confirm in C06 made this an act; the face-down paper makes it visible.')):
        cells.append(f'<div style="display:flex;flex-direction:column;gap:12px">{framed(f, 720)}<div class="tt" style="font-size:30px">{t}</div>'
                     f'<div class="cap"><b>Begins.</b> {a}</div><div class="cap"><b>Stops.</b> {b}</div></div>')
    grid = f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:40px">{"".join(cells)}</div>'
    mob = f'<div style="display:flex;gap:40px;align-items:flex-start;margin-top:30px">{framed("M06_speak", 260, vb=(780, 1688), label="390")}<div class="cap" style="max-width:600px;padding-top:20px"><b>On mobile</b> the enactment is the same clip, cropped on the body. The broken-off line sits in the top text zone; the lower third stays empty because nothing is offered any more.</div></div>'
    return page('Enactment frames', f'{EB} · board C07', 'Enactment: the body begins, then the picture stops',
                'Each intention gets one physical beginning, authored as a clip. The rust bracket marks the committed act. Nothing after the first beat of the act is drawn.',
                f'{grid}{mob}{SVGDEFS}', 2400, 1640)


def board_boundary():
    strip = ''.join(f'<div style="display:flex;flex-direction:column;gap:10px">{framed(f, 700, label=l)}<div class="cap">{d}</div></div>'
                    for f, l, d in (('F06a_speak', 'T+0 · ACT', 'The committed act reaches its last authored frame.'),
                                    ('F07a_held', 'T+0.9 s · HELD', 'Grain locks, ambient loops thin out. Others’ paint drops a step; nobody moves.'),
                                    ('F07b_withdraw', 'T+2.5 s · WITHDRAW', 'Paint withdraws edges-first over 1.6 s: walls, then people, then floor. The island shrinks to the body.')))
    body = (f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:30px">{strip}</div>'
            f'<div style="display:flex;flex-direction:column;gap:14px;margin-top:20px"><div class="eb">T+4 s · Boundary</div>{framed("F07_boundary", 2240)}</div>'
            + note_row([('01', 'What changes', 'Paint becomes paper. The hero’s body becomes flat ink (the halo goes, the silhouette stays). The slide dims to 35%.'),
                        ('02', 'What does not', 'Nobody’s pose changes. No camera move. No sound sting. The world is not destroyed; it stops being remembered.'),
                        ('03', 'The only text', '“That is where your version stops.” Serif italic, top left, same position as every beat line before it.'),
                        ('04', 'No modal', 'No result card, no score, no outcome. The next thing that happens is the reveal, on the same page.')], 500)
            + SVGDEFS)
    return page('Truth boundary', f'{EB} · board C08', 'The truth boundary: your version stops here',
                'Four seconds, three states, one transformation of the Remembered Room paint treatment. This is the line between the player’s counterfactual and the author’s account.',
                body, 2400, 2420)


def board_reveal():
    strip = ''.join(f'<div style="display:flex;flex-direction:column;gap:10px">{framed(f, 520, label=l)}<div class="cap">{d}</div></div>'
                    for f, l, d in (('F07_boundary', '01', 'Boundary. Graphite room, ink body.'),
                                    ('F08a_lift', '02', 'The summary leaves the ink hand. The room fades to 22%.'),
                                    ('F08b_page', '03', 'The page fills the frame; a pencil loop draws itself on the dip.'),
                                    ('F08_reveal', '04', 'The author speaks beside the page they printed.')))
    body = (f'<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:24px">{strip}</div>'
            f'<div style="display:flex;gap:40px;margin-top:30px;align-items:flex-start">{framed("F08_reveal", 1860)}{framed("M08_reveal", 340, vb=(780, 1688), label="390")}</div>'
            + note_row([('01', 'Why it is a climax', 'For the whole story the summary was a prop. Now it is a real document someone made at 2 a.m. The shift from simulation to testimony happens in one object.'),
                        ('02', 'Meeting a person', 'First person, unedited, the largest type in the slice. A margin note in their hand. A handle, not an avatar. No face.'),
                        ('03', 'Reader-paced', 'Words appear line by line at reading speed after a 0.8 s hold. “What happened after” stays folded until asked.'),
                        ('04', 'No verdict', 'The author did something different from the player. Nothing on the page says who was right.')], 500)
            + SVGDEFS)
    return page('Author reveal', f'{EB} · board C09', 'The paint lifts, and a person is holding the page',
                'The reveal keeps the V2 idea (paint withdraws → graphite → author) and adds one move: the hero prop crosses the boundary. The printed summary is the bridge from the reconstructed room to the human who lived it.',
                body, 2400, 2140)


# ================================================================== C10 mobile
def phone(n, label, note):
    zones = (f'<rect x="0" y="0" width="780" height="230" fill="#B5523A" opacity="0.05"/><text x="20" y="220" font-family="IBM Plex Mono, monospace" font-size="18" fill="#B5523A" opacity="0.6">TEXT ZONE</text>'
             f'<rect x="0" y="1400" width="780" height="288" fill="#2F5E8C" opacity="0.05"/><text x="20" y="1440" font-family="IBM Plex Mono, monospace" font-size="18" fill="#2F5E8C" opacity="0.6">THUMB ZONE · INTENT / CONTINUE</text>')
    return (f'<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">'
            f'<div style="padding:14px;background:#1d1c1b;border-radius:44px">{framed(n, 340, overlay=zones, vb=(780, 1688))}</div>'
            f'<div class="cap" style="max-width:360px"><b>{label}</b><br>{note}</div></div>')


def board_mobile():
    cells = [phone('M01_desk', 'Desk', 'Hero and monitor share the frame; the paper is the largest light shape.'),
             phone('M02_meeting', 'Meeting', 'Camera slides 2.2 m along the glass: hero big at left, slide cut by the right edge.'),
             phone('M05_decision', 'Decision', 'Three phrases; Mira is off-frame so her leader runs to the right edge.'),
             phone('M06_speak', 'Enact · speak', 'Same clip as desktop, cropped on the body.'),
             phone('M07_boundary', 'Boundary', 'Graphite plate, ink body, the line in the text zone.'),
             phone('M08_reveal', 'Author', 'Page above, words below, read by scrolling.')]
    return page('Mobile frames', f'{EB} · board C10', '390 px: same plates, different cameras',
                'Mobile frames are not crops of the desktop image. Each location has a portrait camera move along the same geometry, so the hero stays big and the hero object stays in frame.',
                f'<div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:20px">{"".join(cells)}</div>{SVGDEFS}', 2400, 1300)


# ================================================================== C11 desktop compositions & safe areas
def safe_ov(extra=''):
    return (f'<rect x="96" y="54" width="1728" height="972" fill="none" stroke="#2F5E8C" stroke-width="2" stroke-dasharray="8 6"/>'
            f'<rect x="0" y="0" width="1920" height="130" fill="#B5523A" opacity="0.07"/>' + tag(110, 120, 'LINE ZONE', '#B5523A', 18)
            + f'<rect x="0" y="930" width="1920" height="150" fill="#2F5E8C" opacity="0.07"/>' + tag(110, 1010, 'INTENT / CONTINUE ZONE (desktop: free, used only at 05)', '#2F5E8C', 18) + extra)


def board_desktop():
    ox, oy, hu = IM['hero']
    mob = lambda cx: f'<rect x="{fmt(cx - 250)}" y="0" width="499" height="1080" fill="none" stroke="#6E8B5E" stroke-width="3"/>' + tag(cx - 240, 1060, '390 CROP IF NO PORTRAIT CAMERA', '#6E8B5E', 16)
    cells = []
    for f, t, d, ex in (('F01_desk', 'Desk', 'Hero right of centre on the rule of thirds; monitor at the left third; meeting room top right.', mob(780)),
                        ('F02_meeting', 'Meeting', 'Centre of the room right of centre, hero on the left third, the gap between them is the subject.', mob(ox + 100)),
                        ('F03_hallway', 'Hallway', 'Vanishing point left of centre; hero on the left third; glass wall carries the right half.', mob(700)),
                        ('F05_decision', 'Decision', 'All three anchors live inside title-safe. Phrases never cross the frame edge on desktop.', '')):
        cells.append(f'<div style="display:flex;flex-direction:column;gap:10px">{framed(f, 1080, overlay=safe_ov(ex))}{cap("", t, d, 1060)}</div>')
    return page('Desktop compositions', f'{EB} · board C11', 'Desktop compositions and safe areas',
                '1920×1080 masters. Blue dash = title-safe (90%). Red band = the beat line zone. Blue band = the intent zone. Green = what a naive 390 crop would keep, which is why mobile gets its own camera.',
                f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:40px">{"".join(cells)}</div>{SVGDEFS}', 2400, 1700)


# ================================================================== C12 layer stack
def board_layers():
    layers = [('L1_graphite', '1 · Graphite plate', 'Static per location. Architecture and furniture drawn in pencil on paper. Furniture is paper-filled so it occludes.'),
              ('L2_paint', '2 · Paint plate', 'Static per location. Every surface fully painted with its local light. Never shown whole.'),
              ('L3_mask', '3 · Attention mask', 'Runtime. Soft-edged blobs around attention targets, torn by a noise texture. Reveals 2 over 1.'),
              ('L4_actors', '4 · Actors', 'Runtime. Rigged painted-mass figures at finish 0.25–1.0; hero with halo and prop; contact shadows; chair backs as occluders.')]
    stack = ''
    for i, (n, t, d) in enumerate(layers):
        stack += (f'<div style="position:absolute;left:{80 + i * 70}px;top:{260 + i * 210}px;transform:perspective(2200px) rotateX(48deg) rotateZ(-16deg);transform-origin:0 0;'
                  f'box-shadow:0 30px 60px rgba(40,30,20,0.18);background:{"#cfc8bb" if n == "L4_actors" else "transparent"}">{img(n, 820)}</div>')
    labels = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px;padding:16px 0;border-top:1px solid #c4b9a6"><div class="tt" style="font-size:28px">{t}</div><div class="cap">{d}</div></div>' for n, t, d in layers)
    labels += ''.join(f'<div style="display:flex;flex-direction:column;gap:8px;padding:16px 0;border-top:1px solid #c4b9a6"><div class="tt" style="font-size:28px">{t}</div><div class="cap">{d}</div></div>' for t, d in (
        ('5 · Light & prop plates', 'Screen glow, daylight pools, phone/monitor glow, the slide and the summary as live-text plates above paint.'),
        ('6 · Line + hung phrases', 'Beat line top-left; intention phrases with graphite leaders anchored to world points.'),
        ('7 · Paper grain', 'One full-frame grain + mottle pass over everything, so plate, paint and actors share a surface.')))
    comp = f'<div style="display:flex;flex-direction:column;gap:10px;margin-top:30px"><div class="eb">= composite (decision frame)</div>{framed("F05_decision", 760)}</div>'
    body = (f'<div style="display:flex;gap:60px"><div style="position:relative;width:1300px;height:1300px">{stack}</div>'
            f'<div style="display:flex;flex-direction:column;gap:0;width:760px">{labels}{comp}</div></div>{SVGDEFS}')
    return page('Layer stack', f'{EB} · board C12', 'Asset breakdown: seven layers, two of them static',
                'Every location ships as a graphite plate and a paint plate drawn in register from the same camera. Everything that changes during play lives in the mask, the actors and the plates above them.',
                body, 2400, 1800)


# ================================================================== plans (C13, C14)
def plan_meeting(beat='present', W=700, H=760, scale=78, show=('walk', 'occ', 'cam', 'portal', 'actors', 'attn')):
    x0, x1, zb = MR['x0'], MR['x1'], MR['zb']
    ox, oy = W / 2, H - 40

    def P(x, z):
        return (ox + x * scale, oy - (z - 1.0) * scale)
    s = ''
    # walls
    a, b = P(x0, 1.2), P(x1, zb)
    s += f'<rect x="{fmt(a[0])}" y="{fmt(b[1])}" width="{fmt(b[0] - a[0])}" height="{fmt(a[1] - b[1])}" fill="#EFE8DA" stroke="#2b2724" stroke-width="3"/>'
    # glass wall (left) double line
    s += f'<line x1="{fmt(a[0] + 5)}" y1="{fmt(a[1])}" x2="{fmt(a[0] + 5)}" y2="{fmt(b[1])}" stroke="#6F8C93" stroke-width="2"/>'
    if 'walk' in show:
        tx0, tx1, tz0, tz1 = POS['table']
        pts = [P(x0 + 0.3, 1.6), P(x1 - 0.5, 1.6), P(x1 - 0.5, zb - 0.3), P(x0 + 0.3, zb - 0.3)]
        s += f'<path d="M{" L".join(fmt(p[0]) + "," + fmt(p[1]) for p in pts)}Z" fill="url(#hatch)"/>'
    tx0, tx1, tz0, tz1 = POS['table']
    ta, tb = P(tx0, tz0), P(tx1, tz1)
    s += f'<rect x="{fmt(ta[0])}" y="{fmt(tb[1])}" width="{fmt(tb[0] - ta[0])}" height="{fmt(ta[1] - tb[1])}" fill="#8a7a69" stroke="#2b2724" stroke-width="1.5"/>'
    # credenza, screen
    ca, cb = P(x1 - 0.45, 4.0), P(x1, 6.6)
    s += f'<rect x="{fmt(ca[0])}" y="{fmt(cb[1])}" width="{fmt(cb[0] - ca[0])}" height="{fmt(ca[1] - cb[1])}" fill="#b5ab9b"/>'
    sa, sb = P(-1.35, zb), P(1.35, zb)
    s += f'<line x1="{fmt(sa[0])}" y1="{fmt(sa[1] + 4)}" x2="{fmt(sb[0])}" y2="{fmt(sb[1] + 4)}" stroke="#2F5E8C" stroke-width="6"/>' + tag(sa[0], sa[1] + 30, 'SCR', '#2F5E8C', 16)
    # portal
    if 'portal' in show:
        d0, d1 = P(x0, 5.0), P(x0, 5.95)
        s += f'<line x1="{fmt(d0[0])}" y1="{fmt(d0[1])}" x2="{fmt(d1[0])}" y2="{fmt(d1[1])}" stroke="#E4DAC6" stroke-width="8"/>'
        s += f'<path d="M{fmt(d0[0])},{fmt(d0[1])} A{fmt(d0[1] - d1[1])},{fmt(d0[1] - d1[1])} 0 0 0 {fmt(d0[0] + (d0[1] - d1[1]))},{fmt(d1[1])}" fill="none" stroke="#B5523A" stroke-width="1.5" stroke-dasharray="4 4"/>'
        s += tag(d0[0] - 60, (d0[1] + d1[1]) / 2 + 6, 'P1', '#B5523A', 18)
    # chairs (occluders)
    if 'occ' in show:
        for (x, z) in (POS['c_left1'], POS['c_left2'], POS['c_right1'], POS['c_near'], POS['director'], POS['hero_seat']):
            c = P(x, z)
            s += f'<rect x="{fmt(c[0] - 18)}" y="{fmt(c[1] - 18)}" width="36" height="36" fill="none" stroke="#5E5953" stroke-width="1.4"/>'
        c = P(*POS['c_near'])
        s += f'<line x1="{fmt(c[0] - 20)}" y1="{fmt(c[1] + 22)}" x2="{fmt(c[0] + 20)}" y2="{fmt(c[1] + 22)}" stroke="#2b2724" stroke-width="5"/>' + tag(c[0] + 26, c[1] + 30, 'OCC chair back', '#5E5953', 14)
    # camera frustum
    if 'cam' in show:
        cm = P(0, 0.0)
        for sxp in (0, 1920):
            xw = 8.6 * (sxp - F.MEET_CAM['cx']) / F.MEET_CAM['f']
            e = P(xw, 8.6)
            s += f'<line x1="{fmt(cm[0])}" y1="{fmt(cm[1])}" x2="{fmt(e[0])}" y2="{fmt(e[1])}" stroke="#2F5E8C" stroke-width="1.2" stroke-dasharray="6 5"/>'
        s += f'<circle cx="{fmt(cm[0])}" cy="{fmt(cm[1])}" r="7" fill="#2F5E8C"/>' + tag(cm[0] + 12, cm[1] + 6, 'CAM 1.5 m', '#2F5E8C', 14)
    return s, P


def actor(P, x, z, yaw, lab, col='#5E5953', r=13):
    c = P(x, z)
    fx, fz = math.sin(math.radians(yaw)), -math.cos(math.radians(yaw))
    e = (c[0] + fx * 26, c[1] - fz * 26)
    return (f'<circle cx="{fmt(c[0])}" cy="{fmt(c[1])}" r="{r}" fill="{col}"/><line x1="{fmt(c[0])}" y1="{fmt(c[1])}" x2="{fmt(e[0])}" y2="{fmt(e[1])}" stroke="{col}" stroke-width="4"/>'
            + f'<text x="{fmt(c[0] + 16)}" y="{fmt(c[1] - 14)}" font-family="IBM Plex Mono, monospace" font-size="15" fill="{col}">{lab}</text>')


def cast_present(P, hero=(POS['hero_seat'], 90), mira=(POS['mira'], -58)):
    s = ''
    s += actor(P, *mira[0], mira[1], 'M', '#53606F')
    s += actor(P, *POS['director'], -90, 'D', '#34373F')
    for k, (x, z), yaw in (('C1', POS['c_left1'], 90), ('C2', POS['c_left2'], 90), ('C3', POS['c_right1'], -90), ('C4', POS['c_near'], 180)):
        s += actor(P, x, z, yaw, k, '#8a8279', 11)
    s += actor(P, *hero[0], hero[1], 'H', '#C38A34', 15)
    return s


def plan_hall(W=700, H=760, scale=46):
    ox, oy = W / 2 - 40, H - 40
    def P(x, z):
        return (ox + x * scale, oy - (z - 1.0) * scale)
    xl, xr = -1.6, 1.7
    a, b = P(xl, 1.0), P(xr, 16)
    s = f'<rect x="{fmt(a[0])}" y="{fmt(b[1])}" width="{fmt(b[0] - a[0])}" height="{fmt(a[1] - b[1])}" fill="#EFE8DA" stroke="#2b2724" stroke-width="3"/>'
    pts = [P(xl + 0.25, 1.4), P(xr - 0.25, 1.4), P(xr - 0.25, 15.5), P(xl + 0.25, 15.5)]
    s += f'<path d="M{" L".join(fmt(p[0]) + "," + fmt(p[1]) for p in pts)}Z" fill="url(#hatch)"/>'
    g0, g1 = P(xr, 6.0), P(xr, 13.0)
    s += f'<line x1="{fmt(g0[0] - 4)}" y1="{fmt(g0[1])}" x2="{fmt(g1[0] - 4)}" y2="{fmt(g1[1])}" stroke="#6F8C93" stroke-width="2"/>'
    m0, m1 = P(xr, 6.0), P(xr + 6.8, 13.0)
    s += f'<rect x="{fmt(m0[0])}" y="{fmt(m1[1])}" width="{fmt(m1[0] - m0[0])}" height="{fmt(m0[1] - m1[1])}" fill="#E1D9C9" stroke="#2b2724" stroke-width="2"/>'
    s += tag(m0[0] + 20, m1[1] + 30, 'MEETING ROOM', '#5E5953', 14)
    d0, d1 = P(xr, 6.3), P(xr, 7.25)
    s += f'<line x1="{fmt(d0[0])}" y1="{fmt(d0[1])}" x2="{fmt(d1[0])}" y2="{fmt(d1[1])}" stroke="#E4DAC6" stroke-width="8"/>' + tag(d0[0] + 10, (d0[1] + d1[1]) / 2 + 6, 'P1', '#B5523A', 18)
    w0, w1 = P(xl, 4.4), P(xl, 6.8)
    s += f'<line x1="{fmt(w0[0])}" y1="{fmt(w0[1])}" x2="{fmt(w1[0])}" y2="{fmt(w1[1])}" stroke="#E9B567" stroke-width="7"/>' + tag(w0[0] - 98, (w0[1] + w1[1]) / 2, 'WINDOW', '#a07a3a', 14)
    bb0, bb1 = P(xl, 7.6), P(xl + 0.42, 9.2)
    s += f'<rect x="{fmt(bb0[0])}" y="{fmt(bb1[1])}" width="{fmt(bb1[0] - bb0[0])}" height="{fmt(bb0[1] - bb1[1])}" fill="#8E7F6C"/>'
    cm = P(0, 0.2)
    s += f'<circle cx="{fmt(cm[0])}" cy="{fmt(cm[1])}" r="7" fill="#2F5E8C"/>' + tag(cm[0] + 12, cm[1] + 6, 'CAM', '#2F5E8C', 14)
    s += actor(P, -0.85, 4.7, 28, 'H', '#C38A34', 15)
    return s, P


def plan_desk(W=700, H=760, scale=70):
    ox, oy = W / 2 - 60, H - 40
    def P(x, z):
        return (ox + x * scale, oy - (z - 1.0) * scale)
    x0, x1, z0, z1 = DESK['desk']
    a, b = P(-4.5, 1.0), P(5.6, 10.5)
    s = f'<rect x="{fmt(a[0])}" y="{fmt(b[1])}" width="{fmt(b[0] - a[0])}" height="{fmt(a[1] - b[1])}" fill="#EFE8DA" stroke="#2b2724" stroke-width="3"/>'
    s += f'<line x1="{fmt(a[0])}" y1="{fmt(b[1] + 4)}" x2="{fmt(b[0])}" y2="{fmt(b[1] + 4)}" stroke="#E9B567" stroke-width="6"/>'
    pts = [P(-0.2, 1.6), P(1.6, 1.6), P(1.6, 5.8), P(2.9, 5.9), P(2.9, 6.1), P(-0.2, 4.2)]
    s += f'<path d="M{" L".join(fmt(p[0]) + "," + fmt(p[1]) for p in pts)}Z" fill="url(#hatch)"/>'
    da, db = P(x0, z0), P(x1, z1)
    s += f'<rect x="{fmt(da[0])}" y="{fmt(db[1])}" width="{fmt(db[0] - da[0])}" height="{fmt(da[1] - db[1])}" fill="#bfb39f" stroke="#2b2724" stroke-width="1.5"/>'
    mo = P(*DESK['monitor'])
    s += f'<rect x="{fmt(mo[0] - 25)}" y="{fmt(mo[1] - 4)}" width="50" height="8" fill="#2F5E8C"/>' + tag(mo[0] - 30, mo[1] - 12, 'MON', '#2F5E8C', 14)
    for zz in (6.0, 7.8):
        for xx in (-4.4, -2.0):
            q0, q1 = P(xx, zz), P(xx + 1.6, zz + 0.75)
            s += f'<rect x="{fmt(q0[0])}" y="{fmt(q1[1])}" width="{fmt(q1[0] - q0[0])}" height="{fmt(q0[1] - q1[1])}" fill="none" stroke="#8a8279"/>'
    m0, m1 = P(2.2, 6.2), P(5.6, 9.6)
    s += f'<rect x="{fmt(m0[0])}" y="{fmt(m1[1])}" width="{fmt(m1[0] - m0[0])}" height="{fmt(m0[1] - m1[1])}" fill="#E1D9C9" stroke="#6F8C93" stroke-width="2"/>' + tag(m0[0] + 8, m1[1] + 24, 'MEETING ROOM', '#5E5953', 13)
    d0 = P(3.0, 6.2)
    s += f'<line x1="{fmt(d0[0])}" y1="{fmt(d0[1])}" x2="{fmt(d0[0] + 0.9 * scale)}" y2="{fmt(d0[1])}" stroke="#E4DAC6" stroke-width="8"/>' + tag(d0[0], d0[1] + 24, 'P0 → corridor', '#B5523A', 15)
    cm = P(0, 1.0)
    s += f'<circle cx="{fmt(cm[0])}" cy="{fmt(cm[1])}" r="7" fill="#2F5E8C"/>' + tag(cm[0] + 12, cm[1] - 8, 'CAM', '#2F5E8C', 14)
    s += actor(P, *DESK['hero'], -62, 'H', '#C38A34', 15)
    sp = P(0.35, 3.15)
    s += f'<rect x="{fmt(sp[0] - 8)}" y="{fmt(sp[1] - 10)}" width="16" height="20" fill="#F1EBDF" stroke="#B5523A" stroke-width="2"/>' + tag(sp[0] + 12, sp[1] + 30, 'SUMMARY (in hand)', '#B5523A', 13)
    return s, P


def legend():
    items = [('url(#hatch)', 'walkable floor'), ('#5E5953', 'occluder (chair back, table, door frame)'), ('#B5523A', 'portal'), ('#2F5E8C', 'camera, screen, monitor'),
             ('#C38A34', 'hero anchor (tick = facing)'), ('#8a8279', 'other actor anchors')]
    return '<div style="display:flex;gap:26px;flex-wrap:wrap">' + ''.join(
        f'<div style="display:flex;gap:8px;align-items:center"><svg width="22" height="22" aria-hidden="true"><rect width="22" height="22" fill="{c}" stroke="#2b2724" stroke-width="0.5"/></svg><span class="cap">{t}</span></div>' for c, t in items) + '</div>'


def board_staging():
    s1, P1 = plan_desk()
    s2, P2 = plan_hall()
    s3, P3 = plan_meeting()
    s3 += cast_present(P3)
    # building plan schematic
    bp = ('<rect x="20" y="20" width="660" height="560" fill="#EFE8DA" stroke="#2b2724" stroke-width="3"/>'
          '<rect x="20" y="330" width="330" height="250" fill="#E9E2D3" stroke="#2b2724" stroke-width="2"/>' + tag(36, 360, 'L01 OPEN PLAN · DESK', '#2b2724', 15)
          + '<rect x="350" y="20" width="110" height="560" fill="#F1EBDF" stroke="#2b2724" stroke-width="2"/>' + tag(360, 50, 'L03 CORRIDOR', '#2b2724', 15)
          + '<rect x="460" y="120" width="220" height="300" fill="#E1D9C9" stroke="#6F8C93" stroke-width="3"/>' + tag(470, 150, 'L02 MEETING', '#2b2724', 15)
          + '<line x1="350" y1="480" x2="350" y2="530" stroke="#EFE8DA" stroke-width="8"/>' + tag(300, 470, 'P0', '#B5523A', 18)
          + '<line x1="460" y1="250" x2="460" y2="292" stroke="#EFE8DA" stroke-width="8"/>' + tag(468, 280, 'P1', '#B5523A', 18)
          + '<line x1="352" y1="200" x2="352" y2="320" stroke="#E9B567" stroke-width="6"/>'
          + '<path d="M250,470 C300,500 330,505 380,500 S 400,320 400,280 L455,272" fill="none" stroke="#C38A34" stroke-width="3" marker-end="url(#arr)"/>'
          + '<path d="M455,262 L395,262 L395,240" fill="none" stroke="#C38A34" stroke-width="3" stroke-dasharray="6 5" marker-end="url(#arr)"/>'
          + tag(40, 560, 'hero route: desk → P0 → corridor → P1 → room → P1 → window → P1', '#a07a3a', 13))
    def card(t, svgs, w=700, h=760, note=''):
        rw = 520
        return f'<div style="display:flex;flex-direction:column;gap:10px"><div class="tt" style="font-size:30px">{t}</div><svg viewBox="0 0 {w} {h}" width="{rw}" height="{fmt(rw * h / w)}" aria-hidden="true" style="overflow:visible">{svgs}</svg><div class="cap" style="max-width:{rw}px">{note}</div></div>'
    body = (f'<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:40px">'
            f'{card("Building · location graph", bp, 700, 600, "Three locations, two portals. P0 joins the open plan to the corridor; P1 is the glass door between corridor and meeting room. The meeting room is visible from both other locations.")}'
            f'{card("L01 · Desk", s1, note="Walkable: the aisle beside the desk and toward P0. Desk and far desks are occluders below 0.75 m. Summary rides on the hero’s right hand.")}'
            f'{card("L03 · Corridor", s2, note="Walkable: full corridor width minus 0.25 m. Window bay is a light source and an attention target. Glass wall reads the room through it; P1 is the only door.")}'
            f'{card("L02 · Meeting room", s3, note="Walkable: perimeter ring plus the gap behind the near chair. Table, chairs and the near chair back occlude. P1 is in the glass wall at 5.0–5.95 m depth.")}'
            f'</div><div style="margin-top:20px">{legend()}</div>{SVGDEFS}')
    return page('Staging and portals', f'{EB} · board C13', 'Top-down staging and portal geometry',
                'Plans are drawn from the same coordinates as the frames (metres, camera at origin looking +z). Anything an engineer needs to place, walk, occlude or connect is on these plans.',
                body, 2400, 1340)


def board_blocking():
    beats = [('02 Presentation', (POS['hero_seat'], 90), (POS['mira'], -58), None, 'Hero seated by the glass, 1.6 m from table. Mira at the screen.'),
             ('03a Break', None, (POS['mira'], -58), [((-2.75, 4.3), (-3.6, 5.5))], 'Hero leaves through P1. The chair stays empty; nobody else moves.'),
             ('04 Return', (POS['hero_stand'], 78), (POS['mira'], -58), [((-3.6, 5.5), POS['hero_stand'])], 'Hero re-enters through P1 and stops standing, 0.6 m nearer the table.'),
             ('05 Decision', (POS['hero_stand'], 72), (POS['mira'], -58), None, 'Three anchors: hero hand, Mira, empty chair.'),
             ('06a Speak', (POS['hero_stand'], 74), (POS['mira'], -58), None, 'No step. Arm and head rise in place.'),
             ('06b Private', ((-1.55, 4.95), -128), ((-2.65, 5.75), -100), [(POS['hero_stand'], (-1.55, 4.95)), (POS['mira'], (1.6, 8.35), (-2.0, 8.35), (-2.65, 5.75))], 'Meeting closes. Mira walks toward P1; hero intercepts at 1.1 m.'),
             ('06c Silence', (POS['hero_seat'], 90), (POS['mira'], -58), [(POS['hero_stand'], POS['hero_seat'])], 'Hero returns to the overflow chair and sits.')]
    cells = []
    for t, hero, mira, moves, note in beats:
        s, P = plan_meeting(W=520, H=600, scale=56, show=('portal',))
        s += cast_present(P, hero=hero or ((-3.9, 5.5), -90), mira=mira)
        if moves:
            for mv in moves:
                pts = [P(*q) for q in mv]
                s += f'<polyline points="{" ".join(fmt(p[0]) + "," + fmt(p[1]) for p in pts)}" fill="none" stroke="#B5523A" stroke-width="2.5" stroke-dasharray="7 5" marker-end="url(#arr)"/>'
        cells.append(f'<div style="display:flex;flex-direction:column;gap:8px"><div class="tt" style="font-size:24px">{t}</div><svg viewBox="0 0 520 600" width="520" height="600" aria-hidden="true">{s}</svg><div class="cap" style="max-width:500px">{note}</div></div>')
    rules = note_row([('A', 'Distances are authored', 'Hero ↔ table edge: 1.6 m seated (02), 1.0 m standing (04–06a). Hero ↔ Mira: 1.1 m at 06b. These are part of the story, not tuning.'),
                      ('B', 'Others never re-block', 'Director and colleagues hold their anchors in every beat. The only other actor who moves is Mira in 06b, on her own authored path to P1.'),
                      ('C', 'Facing is data', 'Every anchor has a facing. Heads may turn within the pose; feet do not move unless the beat says so.')], 640)
    return page('Actor blocking', f'{EB} · board C14', 'Actor blocking map, beat by beat',
                'Ochre = hero, slate = Mira, dark = director, grey = colleagues C1–C4. Ticks show facing. Rust dashes are the only movement authored in each beat.',
                f'<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:30px 30px">{"".join(cells)}</div><div style="margin-top:40px">{rules}</div>{SVGDEFS}', 2400, 1960)


# ================================================================== C15 attention overlay
def board_attention():
    # desk
    ox, oy, hu = ID['hero']
    m0, m1 = ID['monitor']
    od = (contour(ox, oy - hu * 3.7, hu * 2.4, hu * 4.4, label='1  body + pages', lx=hu * 2.0, ly=-hu * 3)
          + contour((m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2, 220, 160, label='2  the slide', lx=-230, ly=-180)
          + contour((m0[0] + m1[0]) / 2 + 130, m1[1] + 30, 330, 70, dash='10 8', label='3  the match (joins 1 + 2)', lx=-200, ly=110))
    oxm, oym, hum = IM['hero']
    sx0, sy0, sx1, sy1 = IM['screen']
    om = (contour(oxm, oym - hum * 3.4, hum * 2.3, hum * 4.3, label='1  me', lx=-60, ly=-hum * 4.6)
          + contour((sx0 + sx1) / 2, (sy0 + sy1) / 2, (sx1 - sx0) * 0.62, (sy1 - sy0) * 0.75, label='2  my line on her slide', lx=-160, ly=-(sy1 - sy0) * 0.85)
          + contour(IM['mira'][0], IM['mira'][1] - 160, 70, 190, dash='10 8', label='3  Mira', lx=60, ly=-120))
    oxh, oyh, huh = IH['hero']
    oh = (contour(oxh, oyh - huh * 3.4, huh * 2.6, huh * 4.4, label='1  the pages', lx=huh * 2.4, ly=-huh * 3)
          + contour(IH['door'][0], IH['door'][1], 120, 240, dash='10 8', label='2  the door back', lx=-60, ly=-260)
          + contour(470, 420, 140, 240, dash='4 8', label='3  daylight', lx=-140, ly=-260))
    h, m, ch = DA['hand'], DA['mira'], DA['chair']
    oc = (contour(h[0], h[1] - 40, 150, 200, label='hand + pages', lx=-120, ly=-230)
          + contour(m[0], m[1] + 60, 110, 230, label='Mira', lx=40, ly=-240)
          + contour(ch[0], ch[1] + 40, 140, 140, label='empty chair', lx=-60, ly=190))
    cells = []
    for f, ov, t, d in (('F01_desk', od, 'Desk', 'Three targets, read in order. When 1 and 2 have both been attended, target 3 appears: the island joins them and the graphite loops are drawn.'),
                        ('F02_meeting', om, 'Meeting', 'The self, the slide, then Mira. Attending the slide redraws the loop on the kink; attending Mira does not paint her face, only her body.'),
                        ('F03_hallway', oh, 'Hallway', 'Pages first. The door is always a target: the way back is never hidden. Daylight is optional and only widens the island.'),
                        ('F05_decision', oc, 'Decision', 'Exactly three anchors, one per intention. No other target is active; the room is attended as a whole.')):
        cells.append(f'<div style="display:flex;flex-direction:column;gap:10px">{framed(f, 1080, overlay=ov)}{cap("", t, d, 1060)}</div>')
    rules = note_row([('A', 'No dots, no glows', 'Targets are never marked in-game. The player finds them by looking; the only feedback is paint arriving and memory drawing a graphite loop.'),
                      ('B', 'Contours here are documentation', 'Pencil ellipses on this board are for the engineer: target, order and joins. They must not ship.'),
                      ('C', 'Hover = paint, select = line', 'Pointer near a target: the island leans toward it. Selecting: a graphite loop or underline. Committing: rust, once.')], 640)
    return page('Attention map', f'{EB} · board C15', 'Attention and interaction, without hotspots',
                'What the player can attend to in each frame, in what order, and what visibly changes when they do. Overlays are for this handoff only.',
                f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:40px">{"".join(cells)}</div><div style="margin-top:40px">{rules}</div>{SVGDEFS}', 2400, 1880)


# ================================================================== C16 handshake
HS_COLS = ['L01 Desk', 'L02 Meeting · 02 present', 'L03 Corridor · 03 break', 'L02 Meeting · 04 return → 05 decide', 'L02 Meeting · 06 enact', '07 Boundary · 08 Reveal']
HS = [
    ('Location ID concept', ['correction.desk', 'correction.meeting (one location, many beats)', 'correction.corridor', 'correction.meeting · same plate as 02', 'correction.meeting', 'no location: page state over the last plate']),
    ('Floor / walkable', ['Aisle polygon beside desk → P0', 'Perimeter ring + gap behind near chair; table footprint excluded', 'Corridor width minus 0.25 m, 1.4–15.5 m', 'Same as 02', 'Same as 02; 06b path hero_stand → (−1.55, 4.95)', 'none'] ),
    ('Actor anchors', ['H standing beside desk, facing −62°', 'H seated (−2.75, 4.3) · M (1.85, 8.05) · D seated (1.35, 7.1) · C1–C4', 'H (−0.85, 4.7) facing 28°', 'H standing (−2.2, 4.9); others as 02', '06a in place · 06b H (−1.55, 4.95), M (−2.65, 5.75) · 06c H seated', 'ink silhouette at last enact anchor'] ),
    ('Object anchors', ['MON monitor plate (live slide) · SUMMARY in right hand · mug · paper', 'SCR slide plate · SUMMARY in right hand · laptops · cups · chairs', 'SUMMARY held two-handed · bench · window bay', 'SCR · SUMMARY at hip · cups (moved) · laptop (closed) · empty chair', 'SUMMARY raised / face down', 'SUMMARY → page plate'] ),
    ('Portal anchors', ['P0 to corridor (off-frame right rear)', 'P1 glass door, left wall, depth 5.0–5.95 m', 'P1 on glass wall, depth 6.3–7.25 m', 'P1 entry; returns through it', 'P1 is Mira’s exit path in 06b', '—'] ),
    ('Occluders', ['Desk top + chair; far desk rows', 'Table, all chairs, near chair back (clips C4 at seat height), glass mullions', 'Glass mullions, bench', 'Same as 02', 'Same as 02', '—'] ),
    ('Camera-safe region', ['Hero x 900–1300; monitor 620–910; keep both in title-safe', 'Hero left third; slide right of centre; floor below 980 empty', 'Hero left third; door + glass right half', 'All three anchors inside title-safe', 'Body + bracket inside title-safe', 'Page left 30–55%, words right 52–92%'] ),
    ('Attention targets', ['body+pages · slide · match (unlocked)', 'self · slide (kink) · Mira', 'pages · door · daylight', 'self · table edge · slide · chair', 'none (watching)', 'none'] ),
    ('Observation state', ['Island on body; joins monitor after look; graphite loops on both kinks', 'Island on self + slide; others finish 0.4, Mira 0.9', 'Larger, softer island; daylight warm tint', 'Island includes table edge and empty chair', '—', '—'] ),
    ('Selected-intent state', ['—', '—', '—', 'Graphite underline on one phrase; camera 2 steps nearer its anchor', '—', '—'] ),
    ('Accepted-commitment state', ['—', '—', '—', 'Rust bracket around body + naming sentence + separate confirm', 'Bracket stays for the act; enact clip plays', '—'] ),
    ('Boundary state', ['—', '—', '—', '—', 'Held 0.9 s → paint withdraws 1.6 s → ink body', 'Graphite plate, slide 35%, one line top-left'] ),
    ('Reveal state', ['—', '—', '—', '—', '—', 'Summary lifts → page → author words, reader-paced'] ),
    ('Reduced motion', ['No island animation: cross-fade 200 ms; loops appear without drawing', 'Same', 'No walk clip: cut to pose at anchor', 'Camera does not move on select; underline only', 'Enact clip replaced by its last frame', 'No withdraw sweep: 400 ms cross-fade to boundary; page appears in place'] ),
]


def board_handshake():
    head = ''.join(f'<th style="text-align:left;padding:12px 14px;border-bottom:2px solid #2b2724;font-family:IBM Plex Mono,monospace;font-size:13px;letter-spacing:.08em;color:#A5442E;font-weight:400;vertical-align:bottom">{c}</th>' for c in [''] + HS_COLS)
    rows = ''
    for k, vals in HS:
        rows += (f'<tr><th scope="row" style="text-align:left;padding:12px 14px;border-bottom:1px solid #c4b9a6;font-family:Newsreader,Georgia,serif;font-size:21px;font-weight:400;color:#211F1D;vertical-align:top;width:230px">{k}</th>'
                 + ''.join(f'<td style="padding:12px 14px;border-bottom:1px solid #c4b9a6;font-family:IBM Plex Sans,sans-serif;font-size:14px;line-height:1.45;color:#3a3633;vertical-align:top">{v}</td>' for v in vals) + '</tr>')
    table = f'<table style="border-collapse:collapse;width:100%"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>'
    need = note_row([('A', 'What the manifest must expose', 'Per location: camera (position, eye height, focal length, desktop + portrait variants), plates (graphite, paint) in register, walkable polygon, occluder polygons with heights, portal segments with target location.'),
                     ('B', 'Per anchor', 'Id, world position, facing, posture (stand / seat), allowed poses, the prop it carries, and which attention target it belongs to.'),
                     ('C', 'Per attention target', 'World footprint (ellipse), order, which targets it joins after both are attended, and the island growth it causes.'),
                     ('D', 'Per beat', 'Which anchors are occupied, by whom, in which pose; which props moved; which visual state the frame is in (observe / select / commit / enact / boundary / reveal).')], 520)
    return page('Visual ↔ runtime handshake', f'{EB} · board C16', 'Visual ↔ runtime handshake',
                'What each scene must be able to tell the renderer. Coordinates are metres in the scene’s own camera space. This is not a schema; it is the visual information the eventual asset and geometry manifest has to carry.',
                f'{table}<div style="margin-top:50px">{need}</div>{SVGDEFS}', 2400, 1560)


# ================================================================== C17 frozen vs illustrator
def board_frozen():
    frozen = ['Remembered Room treatment: graphite plate + paint plate + attention mask + paper grain',
              'Painted Mass hero: 1:7.4, belted ochre long coat, stand collar, hair mass, paper halo, finish 1.0 always',
              'Others: cool/neutral, chroma < half the hero, finish 0.25–0.9 by attention',
              'Cast and anchors for L02: Mira at the screen, director seated nearest it, four colleagues, overflow chair by the glass',
              'Three locations, two portals, the hero route and the room-visible-from-everywhere rule',
              'The printed summary as the single travelling prop and the red line with its kink as the evidence shape',
              'Decision presentation: three phrases, one style, hung on hand / Mira / empty chair; underline to select; rust bracket + confirm to commit',
              'Enactment stop points for speak, private request, silence',
              'Boundary timing: 0.9 s hold, 1.6 s withdraw, ink body, one line; no modal',
              'Reveal order: page lifts → page fills → words; author typography; aftermath folded',
              'Desktop safe areas; portrait cameras for mobile instead of crops']
    illus = [('Paint plates', 'All four plates need a real painter’s pass: material texture (carpet, laminate, glass, plaster), light falloff, soft colour shifts inside the island. Current plates are flat procedural fills.'),
             ('Hero at large scale', 'Coat folds, belt buckle, seams and collar are now in the right places but are drawn as lines. At > 400 px tall the coat needs hand-painted fold masses.'),
             ('Hands', 'Rig hands are mittens with a thumb. Close-ups (enact speak, silence on the pages, private request) need the nine authored hand states painted.'),
             ('Back and seated actors', 'C4 (back to camera) and seated profiles are occluded to hide rig limits. Seated legs under a table and backs over chair backs need illustrated pose sheets.'),
             ('Faces at scale', 'Face plane + one shadow works below 60 px head. Mira and the director at > 60 px need a painted face-plane pass (still no features).'),
             ('Paint-to-graphite edge', 'The torn mask edge is a noise displacement. It needs a hand-painted brush-edge library (4–6 edges) so islands don’t look procedural.'),
             ('Contact and light', 'Contact shadows are generic ellipses. Feet, chair casters and table legs need painted contact, and the slide’s cool pool needs to wrap onto faces.'),
             ('The page', 'The reveal page should be a real scan of a printed and pencilled sheet, not a vector plate.')]
    left = ''.join(f'<li class="cap" style="margin:0 0 12px;font-size:16px">{t}</li>' for t in frozen)
    right = ''.join(f'<div style="display:flex;flex-direction:column;gap:6px;padding:14px 0;border-top:1px solid #c4b9a6"><div class="tt" style="font-size:26px">{t}</div><div class="cap" style="font-size:15px">{d}</div></div>' for t, d in illus)
    body = (f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:80px">'
            f'<div style="display:flex;flex-direction:column;gap:20px"><div class="eb">Final / frozen for the slice</div><div class="tt" style="font-size:44px">Build it this way</div><ul style="margin:0;padding-left:20px">{left}</ul></div>'
            f'<div style="display:flex;flex-direction:column;gap:20px"><div class="eb">Still requires illustrator pass</div><div class="tt" style="font-size:44px">Placeholder fidelity, final placement</div><div>{right}</div></div></div>{SVGDEFS}')
    return page('Frozen vs illustrator', f'{EB} · board C17', 'What is frozen, and what still needs a painter',
                'Everything on the left can be implemented now and will not change. Everything on the right is in its final position and size but will be re-painted.',
                body, 2400, 1560)


BOARDS = [('C01_Storyboard', board_storyboard, 2200), ('C02_Desk', board_desk, 2340), ('C03_Meeting', board_meeting, 2400),
          ('C04_Hallway', board_hallway, 2360), ('C05_Return', board_return, 2440), ('C06_Decision', board_decision, 2320),
          ('C07_Enactment', board_enactment, 1640), ('C08_Boundary', board_boundary, 2420), ('C09_Reveal', board_reveal, 2140),
          ('C10_Mobile', board_mobile, 1300), ('C11_Desktop', board_desktop, 1700), ('C12_Layers', board_layers, 1800),
          ('C13_Staging', board_staging, 1340), ('C14_Blocking', board_blocking, 1960), ('C15_Attention', board_attention, 1880),
          ('C16_Handshake', board_handshake, 1560), ('C17_Frozen', board_frozen, 1560)]
