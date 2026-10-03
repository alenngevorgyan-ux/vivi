"""Large, hand-authored-style hands for the hands sheet (and close-ups)."""
import math
import numpy as np
from rig import chain, limb
from render import smooth_path, shade, uid, fmt

SKIN = '#C99A78'
COAT = '#C38A34'

FING = [  # base (x,y), phalanx lengths, width
    dict(b=(0.40, -0.075), L=(0.24, 0.14, 0.11), w=0.052),  # index
    dict(b=(0.42, -0.025), L=(0.26, 0.16, 0.11), w=0.054),  # middle
    dict(b=(0.40, 0.025), L=(0.24, 0.15, 0.10), w=0.05),   # ring
    dict(b=(0.36, 0.07), L=(0.19, 0.12, 0.09), w=0.045),   # little
]


def hand(ox, oy, scale, ang, curls, spread=0.0, thumb=(30, 20, 10), mirror=False, skin=SKIN,
         palm_w=0.15, depth_shade=True, sleeve=None, sleeve_len=0.7, show_thumb=True, line=True, only_thumb=False):
    """curls: list of 4 (a1,a2,a3) in degrees, + bends to palm (+y). Returns svg."""
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    my = -1 if mirror else 1

    def T(p):
        x, y = p[0], p[1] * my
        return np.array([ox + (x * ca - y * sa) * scale, oy + (x * sa + y * ca) * scale])
    out = []
    dk = shade(skin, -0.16)
    # sleeve behind wrist
    if sleeve:
        sl = [T((-sleeve_len, -0.19)), T((-0.02, -0.165)), T((0.01, 0.0)), T((-0.03, 0.165)), T((-sleeve_len, 0.19))]
        out.append(('sleeve', sl))
    # fingers back-to-front: little, ring, middle, index
    fpaths = []
    for i in (3, 2, 1, 0):
        f = FING[i]
        a = math.radians((1.5 - i) * -spread * 8)
        p = np.array(f['b'], float)
        pts = [p]
        ws = [f['w'] * 1.08]
        for k in range(3):
            a += math.radians(curls[i][k])
            p = p + np.array([math.cos(a), math.sin(a)]) * f['L'][k]
            pts.append(p)
            ws.append(f['w'] * (1 - 0.1 * (k + 1)))
        fpaths.append((i, [T(q) for q in pts], [w * scale for w in ws]))
    palm = [T(q) for q in [(-0.02, -palm_w * 0.85), (0.20, -palm_w * 1.02), (0.43, -0.10), (0.45, 0.0),
                            (0.40, 0.095), (0.22, palm_w * 0.95), (-0.02, palm_w * 0.8)]]
    # thumb
    tpts = [np.array((0.04, -0.10))]
    a = math.radians(-thumb[0] * 0.7 + 4)
    p = tpts[0]
    for k, Lk in enumerate((0.15, 0.12, 0.10)):
        if k > 0:
            a += math.radians(thumb[k] if k < len(thumb) else 0)
        p = p + np.array([math.cos(a), math.sin(a)]) * Lk
        tpts.append(p)
    tws = [0.075, 0.068, 0.058, 0.048]
    svg = []
    if only_thumb:
        tp = [T(q) for q in tpts]
        d = smooth_path(chain(tp, [w * scale for w in tws], n=3, cap=5), tension=0.4)
        return f'<path d="{d}" fill="{skin}" stroke="{dk}" stroke-width="{fmt(0.008 * scale)}"/>'
    for role, pts in out:
        svg.append(f'<path d="{smooth_path(pts, tension=0.15)}" fill="{COAT if sleeve is True else sleeve}"/>')
    for i, pts, ws in fpaths:
        col = shade(skin, -0.05 * (3 - i)) if depth_shade else skin
        d = smooth_path(chain(pts, ws, n=3, cap=5), tension=0.4)
        svg.append(f'<path d="{d}" fill="{col}"' + (f' stroke="{dk}" stroke-width="{fmt(0.008 * scale)}"' if line else '') + '/>')
    svg.append(f'<path d="{smooth_path(palm)}" fill="{skin}"/>')
    # knuckle shadow line
    if line:
        k1 = [T(q) for q in [(0.30, -0.09), (0.36, -0.02), (0.34, 0.06)]]
        svg.append(f'<path d="M{fmt(k1[0][0])},{fmt(k1[0][1])} Q{fmt(k1[1][0])},{fmt(k1[1][1])} {fmt(k1[2][0])},{fmt(k1[2][1])}" '
                   f'fill="none" stroke="{dk}" stroke-width="{fmt(0.01 * scale)}" opacity="0.6"/>')
    if show_thumb:
        tp = [T(q) for q in tpts]
        d = smooth_path(chain(tp, [w * scale for w in tws], n=3, cap=5), tension=0.4)
        svg.append(f'<path d="{d}" fill="{skin}"' + (f' stroke="{dk}" stroke-width="{fmt(0.008 * scale)}"' if line else '') + '/>')
    # cuff over wrist
    if sleeve:
        cuff = [T((-0.32, -0.172)), T((-0.02, -0.165)), T((0.01, 0.0)), T((-0.03, 0.165)), T((-0.32, 0.175))]
        sc = COAT if sleeve is True else sleeve
        svg.append(f'<path d="{smooth_path(cuff, tension=0.15)}" fill="{sc}"/>')
        e = [T((-0.06, -0.16)), T((-0.07, 0.16))]
        svg.append(f'<path d="M{fmt(e[0][0])},{fmt(e[0][1])} L{fmt(e[1][0])},{fmt(e[1][1])}" stroke="{shade(sc, -0.25)}" stroke-width="{fmt(0.012 * scale)}"/>')
    return ''.join(svg)


def shadow_clip(svg_inner, off=(6, 4), dark='#00000022'):
    return svg_inner
