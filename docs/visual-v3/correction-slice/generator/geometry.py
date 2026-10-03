"""THE CORRECTION — authoritative Design geometry (single source of truth).

Every location has its own stable coordinate system, independent of any camera:
  origin = south-west inner floor corner of the location
  +x = east, +y = up, +z = north, units = metres, floor plane y = 0.
All scene renders, plans and exports read from this module. Nothing else may
hard-code geometry.
"""
import json, math

GEOMETRY_REVISION = 'correction-geo-r3'


def rect(x0, z0, x1, z1):
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]


def yaw_to_dir(yaw):
    """rig yaw (deg) -> facing unit vector in location (x, z). yaw 0 = south (toward camera side), 90 = east, 180 = north."""
    return [round(math.sin(math.radians(yaw)), 4), round(-math.cos(math.radians(yaw)), 4)]


def facing_yaw(frm, to):
    dx, dz = to[0] - frm[0], to[1] - frm[1]
    return round(math.degrees(math.atan2(dx, -dz)), 1)


# ------------------------------------------------------------------ MEETING ROOM
MR_DIRECTOR = [4.75, 5.9]
MR_NEAR_DIRECTOR = [5.6, 5.4]
MEETING = dict(
    id='correction.meeting_room',
    bounds=dict(xMin=0.0, xMax=6.8, zMin=0.0, zMax=7.4, ceiling=2.8),
    walls=dict(west=dict(x=0.0, kind='glass', mullion_spacing=1.25), north=dict(z=7.4, kind='plaster'),
               east=dict(x=6.8, kind='plaster'), south=dict(z=0.0, kind='camera-side (not rendered)')),
    walkable=[rect(0.25, 0.25, 6.3, 7.15)],
    obstacles=dict(
        table=dict(poly=rect(2.55, 3.2, 4.25, 6.5), height=0.74),
        credenza=dict(poly=rect(6.35, 2.8, 6.8, 5.4), height=0.75),
        chair_own_seat=dict(poly=rect(0.41, 2.86, 0.89, 3.34), height=1.02),
        chair_west_1=dict(poly=rect(1.81, 3.86, 2.29, 4.34), height=1.02),
        chair_west_2=dict(poly=rect(1.81, 5.16, 2.29, 5.64), height=1.02),
        chair_east_1=dict(poly=rect(4.51, 4.16, 4.99, 4.64), height=1.02),
        chair_director=dict(poly=rect(4.59, 5.66, 5.07, 6.14), height=1.02),
        chair_south_end=dict(poly=rect(3.16, 2.51, 3.64, 2.99), height=1.02),
    ),
    occluders=dict(
        table=dict(poly=rect(2.55, 3.2, 4.25, 6.5), yMin=0.0, yMax=0.74, note='hides legs and laps of anything north of z=3.2 behind it'),
        chair_south_end_back=dict(segment=[[3.17, 2.51], [3.63, 2.51]], yMin=0.55, yMax=1.02, note='empty chair, back to camera'),
        chair_director_back=dict(segment=[[5.07, 5.67], [5.07, 6.13]], yMin=0.55, yMax=1.02),
        glass_mullions=dict(x=0.0, z=[0.0, 1.25, 2.5, 3.75, 5.0, 6.25], width=0.06, yMin=0.0, yMax=2.8),
        door_jambs=dict(segments=[[[0.0, 3.8], [0.0, 3.8]], [[0.0, 4.75], [0.0, 4.75]]], yMin=0.0, yMax=2.15),
    ),
    portals=dict(P1=dict(segment=[[0.0, 3.8], [0.0, 4.75]], height=2.15, to='correction.corridor', paired='P1',
                         jambs=[[0.0, 3.8], [0.0, 4.75]], threshold_inside=[0.4, 4.28], threshold_outside=[-0.4, 4.28])),
    display_surfaces=dict(screen=dict(plane='z=7.39', corners=[[2.05, 2.3, 7.39], [4.75, 2.3, 7.39], [4.75, 0.95, 7.39], [2.05, 0.95, 7.39]],
                                       live_text_slots=['display.title'], content='neutral chart texture, no data')),
    actors=dict(
        mira=dict(root=[5.25, 6.85], yaw=-58, posture='stand', note='at the screen; never moves in this slice'),
        director=dict(root=MR_DIRECTOR, yaw=-90, posture='seat', seat='chair_director', note='never moves in this slice'),
    ),
    hero_anchors=dict(
        entry=dict(root=[0.5, 4.3], yaw=90, posture='stand', note='first step inside P1'),
        own_seat=dict(root=[0.65, 3.1], yaw=90, posture='seat', seat='chair_own_seat'),
        stand_near_entry=dict(root=[1.2, 3.7], yaw=78, posture='stand', note='standing preparation'),
        near_director=dict(root=MR_NEAR_DIRECTOR, yaw=facing_yaw(MR_NEAR_DIRECTOR, MR_DIRECTOR), posture='stand',
                           note='private request; 0.99 m from director root, bending toward the seated director'),
    ),
    routes=dict(stand_to_near_director=[[1.2, 3.7], [1.6, 2.5], [5.5, 2.5], [5.5, 4.4], MR_NEAR_DIRECTOR],
                seat_to_near_director=[[0.65, 3.1], [1.0, 2.45], [5.5, 2.45], [5.5, 4.4], MR_NEAR_DIRECTOR],
                entry_to_seat=[[0.5, 4.3], [0.9, 3.6], [0.65, 3.1]],
                entry_to_stand=[[0.5, 4.3], [1.2, 3.7]]),
    objects=dict(
        laptop_west=dict(pos=[3.0, 0.74, 4.2], footprint=[0.34, 0.24]),
        laptop_east=dict(pos=[3.85, 0.74, 5.1], footprint=[0.34, 0.24]),
        cup_1=dict(pos=[2.85, 0.74, 5.4]), cup_2=dict(pos=[3.9, 0.74, 3.8]), cup_3=dict(pos=[3.95, 0.74, 5.9]),
        papers=dict(pos=[3.35, 0.745, 3.75], footprint=[0.3, 0.38]),
    ),
    attachments=['hero.hand_R.summary', 'hero.lap.summary', 'mira.hand_R.gesture', 'director.forearm_L.table'],
    cameras=dict(
        desktop=dict(position=[3.4, 1.5, -1.2], look='+z (north)', focal_px=1240, frame=[1920, 1080], principal=[1060, 440]),
        portrait=dict(position=[1.2, 1.5, 0.4], look='+z (north)', focal_px=1300, frame=[780, 1688], principal=[400, 760], use='all meeting beats except near_director'),
        portrait_room=dict(position=[4.0, 1.5, 1.6], look='+z (north)', focal_px=1150, frame=[780, 1688], principal=[330, 760], use='beat 02 second framing: display, Mira, director (camera move from portrait)'),
        portrait_east=dict(position=[4.9, 1.5, 1.4], look='+z (north)', focal_px=1300, frame=[780, 1688], principal=[390, 760], use='private request beat (near_director)'),
    ),
    camera_safe=dict(desktop=dict(title_safe=[96, 54, 1824, 1026], line_zone=[0, 0, 1920, 130], intent_zone=[0, 930, 1920, 1080]),
                     portrait=dict(title_safe=[40, 60, 740, 1628], text_zone=[0, 0, 780, 230], thumb_zone=[0, 1180, 780, 1688])),
)

# ------------------------------------------------------------------ CORRIDOR
CORRIDOR = dict(
    id='correction.corridor',
    bounds=dict(xMin=0.0, xMax=3.3, zMin=0.0, zMax=15.0, ceiling=2.7),
    walls=dict(west=dict(x=0.0, kind='plaster', window_bay=dict(z=[6.8, 9.2], y=[0.75, 2.4])),
               east=dict(x=3.3, kind='glass z 1.5–8.9 (meeting room), plaster elsewhere', glass_z=[1.5, 8.9])),
    walkable=[rect(0.25, 0.25, 3.05, 14.75)],
    obstacles=dict(bench=dict(poly=rect(0.0, 9.6, 0.42, 11.2), height=0.47), sill=dict(poly=rect(0.0, 6.8, 0.18, 9.2), height=0.76)),
    occluders=dict(glass_mullions=dict(x=3.3, z=[1.5, 2.9, 4.3, 5.3, 6.25, 7.6, 8.9], width=0.06, yMin=0.0, yMax=2.7),
                   bench=dict(poly=rect(0.0, 9.6, 0.42, 11.2), yMin=0.0, yMax=0.47)),
    portals=dict(P1=dict(segment=[[3.3, 5.3], [3.3, 6.25]], height=2.15, to='correction.meeting_room', paired='P1',
                         jambs=[[3.3, 5.3], [3.3, 6.25]], threshold_inside=[2.9, 5.78], threshold_outside=[3.7, 5.78]),
                 P0=dict(segment=[[0.0, 0.6], [0.0, 1.8]], height=2.3, to='correction.open_plan', paired='P0',
                         jambs=[[0.0, 0.6], [0.0, 1.8]], threshold_inside=[0.4, 1.2], threshold_outside=[-0.4, 1.2])),
    see_through=dict(glass='east wall z 1.5–8.9 shows correction.meeting_room via transform meeting→corridor: x+3.3, z+1.5',
                     actors_visible=['mira', 'director'], note='same actor identities and poses as the meeting room state, finish 0.25; never proxies'),
    hero_anchors=dict(
        from_meeting=dict(root=[2.9, 5.78], yaw=-90, posture='stand'),
        reading=dict(root=[0.75, 7.6], yaw=28, posture='stand', note='window bay; read pose'),
        return_threshold=dict(root=[2.9, 5.78], yaw=90, posture='stand'),
    ),
    routes=dict(exit_to_reading=[[2.9, 5.78], [1.6, 6.6], [0.75, 7.6]], reading_to_return=[[0.75, 7.6], [1.8, 6.4], [2.9, 5.78]]),
    objects=dict(window_light=dict(pos=[0.6, 0.0, 8.0], footprint=[1.4, 2.6])),
    attachments=['hero.hand_R.summary', 'hero.hand_L.summary'],
    cameras=dict(desktop=dict(position=[1.9, 1.55, 3.2], look='+z (north)', focal_px=1150, frame=[1920, 1080], principal=[820, 430]),
                 portrait=dict(position=[1.1, 1.55, 3.9], look='+z (north)', focal_px=1300, frame=[780, 1688], principal=[380, 760])),
    camera_safe=MEETING['camera_safe'],
)

# ------------------------------------------------------------------ OPEN PLAN
OPEN_PLAN = dict(
    id='correction.open_plan',
    bounds=dict(xMin=0.0, xMax=9.6, zMin=0.0, zMax=11.0, ceiling=2.9),
    walls=dict(north=dict(z=11.0, kind='window wall'), east=dict(x=9.6, kind='plaster', opening='P0')),
    walkable=[rect(0.25, 0.25, 9.35, 10.75)],
    obstacles=dict(hero_desk=dict(poly=rect(4.05, 1.95, 5.75, 2.65), height=0.74),
                   hero_chair=dict(poly=rect(4.91, 2.71, 5.39, 3.19), height=1.02),
                   desk_row_1a=dict(poly=rect(0.6, 5.0, 2.2, 5.75), height=0.75), desk_row_1b=dict(poly=rect(3.0, 5.0, 4.6, 5.75), height=0.75),
                   desk_row_2a=dict(poly=rect(0.6, 6.8, 2.2, 7.55), height=0.75), desk_row_2b=dict(poly=rect(3.0, 6.8, 4.6, 7.55), height=0.75)),
    occluders=dict(hero_desk=dict(poly=rect(4.05, 1.95, 5.75, 2.65), yMin=0.0, yMax=0.74), monitor=dict(segment=[[4.29, 2.45], [5.01, 2.45]], yMin=0.86, yMax=1.27)),
    portals=dict(P0=dict(segment=[[9.6, 8.6], [9.6, 9.8]], height=2.3, to='correction.corridor', paired='P0',
                         jambs=[[9.6, 8.6], [9.6, 9.8]], threshold_inside=[9.2, 9.2], threshold_outside=[10.0, 9.2])),
    display_surfaces=dict(monitor=dict(plane='z=2.45', corners=[[4.29, 1.27, 2.45], [5.01, 1.27, 2.45], [5.01, 0.86, 2.45], [4.29, 0.86, 2.45]],
                                        live_text_slots=['display.title'], content='deck thumbnail, neutral chart texture, no data')),
    actors=dict(),
    hero_anchors=dict(at_desk=dict(root=[5.55, 2.25], yaw=-62, posture='stand'), to_corridor=dict(root=[9.2, 9.2], yaw=90, posture='stand')),
    routes=dict(desk_to_P0=[[5.55, 2.25], [6.4, 3.4], [8.6, 8.6], [9.2, 9.2]]),
    objects=dict(summary=dict(attached='hero.hand_R.summary'), mug=dict(pos=[4.28, 0.74, 2.1]), sheet=dict(pos=[4.92, 0.745, 2.18], footprint=[0.4, 0.28])),
    attachments=['hero.hand_R.summary'],
    cameras=dict(desktop=dict(position=[5.0, 1.55, -1.0], look='+z (north)', focal_px=1220, frame=[1920, 1080], principal=[900, 400]),
                 portrait=dict(position=[5.1, 1.55, -0.8], look='+z (north)', focal_px=1150, frame=[780, 1688], principal=[390, 760])),
    camera_safe=MEETING['camera_safe'],
)

CORRIDOR.setdefault('actors', {})  # no actor stands in the corridor; Mira/director appear only via see_through
LOCATIONS = {L['id']: L for L in (OPEN_PLAN, CORRIDOR, MEETING)}

PORTAL_PAIRS = [
    dict(a=['correction.open_plan', 'P0'], b=['correction.corridor', 'P0'],
         transform_a_to_b='x - 9.6, z - 8.0', endpoints=[[[9.6, 8.6], [0.0, 0.6]], [[9.6, 9.8], [0.0, 1.8]]]),
    dict(a=['correction.corridor', 'P1'], b=['correction.meeting_room', 'P1'],
         transform_a_to_b='x - 3.3, z - 1.5', endpoints=[[[3.3, 5.3], [0.0, 3.8]], [[3.3, 6.25], [0.0, 4.75]]]),
]

RESOLVED = [
    'Meeting room bounds: earlier boards used camera-space x −3.4…3.4, z 1.2…8.6. Authoritative: x 0…6.8, z 0…7.4 (camera-space + (3.4, −1.2)).',
    'Meeting P1: earlier variants put the door at camera-space z 2.55…3.45 and 5.0…5.95. Authoritative: x 0, z 3.8…4.75.',
    'Corridor glass span: earlier hallway render showed camera-space z 6…13 (loc 5…12), which did not pair with P1. Authoritative: z 1.5…8.9, P1 z 5.3…6.25.',
    'Corridor window bay: moved from loc z 3.4…5.8 to z 6.8…9.2 so it does not share the wall with P0 / the open plan.',
    'Open plan: the meeting-room glass box drawn at its right rear contradicted the building plan. Replaced by the east wall with P0 to the corridor.',
    'Plans on C13/C14 previously drew the meeting room with the camera at z=0 inside the plan; plans now use location coordinates with the camera as an external recipe.',
    'Colleague anchors C1–C4 and their chairs as actors are removed. Their chairs remain as empty obstacles.',
]


def to_json():
    return dict(revision=GEOMETRY_REVISION, units='metres', convention=dict(origin='south-west inner floor corner of each location', axes=dict(x='east', y='up', z='north'), floor_plane='y = 0',
                yaw='rig yaw degrees: 0 = facing south (camera side), 90 = east, 180 = north, -90 = west'),
                cast=dict(hero='protagonist (player)', mira='Mira, team lead', director='director'),
                locations=LOCATIONS, portal_pairs=PORTAL_PAIRS,
                camera_model='pinhole, no rotation: screen_x = principal_x + focal_px * (x - cam_x) / (z - cam_z); screen_y = principal_y + focal_px * (cam_y - y) / (z - cam_z)',
                resolved_contradictions=RESOLVED, runtime_normalisation='not provided here; Foundation derives normalised 0–100 output')


if __name__ == '__main__':
    print(json.dumps(to_json(), indent=1)[:400])
