import React from 'react';
import { palettes } from '../../design/tokens';
import { worldTemplates, type ViviWorldId } from '../../world/templates';

/**
 * Vivi scene art is built in four layers so figures can stand *inside* a world
 * rather than on top of a picture of one:
 *
 *   backdrop   architecture and distant light, always behind everyone
 *   midground  floor, furniture and structures a figure walks among
 *   foreground a single gentle occluder a figure can pass behind
 *   lighting   pooled light, spill and dark corners, composited on top
 *
 * Coordinates are the shared 1000 × 600 world. The walkable floor begins at
 * y = 284 (47%), which is where every wall meets its floor.
 */

export interface SceneState {
  /** The story's first cue has fired. */
  active?: boolean;
  doorState?: 'closed' | 'ajar' | 'handle_moving' | 'opening' | 'open';
  phoneLit?: boolean;
  /** Diegetic readout on an elevator or floor indicator. */
  elevatorText?: string;
  /** Elevator doors have parted. */
  elevatorOpen?: boolean;
  /** A train or bus has pulled in. */
  vehicleIn?: boolean;
  /** Diegetic clock or board readout. */
  clockText?: string;
  /** Extra darkness for a held, quiet moment. */
  dim?: number;
  /**
   * Draw set-dressing people into the art. Only the flat composite used for
   * feed cards does this; on stage, people are actors in the runtime.
   */
  populated?: boolean;
}

const FLOOR_Y = 284;

type Palette = (typeof palettes)[keyof typeof palettes];

const isExterior = (w: ViviWorldId) =>
  w === 'city_rain' || w === 'neighborhood_sunset' || w === 'train_station';

/* ----------------------------------------------------------------- defs --- */

function SceneDefs({ world, p, uid }: { world: ViviWorldId; p: Palette; uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.shadow} />
        <stop offset="0.55" stopColor={p.sky} />
        <stop offset="1" stopColor={p.wall} />
      </linearGradient>
      <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.floor} />
        <stop offset="1" stopColor={p.shadow} />
      </linearGradient>
      <radialGradient id={`${uid}-pool`}>
        <stop offset="0" stopColor={p.practical} stopOpacity="0.62" />
        <stop offset="0.45" stopColor={p.practical} stopOpacity="0.2" />
        <stop offset="1" stopColor={p.practical} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-cold`}>
        <stop offset="0" stopColor="#bcd6e4" stopOpacity="0.5" />
        <stop offset="1" stopColor="#bcd6e4" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-corner`}>
        <stop offset="0.3" stopColor="#000" stopOpacity="0" />
        <stop offset="0.72" stopColor="#05070a" stopOpacity="0.32" />
        <stop offset="1" stopColor="#04060a" stopOpacity="0.82" />
      </radialGradient>
      {/* Analogue tooth. Two sparse dots per tile keeps it from reading as noise. */}
      <filter id={`${uid}-tooth`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
        <feColorMatrix in="n" type="saturate" values="0" />
      </filter>
    </defs>
  );
}

/* ------------------------------------------------------- apartment night --- */

function ApartmentBackdrop({ p, uid, state }: { p: Palette; uid: string; state: SceneState }) {
  const open = state.doorState === 'open' || state.doorState === 'opening' || state.doorState === 'ajar';
  return (
    <g>
      <rect width="1000" height={FLOOR_Y + 4} fill={`url(#${uid}-wall)`} />

      {/* Bedroom doorway, left: an exit that stays dark. */}
      <rect x="0" y="92" width="78" height={FLOOR_Y - 92} fill="#191c2c" />
      <rect x="70" y="92" width="10" height={FLOOR_Y - 92} fill="#0f1220" opacity="0.8" />

      {/* Window. Night outside is darker than the wall, never brighter. */}
      <rect x="140" y="76" width="220" height="180" rx="3" fill="#191c2e" />
      <rect x="140" y="76" width="220" height="180" rx="3" fill="none" stroke={p.wall} strokeWidth="9" />
      <path d="M250 80 V252 M144 166 H356" stroke={p.wall} strokeWidth="7" />
      <g fill="#f3c98f" opacity="0.3">
        <rect x="168" y="196" width="3" height="3" />
        <rect x="206" y="124" width="2.5" height="2.5" />
        <rect x="292" y="212" width="3" height="3" />
        <rect x="324" y="150" width="2" height="2" />
        <rect x="186" y="236" width="2.5" height="2.5" />
      </g>
      <rect x="134" y="250" width="232" height="10" rx="2" fill={p.wall} />

      {/* Bathroom door, right. The light behind it is the second act of the scene. */}
      <rect x="664" y="88" width="156" height={FLOOR_Y - 88 + 6} fill="#171a28" />
      {open && <rect x="664" y="88" width="156" height={FLOOR_Y - 88 + 6} fill="#cfe2ea" opacity="0.88" />}
      <rect
        x={open ? 664 : 672}
        y="94"
        width={open ? 44 : 140}
        height={FLOOR_Y - 94 + 6}
        fill={open ? '#2b3040' : '#4a4152'}
      />
      {!open && <path d="M690 112 H782 M690 170 H782" stroke="#000" strokeOpacity="0.18" strokeWidth="6" />}
      {!open && (
        <circle
          cx="762"
          cy="200"
          r="5"
          fill={p.practical}
          opacity={state.doorState === 'handle_moving' ? 1 : 0.65}
        />
      )}
      <rect x="656" y="82" width="172" height="10" rx="2" fill={p.wall} opacity="0.9" />
      {!open && <rect x="676" y={FLOOR_Y - 4} width="132" height="5" fill="#d6e8ef" opacity="0.72" />}

      {/* Hall to the front door, far right. */}
      <rect x="884" y="96" width="116" height={FLOOR_Y - 96} fill="#1c2030" />
      <rect x="904" y="118" width="78" height={FLOOR_Y - 128} fill="#3b3447" />
      <circle cx="966" cy="212" r="4" fill={p.practical} opacity="0.5" />
    </g>
  );
}

function ApartmentMidground({ p, uid, state }: { p: Palette; uid: string; state: SceneState }) {
  const open = state.doorState === 'open' || state.doorState === 'opening' || state.doorState === 'ajar';
  return (
    <g>
      <rect y={FLOOR_Y} width="1000" height={600 - FLOOR_Y} fill={`url(#${uid}-floor)`} />
      {/* Floorboards run toward the viewer and fade before they get busy. */}
      <g stroke="#1d1f2e" strokeOpacity="0.22" strokeWidth="2">
        <path d="M0 330 H1000 M0 392 H1000 M0 466 H1000 M0 552 H1000" />
      </g>
      <path d={`M0 ${FLOOR_Y} H1000`} stroke="#13151f" strokeOpacity="0.5" strokeWidth="4" />

      {/* Light spill from the bathroom lands on the floor, not in the air. */}
      {open && (
        <path d="M668 288 L818 288 L896 396 L622 396Z" fill="#cfe2ea" opacity="0.3" />
      )}
      {!open && <path d="M676 286 L812 286 L826 300 L664 300Z" fill="#cfe2ea" opacity="0.16" />}

      {/* Rug anchors the centre and separates sofa from table. */}
      <ellipse cx="420" cy="470" rx="330" ry="86" fill="#3f3344" opacity="0.6" />
      <ellipse cx="420" cy="470" rx="300" ry="72" fill="none" stroke={p.practical} strokeOpacity="0.1" strokeWidth="4" />

      {/* Kitchen counter, back right. */}
      <path d="M836 300 H1000 V360 H836Z" fill="#453c4e" />
      <path d="M836 296 H1000 V308 H836Z" fill="#574b5e" />
      <rect x="862" y="268" width="26" height="30" rx="3" fill="#2f2a3a" />

      {/* Floor lamp: the warm practical, and the reason the left side is alive. */}
      <path d="M118 430 L118 258" stroke="#2e2838" strokeWidth="6" />
      <ellipse cx="118" cy="432" rx="30" ry="9" fill="#2a2434" />
      <path d="M86 258 L150 258 L138 220 L98 220Z" fill="#4b4053" />
      <path d="M90 256 L146 256 L140 246 L96 246Z" fill={p.practical} opacity="0.85" />

      {/* Sofa. Seat back is tall enough to occlude a figure standing behind it. */}
      <path d="M96 404 Q94 364 140 362 H392 Q436 364 434 406 L440 414 H92Z" fill="#574a5c" />
      <path d="M108 412 Q264 386 424 414 L430 452 Q262 436 102 452Z" fill="#665566" />
      <path d="M92 412 H126 V470 H92Z M406 412 H440 V470 H406Z" fill="#4c4050" />
      <path d="M100 466 H432 L438 492 H94Z" fill="#4a3f51" />
      <path d="M118 490 L114 516 M414 490 L418 516" stroke="#2b2535" strokeWidth="9" />

      {/* Coffee table. The phone lives here; the engine draws the phone itself. */}
      <path d="M462 404 H668 L690 444 H440Z" fill="#5c4a4a" />
      <path d="M470 410 H660 L676 436 H454Z" fill="#6b5756" opacity="0.85" />
      <path d="M452 442 L446 494 M678 442 L686 494" stroke="#372c31" strokeWidth="10" />
      <ellipse cx="565" cy="498" rx="130" ry="18" fill="#1a1626" opacity="0.4" />
      <path d="M598 398 q10 -12 22 -2 q-4 10 -22 2Z" fill="#8e7a6b" opacity="0.7" />
      {state.phoneLit && <ellipse cx="548" cy="412" rx="96" ry="34" fill="#f6dcae" opacity="0.14" />}
    </g>
  );
}

function ApartmentForeground() {
  return (
    <g>
      {/* Near armchair back. The player walks behind this. */}
      <path d="M-30 600 V522 Q-28 494 34 492 H232 Q288 494 290 528 V600Z" fill="#241e2e" />
      <path d="M-30 540 Q130 520 290 544" stroke="#191424" strokeWidth="6" fill="none" opacity="0.7" />
      {/* Cropped hanging lamp frames the top without taking attention. */}
      <path d="M372 0 V30 M350 64 L394 64 L386 32 L358 32Z" stroke="#1d1826" strokeWidth="3" fill="#241f2e" />
      <ellipse cx="372" cy="64" rx="22" ry="6" fill="#3a3144" />
    </g>
  );
}

function ApartmentLighting({ uid, state }: { uid: string; state: SceneState }) {
  const open = state.doorState === 'open' || state.doorState === 'opening' || state.doorState === 'ajar';
  return (
    <g>
      {/* Darkness is the base coat; every lit area below is carved back out of it. */}
      <rect width="1000" height="600" fill="#080a12" opacity={0.3 + (state.dim ?? 0) * 0.22} />

      <g style={{ mixBlendMode: 'screen' }}>
        {/* Warm practical, left: a hot core inside a soft falloff. */}
        <ellipse cx="118" cy="252" rx="200" ry="200" fill={`url(#${uid}-pool)`} opacity="0.95" />
        <ellipse cx="118" cy="248" rx="62" ry="54" fill={`url(#${uid}-pool)`} opacity="0.9" />
        <ellipse cx="150" cy="430" rx="250" ry="120" fill={`url(#${uid}-pool)`} opacity="0.5" />

        {/* Cold bathroom light, right. Closed, it is only a seam on the floor. */}
        <ellipse
          cx="742"
          cy={open ? 300 : 300}
          rx={open ? 300 : 120}
          ry={open ? 260 : 70}
          fill={`url(#${uid}-cold)`}
          opacity={open ? 0.95 : 0.42}
        />

        {state.phoneLit && (
          <>
            <ellipse cx="548" cy="408" rx="150" ry="104" fill={`url(#${uid}-pool)`} opacity="0.62" />
            <ellipse cx="548" cy="404" rx="44" ry="34" fill={`url(#${uid}-pool)`} opacity="0.85" />
          </>
        )}
      </g>

      {/* Dark corners. Nothing in this room is evenly lit. */}
      <rect width="1000" height="600" fill={`url(#${uid}-corner)`} />
    </g>
  );
}

/* --------------------------------------------------------- hallway night --- */

function HallwayBackdrop({ p, uid, state }: { p: Palette; uid: string; state: SceneState }) {
  return (
    <g>
      <rect width="1000" height="600" fill="#0d1620" />
      {/* Corridor converging on a point the player never reaches. */}
      <path d="M0 0 H1000 V156 L648 214 H352 L0 150Z" fill={p.sky} opacity="0.5" />
      <path d="M0 150 L352 214 V392 L0 560Z" fill={p.wall} opacity="0.42" />
      <path d="M1000 156 L648 214 V392 L1000 566Z" fill={p.wall} opacity="0.3" />
      <path d="M352 214 H648 V392 H352Z" fill={`url(#${uid}-wall)`} />

      {/* Elevator at the far end: the only cold light in the corridor. */}
      <rect x="470" y="236" width="118" height="156" fill="#16222c" />
      {state.elevatorOpen ? (
        <g>
          {/* An empty, lit car. Nobody steps out. */}
          <rect x="482" y="238" width="94" height="152" fill="#9fb4ba" opacity="0.62" />
          <rect x="482" y="238" width="94" height="10" fill="#e4f0f2" opacity="0.7" />
          <path d="M482 390 L576 390 L566 372 L492 372Z" fill="#7b8f95" opacity="0.6" />
          <rect x="472" y="238" width="10" height="152" fill="#2a3a44" />
          <rect x="576" y="238" width="10" height="152" fill="#2a3a44" />
        </g>
      ) : (
        <path d="M529 238 V390" stroke="#9fb3b8" strokeWidth="3" opacity="0.8" />
      )}
      <rect x="470" y="236" width="118" height="156" fill="none" stroke="#7f949b" strokeWidth="4" />
      <rect x="486" y="206" width="86" height="26" rx="2" fill="#0e161d" />
      <text
        x="529"
        y="226"
        textAnchor="middle"
        fill={p.practical}
        fontFamily="IBM Plex Mono, monospace"
        fontSize="19"
        letterSpacing="2"
      >
        {state.elevatorText || '—'}
      </text>

      {/* Player's own front door, left foreground wall. */}
      <path d="M96 196 L252 232 V452 L96 520Z" fill="#2b3a44" />
      <path d="M110 212 L240 242 V438 L110 500Z" fill="#3b4b55" />
      <circle cx="226" cy="352" r="6" fill={p.practical} opacity="0.85" />
      {/* Intercom beside it. */}
      <rect x="258" y="268" width="30" height="46" rx="3" fill="#1d2a33" stroke="#71868d" strokeWidth="2" />
      <circle cx="273" cy="282" r="4" fill={state.active ? '#e2705a' : '#44555d'} />
      <rect x="264" y="292" width="18" height="14" rx="2" fill="#0f181e" />

      {/* Neighbour doors receding on the right. */}
      <path d="M904 222 L1000 206 V492 L904 470Z" fill="#26343d" />
      <path d="M742 250 L820 238 V424 L742 440Z" fill="#223038" />
      {/* Hall camera and emergency light, high and watching. */}
      <path d="M592 118 L624 126 L618 146 L590 138Z" fill="#1b262e" />
      <circle cx="596" cy="140" r="3.5" fill="#e2705a" opacity="0.8" />
      <rect x="596" y="86" width="42" height="14" rx="3" fill="#243139" />
      <rect x="600" y="89" width="34" height="8" rx="2" fill="#9fd8c0" opacity="0.55" />
    </g>
  );
}

function HallwayMidground({ p, uid }: { p: Palette; uid: string }) {
  return (
    <g>
      <path d="M0 560 L352 392 H648 L1000 566 V600 H0Z" fill={`url(#${uid}-floor)`} />
      <path d="M352 392 H648" stroke="#0a1118" strokeOpacity="0.6" strokeWidth="3" />
      {/* Floor seams point at the elevator, so the eye goes where the sound will. */}
      <g stroke="#0b131a" strokeOpacity="0.3" strokeWidth="2">
        <path d="M352 392 L0 600 M648 392 L1000 600 M430 392 L300 600 M570 392 L700 600" />
      </g>
      <path d="M470 388 H588 L600 404 H458Z" fill="#9fb3b8" opacity="0.14" />
      <ellipse cx="500" cy="470" rx="420" ry="90" fill={p.shadow} opacity="0.3" />
    </g>
  );
}

function HallwayForeground() {
  return (
    <g>
      {/* The near door frame: the player is always slightly inside a doorway. */}
      <path d="M0 0 H44 V600 H0Z" fill="#070b10" />
      <path d="M44 0 H58 V600 H44Z" fill="#101820" />
      <path d="M1000 0 H960 V600 H1000Z" fill="#070b10" />
      <path d="M960 0 H948 V600 H960Z" fill="#101820" />
    </g>
  );
}

function HallwayLighting({ uid, state }: { uid: string; state: SceneState }) {
  return (
    <g>
      {/* The corridor is black by default; the two practicals only dent it. */}
      <rect width="1000" height="600" fill="#04070c" opacity={0.56 + (state.dim ?? 0) * 0.2} />

      <g style={{ mixBlendMode: 'screen' }}>
        <ellipse cx="300" cy="226" rx="150" ry="132" fill={`url(#${uid}-pool)`} opacity="0.42" />
        <ellipse cx="300" cy="222" rx="46" ry="40" fill={`url(#${uid}-pool)`} opacity="0.5" />
        <ellipse cx="800" cy="236" rx="130" ry="120" fill={`url(#${uid}-pool)`} opacity="0.26" />

        {/* The elevator seam is the only cold light, and the only thing to watch. */}
        <ellipse
          cx="529"
          cy="312"
          rx={state.active ? 185 : 120}
          ry={state.active ? 150 : 100}
          fill={`url(#${uid}-cold)`}
          opacity={state.active ? 0.85 : 0.4}
        />
      </g>

      <rect width="1000" height="600" fill={`url(#${uid}-corner)`} />
    </g>
  );
}

/* ---------------------------------------------------------- office night --- */

/** A seated colleague, drawn into the world so the room can be full without extra cast. */
function SeatedExtra({ x, y, s, tone, turn }: { x: number; y: number; s: number; tone: string; turn: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity="0.9">
      <path d="M-20 44 H20 L24 70 H-24Z" fill="#2c3b44" />
      <path d="M-17 0 Q0 -8 17 0 L21 46 H-21Z" fill={tone} />
      <g transform={`rotate(${turn})`}>
        <ellipse cx="0" cy="-16" rx="10.5" ry="12" fill="#b98a6c" />
        <path d="M-10.5 -19 Q-10 -29 0 -29 Q10 -29 10.5 -19 Q6 -24 0 -24 Q-6 -24 -10.5 -19Z" fill="#2c2724" />
      </g>
      <path d="M-26 50 L-30 92 M26 50 L30 92" stroke="#1d272d" strokeWidth="7" />
    </g>
  );
}

function OfficeBackdrop({ p, uid, state }: { p: Palette; uid: string; state: SceneState }) {
  return (
    <g>
      <rect width="1000" height={FLOOR_Y + 4} fill={`url(#${uid}-wall)`} />

      {/* Presentation screen: the brightest thing in the room, and the evidence. */}
      <rect x="392" y="62" width="300" height="186" rx="3" fill="#0e1c26" />
      <rect x="392" y="62" width="300" height="186" rx="3" fill="none" stroke="#2a3d49" strokeWidth="6" />
      <rect x="406" y="76" width="272" height="158" fill={state.active ? '#9fc4cc' : '#5d7f8b'} opacity="0.9" />
      <g fill="#16242e" opacity="0.72">
        <rect x="424" y="94" width="150" height="13" rx="2" />
        <rect x="424" y="122" width="214" height="7" rx="2" />
        <rect x="424" y="138" width="190" height="7" rx="2" />
        <rect x="424" y="154" width="206" height="7" rx="2" />
        <rect x="424" y="186" width="74" height="34" rx="2" />
        <rect x="512" y="196" width="74" height="24" rx="2" />
        <rect x="600" y="178" width="46" height="42" rx="2" />
      </g>

      {/* City window, right. Distant gold against all that cyan. */}
      <rect x="792" y="70" width="190" height="200" rx="2" fill="#13242f" />
      <rect x="792" y="70" width="190" height="200" rx="2" fill="none" stroke="#334b57" strokeWidth="7" />
      <path d="M887 74 V266" stroke="#334b57" strokeWidth="5" />
      <g fill="#e8c489" opacity="0.6">
        <rect x="812" y="188" width="4" height="4" />
        <rect x="846" y="146" width="3" height="3" />
        <rect x="906" y="210" width="4" height="4" />
        <rect x="940" y="166" width="3" height="3" />
        <rect x="864" y="232" width="3.5" height="3.5" />
        <rect x="922" y="120" width="3" height="3" />
      </g>

      {/* Meeting clock. Time is the pressure in this room. */}
      <rect x="820" y="44" width="96" height="40" rx="3" fill="#0d1a22" />
      <text
        x="868"
        y="74"
        textAnchor="middle"
        fill={p.practical}
        fontFamily="IBM Plex Mono, monospace"
        fontSize="25"
      >
        {state.clockText || '10:42'}
      </text>

      <rect x="40" y="110" width="150" height="174" fill="#223843" opacity="0.65" />
      <path d="M40 110 H190" stroke="#3a5560" strokeWidth="5" />
    </g>
  );
}

function OfficeMidground({ p, uid, state }: { p: Palette; uid: string; state: SceneState }) {
  return (
    <g>
      <rect y={FLOOR_Y} width="1000" height={600 - FLOOR_Y} fill={`url(#${uid}-floor)`} />
      <path d={`M0 ${FLOOR_Y} H1000`} stroke="#0f1c24" strokeOpacity="0.55" strokeWidth="4" />
      <g stroke="#0e1a22" strokeOpacity="0.18" strokeWidth="2">
        <path d="M0 340 H1000 M0 416 H1000 M0 508 H1000" />
      </g>

      {/* Screen spill reaches the floor; the room is otherwise flat and sterile. */}
      <path d="M402 286 L686 286 L760 372 L330 372Z" fill="#9fc4cc" opacity={state.active ? 0.17 : 0.09} />

      {/* Stills only: on stage these people are runtime actors who react to the room. */}
      {state.populated && (
        <>
          {/* Colleagues already seated and already facing the director. */}
          {/* The coworker is already presenting; the player arrives into an argument in progress. */}
          <g transform="translate(372 196) scale(0.82)" opacity="0.95">
            <path d="M-16 0 Q0 -8 16 0 L20 52 H-20Z" fill="#5a6a71" />
            <path d="M-20 52 L-24 112 M20 52 L24 112" stroke="#2a3a43" strokeWidth="9" />
            <path d="M16 6 Q34 16 44 2" fill="none" stroke="#5a6a71" strokeWidth="9" strokeLinecap="round" />
            <ellipse cx="0" cy="-17" rx="10.5" ry="12" fill="#c08a66" />
            <path d="M-10.5 -20 Q-10 -31 0 -31 Q10 -31 10.5 -20 Q6 -26 0 -26 Q-6 -26 -10.5 -20Z" fill="#332b26" />
          </g>
          <SeatedExtra x={286} y={318} s={0.74} tone="#4a5d66" turn={12} />
          <SeatedExtra x={392} y={306} s={0.68} tone="#56666d" turn={16} />
          <SeatedExtra x={742} y={312} s={0.72} tone="#4f6068" turn={-14} />
        </>
      )}

      {/* Meeting table. Wide enough that speaking across it costs something. */}
      <path d="M236 404 H806 L880 498 H162Z" fill="#41545d" />
      <path d="M252 412 H790 L852 486 H190Z" fill="#4d626b" opacity="0.9" />
      <path d="M190 494 L176 584 M852 494 L868 584" stroke="#22323a" strokeWidth="16" />
      <ellipse cx="520" cy="560" rx="360" ry="34" fill="#0d171d" opacity="0.4" />

      {/* The player's own laptop, closed, with their drafts still inside it. */}
      <path d="M268 430 H356 L364 462 H258Z" fill="#2b3b44" />
      <rect x="276" y="402" width="74" height="32" rx="3" fill="#1b2932" />
      <rect x="281" y="406" width="64" height="24" rx="2" fill="#7fa7b2" opacity="0.75" />
      <rect x="600" y="420" width="54" height="36" rx="3" fill="#2a3a43" />
      <ellipse cx="700" cy="430" rx="13" ry="7" fill="#33444d" />
    </g>
  );
}

function OfficeForeground() {
  return (
    <g>
      {/* Two chair backs crop the frame: the player is seated among people. */}
      <path d="M-20 600 V512 Q-18 486 54 484 H196 Q252 486 254 516 V600Z" fill="#17242b" />
      <path d="M760 600 V522 Q762 496 824 494 H980 Q1030 496 1030 526 V600Z" fill="#17242b" />
      <path d="M-20 536 Q118 518 254 540" stroke="#101b21" strokeWidth="5" fill="none" opacity="0.7" />
    </g>
  );
}

function OfficeLighting({ uid, state }: { uid: string; state: SceneState }) {
  return (
    <g>
      <g style={{ mixBlendMode: 'screen' }}>
        {/* Flat overhead office light: wide, cool and unflattering by design. */}
        <ellipse cx="500" cy="210" rx="620" ry="300" fill={`url(#${uid}-cold)`} opacity="0.3" />
        <ellipse cx="540" cy="250" rx="300" ry="220" fill={`url(#${uid}-cold)`} opacity={state.active ? 0.5 : 0.32} />
        <ellipse cx="886" cy="200" rx="190" ry="180" fill={`url(#${uid}-pool)`} opacity="0.3" />
      </g>
      <rect width="1000" height="600" fill={`url(#${uid}-corner)`} opacity="0.8" />
      <rect width="1000" height="600" fill="#0a141b" opacity={0.12 + (state.dim ?? 0) * 0.3} />
    </g>
  );
}

/* ------------------------------------------- remaining worlds (structural) --- */

function GenericBackdrop({ world, p, uid, state }: { world: ViviWorldId; p: Palette; uid: string; state: SceneState }) {
  if (isExterior(world)) {
    return (
      <g>
        <rect width="1000" height="600" fill={`url(#${uid}-wall)`} />
        <path
          d="M0 295 L140 242 L286 259 L378 212 L486 241 L625 195 L760 241 L897 205 L1000 236 V410 H0Z"
          fill={p.shadow}
          opacity="0.45"
        />
        {world === 'neighborhood_sunset' && (
          <>
            <circle cx="754" cy="152" r="89" fill={p.practical} opacity="0.65" />
            <rect x="819" y="337" width="107" height="122" fill="#857f70" opacity="0.8" />
            <rect x="800" y="319" width="140" height="12" fill="#eee2c8" />
          </>
        )}
        {world === 'city_rain' && (
          <>
            <path d="M102 320 H305 V471 H102Z M402 270 H603 V447 H402Z M727 240 H941 V449 H727Z" fill={p.shadow} opacity="0.67" />
            <path d="M130 353 H275 M430 319 H570 M755 291 H911" stroke={p.practical} strokeWidth="8" opacity="0.5" />
          </>
        )}
        {world === 'train_station' && (
          <>
            <path d="M0 330 L1000 297" stroke="#ebd4ac" strokeWidth="12" />
            <rect x="690" y="83" width="224" height="102" rx="3" fill="#263d44" stroke="#d7c6a7" strokeWidth="7" />
            <text x="714" y="124" fill="#f3e4c8" fontFamily="monospace" fontSize="26">LAST TRAIN</text>
            <text x="714" y="159" fill={state.vehicleIn ? '#f0b49c' : '#f3e4c8'} fontFamily="monospace" fontSize="28">
              {state.clockText && /\d/.test(state.clockText) && state.clockText.length <= 8 ? state.clockText : '00:47'}
            </text>
          </>
        )}
      </g>
    );
  }
  return (
    <g>
      <rect width="1000" height={FLOOR_Y + 4} fill={`url(#${uid}-wall)`} />
      <rect x="115" y="86" width="238" height="190" rx="5" fill={p.shadow} stroke={p.practical} strokeOpacity="0.28" strokeWidth="8" />
      <path d="M235 87 V278 M115 186 H353" stroke={p.wall} strokeWidth="9" opacity="0.8" />
      <rect x="744" y="106" width="158" height="180" fill={p.shadow} stroke={p.practical} strokeOpacity="0.35" strokeWidth="7" />
      <rect x="760" y="122" width="126" height="164" fill={p.sky} />
      <circle cx="867" cy="216" r="5" fill={p.practical} />
      {world === 'bar_or_party' && <rect x="392" y="120" width="220" height="150" rx="4" fill="#5c6460" opacity="0.7" />}
    </g>
  );
}

function GenericMidground({ world, p, uid, state }: { world: ViviWorldId; p: Palette; uid: string; state: SceneState }) {
  return (
    <g>
      {isExterior(world) ? (
        <>
          <path d="M0 380 L1000 348 V600 H0Z" fill={`url(#${uid}-floor)`} />
          <path d="M0 488 Q360 414 1000 481" stroke={p.practical} strokeWidth="3" opacity="0.22" fill="none" />
        </>
      ) : (
        <>
          <rect y={FLOOR_Y} width="1000" height={600 - FLOOR_Y} fill={`url(#${uid}-floor)`} />
          <path d={`M0 ${FLOOR_Y} H1000`} stroke="#13151f" strokeOpacity="0.45" strokeWidth="4" />
        </>
      )}

      {world === 'bedroom_night' && (
        <>
          <path d="M92 436 Q236 414 402 440 L428 500 Q213 527 80 504Z" fill="#9c8990" opacity="0.9" />
          <path d="M452 424 L612 424 L642 463 L425 463Z" fill="#75605c" />
          <path d="M440 461 L437 512 M630 461 L635 511" stroke={p.shadow} strokeWidth="13" />
        </>
      )}
      {world === 'family_home' && (
        <>
          <path d="M332 428 L641 428 L687 492 L278 492Z" fill="#8c705b" />
          <path d="M302 487 L295 559 M657 487 L667 559" stroke="#554b42" strokeWidth="14" />
          <rect x="410" y="408" width="153" height="40" rx="3" fill="#eadcc2" transform="rotate(-7 410 408)" />
        </>
      )}
      {world === 'hotel_or_rental' && (
        <>
          <path d="M440 433 L624 433 L649 469 L415 469Z" fill="#827365" />
          <rect x="484" y="399" width="78" height="43" fill="#e1d4c0" transform="rotate(-8 484 399)" />
          <path d="M150 492 L287 492 L301 556 L135 556Z" fill="#6c777c" />
        </>
      )}
      {world === 'bar_or_party' && (
        <>
          <path d="M378 411 L898 411 L921 453 L348 453Z" fill="#726e64" />
          <path d="M374 452 L360 565 M902 452 L918 565" stroke={p.shadow} strokeWidth="17" />
          <ellipse cx="260" cy="477" rx="140" ry="31" fill="#696d65" />
        </>
      )}
      {world === 'train_station' && (
        <>
          <path d="M0 421 L1000 385" stroke="#2c4350" strokeWidth="45" />
          {/* The last train: it slides in on the track when it arrives and its doors stand open. */}
          <g
            style={{
              transform: state.vehicleIn ? 'translateX(0px)' : 'translateX(1100px)',
              transition: 'transform 3.2s cubic-bezier(.16,.72,.18,1)',
            }}
          >
            <path d="M-20 300 L640 278 L640 392 L-20 414Z" fill="#3c5560" />
            <path d="M-20 300 L640 278 L640 292 L-20 314Z" fill="#cfd8d6" opacity="0.6" />
            {[30, 150, 270, 390, 510].map(x => (
              <rect key={x} x={x} y={322 - x * 0.033} width="70" height="38" rx="3" fill="#e9dcb6" opacity="0.75" />
            ))}
            <rect x="440" y={330 - 440 * 0.033} width="44" height="70" fill="#f3e6c2" opacity="0.9" />
            <path d="M-20 414 L640 392" stroke="#1c2a31" strokeWidth="8" />
          </g>
          <path d="M560 405 L1000 372 L1000 520 L560 550Z" fill="#89979a" />
          <rect x="175" y="401" width="166" height="15" fill="#83705d" />
          <path d="M188 413 L179 493 M327 413 L340 493" stroke="#665848" strokeWidth="10" />
        </>
      )}
      {world === 'neighborhood_sunset' && (
        <>
          <path d="M0 453 Q400 415 1000 453" stroke="#f0d5a7" strokeWidth="9" opacity="0.55" fill="none" />
          <path d="M169 434 H343 M190 434 L180 490 M324 434 L334 490" stroke="#655c4d" strokeWidth="14" />
        </>
      )}
      {world === 'city_rain' && (
        <g stroke="#d7e6e4" strokeOpacity="0.25" strokeWidth="2">
          {Array.from({ length: 35 }, (_, i) => (
            <path key={i} d={`M${(i * 173) % 1000} ${(i * 79) % 600} l-10 29`} />
          ))}
        </g>
      )}
    </g>
  );
}

function GenericForeground({ world }: { world: ViviWorldId }) {
  if (isExterior(world)) {
    return <path d="M-20 600 V556 Q220 520 520 540 Q800 558 1020 530 V600Z" fill="#1a1d22" opacity="0.55" />;
  }
  return <path d="M-20 600 V534 Q-18 510 44 508 H206 Q258 510 260 538 V600Z" fill="#20222c" opacity="0.9" />;
}

function GenericLighting({ uid, state }: { uid: string; state: SceneState }) {
  return (
    <g>
      <g style={{ mixBlendMode: 'screen' }}>
        <ellipse cx="520" cy="300" rx="340" ry="260" fill={`url(#${uid}-pool)`} opacity="0.5" />
      </g>
      <rect width="1000" height="600" fill={`url(#${uid}-corner)`} opacity="0.75" />
      <rect width="1000" height="600" fill="#0d1018" opacity={0.12 + (state.dim ?? 0) * 0.3} />
    </g>
  );
}

/* --------------------------------------------------------------- layers --- */

function layerFor(
  kind: 'backdrop' | 'midground' | 'foreground' | 'lighting',
  world: ViviWorldId,
  p: Palette,
  uid: string,
  state: SceneState
) {
  if (world === 'apartment_night') {
    if (kind === 'backdrop') return <ApartmentBackdrop p={p} uid={uid} state={state} />;
    if (kind === 'midground') return <ApartmentMidground p={p} uid={uid} state={state} />;
    if (kind === 'foreground') return <ApartmentForeground />;
    return <ApartmentLighting uid={uid} state={state} />;
  }
  if (world === 'hallway_night') {
    if (kind === 'backdrop') return <HallwayBackdrop p={p} uid={uid} state={state} />;
    if (kind === 'midground') return <HallwayMidground p={p} uid={uid} />;
    if (kind === 'foreground') return <HallwayForeground />;
    return <HallwayLighting uid={uid} state={state} />;
  }
  if (world === 'office_night') {
    if (kind === 'backdrop') return <OfficeBackdrop p={p} uid={uid} state={state} />;
    if (kind === 'midground') return <OfficeMidground p={p} uid={uid} state={state} />;
    if (kind === 'foreground') return <OfficeForeground />;
    return <OfficeLighting uid={uid} state={state} />;
  }
  if (kind === 'backdrop') return <GenericBackdrop world={world} p={p} uid={uid} state={state} />;
  if (kind === 'midground') return <GenericMidground world={world} p={p} uid={uid} state={state} />;
  if (kind === 'foreground') return <GenericForeground world={world} />;
  return <GenericLighting uid={uid} state={state} />;
}

function LayerSvg({
  world,
  state,
  kind,
  className,
}: {
  world: ViviWorldId;
  state: SceneState;
  kind: 'backdrop' | 'midground' | 'foreground' | 'lighting';
  className: string;
}) {
  const p = palettes[worldTemplates[world].palette];
  const uid = `${world}-${kind}`;
  return (
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <SceneDefs world={world} p={p} uid={uid} />
      {layerFor(kind, world, p, uid, state)}
      {kind === 'lighting' && (
        <rect width="1000" height="600" filter={`url(#${uid}-tooth)`} opacity="0.055" style={{ mixBlendMode: 'overlay' }} />
      )}
    </svg>
  );
}

/** Architecture and distant light. Renders behind every figure. */
export const SceneBackdrop = ({ world, state = {} }: { world: ViviWorldId; state?: SceneState }) => (
  <LayerSvg world={world} state={state} kind="backdrop" className="vivi-layer vivi-layer-backdrop" />
);

/** Floor, furniture and props a figure walks among. */
export const SceneMidground = ({ world, state = {} }: { world: ViviWorldId; state?: SceneState }) => (
  <LayerSvg world={world} state={state} kind="midground" className="vivi-layer vivi-layer-midground" />
);

/** One gentle occluder a figure can pass behind. */
export const SceneForeground = ({ world, state = {} }: { world: ViviWorldId; state?: SceneState }) => (
  <LayerSvg world={world} state={state} kind="foreground" className="vivi-layer vivi-layer-foreground" />
);

/** Pooled light, spill, dark corners and grain. */
export const SceneLighting = ({ world, state = {} }: { world: ViviWorldId; state?: SceneState }) => (
  <LayerSvg world={world} state={state} kind="lighting" className="vivi-layer vivi-layer-lighting" />
);

/**
 * Flattened scene for feed cards and storyboard stills, where there are no
 * figures to stand between the layers.
 */
export function SceneArt({ world, active = false }: { world: ViviWorldId; active?: boolean }) {
  const p = palettes[worldTemplates[world].palette];
  const state: SceneState = { active, phoneLit: active, doorState: 'closed', populated: true };
  const uid = `${world}-flat`;
  return (
    <svg
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      className="vivi-scene-art"
      role="img"
      aria-label={`Illustrated ${worldTemplates[world].label} scene`}
    >
      <SceneDefs world={world} p={p} uid={uid} />
      {layerFor('backdrop', world, p, uid, state)}
      {layerFor('midground', world, p, uid, state)}
      {layerFor('foreground', world, p, uid, state)}
      {layerFor('lighting', world, p, uid, state)}
      <rect width="1000" height="600" filter={`url(#${uid}-tooth)`} opacity="0.055" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}
