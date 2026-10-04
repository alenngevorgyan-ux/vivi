/**
 * The scene viewport: a playable room. Renderer only — it owns no story state.
 *
 * It reads the snapshot (scene, hero/actor marks, owners, phase, accepted option), the compiled scene (marks,
 * routes) and the runtime geometry (cameras, floor, collision, occluders, surfaces, doors), and draws them
 * through ONE Fit (NormalizedProjection) that now also carries the camera: a cover framing that settles in on
 * entry and follows the body.
 *
 * What it presents but never decides:
 *  - FREE LOCAL MOVEMENT (master plan §G): while the reducer says movement is eligible, the player walks the hero
 *    with held keys (screen-relative, eased, colliding with the compiled footprints, sliding along them) or by
 *    clicking the floor (A* over the standable floor). The free position is presentation: never saved, never a
 *    precondition, never a story event;
 *  - the hero walking to where the snapshot now says (a preparation's mark, a door on departure, an approved
 *    arrival route, the accepted act's approach). The snapshot moved first; the walk is presentation, and reduced
 *    motion replaces it with a cut;
 *  - deckled painted islands (paint where attention rests), occluder cut-outs, graphite interaction marks, the
 *    display title as live DOM, the boundary withdrawal.
 * It reports presentation facts upward (the body is at an interaction, it arrived where a click sent it, the
 * act's stop pose is on screen, the withdrawal finished); the shell turns those into commands and receipts.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CompiledScene, EntityState, PlaybackManifestV3, SpatialMark } from '../../../engine/v3/contracts/manifest';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import { projectPoint, seatedStandable, type FloorPoint, type RuntimeGeometryV3 } from '../../../engine/v3/contracts/geometry';
import { along, bodyBox, islandEllipse, legalFloor, nearDepth, occluderSilhouette, pathMetres, stageToFloor, surfaceRect, toStage, yawOf, type Fit } from './NormalizedProjection';
import { SceneLayersV3, type BodyLayer, type CutoutLayer, type IslandPx, type LayerModel, type MarkLayer } from './SceneLayersV3';
import { routeBetween, selectFraming, type ActPose, type Orientation, type StagingV3 } from './staging';
import type { AssetCache } from './AssetPreloader';
import type { FigurePose } from './Figure';
import { findPath, framedFloor, metresBetween, pickReach, screenToFloorDir, stepBody, WALK, type BodyState, type FloorLimit } from './locomotion';
import type { Hotspot } from './hotspots';

export type ViewportHit =
  | { kind: 'hero' }
  | { kind: 'actor'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'hotspot'; id: string }
  | { kind: 'floor'; point: FloorPoint; legal: boolean; nearestRole?: string }
  | { kind: 'none' };

export interface ViewportHandle {
  /** A tap at a normalized point of the stage box. */
  hitTest(nx: number, ny: number): ViewportHit;
  /** Stage position of a compiled mark of the current scene. */
  markOnStage(role: string): { x: number; y: number } | undefined;
  /** Stage position of any floor point of the current location. */
  pointOnStage(x: number, y: number): { x: number; y: number } | undefined;
  /** Click-to-walk: path to a floor point; `onArrive` runs only if the body actually gets there. */
  walkTo(point: FloorPoint, onArrive?: () => void): boolean;
  /** Where the body is presented now. */
  heroAt(): FloorPoint | undefined;
}

export interface OverlayLayout {
  fit: Fit;
  box: { w: number; h: number };
  /** Stage point above the hero's head, and above each visible actor. */
  hero?: { x: number; y: number };
  actors: Record<string, { x: number; y: number }>;
  /** Project any normalized point of the current location. */
  project(x: number, y: number, h?: number): { x: number; y: number } | undefined;
}

export interface SceneViewportProps {
  manifest: PlaybackManifestV3;
  state: RuntimeSnapshot;
  staging: StagingV3;
  geometry: RuntimeGeometryV3;
  assets: AssetCache;
  orientation: Orientation;
  reducedMotion: boolean;
  displayTitle: string;
  /** The accepted act's presentation, once accepted. */
  act?: { option: string; pose: ActPose; approachTo?: string };
  /** The enactment's final stop pose is on screen (approach finished, or none). */
  onActStopped?: (instance: string) => void;
  /** The boundary withdrawal finished. */
  onWithdrawn?: (instance: string) => void;
  overlay?: (l: OverlayLayout) => React.ReactNode;
  /** Free movement: the held screen vector (x right, y down) and whether the reducer allows locomotion now. */
  control?: { vector: () => readonly [number, number]; eligible: boolean };
  /** In-world interactions of this scene (derived from the readable model). */
  hotspots?: Hotspot[];
  /** The interaction the body is at changed. */
  onNear?: (id: string | undefined) => void;
  keyHint?: string;
  /** A foot met the floor (two per stride), for footsteps. */
  onStep?: () => void;
}

const ROLE_EPS = 1e-6;
const SCRIPT_MPS = 1.5;
const roleAt = (cs: CompiledScene | undefined, m: { x: number; y: number } | undefined) =>
  cs && m ? Object.entries(cs.marks ?? {}).find(([, v]) => Math.abs(v.x - m.x) < ROLE_EPS && Math.abs(v.y - m.y) < ROLE_EPS)?.[0] : undefined;
const same = (a?: { x: number; y: number }, b?: { x: number; y: number }) => !!a && !!b && Math.abs(a.x - b.x) < ROLE_EPS && Math.abs(a.y - b.y) < ROLE_EPS;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** The camera's position on the floor for the current framing (things with a face are used from its side). */
export function sceneViewFrom(m: PlaybackManifestV3, s: RuntimeSnapshot, staging: StagingV3, geometry: RuntimeGeometryV3, orientation: Orientation): FloorPoint | undefined {
  const cs = m.compiledScenes.find(c => c.id === s.scene);
  const beats = new Set(m.scenePlans.find(p => p.id === s.scene)?.beats.map(b => b.id) ?? []);
  const lastBeat = [...s.deliveredBeats].reverse().find(b => beats.has(b));
  const id = selectFraming(staging, s.scene, { orientation, lastBeat, option: s.decision?.option });
  const cam = geometry.cameras.find(c => c.id === id) ?? geometry.cameras.find(c => c.id === cs?.cameraRecipe);
  return cam ? [cam.projection.camX, cam.projection.camY] : undefined;
}

/** Where a free body may stand in this scene: the floor its current framing shows (all compiled marks included). */
export function sceneFloorLimit(m: PlaybackManifestV3, s: RuntimeSnapshot, staging: StagingV3, geometry: RuntimeGeometryV3, orientation: Orientation): FloorLimit | undefined {
  const cs = m.compiledScenes.find(c => c.id === s.scene);
  const dims = staging.locations[s.location];
  const beats = new Set(m.scenePlans.find(p => p.id === s.scene)?.beats.map(b => b.id) ?? []);
  const lastBeat = [...s.deliveredBeats].reverse().find(b => beats.has(b));
  const id = selectFraming(staging, s.scene, { orientation, lastBeat, option: s.decision?.option });
  const cam = geometry.cameras.find(c => c.id === id) ?? geometry.cameras.find(c => c.id === cs?.cameraRecipe);
  if (!cam || !dims || !cs) return undefined;
  const hero = s.entities.find(e => e.id === m.perspectiveActor)?.mark;
  const keep: Array<[number, number]> = Object.values(cs.marks ?? {}).map(k => [k.x, k.y]);
  if (hero) keep.push([hero.x, hero.y]);
  return framedFloor(cam, staging.figures[m.perspectiveActor].heightM / dims.heightScale, keep);
}

/** Camera: cover the box, zoom, centre on a reference point, clamp so no plate border ever shows. */
function cameraFit(cam: RuntimeGeometryV3['cameras'][number], box: { w: number; h: number }, zoom: number, focus: { sx: number; sy: number }): Fit {
  const { width: vw, height: vh } = cam.viewport;
  const scale = Math.max(1e-6, Math.max(box.w / vw, box.h / vh) * zoom);
  const offX = Math.min(0, Math.max(box.w - vw * scale, box.w / 2 - focus.sx * scale));
  const offY = Math.min(0, Math.max(box.h - vh * scale, box.h / 2 - focus.sy * scale));
  return { cam, scale, offX, offY, box };
}

interface Script {
  path: Array<[number, number]>;
  dur: number;
  elapsed: number;
  done?: () => void;
}

export const SceneViewportV3 = forwardRef<ViewportHandle, SceneViewportProps>(function SceneViewportV3(props, ref) {
  const { manifest: m, state: s, staging, geometry, assets, orientation, reducedMotion, displayTitle, act, onActStopped, onWithdrawn, overlay, control, hotspots = [], onNear, keyHint = 'E' } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  const cs = m.compiledScenes.find(c => c.id === s.scene)!;
  const hero = s.entities.find(e => e.id === m.perspectiveActor)!;
  const heroMark = hero.mark;
  const loc = geometry.locations.find(l => l.location === s.location);
  const dims = staging.locations[s.location];

  /* ------------------------------------------------------- framing --- */
  const sceneBeats = new Set(m.scenePlans.find(p => p.id === s.scene)?.beats.map(b => b.id) ?? []);
  const lastBeat = [...s.deliveredBeats].reverse().find(b => sceneBeats.has(b));
  const cameraId = selectFraming(staging, s.scene, { orientation, lastBeat, option: s.decision?.option });
  const cam = geometry.cameras.find(c => c.id === cameraId) ?? geometry.cameras.find(c => c.id === cs.cameraRecipe)!;
  const plates = staging.plates[cam.id];

  /* ---------------------------------------------- hero presentation --- */
  const actInstance = s.decision ? `${s.attemptId}:${s.decision.option}` : '';
  const approachTarget = act?.approachTo ? cs.marks?.[act.approachTo] : undefined;
  // Where the snapshot (and, after acceptance, the act's approved approach) puts the hero.
  const target: SpatialMark | undefined = s.decision && approachTarget ? approachTarget : heroMark;

  const body = useRef<BodyState & { walking: boolean }>({ pos: target ? [target.x, target.y] : [50, 50], vel: [0, 0], stride: 0, facingLeft: false, walking: false });
  const script = useRef<Script | null>(null);
  const goal = useRef<{ path: FloorPoint[]; i: number; onArrive?: () => void; stuck: number } | null>(null);
  const camRef = useRef<{ sx: number; sy: number; zoom: number; entry: number; scene: string } | null>(null);
  const nearRef = useRef<string | undefined>(undefined);
  const [, setFrame] = useState(0);
  const prev = useRef<{ scene: string; location: string; mark?: SpatialMark; transition?: string; departed?: string }>({ scene: s.scene, location: s.location, mark: target });
  const stoppedFor = useRef<string>('');
  const live = useRef(props);
  live.current = props;

  const walk = useCallback(
    (path: Array<[number, number]>, done?: () => void) => {
      goal.current = null;
      const d = staging.locations[live.current.state.location];
      const metres = d ? pathMetres(path, d.widthM, d.depthM) : 0;
      if (reducedMotion || path.length < 2 || metres <= 0.01) {
        const end = path[path.length - 1];
        script.current = null;
        body.current = { ...body.current, pos: [end[0], end[1]], vel: [0, 0], walking: false };
        setFrame(f => f + 1);
        done?.();
        return;
      }
      script.current = { path, dur: Math.min(4200, Math.max(450, (metres / SCRIPT_MPS) * 1000)), elapsed: 0, done };
    },
    [reducedMotion, staging]
  );

  /* ------------------------------------------------- the game loop --- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let poseClock = 0;
    let shownStride = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); // never catch up after a hidden tab
      last = now;
      const P = live.current;
      const st = P.state;
      const d = staging.locations[st.location];
      const L = geometry.locations.find(l => l.location === st.location);
      const b = body.current;
      const fit = fitRef.current;
      let moved = 0;
      const startX = b.pos[0];

      if (script.current) {
        // A story walk (approved route / door / approach): eased, uninterruptible presentation.
        const sc = script.current;
        sc.elapsed += dt * 1000;
        const t = Math.min(1, sc.elapsed / sc.dur);
        const p = d ? along(sc.path, easeInOut(t), d.widthM, d.depthM) : { x: sc.path[sc.path.length - 1][0], y: sc.path[sc.path.length - 1][1], heading: 0 };
        moved = d ? metresBetween(d, b.pos, [p.x, p.y]) : 0;
        b.pos = [p.x, p.y];
        b.stride += moved / WALK.strideM;
        b.vel = [0, 0];
        if (p.heading) b.facingLeft = p.heading < 0;
        if (t >= 1) {
          script.current = null;
          sc.done?.();
        }
      } else if (L && d && fit) {
        const v = P.control?.eligible ? P.control.vector() : [0, 0];
        const keyed = v[0] !== 0 || v[1] !== 0;
        if (keyed) goal.current = null;
        let want: [number, number] | undefined;
        if (keyed) want = screenToFloorDir(fit, b.pos, v as [number, number], d);
        else if (goal.current && P.control?.eligible) {
          const g = goal.current;
          let wp = g.path[g.i];
          while (wp && metresBetween(d, b.pos, wp) < (g.i === g.path.length - 1 ? 0.06 : 0.22)) wp = g.path[++g.i];
          if (!wp) {
            goal.current = null;
            g.onArrive?.();
          } else {
            const mx = ((wp[0] - b.pos[0]) * d.widthM) / 100;
            const my = ((wp[1] - b.pos[1]) * d.depthM) / 100;
            const n = Math.hypot(mx, my);
            want = [mx / n, my / n];
            // Brake into the last waypoint instead of overshooting it.
            const left = metresBetween(d, b.pos, g.path[g.path.length - 1]);
            if (g.i === g.path.length - 1 && left < 0.5) want = [want[0] * Math.max(0.35, left / 0.5), want[1] * Math.max(0.35, left / 0.5)];
          }
        } else if (goal.current) goal.current = null;
        const origin: FloorPoint = st.decision ? b.pos : target ? [target.x, target.y] : b.pos;
        moved = stepBody(b, want, dt, L, d, { origin, escapeM: 0.9 }, limitRef.current);
        if (goal.current && want && moved < 0.002) {
          goal.current.stuck += dt;
          // Blocked for good: the walk was presentation; the asked-for use still happens (no story distance gate).
          if (goal.current.stuck > 0.35) {
            const g = goal.current;
            goal.current = null;
            g.onArrive?.();
          }
        }
      }
      b.walking = moved > 0.0015 || !!script.current;
      const foot = Math.floor(b.stride * 2 + 0.25);
      if (foot !== footRef.current) {
        footRef.current = foot;
        if (moved > 0) P.onStep?.();
      }
      if (!script.current && fit) {
        const a = toStage(fit, startX, b.pos[1], 0);
        const c = toStage(fit, b.pos[0], b.pos[1], 0);
        if (a && c && Math.abs(c.x - a.x) > 0.05) b.facingLeft = c.x < a.x;
      }

      // Pose changes on twos (12 fps); position, light and camera stay smooth.
      poseClock += dt;
      if (poseClock >= 1 / 12) {
        poseClock = 0;
        shownStride = b.stride;
      }
      strideShown.current = shownStride;

      // Interaction the body is at.
      const hs = P.hotspots ?? [];
      const near = d && P.control?.eligible && !script.current ? pickReach(hs, b.pos, d, nearRef.current)?.id : undefined;
      if (near !== nearRef.current) {
        nearRef.current = near;
        P.onNear?.(near);
      }

      // Camera: follow the body with weight; settle in from a wider establishing framing on entry.
      const c = camRef.current;
      const camNow = geometry.cameras.find(x => x.id === camIdRef.current);
      if (c && camNow) {
        const heroH = d ? staging.figures[m.perspectiveActor].heightM / d.heightScale : 0.6;
        const fp = projectPoint(camNow, b.pos[0], b.pos[1], heroH * 0.55);
        if (fp) {
          const lead = d ? 0.35 : 0;
          const lp = d ? projectPoint(camNow, b.pos[0] + ((b.vel[0] * lead * 100) / d.widthM), b.pos[1] + ((b.vel[1] * lead * 100) / d.depthM), heroH * 0.55) : undefined;
          const tx = (lp ?? fp).sx;
          const ty = (lp ?? fp).sy;
          const k = P.reducedMotion ? 1 : 1 - Math.exp(-dt / 0.55);
          c.sx += (tx - c.sx) * k;
          c.sy += (ty - c.sy) * k;
        }
        c.entry = Math.min(1, c.entry + dt / 1.6);
        c.zoom = P.reducedMotion ? ZOOM : 1 + (ZOOM - 1) * easeOut(c.entry);
      }
      breathRef.current = now / 3400;
      setFrame(f => (f + 1) % 1e6);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const strideShown = useRef(0);
  const footRef = useRef(0);
  const limitRef = useRef<FloorLimit | undefined>(undefined);
  limitRef.current = useMemo(() => sceneFloorLimit(m, s, staging, geometry, orientation), [m, s.scene, s.location, cam.id, orientation, staging, geometry, heroMark?.x, heroMark?.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const breathRef = useRef(0);
  const camIdRef = useRef(cam.id);
  camIdRef.current = cam.id;

  /* ------------------------------------- snapshot → presented body --- */
  useEffect(() => {
    const was = prev.current;
    const tx = s.transition;
    const b = body.current;
    const here = { x: b.pos[0], y: b.pos[1] };
    const doorMid = (portal?: string) => {
      const dr = portal ? loc?.portals.find(p => p.portal === portal) : undefined;
      return dr ? ([(dr.a[0] + dr.b[0]) / 2, (dr.a[1] + dr.b[1]) / 2] as [number, number]) : undefined;
    };
    // Skip (or a restore) past the act: install the final stop at once; never finish a walk in a later phase.
    if (s.decision && s.phase !== 'enacting' && target) {
      if (script.current || !same(here, target)) {
        script.current = null;
        body.current = { ...b, pos: [target.x, target.y], vel: [0, 0], walking: false };
      }
      prev.current = { scene: s.scene, location: s.location, mark: target };
      return;
    }
    // 1. Departing through a door: walk the approved crossing route (from wherever the body is), else to the door.
    if (tx && was.departed !== tx.id) {
      prev.current = { ...was, transition: tx.portal, departed: tx.id };
      const cross = staging.crossings.find(c => c.portal === tx.portal && c.location === s.location && c.depart);
      const route = cross && cs.routes?.[cross.depart!];
      const door = doorMid(tx.portal);
      if (route) walk([[here.x, here.y], ...(route as Array<[number, number]>)]);
      else if (door) walk([[here.x, here.y], door]);
      return;
    }
    if (!target) return;
    // 2. Arrival in another location: the approved arrival route, else in through the door, else a cut.
    if (was.location !== s.location) {
      const cross = staging.crossings.find(c => c.portal === was.transition && c.location === s.location && c.arrive);
      const route = cross && cs.routes?.[cross.arrive!];
      prev.current = { scene: s.scene, location: s.location, mark: target };
      goal.current = null;
      camRef.current = null; // a new place: a fresh establishing settle
      const ends = route && Math.abs(route[route.length - 1][0] - target.x) < ROLE_EPS && Math.abs(route[route.length - 1][1] - target.y) < ROLE_EPS;
      const door = doorMid(was.transition);
      if (route && ends) {
        body.current = { ...b, pos: [route[0][0], route[0][1]], vel: [0, 0] };
        walk(route as Array<[number, number]>);
      } else if (door && !reducedMotion) {
        body.current = { ...b, pos: door, vel: [0, 0] };
        walk([door, [target.x, target.y]]);
      } else walk([[target.x, target.y]]);
      return;
    }
    // 3. Same location, new scene (a cut): re-establish, keep the body where the snapshot says.
    if (was.scene !== s.scene && !same(was.mark, target)) {
      prev.current = { scene: s.scene, location: s.location, mark: target };
      camRef.current = null;
      walk([[target.x, target.y]]);
      return;
    }
    // 4. Same place, new mark (a preparation, an undo, the act's approach): walk there from where the body is.
    const markMoved = !same(was.mark, target);
    prev.current = { scene: s.scene, location: s.location, mark: target };
    const role = roleAt(cs, target);
    const away = !same(here, target);
    if (markMoved || (s.phase === 'enacting' && away)) {
      const route = role && was.mark ? routeBetween(cs, was.mark, role) : undefined;
      const fromRoute = route && route.length > 1 && dims && metresBetween(dims, [here.x, here.y], route[0] as FloorPoint) < 0.6;
      const pathed = !fromRoute && loc && dims ? findPath(loc, dims, b.pos, [target.x, target.y], limitRef.current) : undefined;
      const path: Array<[number, number]> = fromRoute ? [[here.x, here.y], ...(route as Array<[number, number]>).slice(1)] : pathed ? [...pathed.slice(0, -1), [target.x, target.y]] : [[here.x, here.y], [target.x, target.y]];
      walk(path, s.phase === 'enacting' ? () => stopped() : undefined);
    } else if (s.phase === 'enacting') stopped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.scene, s.location, target?.x, target?.y, s.transition?.id, s.phase]);

  // The act's stop pose is on screen: the approach is finished (or there was none). Once per act instance.
  const stopped = () => {
    if (!actInstance || stoppedFor.current === actInstance) return;
    stoppedFor.current = actInstance;
    onActStopped?.(actInstance);
  };
  useEffect(() => {
    if (s.phase === 'enacting' && !script.current && target && same({ x: body.current.pos[0], y: body.current.pos[1] }, target)) stopped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, actInstance]);

  /* -------------------------------------------- boundary withdrawal --- */
  const withdrawn = s.phase === 'boundary' || s.phase === 'reveal_loading' || s.phase === 'revealed' || s.phase === 'ended';
  useEffect(() => {
    if (s.phase !== 'boundary') return;
    // Design C08: paint withdraws (reduced motion: a 400 ms cross-fade). The CSS transition matches this duration.
    const ms = reducedMotion ? 400 : 1200;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      elapsed += Math.min(64, now - last);
      last = now;
      if (elapsed >= ms) onWithdrawn?.(actInstance);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, actInstance, reducedMotion]);

  /* ------------------------------------------------------ the fit --- */
  const pres = { x: body.current.pos[0], y: body.current.pos[1], walking: body.current.walking };
  const heroHeightU = dims ? staging.figures[m.perspectiveActor].heightM / dims.heightScale : 0.6;
  if (!camRef.current || camRef.current.scene !== `${s.scene}|${cam.id}`) {
    const fp = projectPoint(cam, pres.x, pres.y, heroHeightU * 0.55) ?? { sx: cam.viewport.width / 2, sy: cam.viewport.height / 2 };
    camRef.current = { sx: fp.sx, sy: fp.sy, zoom: reducedMotion ? ZOOM : 1, entry: reducedMotion ? 1 : 0, scene: `${s.scene}|${cam.id}` };
  }
  const fit = cameraFit(cam, box, camRef.current.zoom, camRef.current);
  const fitRef = useRef<Fit | null>(null);
  fitRef.current = box.w > 0 ? fit : null;
  const paintIn = reducedMotion ? 1 : easeOut(Math.min(1, camRef.current.entry * 1.25));

  /* --------------------------------------------------- the layers --- */
  const bodies: BodyLayer[] = [];
  const tops: OverlayLayout['actors'] = {};
  let heroTop: { x: number; y: number } | undefined;
  const widthU = (metres: number) => (dims ? (100 * metres) / dims.widthM : 6);
  const place = (id: string, x: number, y: number, facing: string | undefined, posture: 'stand' | 'seat', pose: FigurePose, treatment: BodyLayer['treatment'], hScale = 1, opts: { headingLeft?: boolean; holding?: { src?: string }; label?: string; stride?: number; breath?: number } = {}) => {
    const spec = staging.figures[id];
    if (!spec || !dims) return;
    const hU = (spec.heightM / dims.heightScale) * hScale;
    const bb = bodyBox(fit, x, y, hU, widthU(0.5));
    if (!bb || bb.height <= 0) return;
    const height = bb.height;
    const w = height * 0.6;
    const yaw = yawOf(facing) ?? 90;
    const facingLeft = opts.headingLeft ?? yaw < 0;
    bodies.push({ kind: 'body', id, depth: y, box: { left: bb.cx - w / 2, top: bb.feet - height, width: w, height }, spec, posture, pose, facingLeft, treatment, holding: opts.holding, label: opts.label, stride: opts.stride, breath: opts.breath, floor: [x, y] });
    const top = { x: bb.cx, y: bb.feet - height };
    if (id === m.perspectiveActor) heroTop = top;
    else tops[id] = top;
  };

  // The hero: where the body is presented (free, walked, or on the snapshot's mark).
  const summaryOwned = s.entities.some(e => e.kind === 'object' && e.owner.kind === 'actor' && e.owner.id === hero.id);
  const summarySrc = assets.url(staging.props.summary);
  {
    const atMark = target && same(pres, target);
    const role = atMark ? roleAt(cs, pres) ?? hero.state.mark_role : undefined;
    const seated = !pres.walking && !!role && staging.heroPostures[s.location]?.[role] === 'seat';
    let pose: FigurePose = s.scene === m.spine[0] ? 'look' : s.location !== m.scenePlans.find(p => p.id === m.primaryDecision?.scene)?.location && !pres.walking ? 'read' : 'hold';
    if (pres.walking) pose = 'walk';
    else if (s.decision && act && s.phase !== 'loading') pose = act.pose === 'speak' ? 'speak' : act.pose === 'ask' ? 'ask' : 'still';
    const free = !atMark || pres.walking;
    const facing = s.decision && approachTarget ? approachTarget.facing : heroMark?.facing;
    place(hero.id, pres.x, pres.y, facing, seated && pose !== 'ask' ? 'seat' : 'stand', pose, withdrawn ? 'ink' : 'paint', 1, {
      headingLeft: free ? body.current.facingLeft : undefined,
      holding: summaryOwned ? { src: summarySrc } : undefined,
      label: 'You',
      stride: strideShown.current,
      breath: breathRef.current,
    });
  }
  // Everyone else in this location stays exactly where the snapshot has them (breathing is non-informational idle).
  const others = s.entities.filter((e): e is EntityState & { mark: SpatialMark } => e.kind === 'actor' && e.id !== hero.id && !!e.mark);
  others.forEach((e, i) => {
    const spec = staging.figures[e.id];
    if (!spec) return;
    if (e.owner.kind === 'location' && e.owner.id === s.location) {
      place(e.id, e.mark.x, e.mark.y, e.mark.facing, spec.posture, spec.posture === 'seat' ? 'table' : 'gesture', withdrawn ? 'graphite' : 'paint', 1, { breath: withdrawn ? undefined : breathRef.current * 0.93 + i * 0.37 });
      return;
    }
    // Seen through an open door: the same body, carried by the door's transform. Never a proxy, never a transfer.
    const open = m.portals.some(p => p.kind === 'excursion' && p.fromScene === s.scene && p.to === (e.owner as { id: string }).id && s.variables[`portal_${p.id}`] === 'open');
    const v = open ? staging.seeThrough.find(t => t.from === (e.owner as { id: string }).id && t.to === s.location) : undefined;
    if (v) place(e.id, v.x[0] * e.mark.x + v.x[1], v.y[0] * e.mark.y + v.y[1], e.mark.facing, spec.posture, spec.posture === 'seat' ? 'table' : 'gesture', 'through_glass', v.h);
  });

  // Occluder cut-outs: only where an occluder stands in front of a body it overlaps on screen.
  const cutouts: CutoutLayer[] = [];
  for (const o of loc?.occluders ?? []) {
    const near = nearDepth(o.polygon);
    const behind = bodies.filter(b => b.depth > near + 1e-6);
    if (!behind.length) continue;
    const poly = occluderSilhouette(fit, o.polygon, o.height);
    if (!poly) continue;
    const xs = poly.map(p => p.x);
    const ys = poly.map(p => p.y);
    const overlaps = behind.some(b => b.box.left < Math.max(...xs) && b.box.left + b.box.width > Math.min(...xs) && b.box.top < Math.max(...ys) && b.box.top + b.box.height > Math.min(...ys));
    if (overlaps) cutouts.push({ kind: 'cutout', id: o.id, depth: near, polygon: poly });
  }
  const items = [...bodies, ...cutouts].sort((a, b) => b.depth - a.depth || (a.kind === 'cutout' ? 1 : -1));

  // Painted islands (presentation only): the body always carries one — the room paints in around the player.
  const islands: IslandPx[] = [];
  const targets = s.decision && act ? staging.enactments[act.option]?.attention ?? [] : staging.attention[s.scene] ?? [];
  const hasHero = targets.some(t => t.kind === 'hero');
  const all = withdrawn ? [] : hasHero ? targets : [{ kind: 'hero' as const, r: [10, 0.4] as [number, number] }, ...targets];
  all.forEach((t, i) => {
    const e =
      t.kind === 'hero'
        ? dims
          ? islandEllipse(fit, [pres.x, pres.y, 0.9 / dims.heightScale], t.r)
          : undefined
        : islandEllipse(fit, t.at, t.r);
    if (e) islands.push({ cx: e.cx, cy: e.cy, rx: e.rx * 1.2 * paintIn, ry: e.ry * 1.12 * paintIn, seed: i });
  });
  // An actor seen through glass gets a faint island of its own (Design D03).
  for (const b of bodies) if (b.treatment === 'through_glass') islands.push({ cx: b.box.left + b.box.width / 2, cy: b.box.top + b.box.height / 2, rx: b.box.width * 1.4 * paintIn, ry: b.box.height * 0.8 * paintIn, seed: 5 });

  // Display surfaces of this location: projected rect, Design's texture, the approved title as live DOM.
  const surfaces = Object.entries(staging.surfaces)
    .filter(([, v]) => v.location === s.location)
    .flatMap(([entity]) => {
      const a = loc?.anchors.find(x => x.entity === entity);
      const rect = a?.surface ? surfaceRect(fit, a.surface) : undefined;
      return rect ? [{ entity, rect, title: displayTitle, textureSrc: assets.url(staging.props.display) }] : [];
    });

  // Graphite interaction marks.
  const marks: MarkLayer[] = [];
  if (!withdrawn && control?.eligible)
    for (const h of hotspots) {
      const e = islandEllipse(fit, h.focus, h.extent);
      if (!e) continue;
      const rx = Math.max(22, e.rx);
      const ry = Math.max(16, e.ry);
      const near = nearRef.current === h.id;
      // A door labels its way out from wherever it is, even just behind the camera's shoulder.
      const clamp = h.kind === 'door' ? { x: Math.min(box.w - 40, Math.max(40, e.cx)), y: Math.min(box.h - 120, Math.max(110, e.cy)) } : undefined;
      const side = h.kind === 'door' ? (e.cx > box.w / 2 ? 'left' : 'right') : e.cx > box.w * 0.62 ? 'left' : 'right';
      marks.push({ id: h.id, kind: h.kind, cx: e.cx, cy: e.cy, rx, ry, label: h.label, near, seen: h.seen, side, keyHint, clamp });
    }

  const model: LayerModel = {
    box,
    plate: { left: fit.offX, top: fit.offY, width: cam.viewport.width * fit.scale, height: cam.viewport.height * fit.scale, graphite: plates && assets.url(plates.graphite), paint: plates && assets.url(plates.paint) },
    islands,
    withdrawn,
    surfaces,
    dimSurfaces: withdrawn,
    items,
    marks,
    reducedMotion,
  };

  /* ---------------------------------------------------- hit testing --- */
  const hitRef = useRef({ fit, bodies, surfaces, marks });
  hitRef.current = { fit, bodies, surfaces, marks };
  useImperativeHandle(
    ref,
    () => ({
      hitTest(nx: number, ny: number): ViewportHit {
        const { fit: f, bodies: bs, surfaces: sfs, marks: ks } = hitRef.current;
        const x = nx * f.box.w;
        const y = ny * f.box.h;
        const inside = (r: { left: number; top: number; width: number; height: number }, pad = 0) => x >= r.left - pad && x <= r.left + r.width + pad && y >= r.top - pad && y <= r.top + r.height + pad;
        const st = live.current.state;
        const L = geometry.locations.find(l => l.location === st.location);
        const d = staging.locations[st.location];
        const c = m.compiledScenes.find(q => q.id === st.scene);
        for (const k of ks) if (((x - k.cx) / (k.rx + 8)) ** 2 + ((y - k.cy) / (k.ry + 8)) ** 2 <= 1) return { kind: 'hotspot', id: k.id };
        // Nearest body first (a nearer body covers a farther one).
        for (const b of [...bs].sort((a, q) => a.depth - q.depth)) {
          if (b.treatment === 'through_glass' || !inside(b.box, 4)) continue;
          return b.id === m.perspectiveActor ? { kind: 'hero' } : { kind: 'actor', id: b.id };
        }
        for (const sf of sfs) if (inside(sf.rect, 6)) return { kind: 'object', id: sf.entity };
        const p = stageToFloor(f, x, y);
        if (!p || !L || p[0] < 0 || p[0] > 100 || p[1] < 0 || p[1] > 100) return { kind: 'none' };
        let nearestRole: string | undefined;
        let best = Infinity;
        for (const [role, mk] of Object.entries(c?.marks ?? {})) {
          const dd = Math.hypot(((mk.x - p[0]) * (d?.widthM ?? 1)) / 100, ((mk.y - p[1]) * (d?.depthM ?? 1)) / 100);
          if (dd < best && dd < 0.9) {
            best = dd;
            nearestRole = role;
          }
        }
        const seat = nearestRole ? L.seats?.find(q => q.role === nearestRole)?.obstacle : undefined;
        const legal = legalFloor(L, p) || (!!seat && seatedStandable(L, p, seat));
        return { kind: 'floor', point: p, legal, ...(nearestRole ? { nearestRole } : {}) };
      },
      markOnStage(role: string) {
        const mk = m.compiledScenes.find(q => q.id === live.current.state.scene)?.marks?.[role];
        return mk ? toStage(hitRef.current.fit, mk.x, mk.y, 0) : undefined;
      },
      pointOnStage(x: number, y: number) {
        return toStage(hitRef.current.fit, x, y, 0);
      },
      walkTo(point: FloorPoint, onArrive?: () => void) {
        const st = live.current.state;
        const L = geometry.locations.find(l => l.location === st.location);
        const d = staging.locations[st.location];
        if (!L || !d || script.current) return false;
        // A tap past the walkable floor still walks as far toward it as the room allows.
        const path = findPath(L, d, body.current.pos, point, limitRef.current, 8);
        if (!path) return false;
        goal.current = { path, i: 1, onArrive, stuck: 0 };
        return true;
      },
      heroAt() {
        return body.current.pos;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const overlayLayout: OverlayLayout = { fit, box, hero: heroTop, actors: tops, project: (x, y, h = 0) => toStage(fit, x, y, h) };

  return (
    <div
      ref={wrap}
      className="v3p-viewport"
      data-testid="scene-viewport"
      data-camera={cam.id}
      data-orientation={orientation}
      data-near={nearRef.current ?? ''}
      // QA aid: where this scene's compiled marks fall on the stage (public geometry only).
      data-marks={JSON.stringify(Object.fromEntries(Object.entries(cs.marks ?? {}).flatMap(([r, mk]) => { const q = toStage(fit, mk.x, mk.y, 0); return q ? [[r, [Math.round(q.x), Math.round(q.y)]]] : []; })))}
    >
      <div className="v3p-stage" style={{ width: box.w, height: box.h }} data-testid="stage">
        {box.w > 0 && (plates && model.plate.graphite ? <SceneLayersV3 model={model} overlay={overlay?.(overlayLayout)} /> : <p className="v3p-stage-missing">The scene picture is not loaded.</p>)}
      </div>
    </div>
  );
});

const ZOOM = 1.06;
