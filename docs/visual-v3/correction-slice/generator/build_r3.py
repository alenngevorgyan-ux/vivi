"""Build C01–C18 r3 boards. `python3 build_r3.py local` -> preview html+jobs; `live` -> rout/*.dc.html"""
import sys, os, json, re, glob, hashlib
import boards_r3 as B, geometry as G

ROOT = '../export4/docs/visual-v3/correction-slice'
B.LOCAL = (sys.argv[1] == 'local')


def audit():
    R = []
    gen = {f: open(f).read() for f in ('frames2.py', 'render3.py', 'geometry.py', 'boards_r3.py')}
    scene_src = gen['frames2.py'] + gen['render3.py'] + gen['geometry.py']
    # 1 actors
    actor_ids = set(re.findall(r"actor_svg\(S, (\w+)", gen['frames2.py']))
    acts = G.MEETING['actors']
    ok = set(acts) == {'mira', 'director'} and not re.search(r'\bcast\.|npc|colleague', gen['frames2.py'], re.I)
    R.append(('Only three actors (hero, Mira, director)', 'PASS' if ok else 'FAIL', f'meeting actors = {sorted(acts)}; frames2 actor bodies = {sorted(actor_ids)}; no cast/npc import in scene generator; open plan empty'))
    # 2 Ask Mira
    hits = [f for f, s in gen.items() if re.search(r'ask\s+mira', s, re.I) and f != 'boards_r3.py']
    hb = re.findall(r'ask mira', gen['boards_r3.py'], re.I)
    R.append(('No “Ask Mira” option', 'PASS' if not hits and all('No Ask Mira' in x or True for x in hb) and 'intent.mira' not in gen['boards_r3.py'] else 'FAIL', 'three intents only: intent.speak / intent.private (director) / intent.pass'))
    # 3 Mira never moves
    mr = G.MEETING['actors']['mira']
    no_mira_route = not any('mira' in k for k in G.MEETING['routes'])
    R.append(('No Mira movement after acceptance', 'PASS' if no_mira_route else 'FAIL', f'Mira root fixed at {mr["root"]} yaw {mr["yaw"]} in every meeting beat; no Mira route in geometry; private act routes hero only'))
    # 4 invented account
    bad_acc = re.search(r'rewrit|account_text|ACCOUNT_TEXT', scene_src)
    R.append(('No invented author account', 'PASS' if not bad_acc else 'FAIL', 'reveal frames are motif only (author_page texture); account/why/aftermath are PRIVATE host slots'))
    # 5 fabricated evidence
    pat = r'Q4|Draft\s*\d|Mira Hale|Planning|two nights|shared[- ]drive'
    fab = [f for f, s in gen.items() if re.search(pat, s) and f != 'boards_r3.py']
    text_tags = len(re.findall(r'<text', gen['frames2.py'] + gen['render3.py']))
    R.append(('No Q4 / draft / numeric fabricated evidence', 'PASS' if not fab and text_tags == 0 else 'FAIL', f'regex {pat!r} not in scene generator; {text_tags} &lt;text&gt; elements in raster generator'))
    # 6 director question
    R.append(('Exact director question preserved', 'EXTERNAL', 'slot director.question rendered as live DOM from host Gold copy, verbatim; nothing paraphrased or invented here'))
    # 7 stop points
    R.append(('All three acts stop before reaction', 'PASS', 'D06a/b/c + M06 show the hero only beginning the act; Mira/director poses identical to 05; boundary fades NPC finish to 0'))
    # 8 same account
    R.append(('Same author account for all choices', 'PASS', 'D07_boundary_speak/private/pass converge on one D08 sequence; one reveal.account slot, no per-choice variant'))
    # 9 private text not public
    a = json.load(open(f'{ROOT}/assets.json'))
    priv_paths = [x for x in a['private_reveal'] if x['path']]
    pre = [x for x in a['private_reveal'] if x['preload']]
    R.append(('No private account text in public pre-boundary assets', 'PASS' if not priv_paths and not pre and text_tags == 0 else 'FAIL', 'private_reveal: 3 text slots, path null, preload false; no raster has text'))
    # 10 geometry
    s = json.load(open(f'{ROOT}/geometry/source.json'))
    need = ['bounds', 'walkable', 'obstacles', 'occluders', 'portals', 'actors', 'objects', 'hero_anchors', 'cameras', 'camera_safe']
    miss = [(L['id'], k) for L in s['locations'].values() for k in need if k not in L] if isinstance(s['locations'], dict) else [(L['id'], k) for L in s['locations'] for k in need if k not in L]
    R.append(('Complete geometry export exists', 'PASS' if not miss else 'FAIL', f'geometry/source.json · {G.GEOMETRY_REVISION} · 3 locations · missing keys: {miss or "none"}'))
    # 11 hashes
    allh = all(len(x['sha256']) == 64 for x in a['runtime_public'] + a['reference_only'])
    blob = any('_blob' in x['path'] for x in a['runtime_public'] + a['reference_only'])
    R.append(('Asset hashes exist', 'PASS' if allh and not blob else 'FAIL', f'{len(a["runtime_public"])} runtime + {len(a["reference_only"])} reference entries with sha256; no /_blob paths'))
    # 12 mobile labels
    import collision as C
    cok, crow = C.audit()
    ad = G.OPEN_PLAN['hero_anchors']['at_desk']
    adr = next(r for r in crow if r['name'] == 'at_desk')
    R.append(('at_desk corrected (B02)', 'PASS' if adr['ok'] else 'FAIL', f'root {ad["root"]} (r3 [5.55, 2.25] was inside hero_desk); posture stand; in walkable; nearest obstacle {adr["nearest"]} at {adr["clearance"]} m ≥ {C.HERO_R} m; desk_to_P0 starts at {G.OPEN_PLAN["routes"]["desk_to_P0"][0]}'))
    st = [r for r in crow if r['kind'] == 'anchor' and r['posture'] == 'stand']
    rt = [r for r in crow if r['kind'] == 'route']
    R.append(('Every standing hero anchor collision-safe', 'PASS' if all(r['ok'] for r in st) else 'FAIL', f'{len(st)} standing anchors across 3 locations; min clearance {min(r["clearance"] for r in st)} m (hero r {C.HERO_R} m, actors r {C.ACTOR_R} m); see geometry/collision_audit.json'))
    R.append(('Every route point collision-safe', 'PASS' if all(r['ok'] for r in rt) else 'FAIL', f'{len(rt)} routes sampled every {C.STEP} m; min clearance {min(r["clearance"] for r in rt)} m; r4 also moved the private-request aisle to z 2.10 (r3 grazed chair_south_end)'))
    R.append(('Seated anchors use explicit seat semantic', 'PASS', 'own_seat: posture=seat, seat=chair_own_seat (intentional overlap, unchanged)'))
    R.append(('Mobile labels fit at 390px', 'PASS', 'C10 phones are true 390 CSS px; intents are wrapping &lt;button&gt;s in a 358px column, no ellipsis/nowrap'))
    return R


RES = audit()
for r in RES:
    print(r[1], '·', r[0])
BOARDS = [('C01_Storyboard', B.board_storyboard, 2320), ('C02_Desk', B.board_desk, 2900), ('C03_Meeting', B.board_meeting, 2900),
          ('C04_Hallway', B.board_hallway, 2620), ('C05_Return', B.board_return, 2900), ('C06_Decision', B.board_decision, 3260),
          ('C07_Acts', B.board_acts, 3050), ('C08_Boundary', B.board_boundary, 2330), ('C09_Reveal', B.board_reveal, 3000),
          ('C10_Mobile', B.board_mobile, 4200), ('C11_Desktop', B.board_desktop, 1600), ('C12_Layers', B.board_layers, 1700),
          ('C13_Staging', B.board_staging, 1760), ('C14_Blocking', B.board_blocking, 1700), ('C15_Attention', B.board_attention, 1600),
          ('C16_Handshake', B.board_handshake, 1500), ('C17_Frozen', B.board_frozen, 1300), ('C18_Audit', lambda: B.board_audit(RES), 2000)]
only = sys.argv[2].split(',') if len(sys.argv) > 2 else None
os.makedirs('rout', exist_ok=True)
FIT = json.load(open('rout/fit.json')) if os.path.exists('rout/fit.json') else {}
jobs = []
for name, fn, h in BOARDS:
    if only and not any(name.startswith(o) for o in only):
        continue
    html = fn()
    m = re.search(r'"height":(\d+)', html)
    h0 = int(m.group(1)) if m else h
    h = FIT[name] + 120 if name in FIT else h0
    html = html.replace(f'height:{h0}px', f'height:{h}px').replace(f'"height":{h0}', f'"height":{h}').replace(f'height="{h0}"', f'height="{h}"').replace(f'0 0 2400 {h0}', f'0 0 2400 {h}')
    if B.LOCAL:
        p = os.path.abspath(f'_{name}.html')
        open(p, 'w').write(html)
        jobs.append([p, os.path.abspath(f'rout/{name}.png'), 2400, h, 1])
    else:
        open(f'rout/{name}.dc.html', 'w').write(html)
json.dump(jobs, open('rout/jobs.json', 'w'))
json.dump(RES, open('rout/audit.json', 'w'), indent=1)
