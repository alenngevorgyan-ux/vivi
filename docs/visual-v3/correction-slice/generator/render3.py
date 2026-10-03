"""Render every r3 frame, plate and layer. Order: geometry -> scenes -> this script -> shot2 -> encode."""
import json, os, frames as FR, frames2 as F2, geometry as G
from scene3d import LAYER
os.makedirs('fr3', exist_ok=True)
jobs, MANIFEST = [], []
MR = G.MEETING


def out(name, svg, kind='desktop', role='frame', loc=None, bg='#E4DAC6', note=''):
    if kind == 'portrait':
        html = FR.page_html(svg, W=390, H=844, vb=(0, 0, 780, 1688), bg=bg); sc, W, H = 2, 390, 844
    else:
        html = FR.page_html(svg, bg=bg); sc, W, H = 1, 1920, 1080
    open(f'fr3/{name}.html', 'w').write(html)
    jobs.append([os.path.abspath(f'fr3/{name}.html'), os.path.abspath(f'fr3/{name}.png'), W, H, sc])
    MANIFEST.append(dict(name=name, kind=kind, role=role, location=loc, note=note))


HERO_T = {'own_seat': (0.71, 1.0, 3.1, 0.95, 1.2), 'stand_near_entry': (1.2, 1.0, 3.7, 0.9, 1.25), 'near_director': (5.6, 1.0, 5.4, 0.95, 1.25)}
DISPLAY = (3.4, 1.6, 7.35, 1.7, 0.9)
TABLE = (3.4, 0.8, 4.85, 1.1, 0.6)
DIRECTOR = (4.75, 1.0, 5.9, 0.8, 1.0)


def mt(*xs):
    return list(xs)


for kind, sfx in (('desktop', 'D'), ('portrait', 'M')):
    # 01 desk
    out(f'{sfx}01_desk', F2.open_plan(kind)[0], kind, loc='correction.open_plan')
    # 02 meeting (seated at own seat)
    out(f'{sfx}02_meeting', F2.meeting(kind, 'seat_hold', mt(HERO_T['own_seat'], DISPLAY))[0], kind, loc=MR['id'])
    if kind == 'portrait':
        out('M02b_meeting_room', F2.meeting('portrait_room', 'seat_hold', mt(DISPLAY, (5.25, 1.0, 6.85, 0.7, 1.2), DIRECTOR))[0], kind, loc=MR['id'])
    # 03 corridor
    out(f'{sfx}03_hallway', F2.corridor(kind, 'read')[0], kind, loc='correction.corridor')
    if kind == 'desktop':
        out(f'{sfx}03a_leave', F2.corridor(kind, 'walk')[0], kind, loc='correction.corridor')
    # 04 return, both preparations
    out(f'{sfx}04a_return_seated', F2.meeting(kind, 'seat_hold', mt(HERO_T['own_seat'], DISPLAY, TABLE))[0], kind, loc=MR['id'])
    out(f'{sfx}04b_return_standing', F2.meeting(kind, 'stand_return', mt(HERO_T['stand_near_entry'], DISPLAY, TABLE))[0], kind, loc=MR['id'])
    # 05 decision, both preparations (labels are live DOM, never baked)
    out(f'{sfx}05a_decision_seated', F2.meeting(kind, 'seat_decide', mt(HERO_T['own_seat'], TABLE, DIRECTOR, DISPLAY))[0], kind, loc=MR['id'])
    out(f'{sfx}05b_decision_standing', F2.meeting(kind, 'stand_decide', mt(HERO_T['stand_near_entry'], TABLE, DIRECTOR, DISPLAY))[0], kind, loc=MR['id'])
    # 06 acts
    out(f'{sfx}06a_speak_standing', F2.meeting(kind, 'stand_speak', mt(HERO_T['stand_near_entry'], TABLE))[0], kind, loc=MR['id'])
    out(f'{sfx}06a_speak_seated', F2.meeting(kind, 'seat_speak', mt(HERO_T['own_seat'], TABLE))[0], kind, loc=MR['id'])
    out(f'{sfx}06b_private', F2.meeting('portrait_east' if kind == 'portrait' else kind, 'private', mt(HERO_T['near_director'], DIRECTOR))[0], kind, loc=MR['id'])
    out(f'{sfx}06c_pass_standing', F2.meeting(kind, 'stand_silent', mt(HERO_T['stand_near_entry']))[0], kind, loc=MR['id'])
    out(f'{sfx}06c_pass_seated', F2.meeting(kind, 'seat_silent', mt(HERO_T['own_seat']))[0], kind, loc=MR['id'])
    # 07 boundary (from each act; standing prep shown, seated identical treatment)
    if kind == 'desktop':
        out('D07a_held', F2.meeting(kind, 'stand_speak', mt(HERO_T['stand_near_entry'], TABLE), finishes=dict(mira=0.5, director=0.35))[0], kind, loc=MR['id'])
        out('D07b_withdraw', F2.meeting(kind, 'stand_speak', mt(HERO_T['stand_near_entry']), finishes=dict(mira=0.15, director=0.1), paint_op=0.55)[0], kind, loc=MR['id'])
    for st, nm in (('stand_speak', 'speak'), ('private', 'private'), ('stand_silent', 'pass')):
        if kind == 'portrait' and nm != 'speak':
            continue
        s, _ = F2.meeting(kind, st, [(0, 0, 50, 0.01, 0.01)], finishes=dict(mira=0.0, director=0.0), paint_op=0.0, ink_hero=True, display_dim=1.0)
        out(f'{sfx}07_boundary_{nm}', s, kind, role='boundary', loc=MR['id'])
    # 08 reveal: public motif only (no text)
    W, H = (1920, 1080) if kind == 'desktop' else (780, 1688)
    room, info = F2.meeting(kind, 'stand_speak', [(0, 0, 50, 0.01, 0.01)], finishes=dict(mira=0.0, director=0.0), paint_op=0.0, ink_hero=True, display_dim=1.0)
    lift = f'<rect width="{W}" height="{H}" fill="#EAE2D0"/><g opacity="0.22">{room}</g>' + F2.author_page(W * (0.62 if kind == 'desktop' else 0.5), H * 0.5, 300 if kind == 'desktop' else 360, ang=-5, op=0.9)
    out(f'{sfx}08a_lift', lift, kind, role='reveal-public-motif')
    pw = 470 if kind == 'desktop' else 400
    pcx, pcy = (560, 540) if kind == 'desktop' else (390, 470)
    base = f'<rect width="{W}" height="{H}" fill="#EAE2D0"/>' + F2.author_page(pcx, pcy, pw, ang=-3)
    out(f'{sfx}08b_loading', base + f'<path d="M{pcx - 60},{pcy + pw * 0.95} q60,-40 120,0" fill="none" stroke="#5E5953" stroke-width="2" stroke-dasharray="4 6"/>', kind, role='reveal-public-motif')
    out(f'{sfx}08c_reveal_layout', base, kind, role='reveal-public-motif', note='host-supplied author text is overlaid as live DOM; never baked')
    out(f'{sfx}08d_retry', base + f'<path d="M{pcx - 60},{pcy + pw * 0.95} q30,-20 50,-6 M{pcx + 10},{pcy + pw * 0.95 - 6} q30,6 50,6" fill="none" stroke="#5E5953" stroke-width="2"/>', kind, role='reveal-public-motif')

# runtime plates: per location x camera, no actors, no text, no attention mask
for L, fn in ((G.OPEN_PLAN, F2.open_plan), (G.CORRIDOR, F2.corridor), (G.MEETING, F2.meeting)):
    short = L['id'].split('.')[1]
    for kind in ('desktop', 'portrait'):
        s, _ = fn(kind, layer=dict(paint=False, raw=False, slide=False)) if fn is not F2.meeting else fn(kind, layer=dict(paint=False, raw=False, slide=False))
        out(f'P_{short}_{kind}_graphite', s, kind, role='plate-graphite', loc=L['id'])
        s, _ = fn(kind, layer=dict(lines=False, raw=False, base=False, mask=False)) if fn is not F2.meeting else fn(kind, layer=dict(lines=False, raw=False, base=False, mask=False))
        out(f'P_{short}_{kind}_paint', s, kind, role='plate-paint', loc=L['id'])
# extra meeting-room portrait plates for beat-specific recipes (M02b portrait_room, M06b portrait_east)
for kind in ('portrait_room', 'portrait_east'):
    s, _ = F2.meeting(kind, layer=dict(paint=False, raw=False, slide=False))
    out(f'P_meeting_room_{kind}_graphite', s, 'portrait', role='plate-graphite', loc=MR['id'])
    s, _ = F2.meeting(kind, layer=dict(lines=False, raw=False, base=False, mask=False))
    out(f'P_meeting_room_{kind}_paint', s, 'portrait', role='plate-paint', loc=MR['id'])
# decision layer stack (standing)
s, _ = F2.meeting('desktop', 'stand_decide', mt(HERO_T['stand_near_entry'], TABLE, DIRECTOR, DISPLAY), layer=dict(lines=False, paint=False, base=False, slide=False))
out('L4_actors', s, 'desktop', role='layer-reference', bg='none')
cam = F2.cam_for(MR, 'desktop')
mk = ''.join(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fff"/>' for cx, cy, rx, ry in F2.blob_screen(cam, mt(HERO_T['stand_near_entry'], TABLE, DIRECTOR, DISPLAY)))
out('L3_mask', f'<rect width="1920" height="1080" fill="#111"/><g filter="url(#island)">{mk}</g>', 'desktop', role='layer-reference', bg='#111')
json.dump(jobs, open('fr3/jobs.json', 'w'))
json.dump(MANIFEST, open('fr3/manifest.json', 'w'), indent=1)
print(len(jobs))
