"""Perspective stage: every object is graphite construction + paint mass, with z-ordered items."""
import math
import numpy as np
from kit import gline, pencil
from render import fmt, shade, uid, mix

HU_M = 1.75 / 7.4  # metres per head unit
LAYER = dict(lines=True, paint=True, base=True, raw=True, mask=True)


class Cam:
    def __init__(self, W=1920, H=1080, f=1050, hy=450, eye=1.45, cx=None, camx=0.0, camz=0.0):
        self.W, self.H, self.f, self.hy, self.eye = W, H, f, hy, eye
        self.camx, self.camz = camx, camz
        self.cx = W / 2 if cx is None else cx

    def p(self, x, y, z):
        x, z = x - self.camx, z - self.camz
        z = max(z, 0.05)
        return (self.cx + self.f * x / z, self.hy + self.f * (self.eye - y) / z)

    def hu(self, z):
        return self.f * HU_M / max(0.05, z - self.camz)


def dpath(pts, close=True):
    return 'M' + ' L'.join(f'{fmt(x)},{fmt(y)}' for x, y in pts) + ('Z' if close else '')


class Obj:
    def __init__(self, z):
        self.z = z
        self.lines = []
        self.paint = []
        self.raw = []  # unmasked (e.g. figures)
        self.base = []  # paper fill so graphite objects still occlude


class Stage:
    def __init__(self, cam, light=(-0.6, -1.0)):
        self.cam = cam
        self.bg = Obj(1e9)
        self.items = []
        self.over = []
        self.under_texture = True
        self.light = light

    # ---------------- primitives on an Obj
    def quad(self, o, pts3, fill=None, line=True, lw=1.0, op=0.75):
        pts = [self.cam.p(*q) for q in pts3]
        if fill:
            o.paint.append(f'<path d="{dpath(pts)}" fill="{fill}"/>')
            if o is not self.bg:
                o.base.append(f'<path d="{dpath(pts)}"/>')
        if line:
            o.lines.append(gline(pts + [pts[0]], w=lw, op=op, double=False))
        return pts

    def seg(self, o, a3, b3, lw=0.9, op=0.6):
        o.lines.append(gline([self.cam.p(*a3), self.cam.p(*b3)], w=lw, op=op, double=False))

    def prism(self, o, foot, y0, y1, col, line=True, top_col=None, side_k=-0.18, lw=1.0):
        """foot: list of (x,z) ccw seen from above. draws visible side faces and top."""
        n = len(foot)
        cx = sum(p[0] for p in foot) / n
        cz = sum(p[1] for p in foot) / n
        faces = []
        for i in range(n):
            (x0, z0), (x1, z1) = foot[i], foot[(i + 1) % n]
            mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
            nx, nz = (z1 - z0), -(x1 - x0)
            if nx * (mx - cx) + nz * (mz - cz) < 0:
                nx, nz = -nx, -nz
            if nx * (self.cam.camx - mx) + nz * (self.cam.camz - mz) > 0:
                k = side_k if abs(nx) > abs(nz) else side_k * 0.4
                faces.append((max(z0, z1), [(x0, y0, z0), (x1, y0, z1), (x1, y1, z1), (x0, y1, z0)], shade(col, k)))
        faces.sort(key=lambda f: -f[0])
        for _, q, c in faces:
            self.quad(o, q, c, line, lw=lw)
        if y1 < self.cam.eye:
            self.quad(o, [(x, y1, z) for x, z in foot], top_col or shade(col, 0.08), line, lw=lw)
        elif y0 > self.cam.eye:
            self.quad(o, [(x, y0, z) for x, z in foot], shade(col, -0.25), line, lw=lw)

    def box(self, o, x0, x1, y0, y1, z0, z1, col, **k):
        self.prism(o, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y1, col, **k)

    def rot_foot(self, cx, cz, w, d, yaw):
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        pts = []
        for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)):
            pts.append((cx + dx * c + dz * s, cz - dx * s + dz * c))
        return pts

    def glow(self, o, cx, cy, r, col, op=0.5, sy=1.0):
        gid = uid('g')
        o.paint.append(f'<defs><radialGradient id="{gid}"><stop offset="0" stop-color="{col}" stop-opacity="{op}"/>'
                       f'<stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient></defs>'
                       f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(r)}" ry="{fmt(r * sy)}" fill="url(#{gid})"/>')

    # ---------------- items
    def obj(self, z):
        o = Obj(z)
        self.items.append(o)
        return o

    def add_svg(self, z, s):
        o = Obj(z)
        o.raw.append(s)
        self.items.append(o)
        return o

    # ---------------- furniture
    def table(self, x0, x1, z0, z1, h=0.74, col='#5C4836', legs=True):
        o = self.obj((z0 + z1) / 2)
        if legs:
            for lx, lz in ((x0 + 0.08, z0 + 0.08), (x1 - 0.08, z0 + 0.08), (x0 + 0.08, z1 - 0.08), (x1 - 0.08, z1 - 0.08)):
                self.box(o, lx - 0.03, lx + 0.03, 0, h - 0.04, lz - 0.03, lz + 0.03, shade(col, -0.35), lw=0.7)
        self.box(o, x0, x1, h - 0.04, h, z0, z1, col, top_col=shade(col, 0.1))
        return o

    def chair(self, x, z, yaw=0, col='#3E3C44', back_side=None, mesh=True):
        """office chair; yaw: direction the sitter faces (0 = toward camera, 180 = away, 90 = screen right).
        returns (front_obj, back_obj)"""
        fo = self.obj(z)
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        # facing vector in xz: yaw 0 -> (0,-1) toward camera
        fx, fz = math.sin(math.radians(yaw)), -math.cos(math.radians(yaw))
        # base
        p0 = self.cam.p(x, 0.02, z)
        hu = self.cam.hu(z)
        for a in range(5):
            ang = math.radians(a * 72 + 18)
            ex, ez = x + math.cos(ang) * 0.28, z + math.sin(ang) * 0.28
            fo.lines.append(gline([self.cam.p(x, 0.06, z), self.cam.p(ex, 0.03, ez)], w=0.9, op=0.7, double=False))
            fo.paint.append(f'<path d="{dpath([self.cam.p(x, 0.07, z), self.cam.p(ex, 0.04, ez), self.cam.p(ex, 0.0, ez)], close=False)}" stroke="#25242a" stroke-width="{fmt(max(1.5, hu * 0.06))}" fill="none"/>')
        self.box(fo, x - 0.025, x + 0.025, 0.05, 0.43, z - 0.025, z + 0.025, '#2a292f', lw=0.7)
        foot = self.rot_foot(x, z, 0.48, 0.46, -yaw)
        self.prism(fo, foot, 0.42, 0.49, col, top_col=shade(col, 0.12))
        # back
        bx, bz = x - fx * 0.24, z - fz * 0.24
        bfoot = self.rot_foot(bx, bz, 0.46, 0.05, -yaw)
        bo = self.obj(bz)
        self.prism(bo, bfoot, 0.55, 1.02, col, top_col=shade(col, 0.1))
        bo.z = bz
        return fo, bo

    def paper(self, o, corners, fill='#EFE9DC', lines=3):
        pts = [self.cam.p(*q) for q in corners]
        o.paint.append(f'<path d="{dpath(pts)}" fill="{fill}"/>')
        o.lines.append(gline(pts + [pts[0]], w=0.8, op=0.6, double=False))

    # ---------------- render
    def render(self, blob, island_scale=1.0, paint_op=1.0, mask_id=None, extra_defs=''):
        mid = mask_id or uid('m')
        el = ''.join(f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx * 1.16)}" ry="{fmt(ry * 1.12)}" fill="#fff" opacity="0.3"/>' for cx, cy, rx, ry in blob)
        el += ''.join(f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx)}" ry="{fmt(ry)}" fill="#fff"/>' for cx, cy, rx, ry in blob)
        out = [f'<defs><mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{self.cam.W}" height="{self.cam.H}"><g filter="url(#island)">{el}</g></mask>{extra_defs}</defs>']
        W, H = self.cam.W, self.cam.H
        tex = f'<rect width="{W}" height="{H}" filter="url(#grain)"/><rect width="{W}" height="{H}" filter="url(#mottle)" opacity="0.45"/>'
        mk = f' mask="url(#{mid})"' if LAYER['mask'] else ''
        if LAYER['lines']:
            out.append(pencil(''.join(self.bg.lines)))
        if LAYER['paint']:
            out.append(f'<g{mk} opacity="{paint_op}">{"".join(self.bg.paint)}{tex}</g>')
        for o in sorted(self.items, key=lambda o: -o.z):
            if o.base and LAYER['base']:
                out.append(f'<g fill="#E2D8C4">{"".join(o.base)}</g>')
            if o.lines and LAYER['lines']:
                out.append(pencil(''.join(o.lines)))
            if o.paint and LAYER['paint']:
                out.append(f'<g{mk} opacity="{paint_op}">{"".join(o.paint)}</g>')
            if LAYER['raw']:
                out.extend(o.raw)
        if LAYER['lines']:
            out.append(pencil(f'<g opacity="0.4">{"".join(self.bg.lines)}</g>'))
        out.extend(self.over)
        return ''.join(out)
