from rig import body, pose

NPC_PAL = ['#5E6672', '#6E705F', '#6A5E66', '#3E3F45', '#8C857A', '#3C4A5E', '#6C4A45', '#7A7F86']
SKINS = ['#E6C6A8', '#D7AE8C', '#C99A78', '#B08262', '#94684C', '#74503B', '#573A2B']
HAIRS = ['#1E1A18', '#2B211B', '#4A3426', '#6B4B33', '#8F8A83', '#B9B2A6']

FAMILIES = {
    'long':    dict(heads=7.8, sb=0.62, shb=0.76, chest=0.68, waist=0.54, hip=0.66, limb=0.92),
    'broad':   dict(heads=7.2, sb=0.88, shb=1.10, chest=1.02, waist=0.92, hip=0.84, limb=1.22, neck_w=0.31, head_w=0.80),
    'soft':    dict(heads=7.0, sb=0.70, shb=0.88, chest=0.98, waist=1.0, hip=1.04, limb=1.18, head_w=0.78),
    'slight':  dict(heads=7.2, sb=0.56, shb=0.68, chest=0.64, waist=0.50, hip=0.74, limb=0.82, neck_w=0.2, head_w=0.70),
    'compact': dict(heads=6.7, sb=0.74, shb=0.92, chest=0.88, waist=0.80, hip=0.82, limb=1.12, head_w=0.8),
    'elder':   dict(heads=7.0, sb=0.66, shb=0.80, chest=0.82, waist=0.82, hip=0.82, stoop=1.4),
}
FAM_TXT = {
    'long': 'Long. 7.8 heads, narrow shoulders, length in the legs.',
    'broad': 'Broad. Shoulders wider than hips, heavier limbs, thicker neck.',
    'soft': 'Soft. Mass at waist and hip, rounder line, same height range.',
    'slight': 'Slight. Narrow everything, thin neck, hips wider than shoulders.',
    'compact': 'Compact. 6.7 heads, short-limbed and dense.',
    'elder': 'Elder. Stoop is a rig value: neck forward, upper back rounded.',
}
GARMENTS = {
    'long coat': dict(coat='long', hem=2.0),
    'short jacket': dict(coat='jacket', hem=3.3),
    'knit': dict(coat='sweater', hem=3.6, open=False),
    'shirt': dict(coat='shirt', hem=3.6, open=False, pal=dict(inner='#B9B3A6')),
    'dress + coat': dict(coat='dress', hem=2.5, flare=0.2, open=False, pal=dict(trousers='#3B3434')),
    'parka': dict(coat='long', hem=2.6, flare=0.14, shb=0.92, chest=0.86, waist=0.80),
}


def npc(fam='long', coat_i=0, skin_i=2, hair='short', hair_i=0, garment='short jacket', **kw):
    d = dict(FAMILIES[fam])
    d.update(GARMENTS[garment])
    d.update(kw)
    pal = dict(coat=NPC_PAL[coat_i % len(NPC_PAL)], trousers='#34363F', skin=SKINS[skin_i], hair=HAIRS[hair_i],
               inner='#A8A196', shoe='#1F1D1C')
    pal.update(d.pop('pal', {}))
    return body(hair=hair, pal=pal, **d)
