import json, os, frames as F
from frames import *
os.makedirs('fr', exist_ok=True)
jobs = []
def out(name, svg_inner, mobile=False):
    if mobile:
        html = F.page_html(svg_inner, W=390, H=844, vb=(0, 0, 780, 1688))
        open(f'fr/{name}.html', 'w').write(html)
        jobs.append([os.path.abspath(f'fr/{name}.html'), os.path.abspath(f'fr/{name}.png'), 390, 844, 2])
    else:
        open(f'fr/{name}.html', 'w').write(F.page_html(svg_inner))
        jobs.append([os.path.abspath(f'fr/{name}.html'), os.path.abspath(f'fr/{name}.png'), 1920, 1080, 1])

T = {
 'desk': 'Mira’s deck is on the shared drive this morning.',
 'meet': 'Mira presents the forecast. I built it.',
 'hall': 'Ten minutes’ break. The summary is still in my hand.',
 'ret': 'Same room. My chair by the glass is still empty.',
 'dec': '“Before we close — does anyone have anything to add?”',
 'speak': '“The revision on slide four is mine —”',
 'priv': '“Mira, have you got a minute after this —”',
 'sil': 'I turn the summary face down. I let it stand.',
}
# 01 desk
s, i = desk_scene(text_top=T['desk']); out('F01_desk', s)
s, i = desk_scene(loops=False); out('F01_desk_pre', s)
# 02 meeting
s, i = meeting_room('present', text_top=T['meet']); out('F02_meeting', s)
# 03 hallway
s, i = hallway_scene(text_top=T['hall'], hero_pos=(-0.85, 4.7)); out('F03_hallway', s)
s, i = hallway_scene(hero_pose=POSES['walk'], hero_pos=(0.2, 5.6), state='walk'); out('F03_hallway_leave', s)
# 04 return
def ret_blob(info, extra=()):
    ox, oy, hu = info['hero']
    return [(ox, oy - hu * 3.6, hu * 2.8, hu * 4.4), (info['screen'][0] / 2 + info['screen'][2] / 2, (info['screen'][1] + info['screen'][3]) / 2, 260, 150), *extra]
_, i0 = meeting_room('return', hero_pose=RET_POSE, hero_pos=POS['hero_stand'])
tab = i0['cam'].p(0, 0.74, 5.6)
s, i = meeting_room('return', hero_pose=RET_POSE, hero_pos=POS['hero_stand'], cups_moved=True, text_top=T['ret'],
                    blob=ret_blob(i0, [(tab[0] - 150, tab[1], 300, 120), (i0['chair'][0], i0['chair'][1] + 40, 110, 160)]))
out('F04_return', s)
# 05 decision
_, i0 = meeting_room('decision', hero_pose=DEC_POSE, hero_pos=POS['hero_stand'])
h, m, ch, d = i0['hand'], i0['mira_head'], i0['chair'], i0['director']
HUNG = [hung(h[0] + 30, h[1] - 40, h[0] + 130, h[1] - 170, 'Say the forecast is mine'),
        hung(m[0], m[1] - 10, m[0] - 60, m[1] - 120, 'Ask Mira after the meeting', anchor='end'),
        hung(ch[0] + 10, ch[1] + 10, ch[0] + 40, ch[1] + 150, 'Let it stand')]
blob = ret_blob(i0, [(m[0], m[1] + 60, 120, 200), (ch[0], ch[1] + 40, 120, 160), (d[0], d[1], 110, 120), (tab[0] - 150, tab[1], 300, 120)])
s, i = meeting_room('decision', hero_pose=DEC_POSE, hero_pos=POS['hero_stand'], cups_moved=True, text_top=T["dec"], hung_items=HUNG, blob=blob)
out('F05_decision', s)
# 06 enactments
s, i = meeting_room('speak', hero_pose=SPEAK_POSE, hero_pos=POS['hero_stand'], cups_moved=True, text_top=T['speak'],
                    blob=ret_blob(i0, [(tab[0] - 100, tab[1], 420, 130), (d[0], d[1], 120, 130)]))
bracket = ''
ox, oy, hu = i['hero']
bracket = (f'<path d="M{ox - hu * 1.8},{oy - hu * 8.6} h-12 v{hu * 8.9} h12 M{ox + hu * 2.2},{oy - hu * 8.6} h12 v{hu * 8.9} h-12" fill="none" stroke="{F.RED}" stroke-width="2"/>')
s += bracket; out('F06a_speak', s)
_, j0 = meeting_room('private', hero_pose=APPROACH_POSE, hero_pos=(-1.55, 4.95), mira_pose=MIRA_PACK, mira_pos=(-2.65, 5.75))
ox2, oy2, hu2 = j0['hero']
s, i = meeting_room('private', hero_pose=APPROACH_POSE, hero_pos=(-1.55, 4.95), mira_pose=MIRA_PACK, mira_pos=(-2.65, 5.75), cups_moved=True, empty_chair=True, text_top=T['priv'],
                    blob=[(ox2 - hu2 * 1.2, oy2 - hu2 * 3.6, hu2 * 3.6, hu2 * 4.6), (j0['door'][0], j0['door'][1], 120, 260)])
s += (f'<path d="M{ox2 - hu2 * 1.6},{oy2 - hu2 * 8.4} h-10 v{hu2 * 8.7} h10 M{ox2 + hu2 * 2.0},{oy2 - hu2 * 8.4} h10 v{hu2 * 8.7} h-10" fill="none" stroke="{F.RED}" stroke-width="2"/>')
out('F06b_private', s)
s, i = meeting_room('silence', hero_pose=SILENT_POSE, hero_pos=POS['hero_seat'], cups_moved=True, text_top=T['sil'])
ox3, oy3, hu3 = i['hero']
s += (f'<path d="M{ox3 - hu3 * 2.0},{oy3 - hu3 * 6.6} h-10 v{hu3 * 6.9} h10 M{ox3 + hu3 * 3.2},{oy3 - hu3 * 6.6} h10 v{hu3 * 6.9} h-10" fill="none" stroke="{F.RED}" stroke-width="2"/>')
out('F06c_silence', s)
# 07 boundary states
s, i = meeting_room('speak', hero_pose=SPEAK_POSE, hero_pos=POS['hero_stand'], cups_moved=True,
                    blob=ret_blob(i0, [(tab[0] - 100, tab[1], 420, 130)]), others_finish=dict(mira=0.5, director=0.3))
out('F07a_held', s)
s, i = meeting_room('boundary', hero_pose=SPEAK_POSE, hero_pos=POS['hero_stand'], cups_moved=True, paint_op=0.55,
                    blob=[(i['hero'][0], i['hero'][1] - i['hero'][2] * 3.6, i['hero'][2] * 2.4, i['hero'][2] * 4.3)],
                    others_finish=dict(mira=0.15, director=0.1, c0=0.1, c1=0.1, c2=0.1, c3=0.1))
out('F07b_withdraw', s)
out('F07_boundary', reveal('boundary'))
# 08 reveal
out('F08a_lift', reveal('lift'))
out('F08b_page', reveal('page'))
out('F08_reveal', reveal('final'))
# ---------------- mobile
MC = dict(W=780, H=1688, f=1150, hy=720, eye=1.5)
MM = dict(W=780, H=1688, f=1100, hy=700, eye=1.5, cx=330, camx=-2.2, camz=0.8)
s, i = desk_scene(camcfg=dict(MC, cx=390, f=1150, hy=760, eye=1.55, camx=0.1, camz=0.2), text_top=None); out('M01_desk', s, True)
s, i = meeting_room('present', camcfg=MM); out('M02_meeting', s, True)
_, k0 = meeting_room('decision', hero_pose=DEC_POSE, hero_pos=POS['hero_stand'], camcfg=MM)
h, m, ch = k0['hand'], k0['mira_head'], k0['chair']
hk = [hung(h[0] + 20, h[1] - 20, 330, 330, 'Say the forecast is mine', size=36),
      hung(m[0], m[1], 740, 250, 'Ask Mira after', size=36, anchor='end'),
      hung(ch[0] + 10, ch[1] + 10, 60, 1400, 'Let it stand', size=36)]
s, i = meeting_room('decision', hero_pose=DEC_POSE, hero_pos=POS['hero_stand'], cups_moved=True, hung_items=hk, camcfg=MM,
                    blob=[(k0['hero'][0], k0['hero'][1] - k0['hero'][2] * 3.6, k0['hero'][2] * 3, k0['hero'][2] * 4.6), (m[0], m[1] + 60, 110, 220), (k0['screen'][0] / 2 + k0['screen'][2] / 2, k0['screen'][1] + 90, 220, 170), (ch[0], ch[1] + 60, 120, 200)])
s += F.italic(40, 120, '“Anything to add?”', 40)
out('M05_decision', s, True)
s, i = meeting_room('speak', hero_pose=SPEAK_POSE, hero_pos=POS['hero_stand'], cups_moved=True, camcfg=MM,
                    blob=[(k0['hero'][0], k0['hero'][1] - k0['hero'][2] * 3.8, k0['hero'][2] * 3, k0['hero'][2] * 4.8)])
s += F.italic(40, 120, '“The revision on slide four', 40) + F.italic(40, 172, 'is mine —”', 40)
out('M06_speak', s, True)
room, _ = meeting_room('boundary', blob=[(0, 0, 1, 1)], hero_pose=SPEAK_POSE, hero_pos=POS['hero_stand'], paint_op=0.0, ink_hero=True,
                       camcfg=MM, others_finish=dict(mira=0.0, director=0.0, c0=0.0, c1=0.0, c2=0.0, c3=0.0))
out('M07_boundary', '<rect width="780" height="1688" fill="#EAE2D0"/>' + room + F.italic(40, 120, 'That is where your', 40) + F.italic(40, 172, 'version stops.', 40), True)
out('M08_reveal', reveal('final', W=780, H=1688, mobile=True), True)
json.dump(jobs, open('fr/jobs.json', 'w'))
print(len(jobs))
