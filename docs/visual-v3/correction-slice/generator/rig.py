"""Vivi character rig: light 3D skeleton -> projected 2D part outlines.
Units: head units (hu). Screen: x right, y down. Ground at y=0.
"""
import math
import numpy as np

UP = np.array([0., 1., 0.])


def N(a):
    n = np.linalg.norm(a)
    return a / n if n > 1e-9 else a


def perp(v, d):
    """component of v perpendicular to unit d, normalized"""
    p = v - d * np.dot(v, d)
    return N(p)


def frame(yaw_deg):
    t = math.radians(yaw_deg)
    f = np.array([math.sin(t), 0., math.cos(t)])
    r = np.array([-math.cos(t), 0., math.sin(t)])
    return f, r


def rad(d):
    return math.radians(d)


# ---------------------------------------------------------------- bodies
BASE = dict(
    heads=7.4, sb=0.70, shb=0.84, chest=0.76, waist=0.58, hip=0.72, depth=0.50,
    limb=1.0, head_w=0.76, head_h=1.02, neck_w=0.24,
    coat='long', hem=2.0, flare=0.06, open=True,
    hair='short', scarf=False, belt=False, stoop=0.0, hand=1.0,
    pal=dict(coat='#C38A34', trousers='#2A2B36', skin='#C99A78', hair='#2B211B',
             inner='#B9A991', shoe='#1C1A19', scarf='#B5523A'),
)


def body(**kw):
    b = dict(BASE)
    pal = dict(BASE['pal'])
    pal.update(kw.pop('pal', {}))
    b.update(kw)
    b['pal'] = pal
    return b


def lengths(b):
    extra = b['heads'] - 7.25
    L = dict(ankle=0.30, shin=1.72 + extra * 0.30, thigh=1.78 + extra * 0.30,
             spine=2.15 + extra * 0.28, neck=0.29 + extra * 0.06,
             uarm=1.40 + extra * 0.20, farm=1.20 + extra * 0.18, hand=0.70 * b['hand'])
    return L


# ---------------------------------------------------------------- poses
DEF_ARM = dict(flex=4, abd=6, elbow=10, inw=0, wrist=0, hand='relax', shrug=0, curl=0.35)
DEF_LEG = dict(flex=0, abd=3, knee=3, turn=8, toe=0)
DEF_POSE = dict(yaw=35, twist=0, head_yaw=0, head_pitch=0, head_roll=0,
                spine_pitch=0, spine_roll=0, pelvis_roll=0, neck_fwd=0.0,
                x=0., lift=0., support='both', seat=None, phone=False)


def pose(**kw):
    p = dict(DEF_POSE)
    for k in ('armR', 'armL'):
        a = dict(DEF_ARM)
        a.update(kw.pop(k, {}))
        p[k] = a
    for k in ('legR', 'legL'):
        a = dict(DEF_LEG)
        a.update(kw.pop(k, {}))
        p[k] = a
    p.update(kw)
    return p


# ---------------------------------------------------------------- solve
def solve(b, p):
    L = lengths(b)
    J = {}
    fp, rp = frame(p['yaw'])
    stoop = b.get('stoop', 0)
    hipH = L['ankle'] + L['shin'] + L['thigh']
    P = np.array([0., hipH, 0.])
    # pelvis roll (hip drop)
    pr = rad(p['pelvis_roll'])
    rp2 = N(rp * math.cos(pr) + UP * math.sin(pr))
    # spine
    sp = rad(p['spine_pitch'] + stoop * 10)
    sr = rad(p['spine_roll'])
    s = N(UP * math.cos(sp) * math.cos(sr) + fp * math.sin(sp) + rp * math.sin(sr))
    fc0, rc0 = frame(p['yaw'] + p['twist'])
    fc = perp(fc0, s)
    rc = N(np.cross(fc, s)) * -1
    if np.dot(rc, rc0) < 0:
        rc = -rc
    Nb = P + s * L['spine']
    # rounded upper back: neck base pushed forward
    Nb = Nb + fc * (0.10 * stoop + 0.06 * p['neck_fwd'])
    J.update(P=P, s=s, fp=fp, rp=rp2, fc=fc, rc=rc, Nb=Nb)
    # shoulders
    for side, key, sg in (('R', 'armR', 1), ('L', 'armL', -1)):
        a = p[key]
        sh = Nb + rc * sg * b['sb'] - s * 0.26 + s * a['shrug'] * 0.22 + fc * a['shrug'] * 0.05
        side_v = rc * sg
        fl, ab = rad(a['flex']), rad(a['abd'])
        fhor = N(np.array([fc0[0], 0, fc0[2]]))
        d = N(-UP * math.cos(fl) * math.cos(ab) + fhor * math.sin(fl) * math.cos(ab) + side_v * math.sin(ab))
        E = sh + d * L['uarm']
        inw = rad(a['inw'])
        ref = fhor * math.cos(inw) - side_v * math.sin(inw) + UP * 0.15
        bb = ref - d * np.dot(ref, d)
        if np.linalg.norm(bb) < 1e-3:
            bb = UP - d * np.dot(UP, d)
        bb = N(bb)
        e = rad(a['elbow'])
        fd = N(d * math.cos(e) + bb * math.sin(e))
        W = E + fd * L['farm']
        bb2 = perp(bb, fd) if abs(np.dot(bb, fd)) < 0.99 else bb
        w = rad(a['wrist'])
        hd = N(fd * math.cos(w) + bb2 * math.sin(w))
        # thumb direction
        t3 = fhor * 0.8 - side_v * 0.5
        t3 = perp(t3, hd)
        J['Sh' + side] = sh
        J['E' + side] = E
        J['W' + side] = W
        J['hd' + side] = hd
        J['th' + side] = t3
        J['side' + side] = side_v
    # hips / legs
    for side, key, sg in (('R', 'legR', 1), ('L', 'legL', -1)):
        a = p[key]
        hp = P + rp2 * sg * b['hip'] * 0.62
        side_v = rp * sg
        fl, ab = rad(a['flex']), rad(a['abd'])
        t = N(-UP * math.cos(fl) * math.cos(ab) + fp * math.sin(fl) * math.cos(ab) + side_v * math.sin(ab))
        K = hp + t * L['thigh']
        bk = perp(-fp, t) if abs(np.dot(fp, t)) < 0.99 else -UP
        k = rad(a['knee'])
        sd = N(t * math.cos(k) + bk * math.sin(k))
        A = K + sd * L['shin']
        ff, _ = frame(p['yaw'] + sg * -a['turn'])
        tp = rad(a['toe'])
        fdir = N(ff * math.cos(tp) - UP * math.sin(tp))
        heel = A - UP * 0.26 - ff * 0.12
        toe = A - UP * 0.26 + fdir * 0.86 + UP * 0.0
        if a['toe'] > 0:  # heel lifted, rotate about toe ball
            heel = A - UP * 0.20 - fdir * 0.14
            toe = heel + fdir * 0.98
        J['H' + side] = hp
        J['K' + side] = K
        J['A' + side] = A
        J['heel' + side] = heel
        J['toe' + side] = toe
    # head
    hp_ = rad(p['head_pitch'])
    fh0, rh0 = frame(p['yaw'] + p['twist'] + p['head_yaw'])
    nd = N(s + fc * (0.18 + 0.25 * p['neck_fwd'] + 0.2 * stoop))
    head_up = N(nd * math.cos(hp_) + fh0 * math.sin(hp_))
    hroll = rad(p['head_roll'])
    head_up = N(head_up + rh0 * math.sin(hroll))
    fh = perp(fh0 - UP * math.sin(hp_) * 1.0, head_up)
    Hn = Nb + nd * L['neck']
    Hc = Hn + head_up * 0.42 + fh * 0.05
    J.update(Hn=Hn, Hc=Hc, hup=head_up, fh=fh, rh=rh0, nd=nd)
    # ground: put lowest foot at y=0
    feet = []
    sup = p['support']
    for side in 'RL':
        if sup == 'both' or sup == side:
            feet += [J['heel' + side][1], J['toe' + side][1]]
    lo = min(feet)
    shift = np.array([p['x'], -lo + p['lift'], 0.])
    for k, v in list(J.items()):
        if k in ('s', 'fp', 'rp', 'fc', 'rc', 'fh', 'rh', 'hup', 'nd') or k.startswith(('hd', 'th', 'side')):
            continue
        J[k] = v + shift
    J['L'] = L
    return J


# ---------------------------------------------------------------- 2D helpers
def P2(v):
    return np.array([v[0], -v[1]])


def limb(p1, p2, w1, w2, bulge=0.0, n=7, cap=6):
    """closed outline around segment, half widths w1,w2"""
    p1, p2 = np.asarray(p1, float), np.asarray(p2, float)
    d = p2 - p1
    ln = np.linalg.norm(d)
    if ln < 1e-6:
        d = np.array([0., 1.])
        ln = 1e-6
    d = d / ln
    nn = np.array([-d[1], d[0]])
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        w = w1 + (w2 - w1) * t + bulge * math.sin(math.pi * t)
        c = p1 + (p2 - p1) * t
        left.append(c + nn * w)
        right.append(c - nn * w)
    pts = list(left)
    a0 = math.atan2(nn[1], nn[0])
    for i in range(1, cap):  # end cap at p2 from left to right going forward
        a = a0 - math.pi * i / cap
        pts.append(p2 + np.array([math.cos(a), math.sin(a)]) * w2)
    pts += right[::-1]
    for i in range(1, cap):
        a = a0 + math.pi - math.pi * i / cap
        pts.append(p1 + np.array([math.cos(a), math.sin(a)]) * w1)
    return pts


def chain(pts, ws, n=5, cap=6):
    """outline around polyline with widths at nodes"""
    pts = [np.asarray(p, float) for p in pts]
    left, right = [], []
    for i in range(len(pts) - 1):
        a, b_ = pts[i], pts[i + 1]
        d = N(b_ - a)
        nn = np.array([-d[1], d[0]])
        for j in range(n + (1 if i == len(pts) - 2 else 0)):
            t = j / n
            c = a + (b_ - a) * t
            w = ws[i] + (ws[i + 1] - ws[i]) * t
            left.append(c + nn * w)
            right.append(c - nn * w)
    d0 = N(pts[1] - pts[0])
    d1 = N(pts[-1] - pts[-2])
    out = list(left)
    n1 = np.array([-d1[1], d1[0]])
    a0 = math.atan2(n1[1], n1[0])
    for i in range(1, cap):
        a = a0 - math.pi * i / cap
        out.append(pts[-1] + np.array([math.cos(a), math.sin(a)]) * ws[-1])
    out += right[::-1]
    n0 = np.array([-d0[1], d0[0]])
    a0 = math.atan2(n0[1], n0[0])
    for i in range(1, cap):
        a = a0 + math.pi - math.pi * i / cap
        out.append(pts[0] + np.array([math.cos(a), math.sin(a)]) * ws[0])
    return out


def ellipse(c, rx, ry, rot=0.0, n=20):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = math.cos(a) * rx, math.sin(a) * ry
        cr, sr = math.cos(rot), math.sin(rot)
        out.append(np.array([c[0] + x * cr - y * sr, c[1] + x * sr + y * cr]))
    return out


def hull(points):
    pts = sorted(set((round(p[0], 4), round(p[1], 4)) for p in points))
    if len(pts) <= 2:
        return [np.array(p) for p in pts]

    def cross(o, a, b_):
        return (a[0] - o[0]) * (b_[1] - o[1]) - (a[1] - o[1]) * (b_[0] - o[0])
    lower, upper = [], []
    for p_ in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p_) <= 0:
            lower.pop()
        lower.append(p_)
    for p_ in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p_) <= 0:
            upper.pop()
        upper.append(p_)
    return [np.array(p_) for p_ in lower[:-1] + upper[:-1]]


def circ_pts(c, r, n=10):
    return [np.array([c[0] + math.cos(2 * math.pi * i / n) * r, c[1] + math.sin(2 * math.pi * i / n) * r]) for i in range(n)]


# ---------------------------------------------------------------- hand (2D, hu)
def hand_shapes(W, ang, thumb_sign, kind='relax', curl=0.35, scale=1.0, spread=0.0, detail=False, palm=0.0):
    """returns list of polygons (skin) + list of crease lines. ang = screen direction of hand.
    thumb_sign: +1 thumb on +normal side. palm: 0 back/edge view."""
    s = scale
    d = np.array([math.cos(ang), math.sin(ang)])
    nn = np.array([-d[1], d[0]]) * thumb_sign
    W = np.asarray(W, float)

    def at(x, y):
        return W + d * x * s + nn * y * s
    polys, lines = [], []
    if kind == 'hidden':
        return polys, lines
    if kind == 'fist':
        curl = 1.0
    if kind in ('open', 'stop', 'reach'):
        curl = min(curl, 0.12)
    if kind == 'grip' or kind == 'phone':
        curl = 0.85
    # palm
    pw0, pw1, pl = 0.10, 0.13, 0.34
    palm_poly = [at(-0.03, -pw0), at(pl, -pw1), at(pl + 0.03, 0), at(pl, pw1 * 0.95), at(0.05, pw0 + 0.02), at(-0.03, pw0)]
    polys.append(limb(at(-0.02, 0), at(pl - 0.02, 0), pw0, pw1, n=4, cap=5))
    # fingers
    ys = [0.09, 0.03, -0.03, -0.09]
    lens = [0.34, 0.37, 0.35, 0.28]
    for i, (y, l) in enumerate(zip(ys, lens)):
        spr = (spread * (1.5 - i)) * 0.18
        l1 = l * 0.55
        l2 = l * 0.45
        base = at(pl, y * 1.05)
        a1 = spr
        # curl foreshortens & bends toward palm side (toward -nn slightly for side views)
        k = curl
        dir1 = np.array([math.cos(a1), math.sin(a1)])
        seg1 = (d * dir1[0] + nn * dir1[1]) * l1 * s * (1 - 0.55 * k)
        mid = base + seg1
        bend = k * 1.6
        dir2 = np.array([math.cos(a1 + bend * palm), math.sin(a1 + bend * palm)])
        seg2 = (d * dir2[0] + nn * dir2[1]) * l2 * s * (1 - 0.85 * k)
        tip = mid + seg2
        fw = 0.048 * s
        polys.append(chain([base, mid, tip], [fw * 1.05, fw, fw * 0.85], n=2, cap=4))
        if detail and i < 3:
            lines.append([at(pl - 0.08, (y + ys[i + 1]) / 2 * 1.05), base + (at(pl, (y + ys[i + 1]) / 2) - base) * 0 + (mid - base) * 0.5 + nn * ((ys[i + 1] - y) / 2) * s])
    # thumb
    ta = {'relax': 0.35, 'open': 0.85, 'stop': 0.75, 'reach': 0.55, 'fist': 0.15, 'grip': 0.25, 'phone': 0.3,
          'clasp': 0.2, 'rest': 0.45, 'pocket': 0.3}.get(kind, 0.4)
    tb = at(0.06, pw0 * 0.9)
    tdir = d * math.cos(ta) + nn * math.sin(ta)
    tm = tb + tdir * 0.17 * s
    tdir2 = d * math.cos(ta * 0.4) + nn * math.sin(ta * 0.4)
    tt = tm + tdir2 * 0.15 * s
    polys.append(chain([tb, tm, tt], [0.065 * s, 0.055 * s, 0.045 * s], n=2, cap=4))
    return polys, lines


# ---------------------------------------------------------------- build parts
def build(b, p, hero=False):
    """returns ordered list of parts: dict(role, pts|ellipse, depth)"""
    J = solve(b, p)
    L = J['L']
    lm = b['limb']
    parts = []
    pal = b['pal']

    def add(role, pts, z=0, tag=None, shade=True, group=None, smooth=True):
        parts.append(dict(role=role, pts=pts, z=z, tag=tag, shade=shade, group=group, smooth=smooth))

    # legs ----
    legs = []
    for side in 'RL':
        H, K, A = P2(J['H' + side]), P2(J['K' + side]), P2(J['A' + side])
        z = J['K' + side][2]
        legs.append((z, side, H, K, A))
    legs.sort()
    for i, (z, side, H, K, A) in enumerate(legs):
        role = 'trousers_far' if i == 0 else 'trousers'
        add(role, chain([H, K, A], [0.30 * lm, 0.205 * lm, 0.165 * lm], n=4), z, tag='leg' + side)
        heel, toe = P2(J['heel' + side]), P2(J['toe' + side])
        add('shoe', chain([heel, (heel + toe) / 2, toe], [0.125, 0.115, 0.075], n=3), z, tag='foot', shade=False)
    # pelvis block
    hipsR, hipsL = P2(J['HR']), P2(J['HL'])
    pts = []
    for side in 'RL':
        H, K = P2(J['H' + side]), P2(J['K' + side])
        dd = N(K - H)
        nn = np.array([-dd[1], dd[0]])
        for t in (0.0, 0.25):
            c = H + (K - H) * t
            pts += [c + nn * 0.32 * lm, c - nn * 0.32 * lm]
    Pc = P2(J['P'])
    sv = P2(J['P'] + J['s'] * 0.5)
    pts += [sv + np.array([0.3, 0]), sv - np.array([0.3, 0])]
    add('trousers', hull(pts), 0, tag='pelvis')

    # arms (computed now, ordered later)
    arms = []
    chestZ = J['Nb'][2]
    for side in 'RL':
        a = p['arm' + side]
        Sh, E, W = J['Sh' + side], J['E' + side], J['W' + side]
        z = (E[2] + W[2]) / 2
        arms.append((z, side, a, Sh, E, W))

    def arm_parts(side, a, Sh, E, W, far):
        out = []
        role = 'coat_far' if far else 'coat'
        if b['coat'] in ('shirt', 'dress'):
            role = 'inner_far' if far else 'inner_sleeve'
        kind = a['hand']
        Sh2, E2, W2 = P2(Sh), P2(E), P2(W)
        cuff = W2 + (E2 - W2) * 0.06
        out.append((role, chain([Sh2, E2, cuff], [0.215 * lm, 0.185 * lm, 0.16 * lm], n=4)))
        if not far and a['elbow'] > 25 and role.startswith('coat'):
            u1 = N(E2 - Sh2)
            nrm = np.array([-u1[1], u1[0]])
            if np.dot(W2 - E2, nrm) < 0:
                nrm = -nrm
            out.append(('fold', [E2 + nrm * 0.15 - u1 * 0.16, E2 + nrm * 0.06 + u1 * 0.02, E2 + nrm * 0.13 + N(W2 - E2) * 0.16]))
        if not far and role.startswith('coat'):
            out.append(('fold', [cuff + (E2 - cuff) * 0.16 + np.array([-(E2 - cuff)[1], (E2 - cuff)[0]]) / max(1e-6, np.linalg.norm(E2 - cuff)) * 0.15,
                                 cuff + (E2 - cuff) * 0.16 - np.array([-(E2 - cuff)[1], (E2 - cuff)[0]]) / max(1e-6, np.linalg.norm(E2 - cuff)) * 0.15]))
        if kind not in ('hidden', 'pocket'):
            hd = J['hd' + side]
            h2 = np.array([hd[0], -hd[1]])
            hl = np.linalg.norm(h2)
            ang = math.atan2(h2[1], h2[0])
            # thumb side
            t3 = J['th' + side]
            t2 = np.array([t3[0], -t3[1]])
            nrm = np.array([-h2[1], h2[0]])
            ts = 1 if np.dot(t2, nrm) >= 0 else -1
            sc = (0.55 + 0.45 * min(1, hl / max(1e-6, np.linalg.norm(hd)))) * b['hand']
            polys, _ = hand_shapes(W2, ang, ts, kind, a.get('curl', 0.35), scale=sc, spread=a.get('spread', 0), palm=1)
            for pp in polys:
                out.append(('skin_far' if far else 'skin', pp))
            if kind == 'phone' and p.get('phone'):
                c = W2 + np.array([math.cos(ang), math.sin(ang)]) * 0.22 * sc
                out.append(('phone', ellipse(c, 0.13, 0.20, rot=ang + math.pi / 2, n=12)))
        return out
    arms.sort(key=lambda t: t[0])
    back_arms, front_arms = [], []
    for z, side, a, Sh, E, W in arms:
        far = z < chestZ - 0.05 and not (abs(np.dot(J['fc'], np.array([0, 0, 1.]))) > 0.85)
        if z < chestZ - 0.15 or (far and abs(J['fc'][2]) < 0.85 and z == arms[0][0]):
            back_arms += arm_parts(side, a, Sh, E, W, True)
        else:
            front_arms += arm_parts(side, a, Sh, E, W, False)
    for role, pts in back_arms:
        add(role, pts, -1, tag='arm', shade=role.startswith('coat'))

    # torso -----
    P = J['P']
    s, fc, rc, fp, rp = J['s'], J['fc'], J['rc'], J['fp'], J['rp']
    sp2 = N(P2(J['Nb']) - P2(P))
    nn2 = np.array([-sp2[1], sp2[0]])
    levels = [(0.0, b['hip']), (0.3, (b['hip'] + b['waist']) / 2), (0.5, b['waist']), (0.75, b['chest']), (0.93, b['shb'])]
    left, right = [], []
    spl = np.linalg.norm(J['Nb'] - P)
    for t, br in levels:
        bl = min(1, max(0, (t - 0.35) / 0.5))
        f_ = N(fp * (1 - bl) + fc * bl)
        r_ = N(rp * (1 - bl) + rc * bl)
        dep = b['depth'] * (0.9 if t < 0.6 else 1.0)
        ease = 0.06 if b['coat'] in ('long', 'jacket', 'parka') else 0.0
        w = math.sqrt((br * r_[0]) ** 2 + (dep * f_[0]) ** 2) + ease
        c3 = P + (J['Nb'] - P) * t + f_ * (0.06 * math.sin(math.pi * t))
        c = P2(c3)
        left.append(c + nn2 * w)
        right.append(c - nn2 * w)
    top = P2(J['Nb'])
    neckw = b['neck_w']
    shR, shL = P2(J['ShR']), P2(J['ShL'])
    # order shoulders by screen side relative to nn2
    shs = sorted([shR, shL], key=lambda q: np.dot(q - top, nn2))
    torso = right + [shs[0] - nn2 * 0.19 - sp2 * 0.05, shs[0] - nn2 * 0.07 + sp2 * 0.19,
                     top - nn2 * neckw + sp2 * 0.06,
                     top + nn2 * neckw + sp2 * 0.06, shs[1] + nn2 * 0.07 + sp2 * 0.19,
                     shs[1] + nn2 * 0.19 - sp2 * 0.05] + left[::-1]
    coatkind = b['coat']
    # skirt / coat lower
    hemH = b['hem']
    if coatkind in ('long', 'parka', 'jacket', 'dress', 'skirt'):
        hipY = P[1]
        Lc = max(0.05, hipY - hemH)
        sk = []
        ends = []
        down = np.array([0, 1.0])
        for side in 'RL':
            H, K, A = P2(J['H' + side]), P2(J['K' + side]), P2(J['A' + side])
            th = K - H
            tl = np.linalg.norm(th)
            along = min(Lc, tl * 0.85) if th[1] < tl * 0.9 else min(Lc, tl)
            a_pt = H + N(th) * along
            rem = Lc - along
            # gravity blend
            gdir = N(N(th) * 0.35 + down * 0.65) if rem > 0 else down
            if th[1] >= tl * 0.9:
                end = H + N(N(th) * 0.55 + down * 0.45) * Lc
                mid = (H + end) / 2
            else:
                end = a_pt + gdir * rem
                mid = a_pt
            fl = b['flare'] + (0.12 if coatkind in ('dress', 'skirt') else 0)
            ends.append((H, mid, end))
            nn_ = np.array([1., 0])
            sk += [mid + nn_ * 0.31, mid - nn_ * 0.31,
                   end + nn_ * (0.31 + fl), end - nn_ * (0.31 + fl)]
        sk += [left[0], right[0], left[1], right[1]]
        skirt = hull(sk)
        role = 'coat' if coatkind != 'dress' else 'coat'
        add(role, skirt, 0, tag='skirt', group='coat', smooth=False)
        FOLDS = []
        if coatkind in ('long', 'parka', 'dress') and Lc > 0.6:
            xs = [q[0] for q in skirt]
            mx0, mx1 = min(xs), max(xs)
            ytop = P2(P)[1] + 0.25
            ybot = max(q[1] for q in skirt) - 0.1
            w_ = mx1 - mx0
            for fr, dr, ln in ((0.3, -0.05, 0.95), (0.56, 0.02, 0.7), (0.8, 0.06, 0.9)):
                a = np.array([mx0 + w_ * fr, ytop + (1 - ln) * 0.3])
                bpt = np.array([mx0 + w_ * (fr + dr), ytop + (ybot - ytop) * ln + (1 - ln) * 0.3])
                FOLDS.append([a, (a + bpt) / 2 + np.array([0.025, 0]), bpt])
            # hem thickness
            hem_l = min(sk, key=lambda q: q[0] + 0 * q[1])
            lowpts = sorted(skirt, key=lambda q: -q[1])[:2]
            if len(lowpts) == 2:
                l0, l1 = sorted(lowpts, key=lambda q: q[0])
                FOLDS.append([l0 + np.array([0.06, -0.07]), l1 + np.array([-0.06, -0.07])])
    # torso body
    trole = 'coat' if coatkind in ('long', 'jacket', 'parka', 'dress', 'skirt', 'sweater') else 'inner'
    add(trole, torso, 0, tag='torso', group='coat', smooth=False)
    # collar
    if coatkind in ('long', 'jacket', 'parka'):
        col_pts = [top - nn2 * (neckw + 0.13) + np.array([0, 0.05]), top - nn2 * (neckw + 0.04) - sp2 * 0.0 + np.array([0, -0.30]),
                   top + nn2 * (neckw + 0.04) + np.array([0, -0.30]), top + nn2 * (neckw + 0.13) + np.array([0, 0.05])]
        add('coat', col_pts, 0.3, tag='collar', shade=False, smooth=False)
    # coat front opening (inner shirt strip)
    facing = fc[2]
    if b['open'] and coatkind in ('long', 'jacket') and facing > 0.15:
        strip = []
        for t in (0.9, 0.7, 0.5, 0.25):
            c3 = P + (J['Nb'] - P) * t + fc * b['depth'] * 0.92
            strip.append(P2(c3))
        wds = [0.12, 0.09, 0.05, 0.025][:len(strip)]
        w_scale = min(1, facing * 1.3)
        add('inner', chain(strip, [w * w_scale + 0.01 for w in wds], n=2, cap=3), 0.1, tag='opening', shade=False)
        if coatkind == 'long':
            seam = [strip[-1], P2(P + fc * b['depth'] * 0.95) + np.array([0, (P[1] - hemH) * 0.98])]
            add('seam', [strip[0]] + strip[1:] + seam[1:], 0.12, tag='seam', shade=False)
    if coatkind in ('long', 'parka', 'dress'):
        for fpts in (FOLDS if 'FOLDS' in dir() else []):
            add('fold', fpts, 0.11, tag='fold', shade=False)
        # belt (hero coat)
        if b.get('belt') and coatkind == 'long':
            i_w = 2
            add('belt', [left[i_w] + sp2 * 0.08 + nn2 * 0.02, right[i_w] + sp2 * 0.08 - nn2 * 0.02,
                         right[i_w] - sp2 * 0.08 - nn2 * 0.02, left[i_w] - sp2 * 0.08 + nn2 * 0.02], 0.13, tag='belt', shade=False, smooth=False)
        # pocket flap
        if facing > -0.2:
            pc = P2(P + fc * b['depth'] * 0.9 + rc * 0.28) + np.array([0, 0.55])
            add('fold', [pc + np.array([-0.18, 0.02]), pc + np.array([0.18, -0.02])], 0.11, tag='fold', shade=False)
    if b.get('scarf'):
        c3 = J['Nb'] + fc * 0.18 + s * 0.05
        c = P2(c3)
        add('scarf', ellipse(c, 0.36, 0.17, rot=math.atan2(sp2[1], sp2[0]) + math.pi / 2, n=14), 0.2, tag='scarf')
        tail = [c, P2(c3 - s * 0.6 + fc * 0.1), P2(c3 - s * 1.1 + fc * 0.12)]
        if facing > -0.3:
            add('scarf', chain(tail, [0.12, 0.11, 0.10], n=2, cap=3), 0.2, tag='scarf')

    for role, pts in front_arms:
        add(role, pts, 1, tag='arm', shade=role.startswith('coat'))

    # head ----
    Hn, Hc = P2(J['Hn']), P2(J['Hc'])
    add('skin', limb(P2(J['Nb'] - J['nd'] * 0.05), Hn + (Hc - Hn) * 0.35, b['neck_w'] * 0.72, b['neck_w'] * 0.62, n=3), 1.5, tag='neck', shade=False)
    fh = J['fh']
    fh2 = np.array([fh[0], -fh[1]])
    hup = J['hup']
    up2 = N(np.array([hup[0], -hup[1]]))
    rot = math.atan2(up2[1], up2[0]) + math.pi / 2
    hw, hh = b['head_w'] / 2, b['head_h'] / 2
    facing_cam = fh[2]
    side_amt = fh2[0]  # -1..1 screen direction the face points
    head = dict(c=Hc, rx=hw, ry=hh, rot=rot, side=side_amt, facing=facing_cam, up=up2, hair=b['hair'])
    parts.append(dict(role='head', head=head, z=2, tag='head'))
    return parts, J


def bbox(parts):
    xs, ys = [], []
    for pt in parts:
        if pt['role'] == 'head':
            h = pt['head']
            xs += [h['c'][0] - 0.6, h['c'][0] + 0.6]
            ys += [h['c'][1] - 0.7, h['c'][1] + 0.6]
            continue
        for q in pt['pts']:
            xs.append(q[0])
            ys.append(q[1])
    return min(xs), min(ys), max(xs), max(ys)
