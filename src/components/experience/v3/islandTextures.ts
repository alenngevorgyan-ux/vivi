/**
 * Painted-island material, baked once from Design r4's own island recipe (generator/render.py `island` filter:
 * low-frequency fractal displacement + a soft blur) into small raster masks, so every frame only transforms
 * images instead of re-running a full-screen filter.
 *
 * Per variant (stable by island index):
 *   core  — the wash itself: an irregular, slightly soft-edged body;
 *   outer — the thinner wash beyond it (Design's lighter band), with dry-brush breaks at its edge;
 *   rim   — where pigment pools as the wash dries: a dark, broken ring just inside the core's edge.
 *
 * Geometry: the blob's nominal radius is BLOB_R of the SIZE canvas; a texture drawn for an island of radii
 * (rx, ry) is SIZE / BLOB_R / 2 times larger than that ellipse in each direction (see `islandImageBox`).
 */

const SIZE = 512;
const BLOB_R = 150;
export const VARIANTS = 6;

export interface IslandTexture {
  core: string;
  outer: string;
  rim: string;
}

/** The stage box a texture covers for an island ellipse. */
export const islandImageBox = (cx: number, cy: number, rx: number, ry: number) => {
  const k = SIZE / BLOB_R / 2;
  return { x: cx - rx * k, y: cy - ry * k, width: 2 * rx * k, height: 2 * ry * k };
};

function svgFor(kind: 'core' | 'outer' | 'rim', seed: number): string {
  const c = SIZE / 2;
  const r = kind === 'outer' ? BLOB_R * 1.16 : BLOB_R;
  // Design: baseFrequency .012 / scale 80 / blur 2.5 at a ~450 px island in a 1920 frame — rescaled to this blob.
  const fq = (0.012 * 450) / (2 * r);
  const sc = (80 * 2 * r) / 450;
  const fine = kind === 'outer' ? 0.06 : 0.045;
  const shape = `<ellipse cx="${c}" cy="${c}" rx="${r}" ry="${r}" fill="#fff"/>`;
  const displace = `
    <feTurbulence type="fractalNoise" baseFrequency="${fq.toFixed(4)}" numOctaves="4" seed="${seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${sc.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="d0"/>
    <feTurbulence type="fractalNoise" baseFrequency="${fine}" numOctaves="2" seed="${seed + 40}" result="n2"/>
    <feDisplacementMap in="d0" in2="n2" scale="${kind === 'outer' ? 14 : 8}" xChannelSelector="G" yChannelSelector="R" result="d"/>`;
  let body: string;
  if (kind === 'core') body = `${displace}<feGaussianBlur in="d" stdDeviation="2.2"/>`;
  else if (kind === 'outer')
    // dry brush: the thin wash breaks up where the brush ran out
    body = `${displace}
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="${seed + 7}" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.6 -0.9" result="ga"/>
    <feMorphology in="d" operator="erode" radius="10" result="inner"/>
    <feComposite in="d" in2="inner" operator="out" result="edge"/>
    <feComposite in="edge" in2="ga" operator="out" result="edgeBroken"/>
    <feMerge result="m"><feMergeNode in="inner"/><feMergeNode in="edgeBroken"/></feMerge>
    <feGaussianBlur in="m" stdDeviation="1.6"/>`;
  else
    body = `${displace}
    <feMorphology in="d" operator="erode" radius="5" result="e1"/>
    <feComposite in="d" in2="e1" operator="out" result="ring"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="${seed + 3}" result="b"/>
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.34  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 1.8 -0.55" result="ba"/>
    <feComposite in="ba" in2="ring" operator="in" result="broken"/>
    <feGaussianBlur in="broken" stdDeviation="1.4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs><filter id="f" x="0" y="0" width="${SIZE}" height="${SIZE}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${body}</filter></defs>
  <g filter="url(#f)">${kind === 'rim' ? shape.replace('#fff', '#2a241d') : shape}</g></svg>`;
}

async function rasterize(svg: string): Promise<string> {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

let baking: Promise<IslandTexture[]> | null = null;
let baked: IslandTexture[] | null = null;

/** Bake every variant once per page; resolves to the textures (never rejects: a failure keeps vector islands). */
export function bakeIslandTextures(): Promise<IslandTexture[] | null> {
  if (baked) return Promise.resolve(baked);
  if (typeof document === 'undefined') return Promise.resolve(null);
  if (!baking)
    baking = Promise.all(
      Array.from({ length: VARIANTS }, async (_, i) => {
        const seed = 21 + i * 13;
        const [core, outer, rim] = await Promise.all([rasterize(svgFor('core', seed)), rasterize(svgFor('outer', seed + 101)), rasterize(svgFor('rim', seed))]);
        return { core, outer, rim };
      })
    ).then(t => (baked = t));
  return baking.catch(() => null);
}

export const bakedIslandTextures = () => baked;
