"""Collision audit for Design geometry. Hero footprint = circle r=HERO_R (metres) on the floor plane.

Standing anchors and every route point / sampled route segment must:
  - lie inside a walkable polygon, and
  - keep >= HERO_R clearance from every obstacle polygon and every actor footprint (ACTOR_R).
Seated anchors (posture='seat', seat=<obstacle id>) are exempt from their own seat obstacle only;
the route leg that docks onto the seat is exempt from that seat for its last DOCK metres.
"""
import math
import geometry as G

HERO_R = 0.20
ACTOR_R = 0.25
STEP = 0.05
DOCK = 0.55


def _seg_dist(p, a, b):
    ax, az = a; bx, bz = b; px, pz = p
    dx, dz = bx - ax, bz - az
    L2 = dx * dx + dz * dz
    t = 0 if L2 == 0 else max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / L2))
    return math.hypot(px - ax - t * dx, pz - az - t * dz)


def _inside(p, poly):
    x, z = p; c = False
    for i in range(len(poly)):
        (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % len(poly)]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            c = not c
    return c


def poly_clearance(p, poly):
    """signed: negative if inside"""
    d = min(_seg_dist(p, poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))
    return -d if _inside(p, poly) else d


def check_point(L, p, exempt=()):
    walk = any(_inside(p, w) for w in L['walkable'])
    worst = (None, 99.0)
    for k, o in L['obstacles'].items():
        if k in exempt:
            continue
        c = poly_clearance(p, o['poly'])
        if c < worst[1]:
            worst = (k, c)
    for k, a in (L.get('actors') or {}).items():
        c = math.dist(p, a['root']) - ACTOR_R
        if c < worst[1]:
            worst = ('actor:' + k, c)
    return walk, worst


def audit(locations=None):
    rows, ok_all = [], True
    for L in (locations or G.LOCATIONS.values()):
        seats = {k: a.get('seat') for k, a in L['hero_anchors'].items() if a.get('posture') == 'seat'}
        seat_pts = {tuple(L['hero_anchors'][k]['root']): s for k, s in seats.items()}
        for k, a in L['hero_anchors'].items():
            ex = (a['seat'],) if a.get('posture') == 'seat' else ()
            walk, (ob, c) = check_point(L, a['root'], ex)
            ok = walk and c >= HERO_R if a.get('posture') != 'seat' else walk and c >= 0
            ok_all &= ok
            rows.append(dict(location=L['id'], kind='anchor', name=k, posture=a.get('posture'), point=a['root'], in_walkable=walk,
                             nearest=ob, clearance=round(c, 3), required=HERO_R if a.get('posture') != 'seat' else 0.0,
                             exempt=list(ex), ok=ok))
        for rk, pts in L['routes'].items():
            worst, walk_all = ('', 99.0, None), True
            for i in range(len(pts) - 1):
                a, b = pts[i], pts[i + 1]
                n = max(1, int(math.dist(a, b) / STEP))
                for j in range(n + 1):
                    p = [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]
                    ex = ()
                    for sp, s in seat_pts.items():
                        if math.dist(p, sp) <= DOCK and (tuple(pts[0]) == sp or tuple(pts[-1]) == sp):
                            ex = (s,)
                    walk, (ob, c) = check_point(L, p, ex)
                    walk_all &= walk
                    if c < worst[1]:
                        worst = (ob, c, [round(p[0], 3), round(p[1], 3)])
            ok = walk_all and worst[1] >= HERO_R
            ok_all &= ok
            rows.append(dict(location=L['id'], kind='route', name=rk, points=pts, in_walkable=walk_all, nearest=worst[0],
                             clearance=round(worst[1], 3), at=worst[2], required=HERO_R, ok=ok))
    return ok_all, rows


if __name__ == '__main__':
    ok, rows = audit()
    for r in rows:
        print('PASS' if r['ok'] else 'FAIL', r['location'].split('.')[1], r['kind'], r['name'], r.get('point', ''), 'walk' if r['in_walkable'] else 'OUT', r['nearest'], r['clearance'], r.get('at', ''))
    print('ALL OK' if ok else 'COLLISIONS')
