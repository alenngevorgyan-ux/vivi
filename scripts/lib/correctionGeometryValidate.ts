/**
 * Validate THE CORRECTION's compiled geometry with the real runtime validators: the resource on its own, each
 * variant's manifest against it, and every framing a viewport can select (staging probes). Shared by the build
 * script and the tests, so a committed module that passes here is exactly what the player loads.
 */

import { validateGeometryForManifest, validateRuntimeGeometry } from '../../src/engine/v3/contracts/geometry.ts';
import { validateManifest } from '../../src/engine/v3/contracts/validate.ts';
import { validateStaging } from '../../src/components/experience/v3/staging.ts';
import { correctionFramingShows, PINNED } from './correctionGeometryBuild.ts';

export async function validateCorrectionGeometry(): Promise<string[]> {
  // Imported late: the build writes the module first.
  const g = await import("../../src/data/experienceV3Fixtures/runtime/theCorrection.geometry.ts");
  const { correctionManifest, CORRECTION_VARIANTS } = await import('../../src/data/experienceV3Fixtures/runtime/theCorrection.ts');
  const out: string[] = [];
  for (const v of CORRECTION_VARIANTS) {
    const geo = g.CORRECTION_RUNTIME_GEOMETRY[v];
    out.push(...validateRuntimeGeometry(geo).issues.map(i => `${v} geometry ${i.path}: ${i.message}`));
    if (geo.provenance.sourceHash !== PINNED.source.sha256 || geo.provenance.sourceRevision !== PINNED.source.revision) out.push(`${v} geometry provenance is not the pinned Design source`);
    const m = correctionManifest(v);
    const mv = validateManifest(m, { profile: 'launch' });
    out.push(...mv.issues.map(i => `${v} manifest ${i.path}: ${i.message}`));
    out.push(...validateGeometryForManifest(geo, m).issues.map(i => `${v} ${i.path}: ${i.message}`));
    out.push(...validateStaging(g.CORRECTION_STAGING[v], geo, m, correctionFramingShows).map(i => `${v} staging ${i.path}: ${i.message}`));
  }
  return out;
}
