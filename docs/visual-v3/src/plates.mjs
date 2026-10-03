import { R, P, E, poly, C } from './kit.mjs';

/* ============================================================ APARTMENT ====
   Plate 1000 x 600. Floor line y=300. Lamp left, bathroom door right, coffee
   table (phone) centre. Colours are night: wall plum-blue, floor warm brown.   */
export const apartment = {
  W: 1000, H: 600,
  back: [
    R(-200, -120, 1500, 430, '#2B2F46'),                 // wall
    R(-200, 292, 1500, 14, '#1D2033'),                   // skirting
    R(96, 64, 250, 196, '#12172A'),                      // window
    R(96, 64, 250, 196, 'none', 1, { lw: 1.1, lo: 0.6 }),
    P('M221 66 V258 M98 160 H344', '#2B2F46', 1, { nl: true }),
    R(86, 256, 270, 12, '#3A3F58'),                       // sill
    ...[[150, 190], [188, 128], [270, 214], [312, 150], [168, 236], [296, 100]].map(([x, y]) => R(x, y, 3, 3, '#F3C98F', 0.55, { nl: true })),
    R(0, 84, 70, 218, '#171A2B'),                         // bedroom doorway, left
    R(644, 90, 180, 214, '#14192A'),                      // bathroom recess
    R(656, 96, 156, 208, '#4A4258'),                      // bathroom door
    P('M672 130 H796 M672 190 H796', '#2E2938', 0.7, { nl: true }),
    E(786, 214, 5, 5, '#E9B873', 0.8, { nl: true }),
    R(642, 86, 184, 10, '#3A3F58'),
    R(880, 100, 130, 204, '#161A2B'),                     // hall, far right
    R(900, 122, 84, 176, '#332F43'),
    R(560, 200, 54, 54, '#1F2438', 0.9),                  // small frame on wall
    R(566, 206, 42, 42, '#6B5F77', 0.55, { nl: true }),
  ],
  mid: [
    P('M-200 304 H1300 V700 H-200 Z', '#40363F'),         // floor
    P('M-200 304 H1300 V334 H-200 Z', '#362E39', 1, { nl: true }),
    poly([[360, 430], [760, 430], [850, 560], [270, 560]], '#47545E'),       // rug
    poly([[360, 430], [760, 430], [850, 560], [270, 560]], 'none', 1, { lw: 1.1, lo: 0.5 }),
    // sofa (left, 3/4)
    R(-40, 326, 330, 126, '#7A6258'),
    R(-40, 296, 330, 58, '#8A7066'),
    R(-60, 400, 60, 90, '#5E4A46'),
    R(250, 350, 56, 118, '#5E4A46'),
    R(40, 360, 180, 70, '#6C554D', 0.9, { nl: true }),
    R(-40, 446, 346, 16, '#2A2127', 0.8, { nl: true }),
    // floor lamp
    R(112, 118, 5, 215, '#2A2530'),
    poly([[84, 110], [146, 110], [136, 66], [94, 66]], '#F2C27F'),
    E(114, 336, 22, 5, '#1C1820', 0.8, { nl: true }),
    // coffee table
    poly([[480, 410], [650, 410], [676, 446], [458, 446]], '#7A624F'),
    R(458, 446, 218, 9, '#58463A'),
    R(466, 455, 8, 38, '#4A3A31'), R(660, 455, 8, 38, '#4A3A31'),
    E(588, 418, 9, 3, '#E7E0D2', 0.9, { nl: true }),     // cup
    // side table right + plant
    R(850, 380, 70, 80, '#4A3C3A'),
    R(868, 330, 34, 52, '#2E4B44'),
    R(-200, 304, 1500, 400, 'url(#gBot)', 0.7, { nl: true }),
    R(-200, -120, 1500, 420, 'url(#gTop)', 0.6, { nl: true }),
  ],
  fore: (s) => [
    R(-80, 470, 200, 160, '#14101A'),                     // sofa arm occluder
    R(-80, 470, 200, 12, '#2D2430', 1, { nl: true }),
  ],
  extraLines: '',
  lights(s) {
    const open = s.door === 'open';
    return `<g style="mix-blend-mode:screen">
      <ellipse cx="114" cy="268" rx="300" ry="270" fill="url(#gLamp)" opacity="${s.lampDim ? 0.5 : 0.9}"/>
      <ellipse cx="120" cy="92" rx="70" ry="60" fill="url(#gLamp)" opacity=".9"/>
      <ellipse cx="260" cy="520" rx="330" ry="110" fill="url(#gLamp)" opacity=".34"/>
      <rect x="664" y="298" width="140" height="6" fill="#CFE9EE" opacity="${open ? 0.9 : 0.8}"/>
      <ellipse cx="734" cy="318" rx="${open ? 330 : 110}" ry="${open ? 220 : 26}" fill="url(#gCold)" opacity="${open ? 0.8 : 0.5}"/>
      ${s.phone ? `<ellipse cx="560" cy="414" rx="170" ry="90" fill="url(#gCold)" opacity=".42"/><ellipse cx="560" cy="410" rx="44" ry="26" fill="url(#gCold)" opacity=".9"/>` : ''}
    </g>
    <rect x="-300" y="-300" width="1800" height="1300" fill="url(#gFloorFade)" opacity=".0"/>`;
  },
};

/* ============================================================== OFFICE ====
   Meeting room. Presentation screen at the far wall, table in the middle,
   hero stands by the wall left; the screen is the brightest planar thing.      */
export const office = {
  W: 1000, H: 600,
  back: [
    R(-200, -120, 1500, 420, '#2C3C48'),
    R(-200, 290, 1500, 14, '#1E2C37'),
    R(690, 40, 250, 250, '#101E2C'),                      // city window
    R(690, 40, 250, 250, 'none', 1, { lw: 1.1, lo: 0.55 }),
    P('M815 42 V288', '#2C3C48', 1, { nl: true }),
    ...[[720, 200], [760, 120], [862, 230], [900, 90], [790, 250], [880, 160]].map(([x, y]) => R(x, y, 3, 3, '#F0C98E', 0.5, { nl: true })),
    R(300, 36, 330, 196, '#12202C'),                      // screen frame
    R(310, 46, 310, 176, '#C9DEE2'),                      // screen
    R(310, 46, 310, 176, 'none', 1, { lw: 1.1, lo: 0.6 }),
    R(332, 70, 160, 14, '#2D4A56', 0.9, { nl: true }),    // title bar (text is DOM, never art)
    R(332, 96, 230, 5, '#7FA0AA', 0.8, { nl: true }),
    R(332, 112, 210, 5, '#7FA0AA', 0.8, { nl: true }),
    R(332, 150, 62, 56, '#9CBBC3', 0.9, { nl: true }), R(404, 160, 62, 46, '#9CBBC3', 0.9, { nl: true }), R(476, 140, 62, 66, '#9CBBC3', 0.9, { nl: true }),
    R(0, 96, 120, 196, '#233440'),                        // door left
    R(8, 104, 104, 188, '#2A3C49', 0.9),
    R(-200, -120, 1500, 420, 'url(#gTop)', 0.5, { nl: true }),
  ],
  mid: [
    P('M-200 296 H1300 V700 H-200 Z', '#3A4953'),
    poly([[250, 400], [800, 400], [900, 548], [140, 548]], '#4B5C66'),          // table top
    poly([[250, 400], [800, 400], [900, 548], [140, 548]], 'none', 1, { lw: 1.1, lo: 0.5 }),
    R(140, 548, 760, 14, '#2F3B44'),
    R(158, 562, 14, 36, '#2A353D'), R(870, 562, 14, 36, '#2A353D'),
    // chairs (backs)
    ...[[330, 366], [480, 362], [640, 362], [760, 366]].map(([x, y]) => P(`M${x - 26} ${y + 46} V${y} Q${x} ${y - 8} ${x + 26} ${y} V${y + 46} Z`, '#1F2B35', 1, { nl: false })),
    // objects on table: papers, laptop (no text)
    poly([[310, 470], [380, 470], [392, 492], [300, 492]], '#E7DFCF', 0.95),
    poly([[640, 452], [716, 452], [726, 478], [630, 478]], '#1E2A33'),
    E(560, 468, 10, 4, '#D9D2C2', 0.9, { nl: true }),
    R(-200, 548, 1500, 200, 'url(#gBot)', 0.7, { nl: true }),
  ],
  fore: () => [
    P('M-120 500 Q20 470 120 500 V660 H-120 Z', '#121C25', 0.92),        // chair back occluder

  ],
  lights(s) {
    return `<g style="mix-blend-mode:screen">
      <ellipse cx="465" cy="130" rx="330" ry="170" fill="url(#gCold)" opacity=".62"/>
      <ellipse cx="470" cy="430" rx="360" ry="120" fill="url(#gCold)" opacity=".24"/>
      <ellipse cx="820" cy="150" rx="190" ry="170" fill="url(#gLamp)" opacity=".26"/>
    </g>`;
  },
};

/* ============================================================== HALLWAY ====
   One-point corridor; elevator at far end. Two tired practicals.               */
export const hallway = {
  W: 1000, H: 600,
  back: [
    R(-200, -120, 1500, 480, '#27333D'),
    poly([[-200, -120], [330, 120], [670, 120], [1200, -120]], '#1A242D'),     // ceiling
    poly([[-200, 700], [330, 400], [670, 400], [1200, 700]], '#303A41'),       // floor
    poly([[-200, -120], [330, 120], [330, 400], [-200, 700]], '#222D36'),      // left wall
    poly([[1200, -120], [670, 120], [670, 400], [1200, 700]], '#222D36'),      // right wall
    R(330, 120, 340, 280, '#2E3B45'),                                           // end wall
    R(430, 176, 140, 224, '#9FB3B7'),                                           // lift door (closed, brushed)
    R(498, 176, 4, 224, '#6E8286', 1, { nl: true }),
    R(420, 164, 160, 14, '#16202A'),
    R(486, 142, 28, 14, '#0F1820', 1), R(494, 146, 12, 6, '#7FD1A0', 0.85, { nl: true }),     // floor indicator
    R(590, 250, 12, 30, '#16202A'), E(596, 262, 3, 3, '#E9B873', 0.9, { nl: true }),         // call button
    // doors on the left wall (neighbours)
    poly([[60, 300], [150, 255], [150, 470], [60, 560]], '#3A3340'),
    poly([[200, 255], [262, 226], [262, 400], [200, 440]], '#363040'),
    // mat outside own door, right
    poly([[790, 560], [920, 470], [980, 500], [850, 610]], '#4C4440', 0.9, { nl: true }),
  ],
  mid: [
    R(600, 320, 40, 80, '#16202A', 0.7, { nl: true }),
  ],
  fore: () => [
    R(-60, -40, 70, 700, '#0D141B'),     // near door frame, left
  ],
  lights(s) {
    return `<g style="mix-blend-mode:screen">
      <ellipse cx="260" cy="180" rx="210" ry="130" fill="url(#gLamp)" opacity=".42"/>
      <ellipse cx="560" cy="150" rx="210" ry="110" fill="url(#gLamp)" opacity=".34"/>
      <ellipse cx="500" cy="430" rx="260" ry="90" fill="url(#gCold)" opacity="${s.liftLit ? 0.8 : 0.34}"/>
      <ellipse cx="500" cy="320" rx="120" ry="150" fill="url(#gCold)" opacity="${s.liftLit ? 0.7 : 0.22}"/>
    </g>`;
  },
};

/* ============================================================== ELEVATOR ===
   Interior car, camera behind the rider, facing the doors.                    */
export const elevator = {
  W: 1000, H: 600,
  back: [
    R(-200, -120, 1500, 760, '#3A4348'),
    poly([[-200, -120], [260, 60], [740, 60], [1200, -120]], '#2B343A'),       // ceiling
    poly([[-200, 700], [260, 470], [740, 470], [1200, 700]], '#3F464A'),       // floor
    poly([[-200, -120], [260, 60], [260, 470], [-200, 700]], '#4B565B'),       // left wall
    poly([[1200, -120], [740, 60], [740, 470], [1200, 700]], '#4B565B'),       // right wall
    R(260, 60, 480, 410, '#8A9B9F'),                                             // doors
    R(497, 60, 6, 410, '#5C6E73'),
    R(262, 62, 476, 14, '#232C32'),
    R(470, 24, 60, 30, '#0E1418'), // indicator housing
    R(300, 470, 400, 6, '#2A3338', 1, { nl: true }),
    R(760, 190, 60, 150, '#1E262B'),                                              // panel (right wall, foreshortened)
    ...[[780, 214], [780, 244], [780, 274], [780, 304]].map(([x, y]) => E(x, y, 6, 6, '#C9D2D2', 0.85, { nl: true })),
    E(780, 244, 6, 6, '#F0B36A', 0.95, { nl: true }),
    P('M-30 250 L260 262 V280 L-30 270 Z', '#9AA8AB', 0.85),                      // handrail left
  ],
  mid: [],
  fore: () => [R(-80, -60, 56, 760, '#0F161B', 0.9)],
  lights(s) {
    return `<g style="mix-blend-mode:screen">
      <ellipse cx="500" cy="70" rx="420" ry="190" fill="url(#gCold)" opacity=".55"/>
      <ellipse cx="500" cy="380" rx="360" ry="120" fill="url(#gCold)" opacity=".22"/>
      <ellipse cx="500" cy="40" rx="38" ry="16" fill="#8CE6B0" opacity=".28"/>
    </g>`;
  },
};

/* ================================================================ STREET ===
   Wide 3/4, damp pavement. Entrance of the building at left, sodium lamp, the
   destination window far right.                                                */
export const street = {
  W: 1000, H: 600,
  back: [
    R(-200, -140, 1500, 400, '#1E2A3C'),
    // building facade left
    R(-120, -60, 520, 400, '#2B3347'),
    ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => R(-60 + c * 130, -20 + r * 82, 70, 52, (r + c) % 4 === 1 ? '#E3B070' : '#18202F', (r + c) % 4 === 1 ? 0.8 : 1, { lo: 0.35 }))),
    R(300, 190, 100, 150, '#1A2130'),                      // entrance of own building
    R(314, 204, 72, 136, '#E0B97C', 0.85),
    // far row of buildings, centre
    R(430, 130, 200, 210, '#232C3E'),
    R(460, 160, 36, 30, '#18202F'), R(520, 160, 36, 30, '#E3B070', 0.7), R(580, 160, 36, 30, '#18202F'),
    // destination, right: small shopfront
    R(700, 180, 280, 162, '#2A2F3D'),
    R(724, 214, 170, 120, '#F2C98A'),                      // lit shop window
    R(724, 214, 170, 120, 'none', 1, { lw: 1.1, lo: 0.6 }),
    R(908, 222, 48, 118, '#D9B27A', 0.9),                   // door glass
    R(690, 168, 300, 18, '#4A3F42'),                        // awning
  ],
  mid: [
    P('M-200 340 H1300 V700 H-200 Z', '#2F3846'),           // road + pavement
    P('M-200 340 H1300 V392 H-200 Z', '#434B58', 1, { nl: true }),   // pavement
    R(-200, 390, 1500, 5, '#1B222E', 1, { nl: true }),             // kerb
    // parked car silhouette
    P('M560 400 Q574 372 620 366 H720 Q760 372 780 400 V430 H560 Z', '#141A26'),
    E(610, 432, 20, 20, '#0C1018', 1, { nl: true }), E(736, 432, 20, 20, '#0C1018', 1, { nl: true }),
    // streetlamp
    R(498, 90, 6, 260, '#151B27'),
    P('M501 92 H540 L548 100 H501 Z', '#151B27'),
    E(540, 104, 12, 5, '#FFD59A', 1, { nl: true }),
    // wet reflections
    R(716, 342, 150, 90, 'url(#gWet)', 0.55, { nl: true }),
    R(318, 342, 72, 90, 'url(#gWet)', 0.5, { nl: true }),
    R(-200, 340, 1500, 400, 'url(#gBot)', 0.6, { nl: true }),
  ],
  fore: () => [P('M-80 520 Q60 500 190 520 V700 H-80 Z', '#10151F', 0.95)],
  lights(s) {
    return `<g style="mix-blend-mode:screen">
      <ellipse cx="540" cy="110" rx="170" ry="150" fill="url(#gSodium)" opacity=".8"/>
      <ellipse cx="540" cy="380" rx="260" ry="60" fill="url(#gSodium)" opacity=".38"/>
      <ellipse cx="360" cy="270" rx="150" ry="130" fill="url(#gLamp)" opacity=".4"/>
      <ellipse cx="810" cy="280" rx="260" ry="170" fill="url(#gLamp)" opacity=".62"/>
      <ellipse cx="812" cy="402" rx="200" ry="40" fill="url(#gLamp)" opacity=".4"/>
    </g>`;
  },
};

/* ============================================================ DESTINATION ==
   Close shopfront. Door, lit window, a letter slot, a step.                    */
export const destination = {
  W: 1000, H: 600,
  back: [
    R(-200, -140, 1500, 480, '#232B3A'),
    R(-60, 40, 1120, 300, '#2D3445'),                       // facade
    R(60, 120, 420, 220, '#F4CE92'),                        // big lit window
    R(60, 120, 420, 220, 'none', 1, { lw: 1.1, lo: 0.6 }),
    P('M270 122 V338', '#2D3445', 1, { nl: true }),
    R(90, 250, 360, 8, '#8A6A4E', 0.9, { nl: true }),       // counter edge seen through glass
    R(110, 200, 60, 50, '#C58A5C', 0.5, { nl: true }),
    R(560, 100, 210, 240, '#3A404E'),                       // door frame
    R(578, 118, 174, 222, '#F0C487'),                       // door glass, lit
    R(578, 118, 174, 222, 'none', 1, { lw: 1.1, lo: 0.6 }),
    E(738, 246, 5, 5, '#6B5442', 1, { nl: true }),          // handle
    R(824, 214, 66, 14, '#151A24'),                          // letter slot plate
    R(832, 219, 50, 4, '#05070D', 1, { nl: true }),
    R(40, 70, 760, 28, '#4A3F42'),                           // awning
  ],
  mid: [
    P('M-200 340 H1300 V700 H-200 Z', '#323B49'),
    R(540, 330, 260, 18, '#4A525F'),                          // step
    R(-200, 348, 1500, 6, '#1B222E', 1, { nl: true }),
    R(60, 342, 420, 90, 'url(#gWet)', 0.6, { nl: true }),
    R(578, 342, 174, 100, 'url(#gWet)', 0.6, { nl: true }),
    R(-200, 340, 1500, 400, 'url(#gBot)', 0.55, { nl: true }),
  ],
  fore: () => [R(-80, -60, 56, 760, '#0F1520', 0.9)],
  lights(s) {
    return `<g style="mix-blend-mode:screen">
      <ellipse cx="270" cy="230" rx="320" ry="230" fill="url(#gLamp)" opacity=".7"/>
      <ellipse cx="665" cy="240" rx="250" ry="230" fill="url(#gLamp)" opacity=".75"/>
      <ellipse cx="640" cy="420" rx="330" ry="70" fill="url(#gLamp)" opacity=".42"/>
    </g>`;
  },
};
