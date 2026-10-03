"""THE CORRECTION — source-safe boards (r3). All story copy is live DOM; frames carry no text."""
import json, math
import geometry as G
import frames2 as F2
from kit import page as _page, caption, gline, pencil
from render import fmt

URL = json.load(open('urls3.json'))
LOCAL = False
EB = 'The Correction · source-safe handoff r4'
FOOT = f'VIVI V3 · THE CORRECTION · SOURCE-SAFE HANDOFF · {G.GEOMETRY_REVISION}'


def page(t, eb, h1, sub, inner, w, h):
    return _page(t, eb, h1, sub, inner, w, h, footer=FOOT)


def src(n):
    return f'fr3/{n}.png' if LOCAL else f'/_blob/{URL[n]}'


# ------------------------------------------------------------------ copy registry (single place; nothing invented)
COPY = {
    'display.title': ('Mira’s forecast', 'APPROVED'),
    'story.line': ('[STORY TEXT · GOLD]', 'HOST'),
    'director.question': ('[DIRECTOR QUESTION · GOLD, VERBATIM]', 'HOST'),
    'intent.speak': ('EDITORIAL COPY REQUIRED · Speak publicly now and claim your contribution to the forecast', 'PLACEHOLDER'),
    'intent.private': ('EDITORIAL COPY REQUIRED · Ask the director now to clarify your credit privately afterward', 'PLACEHOLDER'),
    'intent.pass': ('EDITORIAL COPY REQUIRED · Let this question pass without speaking', 'PLACEHOLDER'),
    'confirm.speak': ('EDITORIAL COPY REQUIRED · confirmation sentence for speaking publicly', 'PLACEHOLDER'),
    'confirm.private': ('EDITORIAL COPY REQUIRED · confirmation sentence for the private request to the director', 'PLACEHOLDER'),
    'confirm.pass': ('You let this question pass without speaking.', 'BRIEF WORDING · VERIFY AGAINST GOLD'),
    'confirm.accept': ('EDITORIAL COPY REQUIRED · confirm', 'PLACEHOLDER'),
    'confirm.back': ('EDITORIAL COPY REQUIRED · go back', 'PLACEHOLDER'),
    'boundary.line': ('[BOUNDARY LINE · GOLD]', 'HOST'),
    'reveal.account': ('[AUTHOR ACCOUNT · HOST-SUPPLIED AFTER BOUNDARY]', 'PRIVATE'),
    'reveal.why': ('[WHY · HOST-SUPPLIED]', 'PRIVATE'),
    'reveal.aftermath': ('[AFTERMATH · HOST-SUPPLIED, FOLDED]', 'PRIVATE'),
    'reveal.loading': ('EDITORIAL COPY REQUIRED · loading', 'PLACEHOLDER'),
    'reveal.retry': ('EDITORIAL COPY REQUIRED · could not load', 'PLACEHOLDER'),
    'reveal.retry_action': ('EDITORIAL COPY REQUIRED · retry', 'PLACEHOLDER'),
}
CHIP = {'APPROVED': '#4E6E3A', 'HOST': '#2F5E8C', 'PLACEHOLDER': '#A5442E', 'PRIVATE': '#6A3E7A', 'BRIEF WORDING · VERIFY AGAINST GOLD': '#8a6a1a'}


def txt(k):
    return COPY[k][0]


SVGDEFS = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
           '<pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#6E8B5E" stroke-width="1.4" opacity="0.6"/></pattern>'
           '<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#B5523A"/></marker>'
           '</defs></svg>')

CSS_LABEL = ('font-family:Newsreader,Georgia,serif;font-style:italic;color:#26221F;background:rgba(236,228,210,0.92);'
             'padding:6px 10px;line-height:1.25;overflow-wrap:anywhere')


def dom_label(x, y, text, size, maxw, anchor='left'):
    tx = f'left:{fmt(x)}px' if anchor == 'left' else f'right:{fmt(x)}px'
    return f'<div style="position:absolute;{tx};top:{fmt(y)}px;max-width:{maxw}px;font-size:{size}px;{CSS_LABEL}">{text}</div>'


def frame(n, w, vb=(1920, 1080), svg_over='', dom_over='', label=None, outline=True):
    s = w / vb[0]
    h = vb[1] * s
    ov = f'<svg viewBox="0 0 {vb[0]} {vb[1]}" width="{fmt(w)}" height="{fmt(h)}" style="position:absolute;left:0;top:0" aria-hidden="true">{svg_over}</svg>' if svg_over else ''
    lab = f'<div class="num" style="position:absolute;left:8px;top:6px;background:#E4DAC6;padding:2px 6px">{label}</div>' if label else ''
    ol = 'outline:1px solid #c4b9a6;' if outline else ''
    return (f'<div style="position:relative;width:{fmt(w)}px;height:{fmt(h)}px;{ol}overflow:hidden">'
            f'<img src="{src(n)}" alt="{n}" style="display:block;width:{fmt(w)}px;height:{fmt(h)}px">{ov}{dom_over}{lab}</div>')


def note_row(items, w=500):
    return '<div style="display:flex;gap:50px;flex-wrap:wrap">' + ''.join(caption(n, t, d, w) for n, t, d in items) + '</div>'


def proj(L, kind, x, y, z):
    return F2.cam_for(L, kind).p(x, y, z)


# ------------------------------------------------------------------ live-text overlays
def title_slot_desktop(scale, L, kind, surface):
    c = L['display_surfaces'][surface]['corners']
    a = proj(L, kind, *c[0])
    b = proj(L, kind, *c[2])
    fs = max(9, (b[1] - a[1]) * 0.09 * scale)
    return (f'<div style="position:absolute;left:{fmt(a[0] * scale + (b[0] - a[0]) * scale * 0.08)}px;top:{fmt(a[1] * scale + (b[1] - a[1]) * scale * 0.09)}px;'
            f'font-family:IBM Plex Sans,sans-serif;font-weight:500;font-size:{fmt(fs)}px;color:#22313a;white-space:nowrap">{txt("display.title")}</div>')


def line_slot(scale, key='story.line', size=30, vb_w=1920):
    return f'<div style="position:absolute;left:{fmt(64 * scale)}px;top:{fmt(50 * scale + (22 if scale < 0.5 else 0))}px;max-width:{fmt((vb_w - 200) * scale)}px;font-family:Newsreader,Georgia,serif;font-style:italic;font-size:{fmt(size * scale)}px;color:#2f2b28">{txt(key)}</div>'


ANCH = dict(
    speak=(3.4, 0.8, 4.85),
    private=(G.MEETING['actors']['director']['root'][0], 1.25, G.MEETING['actors']['director']['root'][1]),
    pass_seat=(0.65, 1.15, 3.1), pass_stand=(1.2, 1.25, 3.7))


def decision_overlay(scale, prep='stand', kind='desktop', state='observe', chosen='speak'):
    """desktop: three labels hung on anchors (live DOM). returns (svg leaders, dom)."""
    L = G.MEETING
    pts = dict(speak=proj(L, kind, *ANCH['speak']), private=proj(L, kind, *ANCH['private']), pass_=proj(L, kind, *ANCH['pass_' + prep]))
    lab = dict(speak=(pts['speak'][0] - 40, pts['speak'][1] + 170), private=(pts['private'][0] + 110, pts['private'][1] - 250), pass_=(pts['pass_'][0] - 60, pts['pass_'][1] + 330))
    keys = dict(speak='intent.speak', private='intent.private', pass_='intent.pass')
    svg, dom = '', ''
    for k in ('speak', 'private', 'pass_'):
        p, q = pts[k], lab[k]
        svg += pencil(gline([p, (q[0] + 10, q[1])], w=1.6, col='#4E4A45', op=0.95, double=False)) + f'<circle cx="{fmt(p[0])}" cy="{fmt(p[1])}" r="4" fill="#4E4A45"/>'
        dom += dom_label(q[0] * scale, q[1] * scale, txt(keys[k]), max(11, 22 * scale), int(330 * scale))
        if state in ('select', 'commit') and (k == chosen or (k == 'pass_' and chosen == 'pass')):
            svg += pencil(gline([(q[0], q[1] + 96), (q[0] + 330, q[1] + 96)], w=3.2, col='#26221F', op=1, double=False))
    svg += f'<line x1="0" y1="0" x2="0" y2="0"/>'
    dom += line_slot(scale, 'director.question')
    if state == 'commit':
        ox, oy = proj(L, kind, *(ANCH['pass_' + prep][0], 0, ANCH['pass_' + prep][2]))
        svg += f'<path d="M{fmt(ox - 120)},{fmt(oy - 600)} h-14 v620 h14 M{fmt(ox + 150)},{fmt(oy - 600)} h14 v620 h-14" fill="none" stroke="#B5523A" stroke-width="3"/>'
        dom += (f'<div style="position:absolute;left:{fmt((ox + 200) * scale)}px;top:{fmt((oy - 420) * scale)}px;width:{fmt(560 * scale)}px;display:flex;flex-direction:column;gap:{fmt(10 * scale)}px;background:rgba(236,228,210,0.95);padding:{fmt(14 * scale)}px">'
                f'<div style="font-family:Newsreader,Georgia,serif;font-size:{fmt(26 * scale)}px;color:#26221F">{txt("confirm." + chosen)}</div>'
                f'<div style="display:flex;gap:{fmt(12 * scale)}px;flex-wrap:wrap"><button style="font-family:IBM Plex Sans,sans-serif;font-size:{fmt(18 * scale)}px;padding:{fmt(10 * scale)}px {fmt(16 * scale)}px;background:#B5523A;color:#F4EFE5;border:0;min-height:{fmt(44 * scale)}px">{txt("confirm.accept")}</button>'
                f'<button style="font-family:IBM Plex Sans,sans-serif;font-size:{fmt(18 * scale)}px;padding:{fmt(10 * scale)}px {fmt(16 * scale)}px;background:transparent;color:#3a3633;border:1px solid #8a8279;min-height:{fmt(44 * scale)}px">{txt("confirm.back")}</button></div></div>')
    return svg, dom


def phone(n, label, note, dom='', svg=''):
    zones = (f'<rect x="0" y="0" width="780" height="230" fill="#B5523A" opacity="0.05"/>'
             f'<rect x="0" y="1180" width="780" height="508" fill="#2F5E8C" opacity="0.05"/>') + svg
    return (f'<div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">'
            f'<div style="padding:12px;background:#1d1c1b;border-radius:40px">{frame(n, 390, vb=(780, 1688), svg_over=zones, dom_over=dom)}</div>'
            f'<div class="cap" style="max-width:414px"><b>{label}</b><br>{note}</div></div>')


def m_text(key, top=20, size=17):
    return f'<div style="position:absolute;left:16px;right:16px;top:{top}px;font-family:Newsreader,Georgia,serif;font-style:italic;font-size:{size}px;line-height:1.3;color:#2f2b28">{txt(key)}</div>'


def m_intents(state='observe', chosen='speak'):
    items = ''
    for k in ('speak', 'private', 'pass'):
        u = 'text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px;' if state != 'observe' and k == chosen else ''
        items += (f'<button style="display:block;width:100%;text-align:left;min-height:44px;padding:10px 12px;border:0;border-top:1px solid #8a8279;background:rgba(236,228,210,0.94);'
                  f'font-family:Newsreader,Georgia,serif;font-style:italic;font-size:17px;line-height:1.3;color:#26221F;{u}white-space:normal;overflow-wrap:anywhere">{txt("intent." + k)}</button>')
    return f'<div style="position:absolute;left:16px;right:16px;bottom:24px;display:flex;flex-direction:column">{items}</div>'


def m_confirm(chosen):
    return (f'<div style="position:absolute;left:16px;right:16px;bottom:24px;background:rgba(236,228,210,0.97);padding:14px;border-top:3px solid #B5523A;display:flex;flex-direction:column;gap:12px">'
            f'<div style="font-family:Newsreader,Georgia,serif;font-size:19px;line-height:1.3;color:#26221F">{txt("confirm." + chosen)}</div>'
            f'<button style="min-height:48px;font-family:IBM Plex Sans,sans-serif;font-size:16px;background:#B5523A;color:#F4EFE5;border:0;white-space:normal">{txt("confirm.accept")}</button>'
            f'<button style="min-height:48px;font-family:IBM Plex Sans,sans-serif;font-size:16px;background:transparent;color:#3a3633;border:1px solid #8a8279;white-space:normal">{txt("confirm.back")}</button></div>')


def m_reveal(state):
    if state == 'loading':
        return f'<div style="position:absolute;left:16px;right:16px;top:640px;text-align:center;font-family:IBM Plex Sans,sans-serif;font-size:15px;color:#5a544c">{txt("reveal.loading")}</div>'
    if state == 'retry':
        return (f'<div style="position:absolute;left:16px;right:16px;top:600px;display:flex;flex-direction:column;gap:12px;align-items:stretch">'
                f'<div style="font-family:IBM Plex Sans,sans-serif;font-size:15px;color:#5a544c;text-align:center">{txt("reveal.retry")}</div>'
                f'<button style="min-height:48px;font-family:IBM Plex Sans,sans-serif;font-size:16px;background:transparent;border:1px solid #8a8279;color:#26221F">{txt("reveal.retry_action")}</button></div>')
    bars = ''.join(f'<div style="height:14px;width:{w}%;background:#cfc6b6"></div>' for w in (100, 92, 96, 70, 88, 60))
    return (f'<div style="position:absolute;left:16px;right:16px;top:470px;display:flex;flex-direction:column;gap:10px">'
            f'<div class="num" style="color:#6A3E7A">{txt("reveal.account")}</div>{bars}'
            f'<div class="num" style="color:#6A3E7A;margin-top:10px">{txt("reveal.why")}</div><div style="height:14px;width:80%;background:#cfc6b6"></div>'
            f'<div class="num" style="color:#6A3E7A;margin-top:10px">{txt("reveal.aftermath")} ⌄</div></div>')


def reveal_dom(scale, state):
    if state == 'loading':
        return f'<div style="position:absolute;left:{fmt(1000 * scale)}px;top:{fmt(520 * scale)}px;font-family:IBM Plex Sans,sans-serif;font-size:{fmt(20 * scale)}px;color:#5a544c">{txt("reveal.loading")}</div>'
    if state == 'retry':
        return (f'<div style="position:absolute;left:{fmt(1000 * scale)}px;top:{fmt(480 * scale)}px;display:flex;flex-direction:column;gap:{fmt(12 * scale)}px;max-width:{fmt(600 * scale)}px">'
                f'<div style="font-family:IBM Plex Sans,sans-serif;font-size:{fmt(20 * scale)}px;color:#5a544c">{txt("reveal.retry")}</div>'
                f'<button style="font-family:IBM Plex Sans,sans-serif;font-size:{fmt(18 * scale)}px;padding:{fmt(10 * scale)}px;border:1px solid #8a8279;background:transparent;min-height:{fmt(44 * scale)}px">{txt("reveal.retry_action")}</button></div>')
    bars = ''.join(f'<div style="height:{fmt(22 * scale)}px;width:{w}%;background:#cfc6b6"></div>' for w in (100, 94, 98, 72, 90))
    return (f'<div style="position:absolute;left:{fmt(1000 * scale)}px;top:{fmt(230 * scale)}px;width:{fmt(760 * scale)}px;display:flex;flex-direction:column;gap:{fmt(14 * scale)}px">'
            f'<div class="num" style="color:#6A3E7A;font-size:{fmt(15 * scale)}px">{txt("reveal.account")}</div>{bars}'
            f'<div class="num" style="color:#6A3E7A;font-size:{fmt(15 * scale)}px;margin-top:{fmt(20 * scale)}px">{txt("reveal.why")}</div><div style="height:{fmt(22 * scale)}px;width:80%;background:#cfc6b6"></div>'
            f'<div class="num" style="color:#6A3E7A;font-size:{fmt(15 * scale)}px;margin-top:{fmt(20 * scale)}px">{txt("reveal.aftermath")} ⌄</div></div>')


# ================================================================== C01 storyboard
SEQ = [('01', 'D01_desk', 'Desk', 'OBSERVE', 'Mira’s deck on the monitor. The display title is live text; the chart is neutral texture shared with the printed summary.'),
       ('02', 'D02_meeting', 'Meeting · presentation', 'OBSERVE', 'Mira at the display, the director at the table, the hero on the own-seat by the glass.'),
       ('03a', 'D03a_leave', 'Break · leaving', 'MOVE', 'Out through P1 into the corridor with the summary.'),
       ('03', 'D03_hallway', 'Corridor', 'OBSERVE', 'Window bay. The meeting room is the glass wall and door on the right.'),
       ('04a', 'D04a_return_seated', 'Return · seated preparation', 'MOVE', 'Back on the own seat. Room objects unchanged.'),
       ('04b', 'D04b_return_standing', 'Return · standing preparation', 'MOVE', 'Standing near the entry. Room objects unchanged.'),
       ('05a', 'D05a_decision_seated', 'Decision · seated', 'DECIDE', 'Director’s question (Gold copy). Three intentions as live text.'),
       ('05b', 'D05b_decision_standing', 'Decision · standing', 'DECIDE', 'Same decision from the standing preparation.'),
       ('06a', 'D06a_speak_standing', 'Act · speak publicly', 'ACT', 'Hero begins to speak and claim the work. Stop.'),
       ('06b', 'D06b_private', 'Act · private request to director', 'ACT', 'Hero bends to the director and begins the request. Stop.'),
       ('06c', 'D06c_pass_standing', 'Act · let it pass', 'ACT', 'Body settles in place. Confirmed act. Stop.'),
       ('07', 'D07_boundary_speak', 'Truth boundary', 'BOUNDARY', 'Paint withdraws; ink body; Gold boundary line.'),
       ('08a', 'D08a_lift', 'Reveal · public motif', 'REVEAL', 'Author page rises. No text pre-boundary.'),
       ('08b', 'D08b_loading', 'Reveal · loading', 'REVEAL', 'Host fetches the author account.'),
       ('08c', 'D08c_reveal_layout', 'Reveal · author account', 'REVEAL', 'Same account for every choice. Host-supplied.'),
       ('08d', 'D08d_retry', 'Reveal · retry', 'REVEAL', 'Fetch failed; quiet retry.')]


def board_storyboard():
    cells = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px">{frame(f, 530)}'
                    f'<div style="display:flex;gap:10px;align-items:baseline"><span class="num">{n}</span><span class="cap"><b>{t}</b></span><span class="num" style="margin-left:auto;color:#8a8279">{st}</span></div>'
                    f'<div class="cap">{d}</div></div>' for n, f, t, st, d in SEQ)
    rules = note_row([('A', 'Three actors only', 'Hero, Mira, director. Empty chairs remain as furniture. Anyone seen through glass is the same Mira or director, never a proxy.'),
                      ('B', 'No baked copy', 'Every word on screen is live DOM: display title, story text, director question, intentions, confirmations, boundary line, reveal.'),
                      ('C', 'Two preparations', 'Return, decision and acts exist for the seated and the standing preparation; the chosen one is preserved into the act.'),
                      ('D', 'One reveal', 'All three acts lead to the same boundary treatment and the same author account, supplied by the host after the boundary.')], 520)
    return page('Correction storyboard r3', f'{EB} · C01', 'The Correction, source-safe sequence',
                'Sixteen reference frames. Frames are pictures only; all text shown on later boards is a live-text overlay with its source status.',
                f'<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:36px 26px">{cells}</div><div style="margin-top:50px">{rules}</div>{SVGDEFS}', 2400, 2320)


# ================================================================== finals
def final(code, title, h1, sub, n, notes, dom='', svg='', extra='', h=1900):
    body = f'<div style="display:flex;flex-direction:column;gap:40px">{frame(n, 2240, svg_over=svg, dom_over=dom)}{note_row(notes, 500)}{extra}</div>{SVGDEFS}'
    return page(title, f'{EB} · {code}', h1, sub, body, 2400, h)


S = 2240 / 1920


def board_desk():
    dom = title_slot_desktop(S, G.OPEN_PLAN, 'desktop', 'monitor') + line_slot(S)
    return final('C02', 'Desk r3', 'Desk: Mira’s forecast on the monitor',
                 'The hero stands at the own desk with the printed summary. The monitor shows the deck; its title is live text “Mira’s forecast”. The chart on the monitor and on the summary is the same neutral texture: no numbers, no data claims.',
                 'D01_desk', [('01', 'Recognition, not evidence copy', 'Same chart silhouette on display and paper is a visual device only. No version names, dates or values are drawn.'),
                              ('02', 'Hero prop', 'Printed summary, hero-owned in every frame. Drawn from runtime/props/summary_prop.png at hand anchor hero.hand_R.summary.'),
                              ('03', 'Room', 'Empty desks; no other people. P0 to the corridor is the opening at the far right of the east wall.'),
                              ('04', 'Live text', 'display.title = “Mira’s forecast” (approved). story.line = Gold text, supplied by host.')], dom=dom,
                 extra=f'<div style="display:flex;gap:40px">{phone("M01_desk", "390 · desk", "Portrait recipe: hero and monitor in frame.", dom=m_text("story.line"))}</div>', h=2900)


def board_meeting():
    dom = title_slot_desktop(S, G.MEETING, 'desktop', 'screen') + line_slot(S)
    ex = (f'<div style="display:flex;gap:40px">{phone("M02_meeting", "390 · framing A", "Hero, own seat, glass.", dom=m_text("story.line"))}'
          f'{phone("M02b_meeting_room", "390 · framing B", "Camera move to display, Mira and director. Same location, recipe portrait_room.", dom=m_text("story.line"))}</div>')
    return final('C03', 'Meeting r3', 'Meeting: she owns the room, I sit by the glass',
                 'Three people: Mira standing at the display, the director seated at the table, the hero on the own seat by the glass. Empty chairs stay as furniture.',
                 'D02_meeting', [('01', 'Cast', 'Exactly three actors. The previous four colleagues are removed with their poses and anchors.'),
                                 ('02', 'Mira', 'Authored presenting pose at actor anchor mira; she never moves in this slice.'),
                                 ('03', 'Director', 'Seated at chair_director facing the table; never moves in this slice.'),
                                 ('04', 'Display', 'Neutral chart texture + live title “Mira’s forecast”.')], dom=dom, extra=ex, h=2900)


def board_hallway():
    ex = (f'<div style="display:flex;gap:40px;align-items:flex-start"><div style="display:flex;flex-direction:column;gap:8px"><div class="eb">03a · leaving through P1</div>{frame("D03a_leave", 900)}</div>'
          f'{phone("M03_hallway", "390 · corridor", "Hero at the window bay; the door to the room in frame.", dom=m_text("story.line"))}</div>')
    return final('C04', 'Corridor r3', 'Corridor: outside the room, still beside it',
                 'Daylight bay on the west wall; the meeting room is the glass wall and door P1 on the east. No break duration is stated anywhere.',
                 'D03_hallway', [('01', 'Spatial relation', 'P1 pairs corridor (3.3, 5.3–6.25) with meeting room (0, 3.8–4.75). The glass shows the same table and display.'),
                                 ('02', 'No proxies', 'Mira and the director, when visible through the glass, are the same actors in their current poses at finish 0.25.'),
                                 ('03', 'Read', 'Two-hand read pose at hero anchor reading. The summary stays in the hero’s hands.'),
                                 ('04', 'Exit and return', 'Routes exit_to_reading and reading_to_return; both use P1.')], dom=line_slot(S), extra=ex, h=2620)


def board_return():
    ex = (f'<div style="display:flex;gap:40px"><div style="display:flex;flex-direction:column;gap:8px"><div class="eb">04b · standing preparation</div>{frame("D04b_return_standing", 1080, dom_over=title_slot_desktop(1080 / 1920, G.MEETING, "desktop", "screen"))}</div>'
          f'{phone("M04a_return_seated", "390 · seated", "Own seat.", dom=m_text("story.line"))}{phone("M04b_return_standing", "390 · standing", "Near the entry.", dom=m_text("story.line"))}</div>')
    return final('C05', 'Return r3', 'Return: same meeting, two preparations',
                 'Nothing in the room changes on return. The only difference is where the hero chooses to be: back on the own seat (04a) or standing near the entry (04b). That choice is preserved into the decision and the act.',
                 'D04a_return_seated', [('01', 'Continuity', 'Cups, laptops, papers, Mira and the director are identical to beat 02.'),
                                        ('02', 'Seated preparation', 'hero_anchors.own_seat, pose seat_hold.'),
                                        ('03', 'Standing preparation', 'hero_anchors.stand_near_entry, pose stand_return.'),
                                        ('04', 'Summary', 'In the hero’s right hand in both.')], dom=title_slot_desktop(S, G.MEETING, 'desktop', 'screen') + line_slot(S), extra=ex, h=2900)


def board_decision():
    sv, dm = decision_overlay(S, 'stand')
    def small(n, prep, state, lab, chosen='speak'):
        sc = 720 / 1920
        a, b = decision_overlay(sc, prep, state=state, chosen=chosen)
        return f'<div style="display:flex;flex-direction:column;gap:8px">{frame(n, 720, svg_over=a, dom_over=b, label=lab)}</div>'
    ex = (f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:30px">'
          f'{small("D05a_decision_seated", "seat", "observe", "A · SEATED · OBSERVE")}{small("D05b_decision_standing", "stand", "select", "B · STANDING · SELECTED (speak)")}{small("D05b_decision_standing", "stand", "commit", "C · STANDING · CONFIRM (pass)", "pass")}</div>'
          f'<div style="display:flex;gap:30px;flex-wrap:wrap">'
          f'{phone("M05a_decision_seated", "390 · decision · seated", "Intentions stacked in the thumb zone, full width, wrapping. No truncation.", dom=m_text("director.question") + m_intents())}'
          f'{phone("M05b_decision_standing", "390 · decision · standing", "Same list; anchors differ in the scene.", dom=m_text("director.question") + m_intents("select", "private"))}'
          f'{phone("M05b_decision_standing", "390 · confirmation", "Separate confirm step; the act begins only after accept.", dom=m_text("director.question") + m_confirm("private"))}</div>')
    return final('C06', 'Decision r3', 'Decision: three intentions, complete labels, equal dignity',
                 'Director question is Gold copy, verbatim, supplied by the host. Intention labels are placeholders marked EDITORIAL COPY REQUIRED; they state the full meaning so no layout depends on a short label.',
                 'D05b_decision_standing', [('01', 'Speak publicly now', 'Anchor: table centre (the public room).'),
                                            ('02', 'Private request to the director', 'Anchor: the director. Not Mira. Asked now, for a private clarification afterward.'),
                                            ('03', 'Let it pass', 'Anchor: the hero’s own preparation anchor (seat or stand). Meaning: you let this question pass without speaking.'),
                                            ('04', 'Equal dignity', 'Same type, same size, same leader; on mobile a same-style list. Order is fixed and neutral.')], svg=sv, dom=dm, extra=ex, h=3260)


def board_acts():
    rows = [('D06a_speak_standing', 'D06a_speak_seated', 'Speak publicly', 'Summary rises, head comes up, the hero starts to speak. No words are drawn or invented.', 'Stops before any reaction. Mira and the director keep their authored poses.'),
            ('D06b_private', None, 'Private request to the director', 'Hero walks the authored route to near_director and bends toward the seated director; summary in the left hand.', 'Stops at the first words. No acknowledgement. Mira does not move. The meeting does not end.'),
            ('D06c_pass_standing', 'D06c_pass_seated', 'Let it pass', 'After explicit confirmation: the body settles in the current preparation. The summary stays in hand or on the lap, face up.', 'Stops when the body settles. No agreement gesture. No face-down paper.')]
    cells = ''
    for a, b, t, beg, stop in rows:
        imgs = frame(a, 700, label='STANDING' if b else 'FROM EITHER PREP') + (frame(b, 700, label='SEATED') if b else '<div class="cap" style="width:700px;padding-top:20px">Seated preparation uses route seat_to_near_director; the end pose and stop point are identical.</div>')
        cells += f'<div style="display:flex;gap:30px;align-items:flex-start">{imgs}<div style="display:flex;flex-direction:column;gap:10px;max-width:640px"><div class="tt" style="font-size:32px">{t}</div><div class="cap"><b>Begins.</b> {beg}</div><div class="cap"><b>Stops.</b> {stop}</div></div></div>'
    mob = (f'<div style="display:flex;gap:30px">{phone("M06a_speak_standing", "390 · speak", "")}{phone("M06a_speak_seated", "390 · speak · seated", "")}'
           f'{phone("M06b_private", "390 · private request", "Recipe portrait_east.")}{phone("M06c_pass_standing", "390 · pass", "")}{phone("M06c_pass_seated", "390 · pass · seated", "")}</div>')
    return page('Acts r3', f'{EB} · C07', 'Acts: the body begins, the picture stops',
                'Each act is authored from the selected preparation. No dialogue is drawn; no NPC responds. Reduced-motion uses each frame as a still.',
                f'<div style="display:flex;flex-direction:column;gap:40px">{cells}{mob}</div>{SVGDEFS}', 2400, 3050)


def board_boundary():
    strip = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px">{frame(f, 700, label=l)}<div class="cap">{d}</div></div>' for f, l, d in (
        ('D07a_held', 'T+0 · HELD', 'Last authored act frame holds; grain locks.'),
        ('D07b_withdraw', 'T+0.9 s · WITHDRAW', 'Paint withdraws edges-first over 1.6 s; Mira and the director drop to graphite; island shrinks to the body.'),
        ('D07_boundary_speak', 'T+2.5 s · BOUNDARY', 'Graphite room, ink body, display dimmed. Boundary line is Gold copy.')))
    per = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px">{frame(f, 700, dom_over=line_slot(700 / 1920, "boundary.line"), label=l)}</div>' for f, l in (
        ('D07_boundary_speak', 'AFTER SPEAK'), ('D07_boundary_private', 'AFTER PRIVATE REQUEST'), ('D07_boundary_pass', 'AFTER PASS')))
    return page('Boundary r3', f'{EB} · C08', 'Truth boundary: identical treatment for every act',
                'The boundary does not depend on the choice. Each act ends in its own pose, then the same withdrawal runs. Reduced motion: 400 ms cross-fade from the last act frame to the boundary frame.',
                f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:30px">{strip}</div><div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:30px;margin-top:40px">{per}</div>'
                f'<div style="margin-top:40px;display:flex;gap:30px">{phone("M07_boundary_speak", "390 · boundary", "", dom=m_text("boundary.line"))}</div>{SVGDEFS}', 2400, 2330)


def board_reveal():
    sc = 1060 / 1920
    cells = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px">{frame(f, 1060, dom_over=d, label=l)}</div>' for f, l, d in (
        ('D08a_lift', 'PUBLIC MOTIF · PRE-BOUNDARY SAFE', ''), ('D08b_loading', 'LOADING', reveal_dom(sc, 'loading')),
        ('D08c_reveal_layout', 'AUTHOR ACCOUNT (HOST TEXT)', reveal_dom(sc, 'account')), ('D08d_retry', 'RETRY', reveal_dom(sc, 'retry'))))
    mob = (f'<div style="display:flex;gap:30px">{phone("M08a_lift", "390 · motif", "")}{phone("M08b_loading", "390 · loading", "", dom=m_reveal("loading"))}'
           f'{phone("M08c_reveal_layout", "390 · account", "", dom=m_reveal("account"))}{phone("M08d_retry", "390 · retry", "", dom=m_reveal("retry"))}</div>')
    rules = note_row([('01', 'One account for all choices', 'The reveal never reads the player’s choice. The same host-supplied author account appears after speak, private request or pass.'),
                      ('02', 'Private by construction', 'No author text exists in any frame, plate or prop. The motif page is lined texture only. Text arrives from the host after the boundary.'),
                      ('03', 'Structure', 'Account (large serif) → Why → Aftermath (folded until asked). Content is Gold; layout is fixed.'),
                      ('04', 'Summary stays hero-owned', 'The author page is a separate object. The hero keeps the summary through boundary and reveal.')], 500)
    return page('Reveal r3', f'{EB} · C09', 'Author reveal: public motif, private text from the host',
                'The previous rewritten author account is removed. Frames show only the page motif; purple slots are filled by the host after the boundary.',
                f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:30px">{cells}</div><div style="margin-top:40px">{mob}</div><div style="margin-top:40px">{rules}</div>{SVGDEFS}', 2400, 3000)


def board_mobile():
    items = [('M01_desk', 'Desk', m_text('story.line')), ('M02_meeting', 'Meeting A', m_text('story.line')), ('M02b_meeting_room', 'Meeting B', m_text('story.line')),
             ('M03_hallway', 'Corridor', m_text('story.line')), ('M04a_return_seated', 'Return · seated', m_text('story.line')), ('M04b_return_standing', 'Return · standing', m_text('story.line')),
             ('M05a_decision_seated', 'Decision · seated', m_text('director.question') + m_intents()), ('M05b_decision_standing', 'Decision · standing', m_text('director.question') + m_intents()),
             ('M05b_decision_standing', 'Confirmation', m_text('director.question') + m_confirm('speak')), ('M06a_speak_standing', 'Act · speak', ''), ('M06b_private', 'Act · private request', ''),
             ('M06c_pass_seated', 'Act · pass', ''), ('M07_boundary_speak', 'Boundary', m_text('boundary.line')), ('M08b_loading', 'Reveal · loading', m_reveal('loading')),
             ('M08c_reveal_layout', 'Reveal · account', m_reveal('account')), ('M08d_retry', 'Reveal · retry', m_reveal('retry'))]
    cells = ''.join(phone(n, l, '') for n, l, d in [] ) + ''.join(phone(n, l, '', dom=d) for n, l, d in items)
    return page('Mobile r3', f'{EB} · C10', 'Mobile 390: every required state, live text wrapping',
                'Rendered at true 390 px CSS width. All labels are DOM text in a 358 px column with wrapping; touch targets ≥ 44 px. Red tint = text zone, blue tint = thumb zone.',
                f'<div style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:40px 30px">{cells}</div>{SVGDEFS}', 2400, 4200)


def board_desktop():
    def ov():
        return ('<rect x="96" y="54" width="1728" height="972" fill="none" stroke="#2F5E8C" stroke-width="2" stroke-dasharray="8 6"/>'
                '<rect x="0" y="0" width="1920" height="130" fill="#B5523A" opacity="0.07"/><rect x="0" y="930" width="1920" height="150" fill="#2F5E8C" opacity="0.07"/>')
    cells = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px">{frame(f, 1080, svg_over=ov())}<div class="cap">{d}</div></div>' for f, d in (
        ('D01_desk', 'open_plan · desktop recipe'), ('D02_meeting', 'meeting_room · desktop recipe'), ('D03_hallway', 'corridor · desktop recipe'), ('D05b_decision_standing', 'decision: all three anchors inside title-safe')))
    return page('Desktop r3', f'{EB} · C11', 'Desktop compositions and safe areas',
                'Recipes are in geometry/source.json (cameras.desktop). Blue dash = title-safe, red band = line zone, blue band = intent zone.',
                f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:40px">{cells}</div>{SVGDEFS}', 2400, 1600)


def board_layers():
    lay = [('P_meeting_room_desktop_graphite', '1 · Graphite plate (runtime)', 'runtime/plates/P_meeting_room_desktop_graphite.webp'),
           ('P_meeting_room_desktop_paint', '2 · Paint plate (runtime)', 'runtime/plates/P_meeting_room_desktop_paint.webp'),
           ('L3_mask', '3 · Attention mask (runtime-generated; reference only)', 'reference/layers/L3_mask.webp'),
           ('L4_actors', '4 · Actors (rig; reference only)', 'reference/layers/L4_actors.webp')]
    stack = ''.join(f'<div style="position:absolute;left:{80 + i * 70}px;top:{200 + i * 200}px;transform:perspective(2200px) rotateX(48deg) rotateZ(-16deg);transform-origin:0 0;box-shadow:0 30px 60px rgba(40,30,20,0.18);background:{"#cfc8bb" if n == "L4_actors" else "transparent"}"><img src="{src(n)}" alt="{n}" style="display:block;width:820px"></div>' for i, (n, t, p) in enumerate(lay))
    labels = ''.join(f'<div style="padding:14px 0;border-top:1px solid #c4b9a6"><div class="tt" style="font-size:26px">{t}</div><div class="num" style="color:#5a544c">{p}</div></div>' for n, t, p in lay)
    labels += ''.join(f'<div style="padding:14px 0;border-top:1px solid #c4b9a6"><div class="tt" style="font-size:26px">{t}</div><div class="cap">{d}</div></div>' for t, d in (
        ('5 · Display + prop textures', 'runtime/props: display_texture.png (no text), summary_prop.png (no text), author_page.png (no text).'),
        ('6 · Live DOM', 'display.title, story.line, director.question, intents, confirmations, boundary.line, reveal slots. Never rasterised.'),
        ('7 · Grain', 'Full-frame grain + mottle pass (procedural).')))
    return page('Layers r3', f'{EB} · C12', 'Layer stack: no text in any raster',
                'Runtime-consumable layers are the plates and prop textures listed in assets.json. Actors are rig output; masks are runtime-generated from attention targets.',
                f'<div style="display:flex;gap:60px"><div style="position:relative;width:1300px;height:1250px">{stack}</div><div style="width:760px">{labels}</div></div>{SVGDEFS}', 2400, 1700)


# ================================================================== plans from geometry
def plan_svg(L, W=700, H=760, cams=('desktop',), extra_actors=None, routes=True, show_labels=True):
    B = L['bounds']
    pad = 60
    sc = min((W - 2 * pad) / (B['xMax'] - B['xMin']), (H - 2 * pad - 60) / (B['zMax'] - B['zMin'] + 2.5))
    ox, oy = pad - B['xMin'] * sc + 20, H - pad - 2.5 * sc * 0.6

    def P(x, z):
        return (ox + x * sc, oy - z * sc)

    def poly(pts, **a):
        attr = ' '.join(f'{k.replace("_", "-")}="{v}"' for k, v in a.items())
        return f'<path d="M{" L".join(fmt(P(*p)[0]) + "," + fmt(P(*p)[1]) for p in pts)}Z" {attr}/>'

    def lbl(x, z, t, col='#5E5953', size=13, dx=8, dy=-8):
        p = P(x, z)
        return f'<text x="{fmt(p[0] + dx)}" y="{fmt(p[1] + dy)}" font-family="IBM Plex Mono, monospace" font-size="{size}" fill="{col}" paint-order="stroke" stroke="#EFE8DA" stroke-width="4">{t}</text>' if show_labels else ''
    s = poly([[B['xMin'], B['zMin']], [B['xMax'], B['zMin']], [B['xMax'], B['zMax']], [B['xMin'], B['zMax']]], fill='#EFE8DA', stroke='#2b2724', stroke_width=3)
    for wp in L['walkable']:
        s += poly(wp, fill='url(#hatch)')
    for k, o in L['obstacles'].items():
        s += poly(o['poly'], fill='#8a7a69' if 'table' in k or 'desk' in k else '#b5ab9b', stroke='#2b2724', stroke_width=1, opacity=0.9)
    for k, p in L['portals'].items():
        a, b = p['segment']
        pa, pb = P(*a), P(*b)
        s += f'<line x1="{fmt(pa[0])}" y1="{fmt(pa[1])}" x2="{fmt(pb[0])}" y2="{fmt(pb[1])}" stroke="#EFE8DA" stroke-width="9"/>'
        for j in p['jambs']:
            pj = P(*j)
            s += f'<rect x="{fmt(pj[0] - 4)}" y="{fmt(pj[1] - 4)}" width="8" height="8" fill="#B5523A"/>'
        ti, to = P(*p['threshold_inside']), P(*p['threshold_outside'])
        s += f'<line x1="{fmt(ti[0])}" y1="{fmt(ti[1])}" x2="{fmt(to[0])}" y2="{fmt(to[1])}" stroke="#B5523A" stroke-width="1.5" stroke-dasharray="3 3"/>'
        s += lbl((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, f'{k} → {p["to"].split(".")[1]}', '#B5523A', 14, 10, 4)
    for k, d in L.get('display_surfaces', {}).items():
        c = d['corners']
        pa, pb = P(c[0][0], c[0][2]), P(c[1][0], c[1][2])
        s += f'<line x1="{fmt(pa[0])}" y1="{fmt(pa[1])}" x2="{fmt(pb[0])}" y2="{fmt(pb[1])}" stroke="#2F5E8C" stroke-width="6"/>' + lbl(c[0][0], c[0][2], k.upper(), '#2F5E8C', 13, 0, 18)
    if routes:
        for k, r in L.get('routes', {}).items():
            pts = [P(*q) for q in r]
            s += f'<polyline points="{" ".join(fmt(p[0]) + "," + fmt(p[1]) for p in pts)}" fill="none" stroke="#C38A34" stroke-width="1.6" stroke-dasharray="6 5" opacity="0.8"/>'

    def actor(x, z, yaw, t, col, r=11):
        c = P(x, z)
        fx, fz = G.yaw_to_dir(yaw)
        e = (c[0] + fx * 24, c[1] - fz * 24)
        return (f'<circle cx="{fmt(c[0])}" cy="{fmt(c[1])}" r="{r}" fill="{col}"/><line x1="{fmt(c[0])}" y1="{fmt(c[1])}" x2="{fmt(e[0])}" y2="{fmt(e[1])}" stroke="{col}" stroke-width="4"/>' + lbl(x, z, t, col, 13, 13, -12))
    for k, a in L.get('actors', {}).items():
        s += actor(a['root'][0], a['root'][1], a['yaw'], k, '#53606F' if k == 'mira' else '#34373F')
    for k, a in L.get('hero_anchors', {}).items():
        s += actor(a['root'][0], a['root'][1], a['yaw'], k, '#C38A34', 8)
    for ck in cams:
        c = L['cameras'][ck]
        cx, cy, cz = c['position']
        cp = P(cx, cz)
        far = B['zMax'] - cz
        for sx in (0, c['frame'][0]):
            xw = cx + far * (sx - c['principal'][0]) / c['focal_px']
            e = P(xw, B['zMax'])
            s += f'<line x1="{fmt(cp[0])}" y1="{fmt(cp[1])}" x2="{fmt(e[0])}" y2="{fmt(e[1])}" stroke="#2F5E8C" stroke-width="1.1" stroke-dasharray="6 5"/>'
        s += f'<circle cx="{fmt(cp[0])}" cy="{fmt(cp[1])}" r="6" fill="#2F5E8C"/>' + lbl(cx, cz, f'cam.{ck}', '#2F5E8C', 12, 8, 16)
    # axes
    o = P(0, 0)
    s += f'<line x1="{fmt(o[0])}" y1="{fmt(o[1])}" x2="{fmt(o[0] + 40)}" y2="{fmt(o[1])}" stroke="#2b2724" stroke-width="2" marker-end="url(#arr)"/><line x1="{fmt(o[0])}" y1="{fmt(o[1])}" x2="{fmt(o[0])}" y2="{fmt(o[1] - 40)}" stroke="#2b2724" stroke-width="2" marker-end="url(#arr)"/>'
    s += f'<text x="{fmt(o[0] + 44)}" y="{fmt(o[1] + 4)}" font-family="IBM Plex Mono, monospace" font-size="12">x</text><text x="{fmt(o[0] - 4)}" y="{fmt(o[1] - 46)}" font-family="IBM Plex Mono, monospace" font-size="12">z</text>'
    if extra_actors:
        s += extra_actors(P)
    return s, P


def board_staging():
    cards = ''
    for L, cams in ((G.OPEN_PLAN, ('desktop', 'portrait')), (G.CORRIDOR, ('desktop', 'portrait')), (G.MEETING, ('desktop', 'portrait', 'portrait_room', 'portrait_east'))):
        s, _ = plan_svg(L, cams=cams)
        B = L['bounds']
        cards += (f'<div style="display:flex;flex-direction:column;gap:8px"><div class="tt" style="font-size:28px">{L["id"]}</div>'
                  f'<div class="num" style="color:#5a544c">x {B["xMin"]}–{B["xMax"]} m · z {B["zMin"]}–{B["zMax"]} m · ceiling {B["ceiling"]} m</div>'
                  f'<svg viewBox="0 0 700 760" width="700" height="760" aria-hidden="true" style="overflow:visible">{s}</svg></div>')
    pairs = ''.join(f'<li class="cap" style="margin-bottom:8px">{p["a"][0]} {p["a"][1]} ↔ {p["b"][0]} {p["b"][1]} · transform {p["transform_a_to_b"]} · endpoints {p["endpoints"]}</li>' for p in G.PORTAL_PAIRS)
    res = ''.join(f'<li class="cap" style="margin-bottom:8px">{r}</li>' for r in G.RESOLVED)
    return page('Staging r3', f'{EB} · C13', 'Top-down staging and portal geometry (from geometry/source.json)',
                f'Drawn directly from geometry.py, revision {G.GEOMETRY_REVISION}. Location coordinates: origin = SW inner floor corner, x east, z north, metres. Hatch = walkable, fills = obstacles, red squares = door jambs, dashed red = thresholds, blue = display + camera frusta, ochre = hero anchors and routes.',
                f'<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:30px">{cards}</div>'
                f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:60px;margin-top:40px"><div><div class="eb">Paired portals</div><ul>{pairs}</ul></div><div><div class="eb">Resolved contradictions</div><ul>{res}</ul></div></div>{SVGDEFS}', 2400, 1760)


def board_blocking():
    beats = [('02 Presentation', 'own_seat', None), ('03a Break', 'entry', [('entry', None)]), ('04a Return · seated', 'own_seat', 'entry_to_seat'), ('04b Return · standing', 'stand_near_entry', 'entry_to_stand'),
             ('05 Decision', 'stand_near_entry', None), ('06a Speak', 'stand_near_entry', None), ('06b Private request', 'near_director', 'stand_to_near_director'), ('06c Let it pass', 'stand_near_entry', None)]
    cells = ''
    for t, anc, route in beats:
        L = dict(G.MEETING)
        L = {**G.MEETING, 'hero_anchors': {anc: G.MEETING['hero_anchors'][anc]}, 'routes': ({route: G.MEETING['routes'][route]} if isinstance(route, str) else {})}
        s, _ = plan_svg(L, W=520, H=600, cams=(), show_labels=True)
        cells += f'<div style="display:flex;flex-direction:column;gap:6px"><div class="tt" style="font-size:24px">{t}</div><svg viewBox="0 0 520 600" width="520" height="600" aria-hidden="true">{s}</svg></div>'
    rules = note_row([('A', 'Only the hero moves', 'Mira (mira) and the director (director) hold their anchors in every beat, including after acceptance of any act.'),
                      ('B', 'Private request route', f'stand_to_near_director or seat_to_near_director, south aisle then east aisle; ends {G.MEETING["hero_anchors"]["near_director"]["root"]} facing {G.MEETING["hero_anchors"]["near_director"]["yaw"]}°.'),
                      ('C', 'Preparation preserved', 'Speak and pass happen at the chosen preparation anchor; private request starts from it.')], 640)
    return page('Blocking r3', f'{EB} · C14', 'Actor blocking map (three actors)',
                'Each beat drawn from geometry. Grey/dark circles: Mira and director, fixed. Ochre: the hero anchor occupied in that beat, with the authored route where the hero moves.',
                f'<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:24px">{cells}</div><div style="margin-top:40px">{rules}</div>{SVGDEFS}', 2400, 1700)


def board_attention():
    def ell(L, kind, targets, labels):
        cam = F2.cam_for(L, kind)
        out = ''
        for (cx, cy, rx, ry), lab in zip(F2.blob_screen(cam, targets), labels):
            out += f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx)}" ry="{fmt(ry)}" fill="none" stroke="#4E4A45" stroke-width="2.5" stroke-dasharray="10 8"/>'
            out += f'<text x="{fmt(cx - rx)}" y="{fmt(cy - ry - 12)}" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="30" fill="#26221F" paint-order="stroke" stroke="#ECE4D2" stroke-width="6">{lab}</text>'
        return out
    hx, hz = G.OPEN_PLAN['hero_anchors']['at_desk']['root']
    mc = G.OPEN_PLAN['display_surfaces']['monitor']['corners']
    d1 = ell(G.OPEN_PLAN, 'desktop', [(hx, 1.0, hz, 0.75, 1.15), ((mc[0][0] + mc[1][0]) / 2, 1.05, mc[0][2], 0.6, 0.45)], ['1 hero + summary', '2 display'])
    d2 = ell(G.MEETING, 'desktop', [(0.71, 1.0, 3.1, 0.95, 1.2), (3.4, 1.6, 7.35, 1.7, 0.9)], ['1 hero', '2 display'])
    rx_, rz_ = G.CORRIDOR['hero_anchors']['reading']['root']
    d3 = ell(G.CORRIDOR, 'desktop', [(rx_, 1.0, rz_, 1.1, 1.3), (0.2, 1.5, 8.0, 0.9, 1.2), (3.3, 1.2, 5.78, 0.7, 1.1)], ['1 summary', '2 daylight', '3 door P1'])
    d4 = ell(G.MEETING, 'desktop', [(1.2, 1.0, 3.7, 0.9, 1.25), (3.4, 0.8, 4.85, 1.1, 0.6), (4.75, 1.0, 5.9, 0.8, 1.0), (3.4, 1.6, 7.35, 1.7, 0.9)], ['hero / pass', 'speak', 'private', 'display'])
    cells = ''.join(f'<div style="display:flex;flex-direction:column;gap:8px">{frame(f, 1080, svg_over=o)}<div class="cap">{c}</div></div>' for f, o, c in (
        ('D01_desk', d1, 'Targets are world ellipses (centre x,y,z + radii in metres) per beat; listed in source.json under each beat in assets.json usage.'),
        ('D02_meeting', d2, 'Mira and the director are not separate targets in 02; they are inside the display target.'),
        ('D03_hallway', d3, 'The door back is always a target.'), ('D05b_decision_standing', d4, 'Exactly the three intention anchors plus the display.')))
    return page('Attention r3', f'{EB} · C15', 'Attention targets without hotspot dots',
                'Dashed ellipses are documentation only. In product, attention is shown by the paint island arriving and joining; never by dots or glows.',
                f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:40px">{cells}</div>{SVGDEFS}', 2400, 1600)


# ================================================================== C16 handshake
HS_COLS = ['correction.open_plan', 'correction.meeting_room · 02', 'correction.corridor', 'meeting_room · 04/05', 'meeting_room · 06 acts', 'boundary · reveal']
HS = [
    ('Location / coords', ['source.json › locations[correction.open_plan]', 'source.json › locations[correction.meeting_room]', 'source.json › locations[correction.corridor]', 'same as 02', 'same as 02', 'last act frame of meeting_room']),
    ('Walkable', ['walkable[0] minus obstacles', 'walkable[0] minus obstacles', 'walkable[0] minus obstacles', 'same', 'routes stand/seat_to_near_director', '—']),
    ('Actor anchors', ['none', 'actors.mira, actors.director', 'see_through: mira, director (same identities)', 'same', 'same, fixed after acceptance', 'same, ink/graphite']),
    ('Hero anchors', ['hero_anchors.at_desk', 'hero_anchors.own_seat', 'hero_anchors.reading / from_meeting', 'own_seat | stand_near_entry', 'prep anchor | near_director', 'last act anchor']),
    ('Object anchors', ['display_surfaces.monitor, objects.mug, sheet', 'display_surfaces.screen, objects.*', 'objects.window_light', 'unchanged from 02', 'unchanged', '—']),
    ('Portals', ['P0 ↔ corridor P0', 'P1 ↔ corridor P1', 'P0, P1', 'P1 entry', '—', '—']),
    ('Occluders', ['occluders.hero_desk, monitor', 'occluders.table, chair backs, mullions, jambs', 'occluders.glass_mullions, bench', 'same', 'same', '—']),
    ('Camera recipes', ['cameras.desktop / portrait', 'desktop / portrait / portrait_room', 'desktop / portrait', 'desktop / portrait', 'desktop / portrait / portrait_east', 'same as act']),
    ('Live text', ['display.title, story.line', 'display.title, story.line', 'story.line', 'director.question, intent.*', 'confirm.*', 'boundary.line, reveal.* (private)']),
    ('Observation state', ['island on hero + display', 'island on hero + display', 'island hero + daylight + door', 'island + table edge', '—', '—']),
    ('Selected intent', ['—', '—', '—', 'graphite underline; camera eases toward anchor', '—', '—']),
    ('Accepted commitment', ['—', '—', '—', 'rust bracket + confirm step', 'act clip from prep anchor; NPCs fixed', '—']),
    ('Boundary / reveal', ['—', '—', '—', '—', 'held → withdraw → ink', 'motif → loading → host account | retry']),
    ('Reduced motion', ['cross-fade islands 200 ms', 'same', 'cut walk clips to anchor poses', 'no camera ease', 'act frame as still (D06*/M06*)', '400 ms cross-fade; page appears in place']),
]


def board_handshake():
    head = ''.join(f'<th style="text-align:left;padding:10px 12px;border-bottom:2px solid #2b2724;font-family:IBM Plex Mono,monospace;font-size:12px;color:#A5442E;font-weight:400">{c}</th>' for c in [''] + HS_COLS)
    rows = ''.join(f'<tr><th scope="row" style="text-align:left;padding:10px 12px;border-bottom:1px solid #c4b9a6;font-family:Newsreader,Georgia,serif;font-size:20px;font-weight:400;vertical-align:top;width:210px">{k}</th>'
                   + ''.join(f'<td style="padding:10px 12px;border-bottom:1px solid #c4b9a6;font-family:IBM Plex Sans,sans-serif;font-size:14px;line-height:1.45;color:#3a3633;vertical-align:top">{v}</td>' for v in vals) + '</tr>' for k, vals in HS)
    return page('Handshake r3', f'{EB} · C16', 'Visual ↔ runtime handshake',
                'Every reference resolves to a key in geometry/source.json or assets.json. Design does not normalise to runtime units; Foundation owns that.',
                f'<table style="border-collapse:collapse;width:100%"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>{SVGDEFS}', 2400, 1500)


# ================================================================== C17 frozen / illustrator, C18 audit
def board_frozen():
    frozen = ['Cast: hero, Mira, director only', 'Geometry revision ' + G.GEOMETRY_REVISION + ' (source.json) as the single source of truth',
              'Three locations, two paired portals, hero routes', 'Remembered Room layering; plates per location × camera recipe',
              'Painted Mass hero design; summary hero-owned in every beat', 'No text in any raster; live-text slots and their keys',
              'Decision: three complete intentions, equal style; select = underline; commit = bracket + separate confirm',
              'Private request = to the director, now, for private clarification afterward; Mira never moves',
              'Act stop points; no NPC response after any act', 'Boundary sequence identical for all acts',
              'Reveal: public motif only pre-boundary; same host-supplied account for every choice']
    illus = [('Plates', 'All 16 plates are procedural placeholders in final perspective: need painted materials and light.'),
             ('Hero at large scale', 'Coat folds, belt, collar drawn as lines; need painted fold masses.'),
             ('Hands', 'Rig mitten hands; act close-ups need the authored hand states painted.'),
             ('Seated actors', 'Director seated pose and chair integration need an illustrated pose sheet.'),
             ('Island edge', 'Noise-displaced edge; needs a painted brush-edge set.'),
             ('Prop textures', 'summary_prop, display_texture, author_page: neutral placeholders; final art must stay text-free.')]
    L = ''.join(f'<li class="cap" style="font-size:16px;margin-bottom:10px">{t}</li>' for t in frozen)
    R = ''.join(f'<div style="padding:12px 0;border-top:1px solid #c4b9a6"><div class="tt" style="font-size:24px">{t}</div><div class="cap">{d}</div></div>' for t, d in illus)
    return page('Frozen r3', f'{EB} · C17', 'Frozen for the slice vs still requires illustrator pass',
                'Left can be built now. Right is final in position, scale and layer role, but its pixels will be repainted under the same asset ids.',
                f'<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:80px"><div><div class="eb">Final / frozen</div><ul>{L}</ul></div><div><div class="eb">Illustrator pass</div>{R}</div></div>{SVGDEFS}', 2400, 1300)


def board_audit(results):
    rows = ''.join(f'<tr><td style="padding:10px 12px;border-bottom:1px solid #c4b9a6;font-family:IBM Plex Sans,sans-serif;font-size:16px">{k}</td>'
                   f'<td style="padding:10px 12px;border-bottom:1px solid #c4b9a6;font-family:IBM Plex Mono,monospace;font-size:14px;color:{"#4E6E3A" if ok == "PASS" else ("#8a6a1a" if ok == "EXTERNAL" else "#A5442E")}">{ok}</td>'
                   f'<td style="padding:10px 12px;border-bottom:1px solid #c4b9a6;font-family:IBM Plex Sans,sans-serif;font-size:14px;color:#3a3633">{ev}</td></tr>' for k, ok, ev in results)
    copy = ''.join(f'<tr><td style="padding:8px 12px;border-bottom:1px solid #c4b9a6;font-family:IBM Plex Mono,monospace;font-size:13px">{k}</td><td style="padding:8px 12px;border-bottom:1px solid #c4b9a6;font-family:Newsreader,Georgia,serif;font-size:17px">{v[0]}</td>'
                   f'<td style="padding:8px 12px;border-bottom:1px solid #c4b9a6;font-family:IBM Plex Mono,monospace;font-size:12px;color:{CHIP[v[1]]}">{v[1]}</td></tr>' for k, v in COPY.items())
    return page('Audit r3', f'{EB} · C18', 'Source-safety self-audit and copy registry',
                'Automated checks run over the generator, geometry and exported files. EXTERNAL = depends on Gold copy that is not in this package.',
                f'<table style="border-collapse:collapse;width:100%">{rows}</table><div class="eb" style="margin-top:50px">Copy registry (live DOM only)</div><table style="border-collapse:collapse;width:100%;margin-top:14px">{copy}</table>{SVGDEFS}', 2400, 2000)
