/**
 * In-world interactions: where each currently available command lives in the room.
 *
 * Derived, never authored: the readable model says WHAT is available (the reducer's own gates), the runtime
 * geometry and compiled marks say WHERE (an object's staging anchor, a door's threshold segment, a preparation's
 * mark). Nothing here adds an affordance the readable list does not already offer, and every hotspot dispatches
 * the same command the list does. Anything without a place in the room (what the hero carries, a montage cut
 * that is not a door) becomes a HUD action instead, so it is never lost.
 */

import type { FloorPoint, LocationGeometry } from '../../../engine/v3/contracts/geometry.ts';
import type { PlaybackManifestV3 } from '../../../engine/v3/contracts/manifest.ts';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state.ts';
import type { EntityRef } from '../../../engine/v3/contracts/semantic.ts';
import type { ReadableModel } from '../../../engine/v3/readable.ts';
import { nearestStandable, type FloorDims, type FloorLimit, type Reach } from './locomotion.ts';

export type WorldCommand = { kind: 'observe'; id: string } | { kind: 'travel'; id: string } | { kind: 'prepare'; id: string };

export interface Hotspot extends Reach {
  kind: 'look' | 'door' | 'place';
  /** The 2–4 word italic note (the command's own label). */
  label: string;
  command: WorldCommand;
  /** A door that several ways share (e.g. "Return to the room" and "Resume meeting"): every command it offers. */
  choices?: Array<{ label: string; command: WorldCommand }>;
  /** Where the graphite loop is drawn: floor x, y and height (height units), and its half extents. */
  focus: [number, number, number];
  extent: [number, number];
  seen?: boolean;
}

export interface HudAction {
  kind: 'carried' | 'onward';
  label: string;
  command: WorldCommand;
  seen?: boolean;
}

const mid = (a: FloorPoint, b: FloorPoint): FloorPoint => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export function deriveInteractions(
  m: PlaybackManifestV3,
  s: RuntimeSnapshot,
  readable: ReadableModel,
  loc: LocationGeometry | undefined,
  dims: FloorDims | undefined,
  heroAt: FloorPoint | undefined,
  limit?: FloorLimit,
  /** The camera's floor position: a thing with a face (a display) is used from the side it faces. */
  viewFrom?: FloorPoint
): { hotspots: Hotspot[]; hud: HudAction[] } {
  const hotspots: Hotspot[] = [];
  const hud: HudAction[] = [];
  const hero = m.perspectiveActor;
  const carried = (r: EntityRef) => r.kind === 'self' || (r.kind === 'object' && s.entities.some(e => e.id === r.id && e.owner.kind === 'actor' && e.owner.id === hero));
  const cs = m.compiledScenes.find(c => c.id === s.scene);
  const approach = (p: FloorPoint) => (loc && dims ? nearestStandable(loc, dims, p, 2.6, heroAt, limit) : undefined);

  for (const o of readable.observations) {
    if (!o.available) continue;
    const cmd: WorldCommand = { kind: 'observe', id: o.id };
    if (carried(o.target)) {
      hud.push({ kind: 'carried', label: o.label, command: cmd, seen: o.seen });
      continue;
    }
    const id = o.target.kind === 'self' ? undefined : o.target.id;
    const anchor = id ? loc?.anchors.find(a => a.entity === id) : undefined;
    const mark = id ? s.entities.find(e => e.id === id)?.mark : undefined;
    const root: FloorPoint | undefined = anchor ? anchor.root : mark ? [mark.x, mark.y] : undefined;
    const at = root && (anchor?.surface && viewFrom && loc && dims ? nearestStandable(loc, dims, root, 2.6, viewFrom, limit) : approach(root));
    if (!root || !at) {
      hud.push({ kind: 'carried', label: o.label, command: cmd, seen: o.seen });
      continue;
    }
    const surf = anchor?.surface;
    const focus: [number, number, number] = surf ? [(surf[0][0] + surf[2][0]) / 2, (surf[0][1] + surf[2][1]) / 2, (surf[0][2] + surf[2][2]) / 2] : [root[0], root[1], anchor?.height ?? 0.4];
    hotspots.push({ id: `look:${o.id}`, kind: 'look', label: o.label, command: cmd, at, center: root, radiusM: anchor?.surface ? 1.7 : 1.3, focus, extent: [6, 0.14], seen: o.seen });
  }

  for (const p of readable.preparations) {
    if (!p.available || p.applied) continue;
    const plan = m.preparations.find(x => x.id === p.id);
    const cmd: WorldCommand = { kind: 'prepare', id: p.id };
    const role = plan?.action.kind === 'reposition' ? plan.action.markRole : undefined;
    const mk = role ? cs?.marks?.[role] : undefined;
    if (!mk) {
      hud.push({ kind: 'carried', label: p.label, command: cmd });
      continue;
    }
    // The mark itself is where the body goes (a declared seat may sit inside its chair's footprint).
    hotspots.push({ id: `place:${p.id}`, kind: 'place', label: p.label, command: cmd, at: [mk.x, mk.y], radiusM: 0.85, focus: [mk.x, mk.y, 0.02], extent: [3.2, 0.03] });
  }

  // One mark per physical threshold: ways that share a door are offered together there.
  const doors = new Map<string, Hotspot>();
  for (const p of readable.portals) {
    if (!p.available) continue;
    const cmd: WorldCommand = { kind: 'travel', id: p.id };
    const door = loc?.portals.find(d => d.portal === p.id);
    const at = door && approach(mid(door.a, door.b));
    if (!door || !at) {
      hud.push({ kind: 'onward', label: p.label, command: cmd });
      continue;
    }
    const key = `${door.a.join(',')}|${door.b.join(',')}`;
    const prev = doors.get(key);
    if (prev) {
      prev.choices!.push({ label: p.label, command: cmd });
      prev.label = prev.choices!.map(c => c.label).join(' · ');
      continue;
    }
    const c = mid(door.a, door.b);
    const h: Hotspot = { id: `door:${p.id}`, kind: 'door', label: p.label, command: cmd, choices: [{ label: p.label, command: cmd }], at, radiusM: 1.15, focus: [c[0], c[1], 0.38], extent: [4, 0.38] };
    doors.set(key, h);
    hotspots.push(h);
  }

  return { hotspots, hud };
}
