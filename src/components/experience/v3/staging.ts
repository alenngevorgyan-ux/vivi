/**
 * Presentation staging: what a renderer needs beyond the manifest and the runtime geometry resource, compiled
 * from Design source by the same deterministic build (scripts/build-v3-correction-geometry.ts).
 *
 * It holds NO hero or actor positions: named marks live only in the manifest's compiled scenes and actor marks
 * in its entities (the one runtime coordinate authority). Staging says how to LOOK at that state — which camera
 * recipe a viewport orientation selects, which plates belong to a recipe, where attention islands sit, which
 * posture a mark implies, how an open door shows the room beyond it — and never decides anything: no receipt,
 * gate or distance check depends on it.
 *
 * `validateStaging` proves the staging agrees with the geometry and the manifest: every framing a player can
 * select is validated against `validateGeometryForManifest` with exactly the marks that framing must show, so a
 * viewport orientation can never select a recipe the geometry contract has not accepted.
 */

import { validateGeometryForManifest, type CameraGeometry, type RuntimeGeometryV3 } from '../../../engine/v3/contracts/geometry.ts';
import type { CompiledScene, PlaybackManifestV3 } from '../../../engine/v3/contracts/manifest.ts';

export type Orientation = 'landscape' | 'portrait';
export type Posture = 'stand' | 'seat';
export type ActPose = 'speak' | 'ask' | 'still';

export interface StagingAsset {
  /** Resolved by the bundler from the repository path; never a private or remote location. */
  url: string;
  sha256: string;
  width: number;
  height: number;
  revision: string;
  role: string;
  /** `scene`: preloaded before a scene mounts. `after_boundary_public`: a public motif, only after the boundary. */
  preload: 'scene' | 'after_boundary_public';
}

/**
 * An attention island (Design's paint-through-graphite emphasis). Presentation only.
 * `r` is the island's half extent: [x in floor units, vertical in height units].
 */
export type AttentionTarget = { kind: 'hero'; r: [number, number] } | { kind: 'point'; at: [number, number, number]; r: [number, number] };

export interface SceneFraming {
  landscape: string;
  portrait: string;
  /** Design's second portrait framing while a beat is the latest delivered one. It need not show the hero. */
  portraitByBeat?: Record<string, string>;
  /** Portrait framing for an accepted option's enactment (e.g. an approach the default framing does not show). */
  portraitByOption?: Record<string, string>;
}

export interface FigureSpec {
  posture: Posture;
  heightM: number;
  build: 'hero' | 'slight' | 'broad';
  palette: { coat: string; inner: string; trousers: string; skin: string; hair: string; shoe: string };
}

export interface StagingV3 {
  stagingRevision: string;
  geometryRevision: string;
  assetsRevision: string;
  /** Metre extents per runtime location: converts presentation sizes (figure height, island radius) to floor units. */
  locations: Record<string, { widthM: number; depthM: number; heightScale: number }>;
  framings: Record<string, SceneFraming>;
  /** Design layout zones per camera recipe ([x0, y0, x1, y1] in reference pixels): title_safe, line/text and intent/thumb zones. */
  zones: Record<string, Record<string, [number, number, number, number]>>;
  /** Camera recipe id → its two plates (asset ids). */
  plates: Record<string, { graphite: string; paint: string }>;
  props: { summary: string; display: string; authorPage: string };
  assets: Record<string, StagingAsset>;
  attention: Record<string, AttentionTarget[]>;
  enactments: Record<string, { pose: ActPose; approachTo?: string; attention: AttentionTarget[] }>;
  /** Location → compiled mark role → posture Design declares for it. Roles not listed are standing. */
  heroPostures: Record<string, Record<string, Posture>>;
  /** Where a held object sits on its holder, by posture (Design attachment names). */
  heldAt: Record<Posture, string>;
  figures: Record<string, FigureSpec>;
  /**
   * An open door shows another location's actors, through `to = scale * from + offset` (floor units, height units).
   * Projection only: never a transfer and never a proxy body.
   */
  seeThrough: Array<{ from: string; to: string; portals: string[]; x: [number, number]; y: [number, number]; h: number }>;
  /** Portal crossing presentation: a route in `location` played on arrival (ends on the entry mark) or departure. */
  crossings: Array<{ portal: string; location: string; arrive?: string; depart?: string }>;
  /** Display surfaces (corners in the geometry resource anchors) and the live DOM slot each carries. */
  surfaces: Record<string, { location: string; slot: 'display.title' }>;
  /** Design ids behind every compiled id, for traceability. */
  designNames: Record<string, Record<string, string>>;
}

/* ------------------------------------------------------------ selection --- */

/**
 * The camera recipe a viewport selects: orientation first, then Design's per-beat or per-option portrait framing.
 * Pure: the same inputs always select the same recipe, and only recipes `validateStaging` accepted exist here.
 */
export function selectFraming(st: StagingV3, sceneId: string, o: { orientation: Orientation; lastBeat?: string; option?: string }): string | undefined {
  const f = st.framings[sceneId];
  if (!f) return undefined;
  if (o.orientation === 'landscape') return f.landscape;
  if (o.option && f.portraitByOption?.[o.option]) return f.portraitByOption[o.option];
  if (o.lastBeat && f.portraitByBeat?.[o.lastBeat]) return f.portraitByBeat[o.lastBeat];
  return f.portrait;
}

/**
 * A walk between two marks over the scene's approved routes (each usable in either direction), or undefined when
 * none connects them: the renderer then cuts. Routes are compiled geometry; nothing here invents a path.
 */
export function routeBetween(cs: Pick<CompiledScene, 'marks' | 'routes'>, from: { x: number; y: number }, toRole: string): Array<[number, number]> | undefined {
  const target = cs.marks?.[toRole];
  if (!target) return undefined;
  const same = (a: readonly number[], b: { x: number; y: number }) => Math.abs(a[0] - b.x) < 1e-6 && Math.abs(a[1] - b.y) < 1e-6;
  const at = (p: readonly number[], q: readonly number[]) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
  if (Math.abs(from.x - target.x) < 1e-6 && Math.abs(from.y - target.y) < 1e-6) return [[target.x, target.y]];
  const legs = Object.values(cs.routes ?? {}).flatMap(r => [r, [...r].reverse()]);
  // Breadth-first over route endpoints: the fewest legs, deterministic by route order.
  const queue: Array<{ end: [number, number]; path: Array<[number, number]> }> = [{ end: [from.x, from.y], path: [[from.x, from.y]] }];
  const seen = new Set<string>([`${from.x},${from.y}`]);
  while (queue.length) {
    const { end, path } = queue.shift()!;
    for (const leg of legs) {
      if (!at(leg[0], end)) continue;
      const last = leg[leg.length - 1] as [number, number];
      const k = `${last[0]},${last[1]}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const next = [...path, ...(leg.slice(1) as Array<[number, number]>)];
      if (same(last, target)) return next;
      queue.push({ end: last, path: next });
    }
  }
  return undefined;
}

/* ----------------------------------------------------------- validation --- */

export interface StagingIssue {
  path: string;
  message: string;
}

/**
 * Probe scenes: one per (scene, orientation, Design override) a player can select, carrying exactly the hero marks
 * that framing must show. `shows` lists those roles; the default framings show every mark of the scene.
 */
export type FramingShows = (sceneId: string, framing: 'default' | { beat: string } | { option: string }, orientation: Orientation) => string[];

export function framingProbes(st: StagingV3, m: PlaybackManifestV3, orientation: Orientation, shows: FramingShows): CompiledScene[] {
  const out: CompiledScene[] = [];
  for (const cs of m.compiledScenes) {
    const f = st.framings[cs.id];
    if (!f) continue;
    const probe = (tag: string, camera: string, roles: string[]): CompiledScene => {
      const { entryMark, marks: _all, ...rest } = structuredClone(cs);
      const marks = Object.fromEntries(roles.filter(r => cs.marks?.[r]).map(r => [r, { ...cs.marks![r] }]));
      // The entry mark is carried only when the framing shows the role standing there.
      const showsEntry = !!entryMark && Object.values(marks).some(mk => mk.x === entryMark.x && mk.y === entryMark.y);
      return { ...rest, id: `${cs.id}__${tag}`, cameraRecipe: camera, marks, ...(showsEntry ? { entryMark } : {}) };
    };
    out.push(probe(orientation, orientation === 'landscape' ? f.landscape : f.portrait, shows(cs.id, 'default', orientation)));
    if (orientation === 'portrait') {
      for (const [beat, cam] of Object.entries(f.portraitByBeat ?? {})) out.push(probe(`portrait_${beat}`, cam, shows(cs.id, { beat }, 'portrait')));
      for (const [option, cam] of Object.entries(f.portraitByOption ?? {})) out.push(probe(`portrait_${option}`, cam, shows(cs.id, { option }, 'portrait')));
    }
  }
  return out;
}

/**
 * Staging agrees with the geometry and the manifest. Every selectable framing passes the geometry contract with
 * the marks it must show; every recipe has plates; every route, role and surface it names exists.
 */
export function validateStaging(st: StagingV3, geo: RuntimeGeometryV3, m: PlaybackManifestV3, shows: FramingShows): StagingIssue[] {
  const issues: StagingIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const cams = new Map<string, CameraGeometry>(geo.cameras.map(c => [c.id, c]));
  const hex = /^[a-f0-9]{64}$/;

  if (st.geometryRevision !== geo.provenance.sourceRevision) add('geometryRevision', 'staging and geometry come from different Design source revisions');
  for (const [id, a] of Object.entries(st.assets)) if (!hex.test(a.sha256) || !a.url || !(a.width > 0 && a.height > 0)) add(`assets.${id}`, 'asset needs a url, a SHA-256 and a size');
  for (const cs of m.compiledScenes) {
    const f = st.framings[cs.id];
    if (!f) {
      add(`framings.${cs.id}`, 'scene has no framing');
      continue;
    }
    const all: Array<[string, string, 'landscape' | 'portrait']> = [
      ['landscape', f.landscape, 'landscape'],
      ['portrait', f.portrait, 'portrait'],
      ...Object.entries(f.portraitByBeat ?? {}).map(([b, c]) => [`portraitByBeat.${b}`, c, 'portrait'] as [string, string, 'portrait']),
      ...Object.entries(f.portraitByOption ?? {}).map(([o, c]) => [`portraitByOption.${o}`, c, 'portrait'] as [string, string, 'portrait']),
    ];
    for (const [where, id, orientation] of all) {
      const k = cams.get(id);
      if (!k) add(`framings.${cs.id}.${where}`, `no camera ${id}`);
      else {
        if (k.location !== cs.location) add(`framings.${cs.id}.${where}`, 'camera of another location');
        if (k.orientation !== orientation) add(`framings.${cs.id}.${where}`, `a ${k.orientation} recipe used for ${orientation}`);
      }
      const plates = st.plates[id];
      if (!plates || !st.assets[plates.graphite] || !st.assets[plates.paint]) add(`plates.${id}`, 'recipe has no published plates');
    }
    if (f.landscape !== cs.cameraRecipe) add(`framings.${cs.id}.landscape`, 'the landscape framing must be the recipe the manifest compiled');
    for (const b of Object.keys(f.portraitByBeat ?? {})) if (!m.scenePlans.find(p => p.id === cs.id)?.beats.some(x => x.id === b)) add(`framings.${cs.id}.portraitByBeat.${b}`, 'not a beat of this scene');
    for (const o of Object.keys(f.portraitByOption ?? {})) if (!m.primaryDecision?.options.includes(o) || m.primaryDecision.scene !== cs.id) add(`framings.${cs.id}.portraitByOption.${o}`, 'not an option of this scene');
  }
  for (const orientation of ['landscape', 'portrait'] as const) {
    const probes = framingProbes(st, m, orientation, shows);
    const r = validateGeometryForManifest(geo, { ...m, compiledScenes: probes });
    for (const i of r.issues) add(`probe.${orientation}.${i.path}`, i.message);
  }
  for (const [option, e] of Object.entries(st.enactments)) {
    if (!m.primaryDecision?.options.includes(option)) add(`enactments.${option}`, 'unknown option');
    const scene = m.compiledScenes.find(c => c.id === m.primaryDecision?.scene);
    if (e.approachTo && !scene?.marks?.[e.approachTo]) add(`enactments.${option}.approachTo`, 'approach target is not a compiled mark of the decision scene');
  }
  for (const c of st.crossings) {
    const scenes = m.compiledScenes.filter(s => s.location === c.location);
    for (const r of [c.arrive, c.depart]) if (r && !scenes.some(s => s.routes?.[r])) add(`crossings.${c.portal}.${c.location}`, `route ${r} is not compiled in that location`);
    if (!m.portals.some(p => p.id === c.portal && (p.from === c.location || p.to === c.location))) add(`crossings.${c.portal}`, 'portal does not touch that location');
  }
  for (const [entity, s] of Object.entries(st.surfaces)) {
    const a = geo.locations.find(l => l.location === s.location)?.anchors.find(x => x.entity === entity);
    if (!a?.surface) add(`surfaces.${entity}`, 'no surface corners in the geometry anchors');
  }
  for (const v of st.seeThrough) {
    // The door segment of `from`, carried through the transform, must land on the same door of `to`.
    for (const portal of v.portals) {
      const a = geo.locations.find(l => l.location === v.from)?.portals.find(p => p.portal === portal);
      const b = geo.locations.find(l => l.location === v.to)?.portals.find(p => p.portal === portal);
      if (!a || !b) {
        add(`seeThrough.${portal}`, 'door anchors missing on one side');
        continue;
      }
      const map = (p: readonly number[]) => [v.x[0] * p[0] + v.x[1], v.y[0] * p[1] + v.y[1]];
      const near = (p: number[], q: readonly number[]) => Math.abs(p[0] - q[0]) < 0.02 && Math.abs(p[1] - q[1]) < 0.02;
      const ma = map(a.a);
      const mb = map(a.b);
      if (!((near(ma, b.a) && near(mb, b.b)) || (near(ma, b.b) && near(mb, b.a)))) add(`seeThrough.${portal}`, 'the transform does not carry the door onto its pair');
    }
  }
  return issues;
}
