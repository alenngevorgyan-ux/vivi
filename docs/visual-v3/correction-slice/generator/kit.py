"""Board kit: page wrapper, panels, scene primitives."""
import math
from render import FILTERS, figure, ground_shadow, fmt, shade, mix

PAPER = '#E4DAC6'
INK = '#211F1D'
GRAPH = '#5E5953'
RUST = '#B5523A'

EXTRA_FILTERS = '''
<filter id="tintCold" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feFlood flood-color="#D2DAE1" result="f"/><feBlend in="SourceGraphic" in2="f" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in"/></filter>
<filter id="tintWarm" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feFlood flood-color="#F7E9D2" result="f"/><feBlend in="SourceGraphic" in2="f" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in"/></filter>
<filter id="tintSodium" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feFlood flood-color="#E0A56A" result="f"/><feBlend in="SourceGraphic" in2="f" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in"/></filter>
<filter id="tintNight" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feFlood flood-color="#7E8AA6" result="f"/><feBlend in="SourceGraphic" in2="f" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in"/></filter>
<filter id="blur3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="blur6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
'''

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&amp;family=IBM+Plex+Sans:wght@400;500&amp;family=IBM+Plex+Mono:wght@400&amp;display=swap">
<style>
body{{margin:0;background:#E4DAC6}}
a{{color:#B5523A}}a:hover{{color:#8E3B28}}
.eb{{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#A5442E}}
.tt{{font-family:Newsreader,Georgia,serif;font-weight:400;color:#211F1D;letter-spacing:-.01em}}
.sb{{font-family:'IBM Plex Sans',system-ui,sans-serif;color:#5A554E}}
.cap{{font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:14px;line-height:1.45;color:#5A554E}}
.cap b{{font-weight:500;color:#211F1D}}
.num{{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;color:#A5442E}}
.it{{font-family:Newsreader,Georgia,serif;font-style:italic;color:#3a3633}}
</style>
</helmet>
'''

TAIL = '''</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''


def page(title, eyebrow, heading, sub, inner, w, h, footer='VIVI V3 · CHARACTER LANGUAGE · THE REMEMBERED ROOM · ART-DIRECTION PROOF'):
    grain = (f'<svg width="{w}" height="{h}" style="position:absolute;left:0;top:0;pointer-events:none" aria-hidden="true">'
             f'<rect width="{w}" height="{h}" filter="url(#mottle)"/><rect width="{w}" height="{h}" filter="url(#grain)"/></svg>')
    defs = f'<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>{FILTERS}{EXTRA_FILTERS}</defs></svg>'
    body = (f'<div style="position:relative;width:{w}px;height:{h}px;box-sizing:border-box;padding:72px 80px;overflow:hidden;background:#E4DAC6">'
            f'{defs}{grain}'
            f'<div style="position:relative;display:flex;flex-direction:column;gap:14px;max-width:1500px">'
            f'<div class="eb">{eyebrow}</div>'
            f'<h1 class="tt" style="margin:0;font-size:68px;line-height:1.02">{heading}</h1>'
            f'<p class="sb" style="margin:0;font-size:19px;line-height:1.5">{sub}</p></div>'
            f'<div style="position:relative;margin-top:48px">{inner}</div>'
            f'<div class="num" style="position:absolute;left:80px;bottom:36px;color:#8a8279;letter-spacing:.14em">{footer}</div>'
            f'</div>')
    return HEAD.format(title=title) + body + TAIL.format(w=w, h=h)


def svg(w, h, inner, style='', vb=None):
    vb = vb or (w, h)
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {vb[0]} {vb[1]}" style="display:block;{style}" aria-hidden="true">{inner}</svg>'


def caption(n, title, text, w=None):
    ws = f'max-width:{w}px;' if w else ''
    return (f'<div style="display:flex;gap:10px;{ws}"><span class="num" style="padding-top:2px">{n}</span>'
            f'<div class="cap"><b>{title}</b><br>{text}</div></div>')


# ---------------------------------------------------------------- graphite helpers
def gline(pts, w=1.2, col=GRAPH, op=0.85, double=True):
    d = 'M' + ' L'.join(f'{fmt(x)},{fmt(y)}' for x, y in pts)
    s = f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" opacity="{op}"/>'
    if double:
        d2 = 'M' + ' L'.join(f'{fmt(x + 0.8)},{fmt(y - 0.6)}' for x, y in pts)
        s += f'<path d="{d2}" fill="none" stroke="{col}" stroke-width="{w * 0.6}" stroke-linecap="round" opacity="{op * 0.5}"/>'
    return s


def grect(x, y, w, h, **k):
    return gline([(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)], **k)


def pencil(inner):
    return f'<g filter="url(#pencil)">{inner}</g>'


def floorline(x0, x1, y, col=GRAPH):
    return pencil(gline([(x0, y), (x1, y)], w=1.1, col=col, op=0.6))


def island(mid, shapes_svg, blob, blur=10):
    """painted content revealed through an irregular attention blob.
    blob: list of ellipses (cx,cy,rx,ry)"""
    el = ''.join(f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx * 1.18)}" ry="{fmt(ry * 1.14)}" fill="#fff" opacity="0.28"/>' for cx, cy, rx, ry in blob)
    el += ''.join(f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx)}" ry="{fmt(ry)}" fill="#fff"/>' for cx, cy, rx, ry in blob)
    return (f'<mask id="{mid}" maskUnits="userSpaceOnUse"><g filter="url(#island)">{el}</g></mask>'
            f'<g mask="url(#{mid})">{shapes_svg}</g>')
