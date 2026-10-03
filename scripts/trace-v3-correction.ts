/**
 * Dev-only engineering trace of THE CORRECTION through the real V3 controller.
 *
 *   npm run trace:v3-correction                          # rich, correct_public, table
 *   npm run trace:v3-correction -- --variant compressed --option pass_question
 *   npm run trace:v3-correction -- --visits 2 --summary --title --position near --json
 *
 * Shows scene, location, arc, new facts, entity owners, seen observations,
 * availability, decision, phase and boundary for every event the controller
 * processed (player and host). It never prints reveal text: after release it
 * reports only which record fields arrived. Not end-user UI.
 */

import { CORRECTION_VARIANTS, type CorrectionVariant } from '../src/data/experienceV3Fixtures/runtime/theCorrection.ts';
import { CORRECTION_OPTIONS, canonicalRun, type CorrectionOption } from './lib/correctionWalk.ts';
import type { TraceRow } from './lib/v3HeadlessHost.ts';

export function correctionTrace(variant: CorrectionVariant, option: CorrectionOption, o: Parameters<typeof canonicalRun>[2] = {}): TraceRow[] {
  return canonicalRun(variant, option, o).rows;
}

function table(rows: TraceRow[]): string {
  const out: string[] = [];
  let last = '';
  for (const r of rows) {
    const where = `${r.scene} @ ${r.location} (arc ${r.arc})`;
    if (where !== last) out.push(`\n── ${where}`);
    last = where;
    const facts = r.newFacts.length ? ` +facts[${r.newFacts.join(',')}]` : '';
    out.push(`${String(r.i).padStart(3)} ${r.by === 'host' ? '  host' : 'player'}  ${r.event.padEnd(34)} ${r.result.padEnd(10)} ${r.phase.padEnd(15)}${facts}`);
    out.push(
      `      facts=${r.facts} seen=[${r.seenObservations.join(',')}] doors=[${r.available.portals.join(',')}] obs=[${r.available.observations.join(',')}] acts=[${r.available.actions.join(',')}] prep=[${r.available.preparations.join(',')}] advance=${r.available.canAdvance} decision=${r.decision} boundary=${r.locked ? 'locked' : 'open'} reveal=${r.reveal}`
    );
    out.push(`      entities ${Object.entries(r.entities).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  return out.join('\n');
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('trace-v3-correction.ts');
if (isMain) {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const variant = (arg('variant') ?? 'rich') as CorrectionVariant;
  const option = (arg('option') ?? 'correct_public') as CorrectionOption;
  if (!CORRECTION_VARIANTS.includes(variant)) throw new Error(`--variant must be one of ${CORRECTION_VARIANTS.join(', ')}`);
  if (!CORRECTION_OPTIONS.includes(option)) throw new Error(`--option must be one of ${CORRECTION_OPTIONS.join(', ')}`);
  const position = arg('position') as 'seat' | 'near' | undefined;
  const rows = correctionTrace(variant, option, {
    roomVisits: Number(arg('visits') ?? (variant === 'rich' ? 1 : 0)),
    observeTitle: args.includes('--title'),
    observeSummary: args.includes('--summary'),
    position: position ?? 'none',
    cancelFirst: args.includes('--cancel'),
    skip: args.includes('--skip'),
  });
  if (args.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    console.log(`THE CORRECTION · ${variant} · ${option} · engineering trace (no reveal text)`);
    console.log(table(rows));
  }
}
