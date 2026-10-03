import { C, uid, paintLayer, lineLayer } from './kit.mjs';

/**
 * One framed shot: a crop of a world plate, painted only where attention rests.
 *  plate:   { back, mid, fore, lights(state), W, H }
 *  crop:    [x,y,w,h] in plate units  (the camera)
 *  finish:  array of [cx,cy,rx,ry] blobs in plate units (the finished region)
 *  figures: svg strings in plate units (always finished: bodies and carried things never un-paint)
 *  over:    svg strings in plate units drawn above everything (marks, marginalia)
 *  pxOver:  svg in tile pixel units
 */
export function tile({ bare = false, x = 0, y = 0, w, h, plate, state = {}, crop, finish, figures = [], over = [], pxOver = '', paper = C.paper, hard = false, lines = true, dark = 0, marks = true }) {
  const id = uid('t');
  const [cx, cy, cw, ch] = crop;
  const edge = hard ? 'edgeHard' : 'edge';
  const blobs = finish.map((b) => b.length === 5 ? `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="${b[4]}" fill="#fff"/>` : `<ellipse cx="${b[0]}" cy="${b[1]}" rx="${b[2]}" ry="${b[3]}" fill="#fff"/>`).join('');
  const markEl = marks ? `<g font-size="0">${''}</g>` : '';
  void markEl;
  return `<g transform="translate(${x} ${y})">
<clipPath id="${id}c"><rect width="${w}" height="${h}"/></clipPath>
<g clip-path="url(#${id}c)">
  ${bare ? "" : `<rect width="${w}" height="${h}" fill="${paper}"/>`}
  ${bare ? "" : `<rect width="${w}" height="${h}" filter="url(#paperMottle)" opacity=".3"/>`}
  <svg x="0" y="0" width="${w}" height="${h}" viewBox="${cx} ${cy} ${cw} ${ch}" overflow="hidden">
    <mask id="${id}m" maskUnits="userSpaceOnUse" x="${cx - cw}" y="${cy - ch}" width="${cw * 3}" height="${ch * 3}"><g filter="url(#${edge})">${blobs}</g></mask>
    ${lines ? `<g filter="url(#pen)">${lineLayer(plate.back)}${lineLayer(plate.mid)}${plate.extraLines ?? ''}</g>` : ''}
    <g mask="url(#${id}m)">
      <g filter="url(#paint)">${paintLayer(plate.back)}${paintLayer(plate.mid)}</g>
      ${plate.lights(state)}
    </g>
    ${figures.join('')}
    <g mask="url(#${id}m)"><g filter="url(#paint)">${paintLayer(plate.fore(state))}</g></g>
    ${dark ? `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#05070D" opacity="${dark}" mask="url(#${id}m)"/>` : ''}
    ${over.join('')}
  </svg>
  ${bare ? "" : `<rect width="${w}" height="${h}" filter="url(#paperTex)" opacity=".2" style="mix-blend-mode:multiply"/>`}
  ${pxOver}
</g>
${cropMarks(w, h)}
</g>`;
}

function cropMarks(w, h) {
  const m = -9, t = 12;
  const s = `stroke="${C.graphite}" stroke-width="1" stroke-opacity=".55"`;
  return `<g ${s} fill="none"><path d="M${m} ${m + t} V${m} H${m + t}"/><path d="M${w - m - t} ${m} H${w - m} V${m + t}"/><path d="M${w - m} ${h - m - t} V${h - m} H${w - m - t}"/><path d="M${m + t} ${h - m} H${m} V${h - m - t}"/></g>`;
}

// Finished region helper: insets as fractions of the crop; negative = bleeds off the frame.
export function fin(crop, { l = 0.05, t = 0.05, r = 0.05, b = 0.07, rx = 0.08 } = {}) {
  const [cx, cy, cw, ch] = crop;
  const x0 = cx + cw * l, y0 = cy + ch * t, x1 = cx + cw * (1 - r), y1 = cy + ch * (1 - b);
  return [[x0, y0, x1 - x0, y1 - y0, Math.min(cw, ch) * rx]];
}
