/**
 * The stage's layers, drawn from one Fit. It decides nothing: SceneViewportV3 computes every position from the
 * snapshot, the compiled scene, the runtime geometry and the presented body, and hands them here.
 *
 *   L1 graphite plate · L2 paint plate, masked to DECKLED painted islands (the Remembered Room: paint where
 *   attention rests, graphite elsewhere) · display surfaces (live DOM title) · bodies and occluder cut-outs,
 *   far → near · graphite interaction marks (a drawn loop + italic note) · anchored overlay (controls)
 *
 * Story text is never part of a raster: the title on a display is DOM text placed on the display's projected rect.
 */

import React, { useEffect, useId, useState } from 'react';
import { bakedIslandTextures, bakeIslandTextures, islandImageBox, VARIANTS, type IslandTexture } from './islandTextures';
import { Figure, type FigurePose } from './Figure';
import { PaintedFigure } from './rig/PaintedFigure';
import type { Body, Pose } from './rig/rig';
import type { FigureSpec } from './staging';

export interface IslandPx {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Which baked edge to use (stable per island, so an edge never re-rolls while it moves). */
  seed?: number;
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
  stride?: number;
  breath?: number;
  /** The presented floor position (QA: the world position, independent of where the camera is). */
  floor?: [number, number];
  /** The painted rig (Design r4 construction): body, live pose, scale and the feet's stage point. */
  rig?: { body: Body; pose: Pose; hu: number; coatLag: number; feet: { x: number; y: number }; finish: number; tint?: 'cold' | 'warm'; hero: boolean };
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

/** A graphite interaction mark: faint when merely present, drawn in with its note when the body is at it. */
export interface MarkLayer {
  id: string;
  kind: 'look' | 'door' | 'place';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  label: string;
  near: boolean;
  seen?: boolean;
  /** Where the note sits: left or right of the loop, whichever keeps it on the stage. */
  side: 'left' | 'right';
  keyHint: string;
  /** A door's note stays on screen as a faint exit label, clamped inside the frame. */
  clamp?: { x: number; y: number };
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
  marks?: MarkLayer[];
  reducedMotion: boolean;
  /** The one rust mark: a four-corner bracket closing around the body while an act awaits confirmation. */
  commit?: { left: number; top: number; width: number; height: number };
  /** 0..1: the unremembered room recedes toward paper (decision focus). */
  recede?: number;
  /** The plate's lower edge is in view: let it end in paper. */
  fadeBottom?: boolean;
  /** The plate is narrower than the frame: its sides end in paper too. */
  fadeSides?: boolean;
}

/* ------------------------------------------------------- the deckled edge --- */

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A closed, irregular unit blob: low harmonics for the wash's shape, high ones for the paper's tooth. Baked once. */
function blobPath(seed: number, amp: number, n = 140): string {
  const rnd = mulberry32(seed);
  const harm = Array.from({ length: 9 }, (_, i) => ({ k: 2 + i * 2 + Math.floor(rnd() * 2), a: (amp * (0.9 / (i + 1))) * (0.55 + rnd() * 0.7), ph: rnd() * Math.PI * 2 }));
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let r = 1;
    for (const h of harm) r += h.a * Math.sin(h.k * t + h.ph);
    r += (rnd() - 0.5) * amp * 0.22;
    pts.push(`${(Math.cos(t) * r).toFixed(4)} ${(Math.sin(t) * r).toFixed(4)}`);
  }
  return `M${pts.join('L')}Z`;
}

const EDGES = Array.from({ length: 6 }, (_, k) => ({
  outer: blobPath(101 + k * 17, 0.11),
  mid: blobPath(211 + k * 13, 0.09),
  inner: blobPath(307 + k * 11, 0.07),
}));

/** A hand-drawn graphite loop in pixels: one stroke that overshoots its start, as a pencil does. Baked jitter. */
const LOOP_JITTER = (() => {
  const rnd = mulberry32(977);
  return Array.from({ length: 69 }, () => rnd() - 0.5);
})();
function loopPath(rx: number, ry: number): string {
  const n = 60;
  const pts: string[] = [];
  for (let i = 0; i <= n + 8; i++) {
    const t = (i / n) * Math.PI * 2 - 0.4;
    const r = 1 + Math.sin(t * 3 + 1.3) * 0.035 + LOOP_JITTER[i] * 0.02 + (i > n ? (i - n) * 0.012 : 0);
    pts.push(`${(Math.cos(t) * r * rx).toFixed(1)} ${(Math.sin(t) * r * ry * 0.98).toFixed(1)}`);
  }
  return `M${pts.join('L')}`;
}

/** Figure scale in ~3% steps: small camera moves rescale the drawn figure with CSS instead of redrawing it. */
const quantHu = (hu: number) => Math.pow(2, Math.round(Math.log2(Math.max(1, hu)) * 24) / 24);

function useIslandTextures(): IslandTexture[] | null {
  const [t, setT] = useState<IslandTexture[] | null>(() => bakedIslandTextures());
  useEffect(() => {
    if (t) return;
    let live = true;
    void bakeIslandTextures().then(x => live && x && setT(x));
    return () => {
      live = false;
    };
  }, [t]);
  return t;
}

function Plates({ m, maskId, testIds, tex }: { m: LayerModel; maskId: string; testIds: boolean; tex: IslandTexture[] | null }) {
  const p = m.plate;
  const box = (e: IslandPx) => islandImageBox(e.cx, e.cy, Math.max(1, e.rx), Math.max(1, e.ry));
  return (
    <svg
      className="v3p-plates"
      width={m.box.w}
      height={m.box.h}
      aria-hidden="true"
      style={(() => {
        if (!m.fadeBottom && !m.fadeSides) return undefined;
        const layers = [`linear-gradient(to bottom, #000 ${p.top + p.height - 90}px, transparent ${p.top + p.height - 6}px)`];
        if (m.fadeSides) layers.push(`linear-gradient(to right, transparent ${p.left + 4}px, #000 ${p.left + 48}px, #000 ${p.left + p.width - 48}px, transparent ${p.left + p.width - 4}px)`);
        const mask = layers.join(', ');
        return { maskImage: mask, WebkitMaskImage: mask, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' } as React.CSSProperties;
      })()}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={m.box.w} height={m.box.h}>
          <rect x={0} y={0} width={m.box.w} height={m.box.h} fill="#000" />
          {tex
            ? m.islands.map((e, i) => {
                const t = tex[(e.seed ?? i) % VARIANTS];
                const bx = box(e);
                return (
                  <g key={i}>
                    <image href={t.outer} {...bx} preserveAspectRatio="none" opacity={0.46} />
                    <image href={t.core} {...bx} preserveAspectRatio="none" />
                  </g>
                );
              })
            : m.islands.map((e, i) => {
            const edge = EDGES[(e.seed ?? i) % EDGES.length];
            return (
              <g key={i} transform={`translate(${e.cx.toFixed(1)} ${e.cy.toFixed(1)}) scale(${Math.max(1, e.rx).toFixed(1)} ${Math.max(1, e.ry).toFixed(1)})`}>
                <path d={edge.outer} fill="#fff" opacity={0.3} transform="scale(1.06)" />
                <path d={edge.mid} fill="#fff" opacity={0.55} transform="scale(0.96)" />
                <path d={edge.inner} fill="#fff" transform="scale(0.86)" />
              </g>
            );
          })}
        </mask>
      </defs>
      {p.graphite && <image href={p.graphite} x={p.left} y={p.top} width={p.width} height={p.height} preserveAspectRatio="none" opacity={1 - 0.38 * (m.recede ?? 0)} className="v3p-graphite" data-testid={testIds ? 'plate-graphite' : undefined} />}
      {p.paint && (
        <g className={`v3p-paint${m.withdrawn ? ' is-withdrawn' : ''}${m.reducedMotion ? ' is-still' : ''}`} mask={`url(#${maskId})`}>
          <image href={p.paint} x={p.left} y={p.top} width={p.width} height={p.height} preserveAspectRatio="none" data-testid={testIds ? 'plate-paint' : undefined} />
          {/* The wet edge: pigment pools where the wash stops. */}
          {tex && m.islands.map((e, i) => <image key={`r${i}`} href={tex[(e.seed ?? i) % VARIANTS].rim} {...box(e)} preserveAspectRatio="none" opacity={0.38} style={{ mixBlendMode: 'multiply' }} />)}
          {!tex && m.islands.map((e, i) => (
            <path
              key={i}
              d={EDGES[(e.seed ?? i) % EDGES.length].inner}
              transform={`translate(${e.cx.toFixed(1)} ${e.cy.toFixed(1)}) scale(${Math.max(1, e.rx * 0.86).toFixed(1)} ${Math.max(1, e.ry * 0.86).toFixed(1)})`}
              fill="none"
              stroke="#2a241d"
              strokeOpacity={0.16}
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      )}
    </svg>
  );
}

function Mark({ k }: { k: MarkLayer }) {
  const noteStyle: React.CSSProperties = k.clamp
    ? { left: k.clamp.x, top: k.clamp.y, transform: k.side === 'left' ? 'translate(-100%, -50%)' : 'translate(0, -50%)' }
    : k.side === 'right'
      ? { left: k.cx + k.rx + 10, top: k.cy - k.ry * 0.6 }
      : { left: k.cx - k.rx - 10, top: k.cy - k.ry * 0.6, transform: 'translateX(-100%)' };
  const showNote = k.near || k.kind === 'door';
  return (
    <>
      {k.kind !== 'door' && <svg className={`v3p-mark is-${k.kind}${k.near ? ' is-near' : ''}${k.seen ? ' is-seen' : ''}`} style={{ left: k.cx - k.rx - 6, top: k.cy - k.ry - 6 }} width={k.rx * 2 + 12} height={k.ry * 2 + 12} aria-hidden="true">
        <g transform={`translate(${k.rx + 6} ${k.ry + 6})`}>
          <path key={k.near ? 'n' : 'f'} d={loopPath(k.rx, k.ry)} pathLength={1} />
        </g>
      </svg>}
      {showNote && (
        <div className={`v3p-note is-${k.side} is-${k.kind}${k.near ? ' is-near' : ' is-far'}`} style={noteStyle} aria-hidden="true" data-testid={`note-${k.id}`}>
          {k.kind === 'door' && <span className="v3p-note-arrow">{k.side === 'left' ? '→' : '←'}</span>}
          <span className="v3p-note-text">{k.label}</span>
          {k.near && <kbd className="v3p-key">{k.keyHint}</kbd>}
        </div>
      )}
    </>
  );
}

export function SceneLayersV3({ model, overlay }: { model: LayerModel; overlay?: React.ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tex = useIslandTextures();
  return (
    <div className="v3p-layers" style={{ width: model.box.w, height: model.box.h }} data-testid="scene-layers">
      <Plates m={model} maskId={`isl-${uid}`} testIds tex={tex} />
      {model.surfaces.map(s => (
        <div key={s.entity} className={`v3p-surface${model.dimSurfaces ? ' is-dim' : ''}`} style={{ left: s.rect.left, top: s.rect.top, width: s.rect.width, height: s.rect.height }} data-testid={`surface-${s.entity}`}>
          {s.textureSrc && <img src={s.textureSrc} alt="" draggable={false} className="v3p-surface-texture" />}
          <span className="v3p-surface-title" style={{ fontSize: Math.max(6, s.rect.height * 0.1) }} data-testid={`surface-title-${s.entity}`}>
            {s.title}
          </span>
        </div>
      ))}
      {model.marks?.filter(k => !k.near).map(k => <Mark key={k.id} k={k} />)}
      {model.items.map(it =>
        it.kind === 'cutout' ? (
          <div key={it.id} className="v3p-cutout" style={{ clipPath: `polygon(${it.polygon.map(p => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})` }} data-testid={`cutout-${it.id}`} aria-hidden="true">
            <Plates m={model} maskId={`isl-${uid}-${it.id}`} testIds={false} tex={tex} />
          </div>
        ) : (
          <div key={it.id} className={`v3p-body is-${it.treatment}${model.reducedMotion ? ' is-still' : ''}${it.rig ? ' is-rig' : ''}`} style={it.rig ? { left: it.rig.feet.x, top: it.rig.feet.y, width: 0, height: 0 } : { left: it.box.left, top: it.box.top, width: it.box.width, height: it.box.height }} data-testid={`body-${it.id}`} data-depth={it.depth.toFixed(2)} data-pose={it.pose} data-floor={it.floor ? `${it.floor[0].toFixed(3)},${it.floor[1].toFixed(3)}` : undefined}>
            {it.rig ? (
              <div className="v3p-rig-scale" style={{ transform: `scale(${(it.rig.hu / quantHu(it.rig.hu)).toFixed(4)})` }}>
              <PaintedFigure body={it.rig.body} pose={it.rig.pose} hu={quantHu(it.rig.hu)} hero={it.rig.hero} finish={it.rig.finish} ink={it.treatment === 'ink'} tint={it.rig.tint} coatLag={it.rig.coatLag} prop={it.holding} contact={it.treatment !== 'through_glass'} testId={`figure-${it.id}`} label={it.label} dataPose={it.pose} dataPosture={it.posture} />
              </div>
            ) : (
              <Figure spec={it.spec} posture={it.posture} pose={it.pose} facingLeft={it.facingLeft} holding={it.holding} ink={it.treatment === 'ink'} testId={`figure-${it.id}`} label={it.label} stride={it.stride} breath={it.breath} />
            )}
          </div>
        )
      )}
      {model.marks?.filter(k => k.near).map(k => <Mark key={k.id} k={k} />)}
      {model.commit && (
        <svg className="v3p-commit" style={{ left: model.commit.left, top: model.commit.top }} width={model.commit.width} height={model.commit.height} aria-hidden="true" data-testid="commit-bracket">
          {(() => {
            const { width: w, height: h } = model.commit!;
            const a = Math.min(26, w * 0.28);
            return <path d={`M0,${a} V0 H${a} M${w - a},0 H${w} V${a} M${w},${h - a} V${h} H${w - a} M${a},${h} H0 V${h - a}`} />;
          })()}
        </svg>
      )}
      {overlay}
    </div>
  );
}
