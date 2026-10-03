"""Write geometry/source.json and assets.json for the r3 export, with sha256 hashes."""
import json, os, hashlib, glob
from PIL import Image
import geometry as G

ROOT = '../export4/docs/visual-v3/correction-slice'
ASSET_REVISION = 'correction-assets-r4'
os.makedirs(f'{ROOT}/geometry', exist_ok=True)

# attention targets per beat, in location metres: (x, y, z, rx, ry) ellipsoid half-extents
HERO_T = {'own_seat': [0.71, 1.0, 3.1, 0.95, 1.2], 'stand_near_entry': [1.2, 1.0, 3.7, 0.9, 1.25], 'near_director': [5.6, 1.0, 5.4, 0.95, 1.25]}
DISPLAY = [3.4, 1.6, 7.35, 1.7, 0.9]
TABLE = [3.4, 0.8, 4.85, 1.1, 0.6]
DIRECTOR = [4.75, 1.0, 5.9, 0.8, 1.0]
MIRA = [5.25, 1.0, 6.85, 0.7, 1.2]
M = G.MEETING['id']
BEATS = [
    dict(beat='01_desk', location=G.OPEN_PLAN['id'], hero_anchor='at_desk', route_out='desk_to_P0', attention=[[*G.OPEN_PLAN['hero_anchors']['at_desk']['root'][:1], 1.0, G.OPEN_PLAN['hero_anchors']['at_desk']['root'][1], 0.75, 1.15], [4.65, 1.05, 2.45, 0.6, 0.45]], note='desk island from monitor + hero; no other people in open plan'),
    dict(beat='02_meeting', location=M, hero_anchor='own_seat', attention=[HERO_T['own_seat'], DISPLAY]),
    dict(beat='02_meeting_room_portrait', location=M, hero_anchor='own_seat', camera='portrait_room', attention=[DISPLAY, MIRA, DIRECTOR]),
    dict(beat='03_hallway', location=G.CORRIDOR['id'], hero_anchor='reading', attention=[], note='Mira and director seen through glass via see_through transform; same identities'),
    dict(beat='04a_return_seated', location=M, hero_anchor='own_seat', attention=[HERO_T['own_seat'], DISPLAY, TABLE]),
    dict(beat='04b_return_standing', location=M, hero_anchor='stand_near_entry', attention=[HERO_T['stand_near_entry'], DISPLAY, TABLE]),
    dict(beat='05a_decision_seated', location=M, hero_anchor='own_seat', attention=[HERO_T['own_seat'], TABLE, DIRECTOR, DISPLAY]),
    dict(beat='05b_decision_standing', location=M, hero_anchor='stand_near_entry', attention=[HERO_T['stand_near_entry'], TABLE, DIRECTOR, DISPLAY]),
    dict(beat='06a_speak', location=M, hero_anchor='own_seat | stand_near_entry', attention=['<hero anchor>', TABLE], stop='hero begins speaking; stop before any reaction'),
    dict(beat='06b_private', location=M, hero_anchor='near_director', route='seat_to_near_director | stand_to_near_director', camera_portrait='portrait_east', attention=[HERO_T['near_director'], DIRECTOR],
         stop='hero bends toward seated director and begins the request; stop before any response. Mira does not move.'),
    dict(beat='06c_pass', location=M, hero_anchor='own_seat | stand_near_entry', attention=['<hero anchor>'], stop='hero holds silence in the prepared posture; no agreement cue'),
    dict(beat='07_boundary', location=M, attention=[], note='NPC finishes fade to 0, room paint to 0, hero ink only; identical for all acts'),
]


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


src = G.to_json()
src['beats'] = BEATS
src['attention_target_format'] = '[x, y, z, rx, ry] metres, location coordinates; projected with the active camera recipe'
json.dump(src, open(f'{ROOT}/geometry/source.json', 'w'), indent=1, ensure_ascii=False)
import collision as C
ok, rows = C.audit()
json.dump(dict(geometry_revision=G.GEOMETRY_REVISION, hero_footprint_radius=C.HERO_R, actor_footprint_radius=C.ACTOR_R, sample_step=C.STEP,
               all_ok=ok, checks=rows), open(f'{ROOT}/geometry/collision_audit.json', 'w'), indent=1)
assert ok, 'collision audit failed'

MAN = {m['name']: m for m in json.load(open('fr3/manifest.json'))}
assets, refs = [], []
for p in sorted(glob.glob(f'{ROOT}/runtime/plates/*.webp')):
    n = os.path.basename(p)[:-5]
    _, rest = n.split('_', 1)
    loc_short, cam, layer = None, None, rest.rsplit('_', 1)[1]
    for ls in ('meeting_room', 'open_plan', 'corridor'):
        if rest.startswith(ls):
            loc_short, cam = ls, rest[len(ls) + 1:].rsplit('_', 1)[0]
    w, h = Image.open(p).size
    assets.append(dict(id=n, path=os.path.relpath(p, ROOT), revision=ASSET_REVISION, width=w, height=h,
                       layer_role='L1_plate_graphite' if layer == 'graphite' else 'L2_plate_paint', location=f'correction.{loc_short}', camera=cam,
                       viewport='portrait' if cam.startswith('portrait') else 'desktop', visibility='public', preload='scene',
                       reduced_motion_fallback='same asset (static plate)', sha256=sha(p)))
PROPS = {'summary_prop': ('L4_hero_prop', 'hero-owned summary; no text; follows hero hand attachment anchors'),
         'display_texture': ('L2_display_surface', 'neutral texture mapped to display surface corners; live DOM title “Mira’s forecast” overlaid'),
         'author_page': ('L5_reveal_public_motif', 'public reveal motif only; host text overlaid after boundary')}
for p in sorted(glob.glob(f'{ROOT}/runtime/props/*.png')):
    n = os.path.basename(p)[:-4]
    w, h = Image.open(p).size
    role, note = PROPS[n]
    assets.append(dict(id=n, path=os.path.relpath(p, ROOT), revision=ASSET_REVISION, width=w, height=h, layer_role=role,
                       location='correction.*' if n != 'display_texture' else M, viewport='both', visibility='public',
                       preload='scene' if n != 'author_page' else 'after-boundary-public', reduced_motion_fallback='same asset', note=note, sha256=sha(p)))
for p in sorted(glob.glob(f'{ROOT}/reference/**/*.webp', recursive=True)):
    n = os.path.basename(p)[:-5]
    m = MAN.get(n, {})
    w, h = Image.open(p).size
    refs.append(dict(id=n, path=os.path.relpath(p, ROOT), revision=ASSET_REVISION, width=w, height=h, role=m.get('role', 'layer-reference'),
                     location=m.get('location'), viewport='portrait' if n.startswith('M') else 'desktop', runtime=False,
                     reduced_motion_still=n.startswith(('D06', 'M06', 'D07', 'M07', 'D08', 'M08')), sha256=sha(p)))

PRIVATE = [dict(id=k, kind='text', source='host-supplied after boundary (Gold author account)', path=None, preload=False, visibility='private',
                rule='never in plates, frames, props, scene preload or any pre-boundary payload; identical for all three acts')
           for k in ('reveal.account', 'reveal.why', 'reveal.aftermath')]

out = dict(revision=ASSET_REVISION, geometry_revision=G.GEOMETRY_REVISION, hash='sha256', units='px',
           rules=['No raster contains story text, names, numbers or the author account.', 'Runtime paths are repo-relative; no /_blob URLs.',
                  'Private reveal items are classified separately and never preloaded.'],
           runtime_public=assets, reference_only=refs, private_reveal=PRIVATE,
           superseded='Replaces correction-assets-r3 entirely. r4 changed pixels: D01_desk, M01_desk, P_open_plan_{desktop,portrait}_{graphite,paint}; every other file is byte-identical to r3 and keeps its hash.')
json.dump(out, open(f'{ROOT}/assets.json', 'w'), indent=1, ensure_ascii=False)
print(len(assets), len(refs))
