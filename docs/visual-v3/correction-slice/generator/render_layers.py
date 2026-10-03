import json, os, frames as F
from frames import *
from scene3d import LAYER
jobs=[]
_, i0 = meeting_room('decision', hero_pose=DEC_POSE, hero_pos=POS['hero_stand'])
h, m, ch, d = i0['hand'], i0['mira_head'], i0['chair'], i0['director']
tab = i0['cam'].p(0, 0.74, 5.6)
blob = [(i0['hero'][0], i0['hero'][1] - i0['hero'][2] * 3.6, i0['hero'][2] * 2.8, i0['hero'][2] * 4.4), ((i0['screen'][0] + i0['screen'][2]) / 2, (i0['screen'][1] + i0['screen'][3]) / 2, 260, 150),
        (m[0], m[1] + 60, 120, 200), (ch[0], ch[1] + 40, 120, 160), (d[0], d[1], 110, 120), (tab[0] - 150, tab[1], 300, 120)]
json.dump(dict(blob=blob, hand=list(map(float,h)), mira=list(map(float,m)), chair=list(map(float,ch)), director=list(map(float,d)),
               hero=list(map(float,i0['hero'])), screen=list(map(float,i0['screen'])), door=list(map(float,i0['door']))), open('fr/decision_anchors.json','w'))
def render(name, bg='#E4DAC6', **flags):
    for k in LAYER: LAYER[k] = True
    LAYER['slide'] = True
    LAYER.update(flags)
    s, _ = meeting_room('decision', hero_pose=DEC_POSE, hero_pos=POS['hero_stand'], cups_moved=True, blob=blob)
    open(f'fr/{name}.html','w').write(F.page_html(s, bg=bg))
    jobs.append([os.path.abspath(f'fr/{name}.html'), os.path.abspath(f'fr/{name}.png'), 1920, 1080, 1])
render('L1_graphite', paint=False, raw=False, slide=False)
render('L2_paint', lines=False, raw=False, base=False, mask=False, slide=True)
render('L4_actors', bg='none', lines=False, paint=False, base=False, slide=False)
for k in LAYER: LAYER[k] = True
# mask layer
mk = ''.join(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fff"/>' for cx, cy, rx, ry in blob)
open('fr/L3_mask.html','w').write(F.page_html(f'<rect width="1920" height="1080" fill="#111"/><g filter="url(#island)">{mk}</g>', bg='#111'))
jobs.append([os.path.abspath('fr/L3_mask.html'), os.path.abspath('fr/L3_mask.png'), 1920, 1080, 1])
json.dump(jobs, open('fr/jl.json','w'))
