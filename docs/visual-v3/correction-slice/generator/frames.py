"""THE CORRECTION — production-target frames."""
import math
import numpy as np
from rig import body, pose, solve, P2
from render import figure, fmt, shade, uid, mix, FILTERS
from kit import gline, pencil, EXTRA_FILTERS
from scene3d import Cam, Stage, Obj, dpath, LAYER
from cast import npc
from poses import POSES

# ---------------------------------------------------------------- cast
HERO = body(belt=True)
MIRA = npc('slight', coat_i=0, skin_i=1, hair='bob', hair_i=2, garment='short jacket', pal=dict(coat='#53606F', inner='#B9B3A6'))
DIRECTOR = npc('broad', coat_i=3, skin_i=3, hair='thin', hair_i=4, garment='short jacket', stoop=0.3, pal=dict(coat='#34373F', inner='#8E8A84'))
COLL = [npc('long', coat_i=1, skin_i=5, hair='short', hair_i=0, garment='knit'),
        npc('soft', coat_i=2, skin_i=2, hair='tied', hair_i=3, garment='shirt', pal=dict(inner='#9AA3A8')),
        npc('compact', coat_i=6, skin_i=4, hair='curly', hair_i=0, garment='knit'),
        npc('long', coat_i=7, skin_i=0, hair='crop', hair_i=1, garment='shirt', pal=dict(inner='#C9C2B4'))]

RED = '#B5523A'


def seated(yaw, head_yaw=0, head_pitch=0, arms='lap', spine=0, **kw):
    a = dict(lap=(dict(flex=12, abd=6, elbow=58, hand='rest'), dict(flex=10, abd=8, elbow=55, hand='rest')),
             table=(dict(flex=52, abd=6, elbow=40, hand='rest'), dict(flex=40, abd=8, elbow=60, hand='rest')),
             hold=(dict(flex=22, abd=4, elbow=88, inw=40, hand='grip', curl=0.8), dict(flex=18, abd=6, elbow=92, inw=60, hand='relax')))[arms]
    return pose(yaw=yaw, head_yaw=head_yaw, head_pitch=head_pitch, spine_pitch=spine,
                legR=dict(flex=86, knee=90, abd=4), legL=dict(flex=82, knee=86, abd=7, turn=8),
                armR=a[0], armL=a[1], seat=True, **kw)


def hand_screen(b, p, hu, ox, oy, key='WR'):
    J = solve(b, p)
    v = P2(J[key])
    return np.array([ox + v[0] * hu, oy + v[1] * hu])


def summary_prop(c, hu, ang=-6, scale=1.0, open_=False, face_down=False):
    """the hero prop: stapled A4 summary with the red forecast line and the kink."""
    w, h = 0.70 * hu * scale, 0.96 * hu * scale
    x, y = c
    if face_down:
        inner = (f'<rect x="{fmt(-w / 2)}" y="{fmt(-h / 2)}" width="{fmt(w)}" height="{fmt(h)}" fill="#E7E0D1"/>'
                 f'<rect x="{fmt(-w / 2 + 2)}" y="{fmt(-h / 2 + 2)}" width="{fmt(w)}" height="{fmt(h)}" fill="#DDD5C4" opacity="0.6"/>')
    else:
        lw = max(0.8, hu * 0.035)
        cw, ch = w * 0.76, h * 0.32
        cx0, cy0 = -cw / 2, -h * 0.05
        line = [(0, 0.2), (0.25, 0.35), (0.45, 0.3), (0.62, 0.62), (0.7, 0.48), (1, 0.8)]
        lp = ' L'.join(f'{fmt(cx0 + px * cw)},{fmt(cy0 + ch - py * ch)}' for px, py in line)
        inner = (f'<rect x="{fmt(-w / 2 + 3)}" y="{fmt(-h / 2 + 3)}" width="{fmt(w)}" height="{fmt(h)}" fill="#D9D1C0"/>'
                 f'<rect x="{fmt(-w / 2)}" y="{fmt(-h / 2)}" width="{fmt(w)}" height="{fmt(h)}" fill="#F1EBDF"/>'
                 f'<rect x="{fmt(-w * 0.38)}" y="{fmt(-h * 0.40)}" width="{fmt(w * 0.5)}" height="{fmt(max(1, h * 0.04))}" fill="#3a3633"/>'
                 f'<rect x="{fmt(-w * 0.38)}" y="{fmt(-h * 0.32)}" width="{fmt(w * 0.3)}" height="{fmt(max(0.6, h * 0.02))}" fill="#8f877b"/>'
                 f'<path d="M{lp}" fill="none" stroke="{RED}" stroke-width="{fmt(lw)}" stroke-linejoin="round"/>'
                 f'<rect x="{fmt(-w * 0.38)}" y="{fmt(h * 0.34)}" width="{fmt(w * 0.7)}" height="{fmt(max(0.6, h * 0.018))}" fill="#a39b8e"/>'
                 f'<rect x="{fmt(-w * 0.38)}" y="{fmt(h * 0.39)}" width="{fmt(w * 0.55)}" height="{fmt(max(0.6, h * 0.018))}" fill="#a39b8e"/>'
                 f'<rect x="{fmt(-w * 0.44)}" y="{fmt(-h * 0.49)}" width="{fmt(w * 0.1)}" height="{fmt(max(1, h * 0.012))}" fill="#7d7a76" transform="rotate(-30 {fmt(-w * 0.44)} {fmt(-h * 0.49)})"/>')
    return f'<g filter="url(#rough)" transform="translate({fmt(x)},{fmt(y)}) rotate({ang})">{inner}</g>'


def slide(x0, y0, w, h, title='', sub='', kink_loop=False, dim=0.0):
    """the deck slide as a prop plate (real text, never baked art)."""
    cw, ch = w * 0.72, h * 0.45
    cx0, cy0 = x0 + w * 0.12, y0 + h * 0.42
    line = [(0, 0.2), (0.25, 0.35), (0.45, 0.3), (0.62, 0.62), (0.7, 0.48), (1, 0.8)]
    lp = ' L'.join(f'{fmt(cx0 + px * cw)},{fmt(cy0 + ch - py * ch)}' for px, py in line)
    bars = ''.join(f'<rect x="{fmt(cx0 + i * cw / 6 + cw / 30)}" y="{fmt(cy0 + ch * (0.55 - 0.08 * (i % 3)))}" width="{fmt(cw / 9)}" height="{fmt(ch * (0.45 + 0.08 * (i % 3)))}" fill="#B9CBD2"/>' for i in range(6))
    s = (f'<rect x="{fmt(x0)}" y="{fmt(y0)}" width="{fmt(w)}" height="{fmt(h)}" fill="{mix("#DCE7EA", "#8C9AA0", dim)}"/>'
         f'<text x="{fmt(x0 + w * 0.08)}" y="{fmt(y0 + h * 0.18)}" font-family="IBM Plex Sans, sans-serif" font-weight="500" font-size="{fmt(h * 0.1)}" fill="#22313a">{title}</text>'
         f'<text x="{fmt(x0 + w * 0.08)}" y="{fmt(y0 + h * 0.28)}" font-family="IBM Plex Sans, sans-serif" font-size="{fmt(h * 0.055)}" fill="#4f6370">{sub}</text>'
         f'{bars}<path d="M{lp}" fill="none" stroke="{RED}" stroke-width="{fmt(max(1.2, h * 0.018))}" stroke-linejoin="round"/>')
    if kink_loop:
        kx, ky = cx0 + 0.66 * cw, cy0 + ch - 0.55 * ch
        s += f'<ellipse cx="{fmt(kx)}" cy="{fmt(ky)}" rx="{fmt(w * 0.07)}" ry="{fmt(h * 0.1)}" fill="none" stroke="#5E5953" stroke-width="1.6" transform="rotate(-12 {fmt(kx)} {fmt(ky)})" filter="url(#pencil)"/>'
    return s


def italic(x, y, text, size=26, col='#2f2b28', anchor='start', op=1):
    return f'<text x="{fmt(x)}" y="{fmt(y)}" text-anchor="{anchor}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="{size}" fill="{col}" opacity="{op}">{text}</text>'


def hung(x, y, tx, ty, text, size=27, col='#26221F', lead='#4E4A45', anchor='start'):
    """possibility phrase hung on what it concerns: cream italic + graphite leader."""
    return (pencil(gline([(x, y), (tx, ty)], w=1.1, col=lead, op=0.9, double=False))
            + f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="2.4" fill="{lead}"/>'
            + f'<text x="{fmt(tx + (6 if anchor == "start" else -6))}" y="{fmt(ty + 7)}" text-anchor="{anchor}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="{size}" fill="{col}" '
              f'paint-order="stroke" stroke="#ECE4D2" stroke-width="7" stroke-linejoin="round" stroke-opacity="0.92">{text}</text>')


# =============================================================== MEETING ROOM
MEET_CAM = dict(f=1240, hy=440, eye=1.5, cx=1060)
MR = dict(x0=-3.4, x1=3.4, zb=8.6, h=2.8)
POS = dict(hero_seat=(-2.75, 4.3), hero_stand=(-2.2, 4.9), hero_door=(-2.9, 3.0),
           mira=(1.85, 8.05), director=(1.35, 7.1),
           c_left1=(-1.35, 5.3), c_left2=(-1.35, 6.6), c_right1=(1.4, 4.9), c_near=(0.35, 3.95),
           table=(-0.85, 0.85, 4.4, 7.7))


def meeting_room(state='present', blob=None, camcfg=None, hero_pose=None, hero_pos=None, mira_pose=None, finish_hero=1.0,
                 cups_moved=False, director_pose=None, text_top=None, hung_items=None, paint_op=1.0,
                 hero_finish_override=None, ink_hero=False, others_finish=None, extra_over='', empty_chair=True, mira_pos=None):
    cam = Cam(**(camcfg or MEET_CAM))
    S = Stage(cam)
    bg = S.bg
    x0, x1, zb, H = MR['x0'], MR['x1'], MR['zb'], MR['h']
    zf = 1.2
    # floor / walls / ceiling
    S.quad(bg, [(x0, 0, zf), (x1, 0, zf), (x1, 0, zb), (x0, 0, zb)], '#353A41', line=False)
    S.quad(bg, [(x0, 0, zb), (x1, 0, zb), (x1, H, zb), (x0, H, zb)], '#4B5560')
    S.quad(bg, [(x1, 0, zf), (x1, 0, zb), (x1, H, zb), (x1, H, zf)], '#424C57')
    S.quad(bg, [(x0, H, zf), (x1, H, zf), (x1, H, zb), (x0, H, zb)], '#5B6570')
    # carpet tiles
    for i in range(-6, 7):
        S.seg(bg, (i * 0.6, 0, zf), (i * 0.6, 0, zb), lw=0.6, op=0.22)
    for zz in np.arange(2.0, zb, 0.6):
        S.seg(bg, (x0, 0, zz), (x1, 0, zz), lw=0.6, op=0.18)
    # baseboard, ceiling panels
    S.seg(bg, (x0, 0.08, zb), (x1, 0.08, zb), op=0.4)
    S.seg(bg, (x1, 0.08, zf), (x1, 0.08, zb), op=0.4)
    for zz in (3.2, 5.4, 7.4):
        S.quad(bg, [(-0.7, H - 0.001, zz), (0.7, H - 0.001, zz), (0.7, H - 0.001, zz + 0.9), (-0.7, H - 0.001, zz + 0.9)], '#9CA6AE', lw=0.7)
    # glass wall (left) with hallway beyond
    S.quad(bg, [(x0 - 1.8, 0, zf), (x0 - 1.8, 0, zb), (x0 - 1.8, H, zb), (x0 - 1.8, H, zf)], '#8F989C', line=False)
    S.quad(bg, [(x0, 0, zf), (x0 - 1.8, 0, zf), (x0 - 1.8, 0, zb), (x0, 0, zb)], '#6F767A', line=False)
    for zz in np.arange(zf, zb, 1.0):
        S.seg(bg, (x0 - 1.8, 0, zz), (x0 - 1.8, 2.4, zz), op=0.35)
    S.quad(bg, [(x0, 0, zf), (x0, 0, zb), (x0, H, zb), (x0, H, zf)], '#7E8D97', line=False)
    for zz in np.arange(zf, zb + 0.01, 1.25):
        S.box(bg, x0 - 0.03, x0 + 0.03, 0, H, zz - 0.03, zz + 0.03, '#2E3238', lw=0.8)
    S.box(bg, x0 - 0.03, x0 + 0.03, 1.05, 1.09, zf, zb, '#2E3238', lw=0.6)
    # door in glass wall (portal to hallway)
    dz0, dz1 = 5.0, 5.95
    S.quad(bg, [(x0 + 0.01, 0, dz0), (x0 + 0.01, 0, dz1), (x0 + 0.01, 2.15, dz1), (x0 + 0.01, 2.15, dz0)], '#A7B2B8', lw=1.3)
    S.box(bg, x0 - 0.03, x0 + 0.05, 0.95, 1.0, dz1 - 0.12, dz1 - 0.08, '#C6A15B', lw=0.5)
    # reflections on glass
    for zz in (4.2, 6.1, 7.6):
        a, b2 = cam.p(x0 + 0.01, 2.4, zz), cam.p(x0 + 0.01, 0.6, zz + 0.5)
        bg.paint.append(f'<path d="M{fmt(a[0])},{fmt(a[1])} L{fmt(b2[0])},{fmt(b2[1])}" stroke="#DDE6EA" stroke-width="10" opacity="0.13"/>')
    # right wall credenza + framed print
    S.box(bg, x1 - 0.45, x1, 0, 0.75, 4.0, 6.6, '#3B3F46')
    S.quad(bg, [(x1 - 0.001, 1.3, 4.6), (x1 - 0.001, 1.3, 5.9), (x1 - 0.001, 2.0, 5.9), (x1 - 0.001, 2.0, 4.6)], '#6B7680')
    # screen
    sx0, sy0 = cam.p(-1.35, 2.3, zb - 0.01)
    sx1, sy1 = cam.p(1.35, 0.95, zb - 0.01)
    bg.lines.append(gline([(sx0, sy0), (sx1, sy0), (sx1, sy1), (sx0, sy1), (sx0, sy0)], w=1.2, op=0.9, double=False))
    S.glow(bg, (sx0 + sx1) / 2, (sy0 + sy1) / 2, (sx1 - sx0) * 1.15, '#CFE3EA', 0.30, sy=0.8)
    scr = slide(sx0, sy0, sx1 - sx0, sy1 - sy0, kink_loop=(state in ('present',)), dim=0.0)
    # table + light
    tx0, tx1, tz0, tz1 = POS['table']
    tab = S.table(tx0, tx1, tz0, tz1, col='#5E4A39')
    a = cam.p(0, 0.74, tz1 - 0.6)
    S.glow(tab, a[0], a[1] - 4, 260, '#DCEEF1', 0.22, sy=0.25)
    # props on table: laptops, cups, papers
    def laptop(o, x, z, open_=True, yaw=0):
        S.box(o, x - 0.17, x + 0.17, 0.74, 0.76, z - 0.12, z + 0.12, '#2D3036', lw=0.6)
        if open_:
            S.quad(o, [(x - 0.17, 0.76, z + 0.12), (x + 0.17, 0.76, z + 0.12), (x + 0.17, 0.98, z + 0.16), (x - 0.17, 0.98, z + 0.16)], '#3B4048', lw=0.6)
    def cup(o, x, z):
        p0 = cam.p(x, 0.74, z)
        p1 = cam.p(x, 0.84, z)
        r = cam.hu(z) * 0.18
        o.paint.append(f'<rect x="{fmt(p0[0] - r)}" y="{fmt(p1[1])}" width="{fmt(2 * r)}" height="{fmt(p0[1] - p1[1])}" fill="#E9E3D8"/><ellipse cx="{fmt(p1[0])}" cy="{fmt(p1[1])}" rx="{fmt(r)}" ry="{fmt(r * 0.35)}" fill="#F4EFE6"/>')
        o.lines.append(gline([(p0[0] - r, p1[1]), (p0[0] - r, p0[1]), (p0[0] + r, p0[1]), (p0[0] + r, p1[1])], w=0.7, op=0.6, double=False))
    laptop(tab, -0.45, 5.4, open_=True)
    laptop(tab, 0.45, 6.3, open_=not cups_moved)
    cup(tab, -0.55 if not cups_moved else -0.25, 6.6)
    cup(tab, 0.5, 5.0 if not cups_moved else 5.3)
    cup(tab, 0.55, 7.1)
    S.paper(tab, [(-0.2, 0.745, 4.8), (0.1, 0.745, 4.75), (0.12, 0.745, 5.1), (-0.18, 0.745, 5.15)])
    # ---- people
    ofin = others_finish or {}
    # Mira
    mx, mz = mira_pos or POS['mira']
    mp = mira_pose or pose(yaw=-58, spine_pitch=4, head_yaw=-10, legR=dict(flex=10, knee=6), legL=dict(flex=-8, knee=6),
                            armR=dict(flex=34, abd=20, elbow=70, hand='open', curl=0.25, inw=-25), armL=dict(flex=14, abd=8, elbow=50, hand='relax'))
    o = S.add_svg(mz, figure(MIRA, mp, cam.hu(mz), *cam.p(mx, 0, mz), finish=ofin.get('mira', 0.9), filt='paintL'))
    # director
    dx, dz = POS['director']
    fo, bo = S.chair(dx + 0.08, dz, yaw=-90, col='#2F3036')
    dpose = director_pose or seated(-90, head_yaw=-55, spine=-8, arms='table', head_pitch=-4)
    S.add_svg(dz - 0.01, figure(DIRECTOR, dpose, cam.hu(dz), *cam.p(dx, 0, dz), finish=ofin.get('director', 0.65), filt='paintL', props=False))
    # colleagues (profile, facing table, heads to screen)
    specs = [(COLL[0], POS['c_left1'], 90, 48), (COLL[1], POS['c_left2'], 90, 40), (COLL[2], POS['c_right1'], -90, -50)]
    for i, (b, (x, z), yaw, hy) in enumerate(specs):
        S.chair(x - 0.06 * (1 if yaw > 0 else -1), z, yaw=yaw, col='#56575F')
        S.add_svg(z - 0.01, figure(b, seated(yaw, head_yaw=hy, head_pitch=-3, arms='table' if i == 1 else 'lap'), cam.hu(z), *cam.p(x, 0, z),
                                   finish=ofin.get(f'c{i}', 0.4), filt='paintL', props=False))
    # near-end colleague, back to camera, chair back occludes
    x, z = POS['c_near']
    fo, bo = S.chair(x, z, yaw=180, col='#56575F')
    cid = uid('cl')
    seat_y = cam.p(x, 0.5, z)[1]
    S.add_svg(z + 0.05, f'<defs><clipPath id="{cid}"><rect x="0" y="0" width="{cam.W}" height="{fmt(seat_y)}"/></clipPath></defs><g clip-path="url(#{cid})">'
              + figure(COLL[3], seated(180, head_yaw=8, head_pitch=-6), cam.hu(z), *cam.p(x, 0, z), finish=ofin.get('c3', 0.4), filt='paintL', props=False, contact=False) + '</g>')
    bo.z = z - 0.3
    # ---- hero
    hp = hero_pose or seated(90, head_yaw=14, head_pitch=4, arms='hold')
    hx, hz = hero_pos or POS['hero_seat']
    hu = cam.hu(hz)
    ox, oy = cam.p(hx, 0, hz)
    if hp.get('seat'):
        S.chair(hx - 0.06, hz, yaw=hp['yaw'], col='#5B5C64')
    elif empty_chair:
        cx_, cz_ = POS['hero_seat']
        S.chair(cx_ - 0.06, cz_, yaw=90, col='#5B5C64')
    hfig = figure(HERO, hp, hu, ox, oy, hero=not ink_hero, filt='paintL', finish=hero_finish_override or 1.0,
                  sil=('#1d1b1a' if ink_hero else None))
    hs = f'<g filter="url(#tintCold)">{hfig}</g>' if not ink_hero else hfig
    hs += S_hero_prop(hp, hu, ox, oy, state)
    S.add_svg(hz - 0.02, hs)
    # ---- render
    blob = blob or [(ox, oy - hu * 3.6, hu * 2.6, hu * 4.4), ((sx0 + sx1) / 2, (sy0 + sy1) / 2, (sx1 - sx0) * 0.7, (sy1 - sy0) * 0.9)]
    out = S.render(blob, paint_op=paint_op)
    # slide always lit (hero object): masked by blob too
    if LAYER.get('slide', True):
        out += f'<g>{scr}</g>' if state != 'boundary' else f'<g opacity="0.35">{scr}</g>'
    if text_top:
        out += italic(64, 86, text_top, 30, '#2f2b28')
    if hung_items:
        out += ''.join(hung_items)
    out += extra_over
    cs = POS['hero_seat']
    return out, dict(cam=cam, hero=(ox, oy, hu), hand=hand_screen(HERO, hp, hu, ox, oy, 'WR'), screen=(sx0, sy0, sx1, sy1),
                     mira=cam.p(mx, 0, mz), mira_head=cam.p(mx, 1.6, mz), chair=cam.p(cs[0], 0.5, cs[1]), director=cam.p(POS['director'][0], 1.25, POS['director'][1]),
                     door=cam.p(MR['x0'], 1.0, 5.45))


def S_hero_prop(hp, hu, ox, oy, state):
    """summary in the hero's hand or lap."""
    if state in ('silence',):
        c = hand_screen(HERO, hp, hu, ox, oy, 'WR') + np.array([hu * 0.05, -hu * 0.15])
        return summary_prop(c, hu, ang=-80, scale=0.9, face_down=True)
    if hp.get('armR', {}).get('hand') in ('grip', 'phone'):
        c = hand_screen(HERO, hp, hu, ox, oy, 'WR') + np.array([hu * 0.25, -hu * 0.35])
        ang = -10 if hp['armR']['flex'] < 60 else -4
        return summary_prop(c, hu, ang=ang, scale=0.95)
    return ''


def page_html(svg_inner, W=1920, H=1080, vb=None, bg='#E4DAC6'):
    vb = vb or (0, 0, W, H)
    if bg == 'none':
        return (f'<!doctype html><html><head><meta charset="utf-8"><style>body{{margin:0;background:transparent}}</style></head><body>'
                f'<svg width="{W}" height="{H}" viewBox="{" ".join(str(v) for v in vb)}" style="display:block"><defs>{FILTERS}{EXTRA_FILTERS}</defs>{svg_inner}</svg></body></html>')
    return (f'<!doctype html><html><head><meta charset="utf-8">'
            f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&amp;family=IBM+Plex+Sans:wght@400;500&amp;family=IBM+Plex+Mono&amp;display=swap">'
            f'<style>body{{margin:0;background:{bg}}}</style></head><body>'
            f'<svg width="{W}" height="{H}" viewBox="{" ".join(str(v) for v in vb)}" style="display:block"><defs>{FILTERS}{EXTRA_FILTERS}</defs>'
            f'<rect x="-4000" y="-4000" width="12000" height="12000" fill="{bg}"/>'
            f'<rect x="-4000" y="-4000" width="12000" height="12000" filter="url(#mottle)"/>'
            f'{svg_inner}'
            f'<rect x="-4000" y="-4000" width="12000" height="12000" filter="url(#grain)" opacity="0.8"/></svg></body></html>')


# =============================================================== DESK (open plan)
DESK_CAM = dict(f=1220, hy=400, eye=1.55, cx=900)
DESK = dict(desk=(-0.95, 0.75, 2.95, 3.65), monitor=(-0.35, 3.45), hero=(0.55, 3.25), mr_door=(3.3, 7.4))
STAND_HOLD = pose(yaw=-62, head_yaw=-8, head_pitch=8, spine_pitch=4, support='L',
                  legR=dict(flex=6, knee=6), legL=dict(flex=-6, knee=4),
                  armR=dict(flex=34, abd=4, elbow=84, inw=30, hand='grip', curl=0.8),
                  armL=dict(flex=26, abd=10, elbow=20, hand='rest', curl=0.3))


def desk_scene(state='observe', camcfg=None, blob=None, loops=True, text_top=None):
    cam = Cam(**(camcfg or DESK_CAM))
    S = Stage(cam)
    bg = S.bg
    zb, H = 10.5, 2.9
    S.quad(bg, [(-6, 0, 1.0), (6, 0, 1.0), (6, 0, zb), (-6, 0, zb)], '#B7AE9E', line=False)
    S.quad(bg, [(-6, 0, zb), (6, 0, zb), (6, H, zb), (-6, H, zb)], '#CFC9BD')
    # window wall with daylight
    for i in range(-5, 6):
        S.quad(bg, [(i * 1.1 + 0.05, 0.9, zb - 0.01), (i * 1.1 + 1.0, 0.9, zb - 0.01), (i * 1.1 + 1.0, 2.6, zb - 0.01), (i * 1.1 + 0.05, 2.6, zb - 0.01)], '#E9ECE6', lw=0.7)
    S.quad(bg, [(-6, H, 1.0), (6, H, 1.0), (6, H, zb), (-6, H, zb)], '#D9D3C6', line=False)
    for zz in (3.0, 5.0, 7.0, 9.0):
        for xx in (-3.5, -0.5, 2.5):
            S.quad(bg, [(xx, H - 0.001, zz), (xx + 1.2, H - 0.001, zz), (xx + 1.2, H - 0.001, zz + 0.6), (xx, H - 0.001, zz + 0.6)], '#EFEDE6', lw=0.6, op=0.5)
    # daylight pools on floor
    for xx in (-3.0, -0.6, 1.8):
        a = cam.p(xx, 0, zb - 1.5)
        S.glow(bg, a[0], a[1], 260, '#FFF6E2', 0.35, sy=0.22)
    # far desks rows (graphite + paint)
    for zz in (6.0, 7.8):
        for xx in (-4.4, -2.0):
            o = S.obj(zz)
            S.box(o, xx, xx + 1.6, 0.72, 0.75, zz, zz + 0.75, '#BFB7A8', lw=0.8)
            S.box(o, xx + 0.6, xx + 1.0, 0.75, 1.1, zz + 0.45, zz + 0.5, '#3A3C42', lw=0.7)
            for lx in (xx + 0.05, xx + 1.55):
                S.box(o, lx - 0.02, lx + 0.02, 0, 0.72, zz + 0.05, zz + 0.09, '#8C857A', lw=0.6)
    # meeting room glass box (portal relation)
    mx0, mx1, mz0, mz1 = 2.2, 5.6, 6.2, 9.6
    o = S.obj(6.3)
    S.quad(o, [(mx0, 0, mz0), (mx1, 0, mz0), (mx1, 2.6, mz0), (mx0, 2.6, mz0)], '#9AA6AE')
    S.quad(o, [(mx0, 0, mz0), (mx0, 0, mz1), (mx0, 2.6, mz1), (mx0, 2.6, mz0)], '#8E9AA3')
    for xx in np.arange(mx0, mx1, 0.85):
        S.seg(o, (xx, 0, mz0), (xx, 2.6, mz0), lw=0.9, op=0.7)
    dx0 = 3.0
    S.quad(o, [(dx0, 0, mz0 - 0.01), (dx0 + 0.9, 0, mz0 - 0.01), (dx0 + 0.9, 2.15, mz0 - 0.01), (dx0, 2.15, mz0 - 0.01)], '#B7C1C6', lw=1.3)
    a, b2 = cam.p(mx0 + 0.3, 1.0, mz1 - 0.05), cam.p(mx1 - 0.3, 2.2, mz1 - 0.05)
    o.paint.append(f'<rect x="{fmt(a[0])}" y="{fmt(b2[1])}" width="{fmt(b2[0] - a[0])}" height="{fmt(a[1] - b2[1])}" fill="#D4E2E6" opacity="0.7"/>')
    # far colleague (graphite)
    S.add_svg(6.7, figure(COLL[0], seated(90, head_pitch=6, head_yaw=10, arms='table'), cam.hu(6.4), *cam.p(-4.7, 0, 6.4), finish=0.25, filt='paintL', props=False, contact=False))
    # ---- hero desk
    x0, x1, z0, z1 = DESK['desk']
    d = S.table(x0, x1, z0, z1, h=0.74, col='#CBBFA9')
    # monitor facing camera
    mxp, mzp = DESK['monitor']
    S.box(d, mxp - 0.14, mxp + 0.14, 0.745, 0.76, mzp - 0.02, mzp + 0.18, '#2B2D33', lw=0.7)
    m0, m1 = cam.p(mxp - 0.36, 1.27, mzp), cam.p(mxp + 0.36, 0.86, mzp)
    d.base.append(f'<rect x="{fmt(m0[0] - 6)}" y="{fmt(m0[1] - 6)}" width="{fmt(m1[0] - m0[0] + 12)}" height="{fmt(m1[1] - m0[1] + 12)}"/>')
    d.paint.append(f'<rect x="{fmt(m0[0] - 6)}" y="{fmt(m0[1] - 6)}" width="{fmt(m1[0] - m0[0] + 12)}" height="{fmt(m1[1] - m0[1] + 12)}" fill="#24262B"/>')
    mon = (f'<rect x="{fmt(m0[0])}" y="{fmt(m0[1])}" width="{fmt(m1[0] - m0[0])}" height="{fmt(m1[1] - m0[1])}" fill="#E6ECEE"/>'
           f'<text x="{fmt(m0[0] + 10)}" y="{fmt(m0[1] + 18)}" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#6b7a82">ck</text>')
    mon += slide(m0[0] + 10, m0[1] + 28, (m1[0] - m0[0]) - 20, (m1[1] - m0[1]) - 38, kink_loop=False)
    d.lines.append(gline([(m0[0] - 6, m0[1] - 6), (m1[0] + 6, m0[1] - 6), (m1[0] + 6, m1[1] + 6), (m0[0] - 6, m1[1] + 6), (m0[0] - 6, m0[1] - 6)], w=1.1, op=0.8, double=False))
    S.glow(d, (m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2, 320, '#DCEEF1', 0.25, sy=0.7)
    # mug, pencil, notebook on desk
    S.paper(d, [(0.15, 0.745, 3.05), (0.55, 0.745, 3.02), (0.57, 0.745, 3.3), (0.17, 0.745, 3.33)], fill='#E8E1D2')
    _p0, _p1 = cam.p(-0.72, 0.74, 3.1), cam.p(-0.72, 0.85, 3.1)
    _r = cam.hu(3.1) * 0.2
    d.paint.append(f'<rect x="{fmt(_p0[0] - _r)}" y="{fmt(_p1[1])}" width="{fmt(2 * _r)}" height="{fmt(_p0[1] - _p1[1])}" fill="#ECE6DB"/><ellipse cx="{fmt(_p1[0])}" cy="{fmt(_p1[1])}" rx="{fmt(_r)}" ry="{fmt(_r * 0.35)}" fill="#5a4636"/>')
    # chair pushed back
    S.chair(0.15, 3.95, yaw=0, col='#5B5C64')
    # hero standing beside the desk, summary in hand
    hx, hz = DESK['hero']
    hu = cam.hu(hz)
    ox, oy = cam.p(hx, 0, hz)
    hp = STAND_HOLD
    hs = figure(HERO, hp, hu, ox, oy, hero=True, filt='paintL')
    c = hand_screen(HERO, hp, hu, ox, oy, 'WR') + np.array([-hu * 0.25, -hu * 0.35])
    hs += summary_prop(c, hu, ang=-6, scale=1.0)
    S.add_svg(hz - 0.01, hs)
    blob = blob or [(ox, oy - hu * 3.7, hu * 2.4, hu * 4.4), ((m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2, 260, 200), ((ox + m0[0]) / 2, m1[1] + 40, 260, 120)]
    out = S.render(blob)
    out += mon
    if loops:
        kx = m0[0] + 10 + ((m1[0] - m0[0]) - 20) * (0.12 + 0.72 * 0.66)
        ky = m0[1] + 28 + ((m1[1] - m0[1]) - 38) * (0.42 + 0.45 * 0.45)
        pk = c + np.array([hu * 0.70 * (-0.38 + 0.76 * 0.66), hu * 0.96 * (-0.05 + 0.32 * 0.45)])
        loop = lambda x, y, r: f'<ellipse cx="{fmt(x)}" cy="{fmt(y)}" rx="{fmt(r)}" ry="{fmt(r * 0.7)}" fill="none" stroke="#4E4A45" stroke-width="1.6" filter="url(#pencil)"/>'
        out += loop(kx, ky, 22) + loop(pk[0], pk[1], hu * 0.16)
        out += pencil(f'<path d="M{fmt(kx + 14)},{fmt(ky + 16)} Q{fmt((kx + pk[0]) / 2)},{fmt(max(ky, pk[1]) + 70)} {fmt(pk[0] - 10)},{fmt(pk[1] + 8)}" fill="none" stroke="#4E4A45" stroke-width="1.2" stroke-dasharray="2 5"/>')
    if text_top:
        out += italic(64, 86, text_top, 30)
    return out, dict(cam=cam, hero=(ox, oy, hu), monitor=(m0, m1))


# =============================================================== HALLWAY
HALL_CAM = dict(f=1150, hy=430, eye=1.55, cx=820)
READ = pose(yaw=28, head_pitch=34, neck_fwd=0.8, spine_pitch=6, support='R', pelvis_roll=-4,
            legR=dict(flex=2, knee=2), legL=dict(flex=-6, knee=12, toe=8),
            armR=dict(flex=30, abd=4, elbow=100, inw=40, hand='grip', curl=0.8),
            armL=dict(flex=28, abd=6, elbow=96, inw=60, hand='grip', curl=0.8))


def hallway_scene(camcfg=None, blob=None, hero_pose=None, hero_pos=None, text_top=None, state='read'):
    cam = Cam(**(camcfg or HALL_CAM))
    S = Stage(cam)
    bg = S.bg
    xl, xr, H, zf, zb = -1.6, 1.7, 2.7, 1.0, 16
    S.quad(bg, [(xl, 0, zf), (xr, 0, zf), (xr, 0, zb), (xl, 0, zb)], '#A9A296', line=False)
    S.quad(bg, [(xl, 0, zf), (xl, 0, zb), (xl, H, zb), (xl, H, zf)], '#C9C2B4')
    S.quad(bg, [(xl, H, zf), (xr, H, zf), (xr, H, zb), (xl, H, zb)], '#D6D0C3', line=False)
    S.quad(bg, [(xl, 0, zb), (xr, 0, zb), (xr, H, zb), (xl, H, zb)], '#E8E4D9')
    for zz in np.arange(2.0, zb, 2.2):
        S.quad(bg, [(-0.4, H - 0.001, zz), (0.4, H - 0.001, zz), (0.4, H - 0.001, zz + 0.9), (-0.4, H - 0.001, zz + 0.9)], '#F4F2EB', lw=0.6, op=0.5)
    # window bay on left wall (daylight)
    wz0, wz1 = 4.4, 6.8
    S.quad(bg, [(xl + 0.001, 0.75, wz0), (xl + 0.001, 0.75, wz1), (xl + 0.001, 2.4, wz1), (xl + 0.001, 2.4, wz0)], '#F2F1EA', lw=1.2)
    for zz in np.arange(wz0, wz1, 0.8):
        S.seg(bg, (xl + 0.002, 0.75, zz), (xl + 0.002, 2.4, zz), op=0.6)
    S.box(bg, xl, xl + 0.18, 0.72, 0.76, wz0, wz1, '#D7D0C2', lw=0.8)
    # daylight patch on floor
    pts = [cam.p(xl, 0, wz0 + 0.3), cam.p(xl + 1.4, 0, wz0 + 0.9), cam.p(xl + 1.4, 0, wz1 + 0.9), cam.p(xl, 0, wz1 + 0.3)]
    bg.paint.append(f'<path d="{dpath(pts)}" fill="#FFF8E8" opacity="0.7" filter="url(#blur6)"/>')
    for zz in np.arange(wz0 + 0.2, wz1, 0.8):
        sh = [cam.p(xl, 2.3, zz), cam.p(xl, 2.3, zz + 0.5), cam.p(xl + 1.4, 0, zz + 1.1), cam.p(xl + 1.4, 0, zz + 0.6)]
        bg.paint.append(f'<path d="{dpath(sh)}" fill="#FFF6E0" opacity="0.10"/>')
    # right: meeting room glass wall with the meeting inside (graphite, dimmed)
    gz0, gz1 = 6.0, 13.0
    S.quad(bg, [(xr, 0, zf), (xr, 0, gz0), (xr, H, gz0), (xr, H, zf)], '#C3BCAE')
    S.quad(bg, [(xr, 0, gz0), (xr, 0, gz1), (xr, H, gz1), (xr, H, gz0)], '#9DA8B0')
    S.quad(bg, [(xr, 0, gz1), (xr, 0, zb), (xr, H, zb), (xr, H, gz1)], '#C3BCAE')
    for zz in np.arange(gz0, gz1 + 0.01, 1.4):
        S.seg(bg, (xr, 0, zz), (xr, H, zz), lw=1.0, op=0.8)
    # door into meeting room (portal)
    dz = 6.3
    S.quad(bg, [(xr - 0.001, 0, dz), (xr - 0.001, 0, dz + 0.95), (xr - 0.001, 2.15, dz + 0.95), (xr - 0.001, 2.15, dz)], '#B3BEC4', lw=1.4)
    # inside meeting (through glass): heads and table as soft graphite
    inside = Stage(cam)
    for zz, yy in ((7.6, 1.2), (8.9, 1.2), (10.2, 1.15), (11.4, 1.6)):
        a = cam.p(xr + 0.9, yy, zz)
        r = cam.hu(zz) * 0.42
        bg.lines.append(f'<ellipse cx="{fmt(a[0])}" cy="{fmt(a[1])}" rx="{fmt(r * 0.8)}" ry="{fmt(r)}" fill="none" stroke="#6b665f" stroke-width="1" opacity="0.6"/>')
        b2 = cam.p(xr + 0.9, yy - 0.55, zz)
        bg.lines.append(f'<path d="M{fmt(a[0] - r * 1.6)},{fmt(b2[1])} Q{fmt(a[0])},{fmt(a[1] + r * 0.6)} {fmt(a[0] + r * 1.6)},{fmt(b2[1])}" fill="none" stroke="#6b665f" stroke-width="1" opacity="0.5"/>')
    S.seg(bg, (xr + 0.6, 0.74, 7.0), (xr + 0.6, 0.74, 12.0), op=0.5)
    a = cam.p(xr + 2.2, 1.6, 12.6)
    S.glow(bg, a[0], a[1], 120, '#DCEEF1', 0.5)
    # floor tiles, skirting, second door, notice board, bench
    for xx in np.arange(xl, xr, 0.55):
        S.seg(bg, (xx, 0, zf), (xx, 0, zb), lw=0.5, op=0.18)
    for zz in np.arange(2.0, zb, 0.55):
        S.seg(bg, (xl, 0, zz), (xr, 0, zz), lw=0.5, op=0.14)
    S.seg(bg, (xl, 0.1, zf), (xl, 0.1, zb), op=0.4)
    S.quad(bg, [(xl + 0.001, 0, 9.6), (xl + 0.001, 0, 10.5), (xl + 0.001, 2.1, 10.5), (xl + 0.001, 2.1, 9.6)], '#B9B0A0', lw=1.1)
    S.quad(bg, [(xl + 0.001, 1.1, 7.4), (xl + 0.001, 1.1, 8.6), (xl + 0.001, 1.8, 8.6), (xl + 0.001, 1.8, 7.4)], '#D2CABB', lw=0.9)
    S.box(S.obj(8.2), xl, xl + 0.42, 0.42, 0.47, 7.6, 9.2, '#8E7F6C')
    for zz in (7.7, 9.1):
        S.box(S.obj(8.2), xl + 0.05, xl + 0.37, 0, 0.42, zz - 0.03, zz + 0.03, '#6E6253', lw=0.6)
    # meeting interior through glass (graphite construction)
    ix0, ix1 = xr + 0.9, xr + 2.3
    for (a3, b3) in [((ix0, 0.74, 7.6), (ix0, 0.74, 12.0)), ((ix1, 0.74, 7.6), (ix1, 0.74, 12.0)), ((ix0, 0.74, 7.6), (ix1, 0.74, 7.6)),
                     ((ix0, 0.0, 7.7), (ix0, 0.74, 7.7)), ((ix0, 0.0, 11.9), (ix0, 0.74, 11.9))]:
        S.seg(bg, a3, b3, lw=1.0, op=0.7)
    for zz in (8.0, 9.3, 10.6):
        S.seg(bg, (ix0 - 0.35, 0.5, zz), (ix0 - 0.35, 1.0, zz), lw=1.0, op=0.6)
    S.quad(bg, [(xr + 3.3, 0.95, 9.2), (xr + 3.3, 0.95, 11.4), (xr + 3.3, 2.1, 11.4), (xr + 3.3, 2.1, 9.2)], '#D6E3E7', lw=1.0)
    # hero
    hx, hz = hero_pos or (-0.85, 5.2)
    hp = hero_pose or READ
    hu = cam.hu(hz)
    ox, oy = cam.p(hx, 0, hz)
    hs = figure(HERO, hp, hu, ox, oy, hero=True, filt='paintL')
    if state == 'read':
        cR = hand_screen(HERO, hp, hu, ox, oy, 'WR')
        cL = hand_screen(HERO, hp, hu, ox, oy, 'WL')
        c = (cR + cL) / 2 + np.array([hu * 0.05, -hu * 0.2])
        hs += summary_prop(c, hu, ang=8, scale=1.05)
    elif state == 'walk':
        c = hand_screen(HERO, hp, hu, ox, oy, 'WR')
        hs += summary_prop(c + np.array([hu * 0.1, -hu * 0.1]), hu, ang=-70, scale=0.9)
    S.add_svg(hz, f'<g filter="url(#tintWarm)">{hs}</g>')
    w0 = cam.p(xl, 2.4, wz0)
    gp = cam.p(xr, 1.2, 8.5)
    blob = blob or [(ox, oy - hu * 3.4, hu * 3.4, hu * 4.6), (w0[0] + 90, w0[1] + 230, 240, 320), (gp[0], gp[1], 190, 260), ((ox + gp[0]) / 2, oy - hu * 1.5, 260, 180)]
    out = S.render(blob)
    if text_top:
        out += italic(64, 86, text_top, 30)
    return out, dict(cam=cam, hero=(ox, oy, hu), door=cam.p(xr, 1.0, dz + 0.45))


# =============================================================== REVEAL
AUTHOR_WORDS = ["I didn’t say anything in the room.",
                "When it ended I waited by the corridor window",
                "and asked Mira if she had a minute.",
                "My hands shook more than they would have",
                "in front of everyone."]
AUTHOR_WHY = "I needed her to say it before I said it to anyone else."


def big_page(cx, cy, w, ang=-2.5, loop=True, note=True, op=1.0):
    h = w * 1.414
    x0, y0 = -w / 2, -h / 2
    cw, ch = w * 0.76, h * 0.26
    cx0, cy0 = -cw / 2, -h * 0.12
    line = [(0, 0.2), (0.25, 0.35), (0.45, 0.3), (0.62, 0.62), (0.7, 0.48), (1, 0.8)]
    lp = ' L'.join(f'{fmt(cx0 + px * cw)},{fmt(cy0 + ch - py * ch)}' for px, py in line)
    rows = ''.join(f'<rect x="{fmt(-w * 0.38)}" y="{fmt(h * (0.22 + i * 0.035))}" width="{fmt(w * (0.74 - 0.12 * (i % 3)))}" height="{fmt(max(1, h * 0.008))}" fill="#a8a092"/>' for i in range(7))
    bars = ''.join(f'<rect x="{fmt(cx0 + i * cw / 6 + cw / 30)}" y="{fmt(cy0 + ch * (0.55 - 0.08 * (i % 3)))}" width="{fmt(cw / 9)}" height="{fmt(ch * (0.45 + 0.08 * (i % 3)))}" fill="#DAD3C4"/>' for i in range(6))
    s = (f'<g transform="translate({fmt(cx)},{fmt(cy)}) rotate({ang})" opacity="{op}">'
         f'<rect x="{fmt(x0 + 10)}" y="{fmt(y0 + 14)}" width="{fmt(w)}" height="{fmt(h)}" fill="#2a2420" opacity="0.12" filter="url(#blur6)"/>'
         f'<rect x="{fmt(x0 + 5)}" y="{fmt(y0 + 5)}" width="{fmt(w)}" height="{fmt(h)}" fill="#E3DACA"/>'
         f'<rect x="{fmt(x0)}" y="{fmt(y0)}" width="{fmt(w)}" height="{fmt(h)}" fill="#F4EFE5"/>'
         f'<rect x="{fmt(x0 + w * 0.06)}" y="{fmt(y0 + h * 0.012)}" width="{fmt(w * 0.12)}" height="{fmt(h * 0.006)}" fill="#7d7a76" transform="rotate(-28 {fmt(x0 + w * 0.06)} {fmt(y0 + h * 0.012)})"/>'
         f'<text x="{fmt(-w * 0.38)}" y="{fmt(-h * 0.40)}" font-family="IBM Plex Mono, monospace" font-size="{fmt(w * 0.032)}" letter-spacing="2" fill="#3a3633"></text>'
         f'<text x="{fmt(-w * 0.38)}" y="{fmt(-h * 0.365)}" font-family="IBM Plex Sans, sans-serif" font-size="{fmt(w * 0.026)}" fill="#7d7468">ew</text>'
         f'{bars}<path d="M{lp}" fill="none" stroke="{RED}" stroke-width="{fmt(w * 0.008)}" stroke-linejoin="round"/>{rows}')
    if loop:
        kx, ky = cx0 + 0.66 * cw, cy0 + ch - 0.55 * ch
        s += f'<ellipse cx="{fmt(kx)}" cy="{fmt(ky)}" rx="{fmt(w * 0.085)}" ry="{fmt(w * 0.06)}" fill="none" stroke="#4E4A45" stroke-width="{fmt(w * 0.005)}" transform="rotate(-14 {fmt(kx)} {fmt(ky)})" filter="url(#pencil)"/>'
    if note:
        s += (f'<text x="{fmt(w * 0.06)}" y="{fmt(-h * 0.06)}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="{fmt(w * 0.04)}" fill="#5a544c" transform="rotate(-4 {fmt(w * 0.06)} {fmt(-h * 0.06)})"></text>'
              + pencil(f'<path d="M{fmt(w * 0.05)},{fmt(-h * 0.07)} Q{fmt(w * 0.0)},{fmt(-h * 0.05)} {fmt(cx0 + 0.70 * cw)},{fmt(cy0 + ch * 0.32)}" fill="none" stroke="#5a544c" stroke-width="{fmt(w * 0.003)}"/>'))
    return s + '</g>'


def reveal(state='final', W=1920, H=1080, mobile=False):
    out = f'<rect width="{W}" height="{H}" fill="#EAE2D0"/>'
    hu = 34 if not mobile else 30
    if state in ('boundary', 'lift'):
        room, info = meeting_room('boundary', blob=[(0, 0, 1, 1)], hero_pose=SPEAK_POSE, hero_pos=POS['hero_stand'], paint_op=0.0, ink_hero=True,
                                  others_finish=dict(mira=0.0, director=0.0, c0=0.0, c1=0.0, c2=0.0, c3=0.0))
        out += f'<g opacity="{0.9 if state == "boundary" else 0.22}">{room}</g>'
        if state == 'boundary':
            out += italic(64, 86, 'That is where your version stops.', 30)
        if state == 'lift':
            ox, oy, hu_ = info['hero']
            c = info['hand']
            out += big_page(c[0] + 160, c[1] + 120, 300, ang=-6, loop=False, note=False)
        return out
    if state == 'page':
        out += big_page(W / 2, H / 2 + 20, 560 if not mobile else 520, ang=-2, loop=True, note=False)
        return out
    # final
    if not mobile:
        out += pencil(gline([(120, 880), (520, 880)], w=1.1, op=0.5))
        out += figure(HERO, SPEAK_POSE, 40, 230, 880, sil='#1d1b1a')
        out += big_page(560, 540, 470, ang=-3, loop=True, note=True)
        tx, ty = 1000, 300
        out += f'<text x="{tx}" y="{ty - 74}" font-family="IBM Plex Mono, monospace" font-size="15" letter-spacing="3" fill="{RED}">THE AUTHOR</text>'
        for i, ln in enumerate(AUTHOR_WORDS):
            out += f'<text x="{tx}" y="{ty + i * 62}" font-family="Newsreader, Georgia, serif" font-size="46" fill="#1f1c1a">{ln}</text>'
        y2 = ty + len(AUTHOR_WORDS) * 62 + 50
        out += f'<text x="{tx}" y="{y2}" font-family="IBM Plex Mono, monospace" font-size="13" letter-spacing="3" fill="{RED}">WHY</text>'
        out += f'<text x="{tx}" y="{y2 + 38}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="26" fill="#4a453f">{AUTHOR_WHY}</text>'
        out += f'<text x="{tx}" y="{y2 + 104}" font-family="IBM Plex Mono, monospace" font-size="14" fill="#8a8279">@lena_r · told in her own words · fictional story for QA</text>'
        out += pencil(gline([(tx, y2 + 150), (tx + 700, y2 + 150)], w=1, op=0.4))
        out += f'<text x="{tx}" y="{y2 + 190}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="22" fill="#6b645b">What happened after ⌄</text>'
    else:
        out += big_page(W / 2, 470, 400, ang=-3, loop=True, note=True)
        tx, ty = 52, 1000
        out += f'<text x="{tx}" y="{ty - 60}" font-family="IBM Plex Mono, monospace" font-size="20" letter-spacing="4" fill="{RED}">THE AUTHOR</text>'
        lines = ["I didn’t say anything in", "the room. When it ended I", "waited by the corridor", "window and asked Mira if", "she had a minute. My hands", "shook more than they would", "have in front of everyone."]
        for i, ln in enumerate(lines):
            out += f'<text x="{tx}" y="{ty + i * 62}" font-family="Newsreader, Georgia, serif" font-size="48" fill="#1f1c1a">{ln}</text>'
        out += f'<text x="{tx}" y="{ty + len(lines) * 62 + 50}" font-family="IBM Plex Mono, monospace" font-size="20" fill="#8a8279">@lena_r · fictional story for QA</text>'
        out += f'<text x="{tx}" y="{ty + len(lines) * 62 + 120}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="32" fill="#6b645b">What happened after ⌄</text>'
    return out


# =============================================================== POSES FOR THE SLICE
RET_POSE = pose(yaw=78, head_yaw=6, head_pitch=2, support='L', pelvis_roll=3,
                legR=dict(flex=6, knee=6), legL=dict(flex=-6, knee=4),
                armR=dict(flex=12, abd=6, elbow=58, inw=30, hand='grip', curl=0.8), armL=dict(flex=-4, abd=6, elbow=14))
DEC_POSE = pose(yaw=72, head_yaw=14, head_pitch=-2, support='L', pelvis_roll=3, spine_pitch=-2,
                legR=dict(flex=8, knee=6), legL=dict(flex=-6, knee=4),
                armR=dict(flex=16, abd=6, elbow=70, inw=35, hand='grip', curl=0.8), armL=dict(flex=-2, abd=8, elbow=24))
SPEAK_POSE = pose(yaw=74, head_pitch=-10, spine_roll=-3, support='both',
                  legR=dict(flex=8, knee=6), legL=dict(flex=-6, knee=4),
                  armR=dict(flex=104, abd=10, elbow=58, hand='grip', curl=0.8), armL=dict(flex=-2, abd=6, elbow=18))
APPROACH_POSE = pose(yaw=-128, head_pitch=4, spine_pitch=4, legR=dict(flex=14, knee=8), legL=dict(flex=-12, knee=16, toe=14),
                     armR=dict(flex=34, abd=8, elbow=66, hand='open', curl=0.3, inw=10), armL=dict(flex=6, abd=6, elbow=40, hand='grip', curl=0.8))
MIRA_PACK = pose(yaw=-100, head_pitch=6, spine_pitch=3, legR=dict(flex=12, knee=8), legL=dict(flex=-10, knee=14, toe=12),
                 armR=dict(flex=20, abd=6, elbow=96, inw=70, hand='grip', curl=0.8), armL=dict(flex=-8, abd=6, elbow=20))
SILENT_POSE = pose(yaw=90, head_yaw=8, head_pitch=6, legR=dict(flex=86, knee=90, abd=4), legL=dict(flex=82, knee=86, abd=7, turn=8),
                   armR=dict(flex=22, abd=4, elbow=60, hand='rest', curl=0.2), armL=dict(flex=18, abd=6, elbow=64, hand='rest', curl=0.2), seat=True)
