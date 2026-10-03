/**
 * The normalized scene viewport. Renderer only: it reads the snapshot (scene, hero/actor marks, owners, phase,
 * accepted option), the compiled scene (marks, routes) and the runtime geometry (cameras, floor, occluders,
 * surfaces), and draws them through ONE fit (NormalizedProjection). It owns no story state.
 *
 * What it presents but never decides:
 *  - the camera recipe the viewport orientation selects (staging framings, validated at build time);
 *  - the hero walking an approved compiled route between the mark it was on and the mark the snapshot now names
 *    (a reposition, a portal-threshold crossing, the private-request approach). The snapshot moved first; the
 *    walk is presentation, and reduced motion replaces it with a cut;
 *  - attention islands, occluder cut-outs, the display title as live DOM, the boundary withdrawal.
 * It reports presentation facts upward (approach finished, withdrawal finished); the shell turns those into the
 * host's guarded receipts.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CompiledScene, EntityState, PlaybackManifestV3, SpatialMark } from '../../../engine/v3/contracts/manifest';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import { seatedStandable, type FloorPoint, type RuntimeGeometryV3 } from '../../../engine/v3/contracts/geometry';
import { along, bodyBox, fitCamera, islandEllipse, legalFloor, nearDepth, occluderSilhouette, pathMetres, stageToFloor, surfaceRect, toStage, yawOf, type Fit } from './NormalizedProjection';
import { SceneLayersV3, type BodyLayer, type CutoutLayer, type IslandPx, type LayerModel } from './SceneLayersV3';
import { routeBetween, selectFraming, type ActPose, type Orientation, type StagingV3 } from './staging';
import type { AssetCache } from './AssetPreloader';
import type { FigurePose } from './Figure';

export type ViewportHit =
  | { kind: 'hero' }
  | { kind: 'actor'; id: string }
  | { kind: 'object'; id: string }
  | { kind: 'floor'; point: FloorPoint; legal: boolean; nearestRole?: string }
  | { kind: 'none' };

export interface ViewportHandle {
  /** A tap at a normalized point of the stage box. */
  hitTest(nx: number, ny: number): ViewportHit;
  /** Stage position of a compiled mark of the current scene (for keyboard stepping between marks). */
  markOnStage(role: string): { x: number; y: number } | undefined;
  /** Stage position of any floor point of the current location. */
  pointOnStage(x: number, y: number): { x: number; y: number } | undefined;
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
}

const WALK_MPS = 1.6;
const ROLE_EPS = 1e-6;
const roleAt = (cs: CompiledScene | undefined, m: { x: number; y: number } | undefined) =>
  cs && m ? Object.entries(cs.marks ?? {}).find(([, v]) => Math.abs(v.x - m.x) < ROLE_EPS && Math.abs(v.y - m.y) < ROLE_EPS)?.[0] : undefined;

interface Presented {
  x: number;
  y: number;
  walking: boolean;
  headingLeft?: boolean;
}

export const SceneViewportV3 = forwardRef<ViewportHandle, SceneViewportProps>(function SceneViewportV3(props, ref) {
  const { manifest: m, state: s, staging, geometry, assets, orientation, reducedMotion, displayTitle, act, onActStopped, onWithdrawn, overlay } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [viewportH, setViewportH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
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
  const [pres, setPres] = useState<Presented | undefined>(() => (target ? { x: target.x, y: target.y, walking: false } : undefined));
  const anim = useRef<{ raf: number; id: number } | null>(null);
  const prev = useRef<{ scene: string; location: string; mark?: SpatialMark; transition?: string; departed?: string }>({ scene: s.scene, location: s.location, mark: target });
  const stoppedFor = useRef<string>('');

  const stopAnim = () => {
    if (anim.current) cancelAnimationFrame(anim.current.raf);
    anim.current = null;
  };
  const walk = useCallback(
    (path: Array<[number, number]>, done?: () => void) => {
      stopAnim();
      const metres = dims ? pathMetres(path, dims.widthM, dims.depthM) : 0;
      if (reducedMotion || path.length < 2 || metres <= 0) {
        const end = path[path.length - 1];
        setPres({ x: end[0], y: end[1], walking: false });
        done?.();
        return;
      }
      const dur = Math.min(4200, Math.max(500, (metres / WALK_MPS) * 1000));
      let elapsed = 0;
      let last = performance.now();
      const id = Math.random();
      const tick = (now: number) => {
        elapsed += Math.min(64, now - last); // never catch up after a hidden tab
        last = now;
        const t = Math.min(1, elapsed / dur);
        const p = along(path, t, dims!.widthM, dims!.depthM);
        setPres({ x: p.x, y: p.y, walking: t < 1, headingLeft: p.heading < 0 ? true : p.heading > 0 ? false : undefined });
        if (t < 1) anim.current = { raf: requestAnimationFrame(tick), id };
        else {
          anim.current = null;
          done?.();
        }
      };
      anim.current = { raf: requestAnimationFrame(tick), id };
    },
    [dims, reducedMotion]
  );

  useEffect(() => () => stopAnim(), []);

  useEffect(() => {
    const was = prev.current;
    const tx = s.transition;
    // Skip (or a restore) past the act: install the final stop at once; never finish a walk in a later phase.
    if (s.decision && s.phase !== 'enacting' && target) {
      if (anim.current || !pres || pres.x !== target.x || pres.y !== target.y) {
        stopAnim();
        setPres({ x: target.x, y: target.y, walking: false });
      }
      prev.current = { scene: s.scene, location: s.location, mark: target };
      return;
    }
    // 1. Departing through a door with an approved crossing route: walk it while the destination prepares.
    if (tx && was.departed !== tx.id) {
      prev.current = { ...was, transition: tx.portal, departed: tx.id };
      const cross = staging.crossings.find(c => c.portal === tx.portal && c.location === s.location && c.depart);
      const route = cross && cs.routes?.[cross.depart!];
      if (route && heroMark && Math.abs(route[0][0] - heroMark.x) < ROLE_EPS && Math.abs(route[0][1] - heroMark.y) < ROLE_EPS) walk(route as Array<[number, number]>);
      return;
    }
    if (!target) return;
    // 2. Arrival in another location: walk the approved arrival route, if this door has one; otherwise a cut.
    if (was.location !== s.location) {
      const cross = staging.crossings.find(c => c.portal === was.transition && c.location === s.location && c.arrive);
      const route = cross && cs.routes?.[cross.arrive!];
      prev.current = { scene: s.scene, location: s.location, mark: target };
      const ends = route && Math.abs(route[route.length - 1][0] - target.x) < ROLE_EPS && Math.abs(route[route.length - 1][1] - target.y) < ROLE_EPS;
      if (route && ends) walk(route as Array<[number, number]>);
      else walk([[target.x, target.y]]);
      return;
    }
    // 3. Same location, new mark (a reposition, an undo, the act's approach): the approved route, else a cut.
    const moved = !was.mark || Math.abs(was.mark.x - target.x) > ROLE_EPS || Math.abs(was.mark.y - target.y) > ROLE_EPS;
    prev.current = { scene: s.scene, location: s.location, mark: target };
    const role = roleAt(cs, target);
    if (moved) {
      const from = was.mark ?? target;
      const path = role ? routeBetween(cs, from, role) : undefined;
      walk(path ?? [[target.x, target.y]], s.phase === 'enacting' ? () => stopped() : undefined);
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
    if (s.phase === 'enacting' && !anim.current && pres && target && Math.abs(pres.x - target.x) < ROLE_EPS && Math.abs(pres.y - target.y) < ROLE_EPS) stopped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, pres?.x, pres?.y, actInstance]);

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
  const box = useMemo(() => {
    const w = Math.max(0, width);
    if (orientation === 'landscape') {
      const aspect = cam.viewport.height / cam.viewport.width;
      const h = Math.min(w * aspect, Math.max(260, viewportH * 0.7));
      return { w: Math.min(w, h / aspect), h };
    }
    return { w, h: Math.min(w * (cam.viewport.height / cam.viewport.width), Math.max(320, viewportH * 0.6)) };
  }, [width, viewportH, orientation, cam]);

  const heroHeightU = dims ? staging.figures[m.perspectiveActor].heightM / dims.heightScale : 0.6;
  const focusFit = fitCamera(cam, box, { kind: 'contain' });
  const fit = useMemo(() => {
    if (orientation === 'landscape') return focusFit;
    // Portrait band: centred on the hero's body (or the camera's principal point when the framing omits the hero).
    const p = pres ? toStage(focusFit, pres.x, pres.y, heroHeightU / 2) : undefined;
    const focusY = p ? (p.y - focusFit.offY) / focusFit.scale : undefined;
    return fitCamera(cam, box, { kind: 'band', focusY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam, box.w, box.h, orientation, pres?.x, pres?.y]);

  /* --------------------------------------------------- the layers --- */
  const layout = useMemo(() => {
    const bodies: BodyLayer[] = [];
    const tops: OverlayLayout['actors'] = {};
    let heroTop: { x: number; y: number } | undefined;
    const widthU = (metres: number) => (dims ? (100 * metres) / dims.widthM : 6);
    const place = (id: string, x: number, y: number, facing: string | undefined, posture: 'stand' | 'seat', pose: FigurePose, treatment: BodyLayer['treatment'], hScale = 1, opts: { headingLeft?: boolean; holding?: { src?: string }; label?: string } = {}) => {
      const spec = staging.figures[id];
      if (!spec || !dims) return;
      const hU = (spec.heightM / dims.heightScale) * hScale;
      const b = bodyBox(fit, x, y, hU, widthU(0.5));
      if (!b || b.height <= 0) return;
      const height = b.height;
      const w = height * 0.6;
      const yaw = yawOf(facing) ?? 90;
      const facingLeft = opts.headingLeft ?? yaw < 0;
      bodies.push({ kind: 'body', id, depth: y, box: { left: b.cx - w / 2, top: b.feet - height, width: w, height }, spec, posture, pose, facingLeft, treatment, holding: opts.holding, label: opts.label });
      const top = { x: b.cx, y: b.feet - height };
      if (id === m.perspectiveActor) heroTop = top;
      else tops[id] = top;
    };

    // The hero: the snapshot's (or the act's approved) position, walked by presentation only.
    const summaryOwned = s.entities.some(e => e.kind === 'object' && e.owner.kind === 'actor' && e.owner.id === hero.id);
    const summarySrc = assets.url(staging.props.summary);
    if (pres) {
      const role = roleAt(cs, pres) ?? hero.state.mark_role;
      const seated = !pres.walking && !!role && staging.heroPostures[s.location]?.[role] === 'seat';
      let pose: FigurePose = s.scene === m.spine[0] ? 'look' : s.location !== m.scenePlans.find(p => p.id === m.primaryDecision?.scene)?.location && !pres.walking ? 'read' : 'hold';
      if (pres.walking) pose = 'walk';
      else if (s.decision && act && s.phase !== 'loading') pose = act.pose === 'speak' ? 'speak' : act.pose === 'ask' ? 'ask' : 'still';
      const facing = s.decision && approachTarget ? approachTarget.facing : heroMark?.facing;
      place(hero.id, pres.x, pres.y, facing, seated && pose !== 'ask' ? 'seat' : 'stand', pose, withdrawn ? 'ink' : 'paint', 1, { headingLeft: pres.walking ? pres.headingLeft : undefined, holding: summaryOwned ? { src: summarySrc } : undefined, label: 'You' });
    }
    // Everyone else in this location stays exactly where the snapshot has them.
    const others = s.entities.filter((e): e is EntityState & { mark: SpatialMark } => e.kind === 'actor' && e.id !== hero.id && !!e.mark);
    for (const e of others) {
      const spec = staging.figures[e.id];
      if (!spec) continue;
      if (e.owner.kind === 'location' && e.owner.id === s.location) {
        place(e.id, e.mark.x, e.mark.y, e.mark.facing, spec.posture, spec.posture === 'seat' ? 'table' : 'gesture', withdrawn ? 'graphite' : 'paint');
        continue;
      }
      // Seen through an open door: the same body, carried by the door's transform. Never a proxy, never a transfer.
      const open = m.portals.some(p => p.kind === 'excursion' && p.fromScene === s.scene && p.to === (e.owner as { id: string }).id && s.variables[`portal_${p.id}`] === 'open');
      const v = open ? staging.seeThrough.find(t => t.from === (e.owner as { id: string }).id && t.to === s.location) : undefined;
      if (v) place(e.id, v.x[0] * e.mark.x + v.x[1], v.y[0] * e.mark.y + v.y[1], e.mark.facing, spec.posture, spec.posture === 'seat' ? 'table' : 'gesture', 'through_glass', v.h);
    }

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

    // Attention islands (presentation only).
    const islands: IslandPx[] = [];
    const targets = s.decision && act ? staging.enactments[act.option]?.attention ?? [] : staging.attention[s.scene] ?? [];
    for (const t of withdrawn ? [] : targets) {
      const e =
        t.kind === 'hero'
          ? pres && dims
            ? islandEllipse(fit, [pres.x, pres.y, 1.0 / dims.heightScale], t.r)
            : undefined
          : islandEllipse(fit, t.at, t.r);
      if (e) islands.push({ ...e, rx: e.rx * 1.25, ry: e.ry * 1.15 });
    }
    // An actor seen through glass gets a faint island of its own (Design D03).
    for (const b of bodies) if (b.treatment === 'through_glass') islands.push({ cx: b.box.left + b.box.width / 2, cy: b.box.top + b.box.height / 2, rx: b.box.width * 1.4, ry: b.box.height * 0.8 });

    // Display surfaces of this location: projected rect, Design's texture, the approved title as live DOM.
    const surfaces = Object.entries(staging.surfaces)
      .filter(([, v]) => v.location === s.location)
      .flatMap(([entity]) => {
        const a = loc?.anchors.find(x => x.entity === entity);
        const rect = a?.surface ? surfaceRect(fit, a.surface) : undefined;
        return rect ? [{ entity, rect, title: displayTitle, textureSrc: assets.url(staging.props.display) }] : [];
      });

    const ref = { w: cam.viewport.width * fit.scale, h: cam.viewport.height * fit.scale };
    const model: LayerModel = {
      box,
      plate: { left: fit.offX, top: fit.offY, width: ref.w, height: ref.h, graphite: plates && assets.url(plates.graphite), paint: plates && assets.url(plates.paint) },
      islands,
      withdrawn,
      surfaces,
      dimSurfaces: withdrawn,
      items,
      reducedMotion,
    };
    return { model, heroTop, tops, bodies, surfaces };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit, pres, s, act, withdrawn, displayTitle, reducedMotion, plates, loc]);

  /* ---------------------------------------------------- hit testing --- */
  useImperativeHandle(
    ref,
    () => ({
      hitTest(nx: number, ny: number): ViewportHit {
        const x = nx * box.w;
        const y = ny * box.h;
        const inside = (r: { left: number; top: number; width: number; height: number }, pad = 0) => x >= r.left - pad && x <= r.left + r.width + pad && y >= r.top - pad && y <= r.top + r.height + pad;
        // Nearest body first (a nearer body covers a farther one).
        for (const b of [...layout.bodies].sort((a, c) => a.depth - c.depth)) {
          if (b.treatment === 'through_glass' || !inside(b.box, 4)) continue;
          return b.id === m.perspectiveActor ? { kind: 'hero' } : { kind: 'actor', id: b.id };
        }
        for (const sf of layout.surfaces) if (inside(sf.rect, 6)) return { kind: 'object', id: sf.entity };
        const p = stageToFloor(fit, x, y);
        if (!p || !loc || p[0] < 0 || p[0] > 100 || p[1] < 0 || p[1] > 100) return { kind: 'none' };
        // The nearest compiled mark of this scene to the tapped floor, for tap-to-approach.
        let nearestRole: string | undefined;
        let best = Infinity;
        for (const [role, mk] of Object.entries(cs.marks ?? {})) {
          const d = Math.hypot(((mk.x - p[0]) * (dims?.widthM ?? 1)) / 100, ((mk.y - p[1]) * (dims?.depthM ?? 1)) / 100);
          if (d < best && d < 0.9) {
            best = d;
            nearestRole = role;
          }
        }
        // Legal: open floor clear of the (already inflated) footprints, or — for a declared seated mark — its own seat.
        const seat = nearestRole ? loc.seats?.find(q => q.role === nearestRole)?.obstacle : undefined;
        const legal = legalFloor(loc, p) || (!!seat && seatedStandable(loc, p, seat));
        return { kind: 'floor', point: p, legal, ...(nearestRole ? { nearestRole } : {}) };
      },
      markOnStage(role: string) {
        const mk = cs.marks?.[role];
        return mk ? toStage(fit, mk.x, mk.y, 0) : undefined;
      },
      pointOnStage(x: number, y: number) {
        return toStage(fit, x, y, 0);
      },
    }),
    [box, layout, fit, loc, cs, dims, m.perspectiveActor]
  );

  const overlayLayout: OverlayLayout = { fit, box, hero: layout.heroTop, actors: layout.tops, project: (x, y, h = 0) => toStage(fit, x, y, h) };

  return (
    <div
      ref={wrap}
      className="v3p-viewport"
      data-testid="scene-viewport"
      data-camera={cam.id}
      data-orientation={orientation}
      // QA aid: where this scene's compiled marks fall on the stage (public geometry only).
      data-marks={JSON.stringify(Object.fromEntries(Object.entries(cs.marks ?? {}).flatMap(([r, mk]) => { const q = toStage(fit, mk.x, mk.y, 0); return q ? [[r, [Math.round(q.x), Math.round(q.y)]]] : []; })))}
      style={{ height: box.h }}
    >
      <div className="v3p-stage" style={{ width: box.w, height: box.h }} data-testid="stage">
        {plates && layout.model.plate.graphite ? <SceneLayersV3 model={layout.model} overlay={overlay?.(overlayLayout)} /> : <p className="v3p-stage-missing">The scene picture is not loaded.</p>}
      </div>
    </div>
  );
});
