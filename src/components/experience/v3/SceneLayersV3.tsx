/**
 * The stage's layers, drawn from one Fit. It decides nothing: SceneViewportV3 computes every position from the
 * snapshot, the compiled scene and the runtime geometry and hands them here.
 *
 *   L1 graphite plate · L2 paint plate (masked to attention islands) · display surfaces (live DOM title)
 *   · bodies and occluder cut-outs, far → near (a cut-out is the plate itself, clipped to an occluder's silhouette,
 *     redrawn over any body standing behind that occluder) · anchored overlay (controls)
 *
 * Story text is never part of a raster: the title on a display is DOM text placed on the display's projected rect.
 */

import React from 'react';
import { Figure, type FigurePose } from './Figure';
import type { FigureSpec } from './staging';

export interface IslandPx {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface BodyLayer {
  kind: 'body';
  id: string;
  depth: number;
  box: { left: number; top: number; width: number; height: number };
  spec: FigureSpec;
  posture: 'stand' | 'seat';
  pose: FigurePose;
  facingLeft: boolean;
  holding?: { src?: string };
  /** Boundary treatment: the hero becomes ink, everyone else graphite. */
  treatment: 'paint' | 'ink' | 'graphite' | 'through_glass';
  label?: string;
}

export interface CutoutLayer {
  kind: 'cutout';
  id: string;
  depth: number;
  polygon: Array<{ x: number; y: number }>;
}

export interface SurfaceLayer {
  entity: string;
  rect: { left: number; top: number; width: number; height: number };
  title: string;
  textureSrc?: string;
}

export interface LayerModel {
  box: { w: number; h: number };
  plate: { left: number; top: number; width: number; height: number; graphite?: string; paint?: string };
  islands: IslandPx[];
  /** Paint withdrawn (boundary) — the islands fade out; nothing else changes. */
  withdrawn: boolean;
  surfaces: SurfaceLayer[];
  dimSurfaces: boolean;
  items: Array<BodyLayer | CutoutLayer>;
  reducedMotion: boolean;
}

const maskOf = (islands: IslandPx[]) =>
  islands.length ? islands.map(e => `radial-gradient(${Math.max(1, e.rx)}px ${Math.max(1, e.ry)}px at ${e.cx}px ${e.cy}px, #000 0%, #000 58%, transparent 100%)`).join(', ') : 'linear-gradient(transparent, transparent)';

function Plates({ m, idPrefix }: { m: LayerModel; idPrefix?: string }) {
  const mask = maskOf(m.islands);
  const pos: React.CSSProperties = { position: 'absolute', left: m.plate.left, top: m.plate.top, width: m.plate.width, height: m.plate.height };
  return (
    <>
      {m.plate.graphite && <img src={m.plate.graphite} alt="" draggable={false} style={pos} data-testid={idPrefix ? undefined : 'plate-graphite'} />}
      {m.plate.paint && (
        <div className={`v3p-paint${m.withdrawn ? ' is-withdrawn' : ''}${m.reducedMotion ? ' is-still' : ''}`} style={{ position: 'absolute', inset: 0, maskImage: mask, WebkitMaskImage: mask, maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }}>
          <img src={m.plate.paint} alt="" draggable={false} style={pos} data-testid={idPrefix ? undefined : 'plate-paint'} />
        </div>
      )}
    </>
  );
}

export function SceneLayersV3({ model, overlay }: { model: LayerModel; overlay?: React.ReactNode }) {
  return (
    <div className="v3p-layers" style={{ width: model.box.w, height: model.box.h }} data-testid="scene-layers">
      <Plates m={model} />
      {model.surfaces.map(s => (
        <div key={s.entity} className={`v3p-surface${model.dimSurfaces ? ' is-dim' : ''}`} style={{ left: s.rect.left, top: s.rect.top, width: s.rect.width, height: s.rect.height }} data-testid={`surface-${s.entity}`}>
          {s.textureSrc && <img src={s.textureSrc} alt="" draggable={false} className="v3p-surface-texture" />}
          <span className="v3p-surface-title" style={{ fontSize: Math.max(6, s.rect.height * 0.1) }} data-testid={`surface-title-${s.entity}`}>
            {s.title}
          </span>
        </div>
      ))}
      {model.items.map(it =>
        it.kind === 'cutout' ? (
          <div key={it.id} className="v3p-cutout" style={{ clipPath: `polygon(${it.polygon.map(p => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})` }} data-testid={`cutout-${it.id}`} aria-hidden="true">
            <Plates m={model} idPrefix={it.id} />
          </div>
        ) : (
          <div key={it.id} className={`v3p-body is-${it.treatment}${model.reducedMotion ? ' is-still' : ''}`} style={{ left: it.box.left, top: it.box.top, width: it.box.width, height: it.box.height }} data-testid={`body-${it.id}`} data-depth={it.depth.toFixed(2)}>
            <Figure spec={it.spec} posture={it.posture} pose={it.pose} facingLeft={it.facingLeft} holding={it.holding} ink={it.treatment === 'ink'} testId={`figure-${it.id}`} label={it.label} />
          </div>
        )
      )}
      {overlay}
    </div>
  );
}
