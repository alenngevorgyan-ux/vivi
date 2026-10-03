"""THE CORRECTION — source-safe frames (r3). Location coordinates from geometry.py; no baked text."""
import math
import numpy as np
from rig import body, pose, solve, P2
from render import figure, fmt, shade, uid, mix, FILTERS
from kit import gline, pencil, EXTRA_FILTERS
from scene3d import Cam, Stage, Obj, dpath, LAYER
from frames import HERO, MIRA, DIRECTOR, seated, hand_screen, RED
import geometry as G

MR, CO, OP = G.MEETING, G.CORRIDOR, G.OPEN_PLAN


def cam_for(L, kind):
    c = L['cameras'][kind]
    (cx, cy), (W, H) = c['principal'], c['frame']
    return Cam(W=W, H=H, f=c['focal_px'], hy=cy, eye=c['position'][1], cx=cx, camx=c['position'][0], camz=c['position'][2])


# ---------------------------------------------------------------- props (no text, no data)
def summary_prop(c, hu, ang=-6, scale=1.0):
    w, h = 0.70 * hu * scale, 0.96 * hu * scale
    lw = max(0.8, hu * 0.03)
    cw, ch = w * 0.74, h * 0.28
    cx0, cy0 = -cw / 2, -h * 0.06
    line = [(0, 0.3), (0.3, 0.42), (0.55, 0.38), (0.75, 0.6), (1, 0.7)]
    lp = ' L'.join(f'{fmt(cx0 + px * cw)},{fmt(cy0 + ch - py * ch)}' for px, py in line)
    rows = ''.join(f'<rect x="{fmt(-w * 0.37)}" y="{fmt(-h * (0.40 - i * 0.05))}" width="{fmt(w * (0.6 - 0.15 * (i % 2)))}" height="{fmt(max(0.6, h * 0.016))}" fill="#a39b8e"/>' for i in range(2))
    rows += ''.join(f'<rect x="{fmt(-w * 0.37)}" y="{fmt(h * (0.32 + i * 0.05))}" width="{fmt(w * (0.7 - 0.12 * (i % 2)))}" height="{fmt(max(0.6, h * 0.016))}" fill="#a39b8e"/>' for i in range(2))
    inner = (f'<rect x="{fmt(-w / 2 + 3)}" y="{fmt(-h / 2 + 3)}" width="{fmt(w)}" height="{fmt(h)}" fill="#D9D1C0"/>'
             f'<rect x="{fmt(-w / 2)}" y="{fmt(-h / 2)}" width="{fmt(w)}" height="{fmt(h)}" fill="#F1EBDF"/>{rows}'
             f'<path d="M{lp}" fill="none" stroke="{RED}" stroke-width="{fmt(lw)}" stroke-linejoin="round"/>'
             f'<rect x="{fmt(-w * 0.44)}" y="{fmt(-h * 0.49)}" width="{fmt(w * 0.1)}" height="{fmt(max(1, h * 0.012))}" fill="#7d7a76" transform="rotate(-30 {fmt(-w * 0.44)} {fmt(-h * 0.49)})"/>')
    return f'<g filter="url(#rough)" transform="translate({fmt(c[0])},{fmt(c[1])}) rotate({ang})">{inner}</g>'


def neutral_display(x0, y0, w, h, dim=0.0):
    """display texture: chart silhouette, no title, no numbers. Title is a live-text slot."""
    cw, ch = w * 0.72, h * 0.45
    cx0, cy0 = x0 + w * 0.12, y0 + h * 0.40
    line = [(0, 0.3), (0.3, 0.42), (0.55, 0.38), (0.75, 0.6), (1, 0.7)]
    lp = ' L'.join(f'{fmt(cx0 + px * cw)},{fmt(cy0 + ch - py * ch)}' for px, py in line)
    bars = ''.join(f'<rect x="{fmt(cx0 + i * cw / 6 + cw / 30)}" y="{fmt(cy0 + ch * (0.55 - 0.08 * (i % 3)))}" width="{fmt(cw / 9)}" height="{fmt(ch * (0.45 + 0.08 * (i % 3)))}" fill="#B9CBD2"/>' for i in range(6))
    return (f'<rect x="{fmt(x0)}" y="{fmt(y0)}" width="{fmt(w)}" height="{fmt(h)}" fill="{mix("#DCE7EA", "#8C9AA0", dim)}"/>'
            f'<rect x="{fmt(x0 + w * 0.08)}" y="{fmt(y0 + h * 0.10)}" width="{fmt(w * 0.5)}" height="{fmt(h * 0.12)}" fill="#C9D7DC"/>'
            f'{bars}<path d="M{lp}" fill="none" stroke="{RED}" stroke-width="{fmt(max(1.2, h * 0.018))}" stroke-linejoin="round"/>')


def blob_screen(cam, targets):
    out = []
    for (x, y, z, rx, ry) in targets:
        p = cam.p(x, y, z)
        k = cam.f / max(0.3, z - cam.camz)
        out.append((p[0], p[1], rx * k, ry * k))
    return out


def actor_svg(S, b, p, x, z, finish=1.0, hero=False, filt='paintL', tint=None, props=False, ink=False, prop=None, contact=True):
    cam = S.cam
    hu = cam.hu(z)
    ox, oy = cam.p(x, 0, z)
    s = figure(b, p, hu, ox, oy, hero=hero and not ink, filt=filt, finish=finish, props=props, contact=contact, sil=('#1d1b1a' if ink else None))
    if tint and not ink:
        s = f'<g filter="url(#{tint})">{s}</g>'
    if prop:
        s += prop(hu, ox, oy)
    return s, (ox, oy, hu)


# ---------------------------------------------------------------- hero poses (prep + acts)
P_SEAT_HOLD = seated(90, head_yaw=14, head_pitch=4, arms='hold')
P_SEAT_DEC = seated(90, head_yaw=22, head_pitch=0, arms='hold')
P_SEAT_SPEAK = pose(yaw=90, head_yaw=10, head_pitch=-12, spine_pitch=6, legR=dict(flex=86, knee=90, abd=4), legL=dict(flex=82, knee=86, abd=7, turn=8),
                    armR=dict(flex=96, abd=8, elbow=52, hand='grip', curl=0.8), armL=dict(flex=12, abd=8, elbow=58, hand='rest'), seat=True)
P_SEAT_SILENT = pose(yaw=90, head_yaw=10, head_pitch=2, spine_pitch=-4, legR=dict(flex=86, knee=90, abd=4), legL=dict(flex=82, knee=86, abd=7, turn=8),
                     armR=dict(flex=16, abd=4, elbow=62, inw=30, hand='rest', curl=0.25), armL=dict(flex=14, abd=6, elbow=66, inw=40, hand='rest', curl=0.25), seat=True)
P_STAND_RET = pose(yaw=78, head_yaw=6, head_pitch=2, support='L', pelvis_roll=3, legR=dict(flex=6, knee=6), legL=dict(flex=-6, knee=4),
                   armR=dict(flex=12, abd=6, elbow=58, inw=30, hand='grip', curl=0.8), armL=dict(flex=-4, abd=6, elbow=14))
P_STAND_DEC = pose(yaw=72, head_yaw=14, head_pitch=-2, support='L', pelvis_roll=3, spine_pitch=-2, legR=dict(flex=8, knee=6), legL=dict(flex=-6, knee=4),
                   armR=dict(flex=16, abd=6, elbow=70, inw=35, hand='grip', curl=0.8), armL=dict(flex=-2, abd=8, elbow=24))
P_STAND_SPEAK = pose(yaw=74, head_pitch=-10, spine_roll=-3, legR=dict(flex=8, knee=6), legL=dict(flex=-6, knee=4),
                     armR=dict(flex=104, abd=10, elbow=58, hand='grip', curl=0.8), armL=dict(flex=-2, abd=6, elbow=18))
P_STAND_SILENT = pose(yaw=76, head_yaw=4, head_pitch=4, support='R', pelvis_roll=-4, legR=dict(flex=2, knee=2), legL=dict(flex=-4, knee=10, toe=6),
                      armR=dict(flex=2, abd=6, elbow=22, hand='grip', curl=0.8), armL=dict(flex=0, abd=6, elbow=16, hand='relax'))
P_PRIVATE = pose(yaw=G.MEETING['hero_anchors']['near_director']['yaw'], spine_pitch=20, head_pitch=22, neck_fwd=0.8,
                 legR=dict(flex=10, knee=10), legL=dict(flex=-6, knee=6),
                 armR=dict(flex=30, abd=10, elbow=84, hand='open', curl=0.35, inw=20), armL=dict(flex=0, abd=6, elbow=20, hand='grip', curl=0.8))
P_READ = pose(yaw=28, head_pitch=34, neck_fwd=0.8, spine_pitch=6, support='R', pelvis_roll=-4, legR=dict(flex=2, knee=2), legL=dict(flex=-6, knee=12, toe=8),
              armR=dict(flex=30, abd=4, elbow=100, inw=40, hand='grip', curl=0.8), armL=dict(flex=28, abd=6, elbow=96, inw=60, hand='grip', curl=0.8))
P_WALK_OUT = pose(yaw=-130, spine_pitch=4, head_pitch=10, legR=dict(flex=22, knee=8), legL=dict(flex=-18, knee=20, toe=24),
                  armR=dict(flex=6, abd=6, elbow=40, hand='grip', curl=0.8), armL=dict(flex=16, abd=4, elbow=24))
P_DESK = pose(yaw=-62, head_yaw=-8, head_pitch=8, spine_pitch=4, support='L', legR=dict(flex=6, knee=6), legL=dict(flex=-6, knee=4),
              armR=dict(flex=34, abd=4, elbow=84, inw=30, hand='grip', curl=0.8), armL=dict(flex=26, abd=10, elbow=20, hand='rest', curl=0.3))
P_MIRA = pose(yaw=-58, spine_pitch=4, head_yaw=-10, legR=dict(flex=10, knee=6), legL=dict(flex=-8, knee=6),
              armR=dict(flex=34, abd=20, elbow=70, hand='open', curl=0.25, inw=-25), armL=dict(flex=14, abd=8, elbow=50, hand='relax'))
P_DIRECTOR = seated(-90, head_yaw=-55, spine=-8, arms='table', head_pitch=-4)

HERO_STATES = {
    'seat_hold': ('own_seat', P_SEAT_HOLD, 'hand'), 'seat_decide': ('own_seat', P_SEAT_DEC, 'hand'),
    'seat_speak': ('own_seat', P_SEAT_SPEAK, 'hand'), 'seat_silent': ('own_seat', P_SEAT_SILENT, 'lap'),
    'stand_return': ('stand_near_entry', P_STAND_RET, 'hand'), 'stand_decide': ('stand_near_entry', P_STAND_DEC, 'hand'),
    'stand_speak': ('stand_near_entry', P_STAND_SPEAK, 'hand'), 'stand_silent': ('stand_near_entry', P_STAND_SILENT, 'hand'),
    'private': ('near_director', P_PRIVATE, 'hand_L'),
}


def hero_prop_fn(p, mode):
    def f(hu, ox, oy):
        if mode == 'lap':
            a = hand_screen(HERO, p, hu, ox, oy, 'WR')
            b = hand_screen(HERO, p, hu, ox, oy, 'WL')
            c = (a + b) / 2 + np.array([0, -hu * 0.06])
            return summary_prop(c, hu, ang=-78, scale=0.85)
        key = 'WL' if mode == 'hand_L' else 'WR'
        c = hand_screen(HERO, p, hu, ox, oy, key)
        arm = p['armL' if key == 'WL' else 'armR']
        if arm['flex'] > 60:
            return summary_prop(c + np.array([hu * 0.22, -hu * 0.38]), hu, ang=-4)
        if arm['flex'] < 8:
            return summary_prop(c + np.array([hu * 0.08, -hu * 0.05]), hu, ang=-80, scale=0.95)
        return summary_prop(c + np.array([hu * 0.25, -hu * 0.35]), hu, ang=-8)
    return f


# ================================================================ MEETING ROOM
def meeting(kind='desktop', hero_state='seat_hold', targets=None, finishes=None, paint_op=1.0, ink_hero=False,
            hero_visible=True, display_dim=0.0, layer=None):
    cam = cam_for(MR, kind)
    S = Stage(cam)
    bg = S.bg
    B = MR['bounds']
    x0, x1, zb, H = B['xMin'], B['xMax'], B['zMax'], B['ceiling']
    zf = cam.camz + 1.4
    S.quad(bg, [(x0, 0, zf), (x1, 0, zf), (x1, 0, zb), (x0, 0, zb)], '#353A41', line=False)
    S.quad(bg, [(x0, 0, zb), (x1, 0, zb), (x1, H, zb), (x0, H, zb)], '#4B5560')
    S.quad(bg, [(x1, 0, zf), (x1, 0, zb), (x1, H, zb), (x1, H, zf)], '#424C57')
    S.quad(bg, [(x0, H, zf), (x1, H, zf), (x1, H, zb), (x0, H, zb)], '#5B6570')
    for i in range(0, 12):
        S.seg(bg, (i * 0.6, 0, zf), (i * 0.6, 0, zb), lw=0.6, op=0.22)
    for zz in np.arange(0.6, zb, 0.6):
        S.seg(bg, (x0, 0, zz), (x1, 0, zz), lw=0.6, op=0.18)
    S.seg(bg, (x0, 0.08, zb), (x1, 0.08, zb), op=0.4)
    S.seg(bg, (x1, 0.08, zf), (x1, 0.08, zb), op=0.4)
    for zz in (2.0, 4.2, 6.2):
        S.quad(bg, [(2.7, H - 0.001, zz), (4.1, H - 0.001, zz), (4.1, H - 0.001, zz + 0.9), (2.7, H - 0.001, zz + 0.9)], '#9CA6AE', lw=0.7)
    # corridor beyond glass (empty)
    S.quad(bg, [(x0 - 1.8, 0, zf), (x0 - 1.8, 0, zb), (x0 - 1.8, H, zb), (x0 - 1.8, H, zf)], '#8F989C', line=False)
    S.quad(bg, [(x0, 0, zf), (x0 - 1.8, 0, zf), (x0 - 1.8, 0, zb), (x0, 0, zb)], '#6F767A', line=False)
    S.quad(bg, [(x0, 0, zf), (x0, 0, zb), (x0, H, zb), (x0, H, zf)], '#7E8D97', line=False)
    for zz in MR['occluders']['glass_mullions']['z']:
        if zz >= zf:
            S.box(bg, x0 - 0.03, x0 + 0.03, 0, H, zz - 0.03, zz + 0.03, '#2E3238', lw=0.8)
    S.box(bg, x0 - 0.03, x0 + 0.03, 1.05, 1.09, max(zf, 0), zb, '#2E3238', lw=0.6)
    (_, d0), (_, d1) = MR['portals']['P1']['segment']
    S.quad(bg, [(x0 + 0.01, 0, d0), (x0 + 0.01, 0, d1), (x0 + 0.01, 2.15, d1), (x0 + 0.01, 2.15, d0)], '#A7B2B8', lw=1.3)
    S.box(bg, x0 - 0.03, x0 + 0.05, 0.95, 1.0, d1 - 0.12, d1 - 0.08, '#C6A15B', lw=0.5)
    for zz in (2.9, 4.9, 6.4):
        a, b2 = cam.p(x0 + 0.01, 2.4, zz), cam.p(x0 + 0.01, 0.6, zz + 0.5)
        bg.paint.append(f'<path d="M{fmt(a[0])},{fmt(a[1])} L{fmt(b2[0])},{fmt(b2[1])}" stroke="#DDE6EA" stroke-width="10" opacity="0.13"/>')
    cr = MR['obstacles']['credenza']['poly']
    S.box(bg, cr[0][0], cr[1][0], 0, 0.75, cr[0][1], cr[2][1], '#3B3F46')
    S.quad(bg, [(x1 - 0.001, 1.3, 3.4), (x1 - 0.001, 1.3, 4.7), (x1 - 0.001, 2.0, 4.7), (x1 - 0.001, 2.0, 3.4)], '#6B7680')
    # display
    sc = MR['display_surfaces']['screen']['corners']
    sx0, sy0 = cam.p(sc[0][0], sc[0][1], sc[0][2])
    sx1, sy1 = cam.p(sc[2][0], sc[2][1], sc[2][2])
    bg.lines.append(gline([(sx0, sy0), (sx1, sy0), (sx1, sy1), (sx0, sy1), (sx0, sy0)], w=1.2, op=0.9, double=False))
    S.glow(bg, (sx0 + sx1) / 2, (sy0 + sy1) / 2, (sx1 - sx0) * 1.15, '#CFE3EA', 0.30, sy=0.8)
    # table, chairs, objects
    t = MR['obstacles']['table']['poly']
    tab = S.table(t[0][0], t[1][0], t[0][1], t[2][1], col='#5E4A39')
    a = cam.p(3.4, 0.74, 6.0)
    S.glow(tab, a[0], a[1] - 4, 260 * cam.f / 1240, '#DCEEF1', 0.22, sy=0.25)
    ob = MR['objects']
    for k in ('laptop_west', 'laptop_east'):
        x, y, z = ob[k]['pos']
        S.box(tab, x - 0.17, x + 0.17, 0.74, 0.76, z - 0.12, z + 0.12, '#2D3036', lw=0.6)
        S.quad(tab, [(x - 0.17, 0.76, z + 0.12), (x + 0.17, 0.76, z + 0.12), (x + 0.17, 0.98, z + 0.16), (x - 0.17, 0.98, z + 0.16)], '#3B4048', lw=0.6)
    for k in ('cup_1', 'cup_2', 'cup_3'):
        x, y, z = ob[k]['pos']
        p0, p1 = cam.p(x, 0.74, z), cam.p(x, 0.84, z)
        r = cam.hu(z) * 0.18
        tab.paint.append(f'<rect x="{fmt(p0[0] - r)}" y="{fmt(p1[1])}" width="{fmt(2 * r)}" height="{fmt(p0[1] - p1[1])}" fill="#E9E3D8"/><ellipse cx="{fmt(p1[0])}" cy="{fmt(p1[1])}" rx="{fmt(r)}" ry="{fmt(r * 0.35)}" fill="#F4EFE6"/>')
    x, y, z = ob['papers']['pos']
    S.paper(tab, [(x - 0.15, 0.745, z - 0.19), (x + 0.15, 0.745, z - 0.2), (x + 0.16, 0.745, z + 0.18), (x - 0.14, 0.745, z + 0.19)])
    O = MR['obstacles']
    chair_yaw = dict(chair_west_1=90, chair_west_2=90, chair_east_1=-90, chair_south_end=180, chair_director=-90, chair_own_seat=90)
    for k, yw in chair_yaw.items():
        poly = O[k]['poly']
        cx_, cz_ = (poly[0][0] + poly[1][0]) / 2, (poly[0][1] + poly[2][1]) / 2
        fo, bo = S.chair(cx_, cz_, yaw=yw, col='#56575F' if k != 'chair_director' else '#2F3036')
    fin = dict(mira=0.9, director=0.65)
    fin.update(finishes or {})
    mr = MR['actors']['mira']
    s, _ = actor_svg(S, MIRA, P_MIRA, mr['root'][0], mr['root'][1], finish=fin['mira'])
    S.add_svg(mr['root'][1], s)
    dr = MR['actors']['director']
    s, _ = actor_svg(S, DIRECTOR, P_DIRECTOR, dr['root'][0] - 0.06, dr['root'][1], finish=fin['director'])
    S.add_svg(dr['root'][1] - 0.01, s)
    hinfo = None
    if hero_visible:
        anc, hp, pm = HERO_STATES[hero_state]
        ha = MR['hero_anchors'][anc]
        hx, hz = ha['root']
        if hp.get('seat'):
            hx += 0.06
        s, hinfo = actor_svg(S, HERO, hp, hx, hz, hero=True, tint='tintCold', ink=ink_hero, prop=hero_prop_fn(hp, pm))
        S.add_svg(hz - 0.02, s)
    targets = targets or [(0.9, 1.0, 3.6, 1.0, 1.25), (3.4, 1.6, 7.3, 1.7, 0.9)]
    if layer:
        LAYER.update(layer)
    out = S.render(blob_screen(cam, targets), paint_op=paint_op)
    if LAYER.get('slide', True):
        out += f'<g opacity="{1 - 0.65 * display_dim}">{neutral_display(sx0, sy0, sx1 - sx0, sy1 - sy0, dim=display_dim)}</g>'
    for k in LAYER:
        LAYER[k] = True
    LAYER['slide'] = True
    return out, dict(cam=cam, hero=hinfo, display=(sx0, sy0, sx1, sy1))


# ================================================================ CORRIDOR
def corridor(kind='desktop', hero_state='read', targets=None, layer=None):
    cam = cam_for(CO, kind)
    S = Stage(cam)
    bg = S.bg
    B = CO['bounds']
    xl, xr, H, zb = B['xMin'], B['xMax'], B['ceiling'], B['zMax']
    zf = cam.camz + 1.0
    S.quad(bg, [(xl, 0, zf), (xr, 0, zf), (xr, 0, zb), (xl, 0, zb)], '#A9A296', line=False)
    S.quad(bg, [(xl, 0, zf), (xl, 0, zb), (xl, H, zb), (xl, H, zf)], '#C9C2B4')
    S.quad(bg, [(xl, H, zf), (xr, H, zf), (xr, H, zb), (xl, H, zb)], '#D6D0C3', line=False)
    S.quad(bg, [(xl, 0, zb), (xr, 0, zb), (xr, H, zb), (xl, H, zb)], '#E8E4D9')
    for zz in np.arange(zf + 0.5, zb, 2.2):
        S.quad(bg, [(1.25, H - 0.001, zz), (2.05, H - 0.001, zz), (2.05, H - 0.001, zz + 0.9), (1.25, H - 0.001, zz + 0.9)], '#F4F2EB', lw=0.6, op=0.5)
    for xx in np.arange(xl, xr, 0.55):
        S.seg(bg, (xx, 0, zf), (xx, 0, zb), lw=0.5, op=0.18)
    for zz in np.arange(zf, zb, 0.55):
        S.seg(bg, (xl, 0, zz), (xr, 0, zz), lw=0.5, op=0.14)
    S.seg(bg, (xl, 0.1, zf), (xl, 0.1, zb), op=0.4)
    wz0, wz1 = CO['walls']['west']['window_bay']['z']
    S.quad(bg, [(xl + 0.001, 0.75, wz0), (xl + 0.001, 0.75, wz1), (xl + 0.001, 2.4, wz1), (xl + 0.001, 2.4, wz0)], '#F2F1EA', lw=1.2)
    for zz in np.arange(wz0, wz1, 0.8):
        S.seg(bg, (xl + 0.002, 0.75, zz), (xl + 0.002, 2.4, zz), op=0.6)
    S.box(bg, xl, xl + 0.18, 0.72, 0.76, wz0, wz1, '#D7D0C2', lw=0.8)
    pts = [cam.p(xl, 0, wz0 + 0.3), cam.p(xl + 1.4, 0, wz0 + 0.9), cam.p(xl + 1.4, 0, wz1 + 0.9), cam.p(xl, 0, wz1 + 0.3)]
    bg.paint.append(f'<path d="{dpath(pts)}" fill="#FFF8E8" opacity="0.7" filter="url(#blur6)"/>')
    # P0 opening (south, behind camera if out of view)
    (_, p00), (_, p01) = CO['portals']['P0']['segment']
    if p01 > zf:
        S.quad(bg, [(xl + 0.001, 0, max(p00, zf)), (xl + 0.001, 0, p01), (xl + 0.001, 2.3, p01), (xl + 0.001, 2.3, max(p00, zf))], '#BDB4A4', lw=1.1)
    # east: glass to meeting room
    gz0, gz1 = CO['walls']['east']['glass_z']
    S.quad(bg, [(xr, 0, zf), (xr, 0, max(gz0, zf)), (xr, H, max(gz0, zf)), (xr, H, zf)], '#C3BCAE')
    S.quad(bg, [(xr, 0, max(gz0, zf)), (xr, 0, gz1), (xr, H, gz1), (xr, H, max(gz0, zf))], '#9DA8B0')
    S.quad(bg, [(xr, 0, gz1), (xr, 0, zb), (xr, H, zb), (xr, H, gz1)], '#C3BCAE')
    for zz in CO['occluders']['glass_mullions']['z']:
        if zz > zf:
            S.seg(bg, (xr, 0, zz), (xr, H, zz), lw=1.0, op=0.8)
    (_, d0), (_, d1) = CO['portals']['P1']['segment']
    S.quad(bg, [(xr - 0.001, 0, d0), (xr - 0.001, 0, d1), (xr - 0.001, 2.15, d1), (xr - 0.001, 2.15, d0)], '#B3BEC4', lw=1.4)
    # meeting room seen through the glass (transform meeting -> corridor: x+3.3, z+1.5): same table, same actors
    T = lambda x, z: (x + 3.3, z + 1.5)
    t = MR['obstacles']['table']['poly']
    (a0, b0), (a1, b1) = T(t[0][0], t[0][1]), T(t[1][0], t[2][1])
    for (p, q) in [((a0, 0.74, b0), (a1, 0.74, b0)), ((a0, 0.74, b0), (a0, 0.74, b1)), ((a1, 0.74, b0), (a1, 0.74, b1)), ((a0, 0, b0 + 0.08), (a0, 0.74, b0 + 0.08))]:
        S.seg(bg, p, q, lw=0.9, op=0.6)
    sc = MR['display_surfaces']['screen']['corners']
    q = [(T(c[0], c[2])[0], c[1], T(c[0], c[2])[1]) for c in sc]
    S.quad(bg, q, None, lw=1.0)
    mr, dr = MR['actors']['mira'], MR['actors']['director']
    mx, mz = T(*mr['root'])
    dx, dz = T(*dr['root'])
    s, _ = actor_svg(S, MIRA, P_MIRA, mx, mz, finish=0.25, contact=False)
    S.add_svg(mz, s)
    s, _ = actor_svg(S, DIRECTOR, P_DIRECTOR, dx - 0.06, dz, finish=0.25, contact=False)
    S.add_svg(dz, s)
    gl = S.obj(gz0 + 0.5)
    gl.raw.append(f'<path d="{dpath([cam.p(xr, 0, max(gz0, zf)), cam.p(xr, 0, gz1), cam.p(xr, H, gz1), cam.p(xr, H, max(gz0, zf))])}" fill="#C9D3D8" opacity="0.28"/>')
    bb = CO['obstacles']['bench']['poly']
    S.box(S.obj(bb[0][1]), bb[0][0], bb[1][0], 0.42, 0.47, bb[0][1], bb[2][1], '#8E7F6C')
    hinfo = None
    if hero_state == 'read':
        hx, hz = CO['hero_anchors']['reading']['root']
        hp = P_READ

        def prop(hu, ox, oy):
            cR = hand_screen(HERO, hp, hu, ox, oy, 'WR')
            cL = hand_screen(HERO, hp, hu, ox, oy, 'WL')
            return summary_prop((cR + cL) / 2 + np.array([hu * 0.05, -hu * 0.2]), hu, ang=8, scale=1.05)
    else:
        hx, hz = CO['routes']['exit_to_reading'][1]
        hp = P_WALK_OUT
        prop = hero_prop_fn(hp, 'hand')
    s, hinfo = actor_svg(S, HERO, hp, hx, hz, hero=True, tint='tintWarm', prop=prop)
    S.add_svg(hz, s)
    targets = targets or [(hx, 1.0, hz, 1.1, 1.3), (0.2, 1.5, 8.0, 0.9, 1.2), (3.3, 1.2, 5.78, 0.7, 1.1)]
    if layer:
        LAYER.update(layer)
    out = S.render(blob_screen(cam, targets))
    for k in LAYER:
        LAYER[k] = True
    return out, dict(cam=cam, hero=hinfo, door=cam.p(xr, 1.0, (d0 + d1) / 2))


# ================================================================ OPEN PLAN
def open_plan(kind='desktop', targets=None, layer=None):
    cam = cam_for(OP, kind)
    S = Stage(cam)
    bg = S.bg
    B = OP['bounds']
    zb, H, xE = B['zMax'], B['ceiling'], B['xMax']
    zf = cam.camz + 1.0
    S.quad(bg, [(-1.0, 0, zf), (xE, 0, zf), (xE, 0, zb), (-1.0, 0, zb)], '#B7AE9E', line=False)
    S.quad(bg, [(-1.0, 0, zb), (xE, 0, zb), (xE, H, zb), (-1.0, H, zb)], '#CFC9BD')
    for i in range(0, 9):
        S.quad(bg, [(i * 1.1 + 0.05, 0.9, zb - 0.01), (i * 1.1 + 1.0, 0.9, zb - 0.01), (i * 1.1 + 1.0, 2.6, zb - 0.01), (i * 1.1 + 0.05, 2.6, zb - 0.01)], '#E9ECE6', lw=0.7)
    S.quad(bg, [(-1.0, H, zf), (xE, H, zf), (xE, H, zb), (-1.0, H, zb)], '#D9D3C6', line=False)
    S.quad(bg, [(xE, 0, zf), (xE, 0, zb), (xE, H, zb), (xE, H, zf)], '#C7C0B2')
    (_, p0), (_, p1) = OP['portals']['P0']['segment']
    S.quad(bg, [(xE - 0.001, 0, p0), (xE - 0.001, 0, p1), (xE - 0.001, 2.3, p1), (xE - 0.001, 2.3, p0)], '#E6E1D6', lw=1.3)
    for zz in (2.0, 4.0, 6.0, 8.0):
        for xx in (1.5, 4.5, 7.5):
            S.quad(bg, [(xx, H - 0.001, zz), (xx + 1.2, H - 0.001, zz), (xx + 1.2, H - 0.001, zz + 0.6), (xx, H - 0.001, zz + 0.6)], '#EFEDE6', lw=0.6, op=0.5)
    for xx in (2.0, 4.4, 6.8):
        a = cam.p(xx, 0, zb - 1.5)
        S.glow(bg, a[0], a[1], 260 * cam.f / 1220, '#FFF6E2', 0.35, sy=0.22)
    for k, ob in OP['obstacles'].items():
        if not k.startswith('desk_row'):
            continue
        poly = ob['poly']
        o = S.obj(poly[0][1])
        S.box(o, poly[0][0], poly[1][0], 0.72, 0.75, poly[0][1], poly[2][1], '#BFB7A8', lw=0.8)
        S.box(o, poly[0][0] + 0.6, poly[0][0] + 1.0, 0.75, 1.1, poly[2][1] - 0.3, poly[2][1] - 0.25, '#3A3C42', lw=0.7)
        for lx in (poly[0][0] + 0.05, poly[1][0] - 0.05):
            S.box(o, lx - 0.02, lx + 0.02, 0, 0.72, poly[0][1] + 0.05, poly[0][1] + 0.09, '#8C857A', lw=0.6)
    dk = OP['obstacles']['hero_desk']['poly']
    d = S.table(dk[0][0], dk[1][0], dk[0][1], dk[2][1], h=0.74, col='#CBBFA9')
    mc = OP['display_surfaces']['monitor']['corners']
    mx = (mc[0][0] + mc[1][0]) / 2
    mz = mc[0][2]
    S.box(d, mx - 0.14, mx + 0.14, 0.745, 0.76, mz - 0.02, mz + 0.18, '#2B2D33', lw=0.7)
    m0, m1 = cam.p(mc[0][0], mc[0][1], mz), cam.p(mc[2][0], mc[2][1], mz)
    d.base.append(f'<rect x="{fmt(m0[0] - 6)}" y="{fmt(m0[1] - 6)}" width="{fmt(m1[0] - m0[0] + 12)}" height="{fmt(m1[1] - m0[1] + 12)}"/>')
    d.paint.append(f'<rect x="{fmt(m0[0] - 6)}" y="{fmt(m0[1] - 6)}" width="{fmt(m1[0] - m0[0] + 12)}" height="{fmt(m1[1] - m0[1] + 12)}" fill="#24262B"/>')
    d.lines.append(gline([(m0[0] - 6, m0[1] - 6), (m1[0] + 6, m0[1] - 6), (m1[0] + 6, m1[1] + 6), (m0[0] - 6, m1[1] + 6), (m0[0] - 6, m0[1] - 6)], w=1.1, op=0.8, double=False))
    S.glow(d, (m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2, 320 * cam.f / 1220, '#DCEEF1', 0.25, sy=0.7)
    sx, sy_, sz = OP['objects']['sheet']['pos']
    S.paper(d, [(sx - 0.2, 0.745, sz - 0.12), (sx + 0.2, 0.745, sz - 0.15), (sx + 0.22, 0.745, sz + 0.13), (sx - 0.18, 0.745, sz + 0.15)], fill='#E8E1D2')
    gx, gy, gz = OP['objects']['mug']['pos']
    p0, p1 = cam.p(gx, 0.74, gz), cam.p(gx, 0.85, gz)
    r = cam.hu(gz) * 0.2
    d.paint.append(f'<rect x="{fmt(p0[0] - r)}" y="{fmt(p1[1])}" width="{fmt(2 * r)}" height="{fmt(p0[1] - p1[1])}" fill="#ECE6DB"/><ellipse cx="{fmt(p1[0])}" cy="{fmt(p1[1])}" rx="{fmt(r)}" ry="{fmt(r * 0.35)}" fill="#5a4636"/>')
    ch = OP['obstacles']['hero_chair']['poly']
    S.chair((ch[0][0] + ch[1][0]) / 2, (ch[0][1] + ch[2][1]) / 2, yaw=0, col='#5B5C64')
    hx, hz = OP['hero_anchors']['at_desk']['root']
    s, hinfo = actor_svg(S, HERO, P_DESK, hx, hz, hero=True, prop=hero_prop_fn(P_DESK, 'hand'))
    S.add_svg(hz - 0.01, s)
    targets = targets or [(hx, 1.0, hz, 0.75, 1.15), (mx, 1.05, mz, 0.6, 0.45)]
    if layer:
        LAYER.update(layer)
    out = S.render(blob_screen(cam, targets))
    if LAYER.get('slide', True):
        out += neutral_display(m0[0], m0[1], m1[0] - m0[0], m1[1] - m0[1])
    for k in LAYER:
        LAYER[k] = True
    return out, dict(cam=cam, hero=hinfo, monitor=(m0, m1))


# ================================================================ REVEAL (public motif only, no text)
def author_page(cx, cy, w, ang=-3, op=1.0):
    h = w * 1.414
    rows = ''.join(f'<rect x="{fmt(-w * 0.38)}" y="{fmt(-h * 0.36 + i * h * 0.05)}" width="{fmt(w * (0.74 - 0.14 * (i % 3)))}" height="{fmt(max(1, h * 0.007))}" fill="#c4bcae"/>' for i in range(14))
    return (f'<g transform="translate({fmt(cx)},{fmt(cy)}) rotate({ang})" opacity="{op}">'
            f'<rect x="{fmt(-w / 2 + 10)}" y="{fmt(-h / 2 + 14)}" width="{fmt(w)}" height="{fmt(h)}" fill="#2a2420" opacity="0.12" filter="url(#blur6)"/>'
            f'<rect x="{fmt(-w / 2 + 5)}" y="{fmt(-h / 2 + 5)}" width="{fmt(w)}" height="{fmt(h)}" fill="#E3DACA"/>'
            f'<rect x="{fmt(-w / 2)}" y="{fmt(-h / 2)}" width="{fmt(w)}" height="{fmt(h)}" fill="#F4EFE5"/>{rows}</g>')
