"""SVG rendering of rig parts in four styles."""
import math
import numpy as np
from rig import build, bbox, ellipse, chain, limb, N

_uid = [0]


def uid(p='u'):
    _uid[0] += 1
    return f'{p}{_uid[0]}'


def hexrgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgbhex(c):
    return '#' + ''.join(f'{max(0, min(255, int(round(v)))):02x}' for v in c)


def shade(h, k):
    """k<0 darken, k>0 lighten toward paper"""
    c = hexrgb(h)
    if k < 0:
        return rgbhex([v * (1 + k) for v in c])
    tgt = [236, 228, 212]
    return rgbhex([v + (t - v) * k for v, t in zip(c, tgt)])


def mix(a, b_, t):
    A, B = hexrgb(a), hexrgb(b_)
    return rgbhex([x + (y - x) * t for x, y in zip(A, B)])


def fmt(v):
    return f'{v:.3f}'.rstrip('0').rstrip('.')


def smooth_path(pts, closed=True, tension=0.5):
    pts = [np.asarray(p, float) for p in pts]
    n = len(pts)
    if n < 3:
        return 'M' + ' L'.join(f'{fmt(p[0])},{fmt(p[1])}' for p in pts) + ('Z' if closed else '')
    d = f'M{fmt(pts[0][0])},{fmt(pts[0][1])}'
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if closed or i > 0 else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if closed or i + 2 < n else p2
        c1 = p1 + (p2 - p0) * tension / 3
        c2 = p2 - (p3 - p1) * tension / 3
        d += f' C{fmt(c1[0])},{fmt(c1[1])} {fmt(c2[0])},{fmt(c2[1])} {fmt(p2[0])},{fmt(p2[1])}'
    return d + ('Z' if closed else '')


def poly_path(pts, step=1):
    pts = pts[::step] if step > 1 else pts
    return 'M' + ' L'.join(f'{fmt(p[0])},{fmt(p[1])}' for p in pts) + 'Z'


def egg(c, rx, ry, rot, n=28, chin=0.16):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        y = math.sin(a) * ry
        x = math.cos(a) * rx * (1 - chin * max(0, math.sin(a)))  # +y is down (chin)
        cr, sr = math.cos(rot), math.sin(rot)
        out.append(np.array([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr]))
    return out


# --------------------------------------------------------------- heads
def head_shapes(h, style='A', hairkind=None):
    """returns list of (role, pts) in draw order"""
    c, rx, ry, rot = h['c'], h['rx'], h['ry'], h['rot']
    side, facing = h['side'], h['facing']
    hair = hairkind or h['hair']
    sg = 1 if side >= 0 else -1
    asd = min(1, abs(side))
    cr, sr = math.cos(rot), math.sin(rot)

    def L(x, y):  # local (x toward face side, y down) -> screen
        x *= sg
        return np.array([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr])
    out = []
    # back hair drapes (behind head)
    if hair in ('long', 'tied'):
        back = -0.55 * asd
        pts = [L(back * rx - 0.05, -0.3 * ry), L(back * rx - 0.45 * rx * asd - 0.1, 0.4 * ry),
               L(back * rx - 0.35 * asd - 0.05, 1.45 * ry if hair == 'long' else 1.0 * ry),
               L(0.15 * rx * (1 - asd) + back * rx * 0.2, 1.5 * ry if hair == 'long' else 0.9 * ry),
               L(0.55 * rx * (1 - asd), 1.2 * ry), L(0.6 * rx * (1 - asd), -0.3 * ry)]
        if hair == 'tied':
            pts = [L(-0.7 * rx * asd, -0.1 * ry), L(-1.05 * rx * asd - 0.1 * (1 - asd), 0.5 * ry),
                   L(-0.95 * rx * asd - 0.05, 1.05 * ry), L(-0.6 * rx * asd, 0.4 * ry)]
        out.append(('hair', pts))
    if hair == 'bob':
        pts = [L(-1.08 * rx, -0.2 * ry), L(-1.12 * rx, 0.55 * ry), L(-0.2 * rx * asd, 0.72 * ry),
               L(0.2 * rx * (1 - asd), 0.7 * ry), L(1.05 * rx * (1 - asd) + 0.1 * asd, 0.5 * ry), L(rx, -0.3 * ry)]
        out.append(('hair', pts))
    # skin head
    face = egg(c, rx, ry, rot, chin=0.18)
    out.append(('skin', face))
    # nose/jaw protrusion in profile-ish views
    if facing > -0.35 and asd > 0.35:
        k = (asd - 0.35) / 0.65
        nose = [L(0.88 * rx, -0.12 * ry), L(rx + 0.07 * k, 0.14 * ry), L(0.93 * rx, 0.2 * ry), L(0.8 * rx, 0.12 * ry)]
        out.append(('skin', nose))

    # hair cap
    vol = {'crop': 1.04, 'short': 1.09, 'bob': 1.1, 'long': 1.09, 'tied': 1.06, 'bun': 1.07,
           'curly': 1.22, 'thin': 1.02, 'scarf': 1.12, 'bald': 1.0}.get(hair, 1.08)
    if hair != 'bald':
        a0 = 18 + 52 * asd
        a1 = 162 + 92 * asd
        if hair in ('crop', 'thin'):
            a0 += 10
            a1 -= 10 * (1 - asd)
        if hair == 'scarf':
            a0, a1 = -20 + 40 * asd, 200 + 60 * asd
        if facing < -0.15:
            t = min(1, (-facing - 0.15) * 2.2)
            a1 = a1 + (360 + a0 - 8 - a1) * t
        arc = []
        steps = 16
        for i in range(steps + 1):
            a = math.radians(a0 + (a1 - a0) * i / steps)
            # angles measured from +x (face side) toward up (-y)
            x = math.cos(a) * rx * vol
            y = -math.sin(a) * ry * (vol if math.sin(a) > 0 else 1.02)
            if hair == 'curly':
                x += 0.03 * math.cos(9 * a)
                y += 0.03 * math.sin(9 * a)
            arc.append(L(x, y))
        if facing < -0.15 and a1 - a0 > 300:
            pts = arc
        else:
            # hairline: chord pulled toward crown
            if hair == 'scarf':
                pts = arc + [L(0.0, 0.25 * ry)]
            else:
                hl = 0.55 if hair in ('crop', 'thin') else 0.42
                fr = [(-0.62, -0.30), (0.0, -hl - 0.05), (0.62, -0.30)]
                pr = [(-0.32, 0.30), (0.30, -0.12), (0.55, -0.30)]
                pts = arc + [L((fx * (1 - asd) + px * asd) * rx, (fy * (1 - asd) + py * asd) * ry)
                             for (fx, fy), (px, py) in zip(fr, pr)]
        out.append(('hair', pts))
        if hair == 'bun':
            out.append(('hair', ellipse(L(-0.75 * rx * asd, -0.85 * ry + 0.25 * asd), 0.22, 0.2, n=12)))
    # nose / brow shadow (features option B)
    face = FACE[0]
    if face == 'B' and facing > 0.5 and asd < 0.3:
        nx = (0.12 + 0.75 * asd) * rx
        sh = [L(nx + 0.01, -0.10 * ry), L(nx + 0.035, 0.2 * ry), L(nx - 0.07, 0.22 * ry)]
        out.append(('skin_sh', sh))
    if face == 'C' and facing > 0.1:
        ex = (0.1 + 0.55 * asd) * rx
        for dx in ((-0.28, 0.12) if asd < 0.5 else (0.0,)):
            out.append(('ink', ellipse(L(ex + dx * rx * (1 - asd) - 0.05 * asd, -0.06 * ry), 0.035, 0.022, n=8)))
        out.append(('ink', [L(ex - 0.08, 0.42 * ry), L(ex + 0.08 * (1 - asd) + 0.04, 0.42 * ry), L(ex + 0.08 * (1 - asd) + 0.04, 0.445 * ry), L(ex - 0.08, 0.445 * ry)]))
    return out


FACE = ['B']


# --------------------------------------------------------------- figure
def palette_roles(b, style, hero):
    pal = b['pal']
    coat = pal['coat']
    if b['coat'] in ('shirt',):
        coat = pal['inner']
    roles = {
        'ink': '#3A2A22',
        'coat': coat, 'coat_far': shade(coat, -0.18),
        'trousers': pal['trousers'], 'trousers_far': shade(pal['trousers'], -0.25),
        'skin': pal['skin'], 'skin_far': shade(pal['skin'], -0.15), 'skin_sh': shade(pal['skin'], -0.28),
        'hair': pal['hair'], 'inner': pal['inner'], 'inner_sleeve': pal['inner'], 'inner_far': shade(pal['inner'], -0.15),
        'shoe': pal['shoe'], 'scarf': pal['scarf'], 'belt': shade(coat, -0.2), 'phone': '#DCEEF1', 'head': pal['skin'],
    }
    return roles


SH_OFF = {'skirt': 0.30, 'torso': 0.26, 'arm': 0.10, 'leg': 0.11, 'pelvis': 0.0, 'head': 0.08}


def chair_svg(J, hu, ox, oy, sx, table=False, col='#5B5650'):
    """graphite chair (and optional table) under a seated figure, in screen px"""
    from rig import P2
    P = P2(J['P']); fp = J['fp']
    fx = fp[0] if abs(fp[0]) > 0.2 else 0.2
    sgn = 1 if fx > 0 else -1
    seat_y = P[1] + 0.32
    back_x = P[0] - sgn * 0.55
    front_x = P[0] + sgn * 0.75
    def T(x, y):
        return (ox + x * sx, oy + y * hu)
    lines = []
    (ax, ay), (bx, by) = T(back_x, seat_y), T(front_x, seat_y)
    lines.append(f'M{fmt(ax)},{fmt(ay)} L{fmt(bx)},{fmt(by)}')
    lines.append(f'M{fmt(ax)},{fmt(ay+0.12*hu)} L{fmt(bx)},{fmt(by+0.12*hu)}')
    for xx in (back_x + sgn*0.06, front_x - sgn*0.06):
        a = T(xx, seat_y + 0.12); b2 = T(xx, 0)
        lines.append(f'M{fmt(a[0])},{fmt(a[1])} L{fmt(b2[0])},{fmt(b2[1])}')
    a = T(back_x, seat_y); b2 = T(back_x - sgn * 0.12, seat_y - 2.0)
    lines.append(f'M{fmt(a[0])},{fmt(a[1])} L{fmt(b2[0])},{fmt(b2[1])}')
    a = T(back_x + sgn*0.12, seat_y); b2 = T(back_x, seat_y - 2.0)
    lines.append(f'M{fmt(a[0])},{fmt(a[1])} L{fmt(b2[0])},{fmt(b2[1])}')
    s = f'<g fill="none" stroke="{col}" stroke-width="1.3" stroke-linecap="round" filter="url(#pencil)"><path d="{" ".join(lines)}"/></g>'
    if table:
        tx0, tx1 = P[0] + sgn * 1.45, P[0] + sgn * 3.6
        ty = seat_y - 1.1
        a = T(tx0, ty); b2 = T(tx1, ty)
        tl = [f'M{fmt(a[0])},{fmt(a[1])} L{fmt(b2[0])},{fmt(b2[1])}', f'M{fmt(a[0])},{fmt(a[1]+0.1*hu)} L{fmt(b2[0])},{fmt(b2[1]+0.1*hu)}']
        for xx in (tx0 + sgn * 0.15, tx1 - sgn * 0.15):
            c1 = T(xx, ty + 0.1); c2 = T(xx, 0)
            tl.append(f'M{fmt(c1[0])},{fmt(c1[1])} L{fmt(c2[0])},{fmt(c2[1])}')
        s += f'<g fill="none" stroke="{col}" stroke-width="1.3" stroke-linecap="round" filter="url(#pencil)"><path d="{" ".join(tl)}"/></g>'
    return s


def figure(b, p, hu, ox, oy, style='A', hero=False, flip=False, light=(-1, -0.55), sil=None,
           finish=1.0, filt=None, extra_attr='', props=True, table=False, halo=None, contact=True):
    """returns svg string. finish: 1 fully painted, <1 graphite-ish (NPC out of attention).
    sil: color for pure silhouette mode."""
    parts, J = build(b, p, hero)
    roles = palette_roles(b, style, hero)
    sx = -hu if flip else hu
    lx, ly = light
    if flip:
        lx = -lx
    ln = math.hypot(lx, ly)
    lx, ly = lx / ln, ly / ln
    g = []
    local_defs = []
    pre = ''
    if contact and not sil:
        for sd in 'RL':
            hl, tl = J['heel' + sd], J['toe' + sd]
            if min(hl[1], tl[1]) < 0.12:
                cx = (hl[0] + tl[0]) / 2 * (-1 if flip else 1)
                ln_ = abs(hl[0] - tl[0]) / 2 + 0.25
                pre += f'<ellipse cx="{fmt(ox + cx * hu)}" cy="{fmt(oy + 0.02 * hu)}" rx="{fmt(ln_ * hu)}" ry="{fmt(0.075 * hu)}" fill="url(#contactG)"/>'
    if props and p.get('seat'):
        pre = chair_svg(J, hu, ox, oy, sx, table=table or p is None)
    if table and not p.get('seat'):
        pass

    def P(d):
        pts = d['pts']
        if style == 'C':
            return poly_path(pts, step=max(1, len(pts) // 9))
        return smooth_path(pts, tension=0.5 if d.get('smooth', True) else 0.18)

    seams = [pt for pt in parts if pt['role'] in ('seam', 'fold')]
    parts = [pt for pt in parts if pt['role'] not in ('seam', 'fold')]
    draw = []
    for pt in parts:
        if pt['role'] == 'head':
            for i_, (r_, pts) in enumerate(head_shapes(pt['head'], style)):
                draw.append(dict(role=r_, pts=pts, shade=(r_ == 'skin' and FACE[0] != 'A'), tag='head', group=('headskin' if r_ == 'skin' else None)))
        else:
            draw.append(pt)

    tr = f'translate({fmt(ox)},{fmt(oy)}) scale({fmt(sx)},{fmt(hu)})'
    if sil:
        body_ = ''.join(f'<path d="{P(d)}"/>' for d in draw)
        fa = f' filter="url(#{filt})"' if filt else ''
        return pre * 0 + f'<g{fa} {extra_attr}><g transform="{tr}" fill="{sil}">{body_}</g></g>'

    # group consecutive parts with same group key
    items = []
    for d in draw:
        gk = d.get('group')
        if gk and items and isinstance(items[-1], list) and items[-1][0].get('group') == gk:
            items[-1].append(d)
        elif gk:
            items.append([d])
        else:
            items.append(d)

    def col_of(d):
        c = roles.get(d['role'], '#888')
        if style == 'C' and d['role'] == 'coat':
            c = mix(c, '#B5523A', 0.35)
        if finish < 1:
            c = mix('#C9C0AF', c, finish)
        return c

    if style in ('A', 'C'):
        if hero and style == 'A':
            hl = ''.join(f'<path d="{P(d)}"/>' for d in draw)
            hc = halo or '#EDE5D3'
            g.append(f'<g fill="{hc}" stroke="{hc}" stroke-width="0.15" stroke-linejoin="round" opacity="0.85">{hl}</g>')
        for it in items:
            grp = it if isinstance(it, list) else [it]
            d0 = grp[0]
            col = col_of(d0)
            off = max(SH_OFF.get(d.get('tag'), 0.0) for d in grp) if d0.get('shade') else 0
            if style == 'C' and d0['role'] == 'skin' and d0.get('tag') == 'head':
                off = 0.2
            if off > 0 and finish > 0.4:
                cid = uid('c')
                paths = ''.join(f'<path d="{P(d)}"/>' for d in grp)
                local_defs.append(f'<clipPath id="{cid}">{paths}</clipPath>')
                k = -0.30 if style == 'C' else -0.22
                g.append(f'<g fill="{shade(col, k)}">{paths}</g>')
                tx, ty = (lx * off * 1.5, 0) if style == 'C' else (lx * off, ly * off * 0.6)
                g.append(f'<g clip-path="url(#{cid})"><g fill="{col}" transform="translate({fmt(tx)},{fmt(ty)})">{paths}</g></g>')
            else:
                for d in grp:
                    g.append(f'<path d="{P(d)}" fill="{col_of(d)}"/>')
        if style == 'A' and finish > 0.6:
            for sm in seams:
                if sm['role'] == 'fold':
                    g.append(f'<path d="{smooth_path(sm["pts"], closed=False)}" fill="none" stroke="{shade(roles["coat"], -0.32)}" stroke-width="0.032" stroke-linecap="round" opacity="0.75"/>')
                else:
                    g.append(f'<path d="{smooth_path(sm["pts"], closed=False)}" fill="none" stroke="{shade(roles["coat"], -0.3)}" stroke-width="0.035" stroke-linecap="round"/>')
        if finish < 1:
            outl = ''.join(f'<path d="{P(d)}"/>' for d in draw)
            g.insert(0, f'<g fill="#5B5650" stroke="#5B5650" stroke-width="0.07" stroke-linejoin="round" opacity="{fmt(min(1, 1.2 * (1 - finish)))}">{outl}</g>')
    elif style == 'B':
        wash = ''.join(f'<path d="{P(d)}"/>' for d in draw if d['role'] in ('coat', 'coat_far', 'scarf'))
        washs = ''.join(f'<path d="{P(d)}"/>' for d in draw if d['role'].startswith('skin'))
        washt = ''.join(f'<path d="{P(d)}"/>' for d in draw if d['role'].startswith(('trousers', 'hair', 'shoe')))
        allp = ''.join(f'<path d="{P(d)}"/>' for d in draw if d['role'] != 'skin_sh')
        g.append(f'<g fill="#34322F" stroke="#34322F" stroke-width="0.075" stroke-linejoin="round">{allp}</g>')
        g.append(f'<g fill="#ECE4D2">{allp}</g>')
        front = ''.join(f'<path d="{P(d)}"/>' for d in draw if (d.get('z', 2) >= 1 or d.get('tag') == 'head') and d['role'] != 'skin_sh')
        g.append(f'<g fill="#ECE4D2" stroke="#34322F" stroke-width="0.034" stroke-linejoin="round">{front}</g>')
        g.append(f'<g transform="translate(0.16,0.09)" style="mix-blend-mode:multiply">'
                 f'<g fill="{b["pal"]["coat"]}" opacity="0.85">{wash}</g>'
                 f'<g fill="{b["pal"]["skin"]}" opacity="0.45">{washs}</g>'
                 f'<g fill="#4d5060" opacity="0.4">{washt}</g></g>')
    elif style == 'D':
        body_ = ''.join(f'<path d="{P(d)}"/>' for d in draw)
        g.append(f'<g fill="#E9B567" transform="translate({fmt(lx * 0.08)},{fmt(ly * 0.08)})">{body_}</g>')
        g.append(f'<g fill="#18171D">{body_}</g>')
        hands = ''.join(f'<path d="{P(d)}"/>' for d in draw if d['role'] in ('skin', 'skin_far') and d.get('tag') not in ('head', 'neck'))
        g.append(f'<g fill="#B88A66">{hands}</g>')
    ph = ''.join(f'<path d="{P(d)}"/>' for d in draw if d['role'] == 'phone')
    if ph and style != 'B':
        g.append(f'<g fill="#DCEEF1">{ph}</g>')
    fa = f' filter="url(#{filt})"' if filt else ''
    s = (pre + f'<g{fa} {extra_attr}>' + (f'<defs>{"".join(local_defs)}</defs>' if local_defs else '') +
         f'<g transform="{tr}">' + ''.join(g) + '</g></g>')
    if ph and style != 'B':
        # phone glow, unfiltered
        from rig import P2
        s += ''
    return s


def ground_shadow(ox, oy, hu, w=1.6, op=0.22, col='#2b2620'):
    return f'<ellipse cx="{fmt(ox)}" cy="{fmt(oy)}" rx="{fmt(w * hu)}" ry="{fmt(0.16 * hu)}" fill="{col}" opacity="{op}" filter="url(#soft)"/>'


FILTERS = '''
<filter id="paint" x="-15%" y="-10%" width="130%" height="120%">
 <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="4" result="n1"/>
 <feDisplacementMap in="SourceGraphic" in2="n1" scale="4.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="n2"/>
 <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0 0.04  0 0 0 -1.3 0.78" result="g"/>
 <feComposite in="g" in2="d" operator="in" result="gd"/>
 <feMerge><feMergeNode in="d"/><feMergeNode in="gd"/></feMerge>
</filter>
<filter id="paintL" x="-15%" y="-10%" width="130%" height="120%">
 <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="7" result="n1"/>
 <feDisplacementMap in="SourceGraphic" in2="n1" scale="8" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="2" result="n2"/>
 <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.06  0 0 0 0 0.04  0 0 0 -1.3 0.8" result="g"/>
 <feComposite in="g" in2="d" operator="in" result="gd"/>
 <feMerge><feMergeNode in="d"/><feMergeNode in="gd"/></feMerge>
</filter>
<filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
 <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="n"/>
 <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
 <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="11" result="n"/>
 <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="5" result="n2"/>
 <feColorMatrix in="n2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.5" result="a"/>
 <feComposite in="d" in2="a" operator="in"/>
</filter>
<radialGradient id="contactG"><stop offset="0" stop-color="#120e0b" stop-opacity="0.55"/><stop offset="0.6" stop-color="#120e0b" stop-opacity="0.25"/><stop offset="1" stop-color="#120e0b" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="soft12" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="soft30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="island" x="-20%" y="-20%" width="140%" height="140%">
 <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="21" result="n"/>
 <feDisplacementMap in="SourceGraphic" in2="n" scale="80" xChannelSelector="R" yChannelSelector="G" result="d"/>
 <feGaussianBlur in="d" stdDeviation="2.5"/>
</filter>
<filter id="grain" x="0" y="0" width="100%" height="100%">
 <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="1" stitchTiles="stitch"/>
 <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0.10 0"/>
</filter>
<filter id="mottle" x="0" y="0" width="100%" height="100%">
 <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="3" seed="8" stitchTiles="stitch"/>
 <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 0.16 -0.02"/>
</filter>
'''
