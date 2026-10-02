/**
 * Re-render reports/openrouter-model-bakeoff.md from saved raw results
 * without calling any model:
 *
 *   npm run report:models [-- --in reports/data/openrouter-bakeoff.json --out reports/openrouter-model-bakeoff.md]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { summarise, renderConsole, renderMarkdown, type BakeoffData } from './lib/bakeoffSummary.ts';

const argv = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const data = JSON.parse(readFileSync(opt('in', 'reports/data/openrouter-bakeoff.json'), 'utf8')) as BakeoffData;
const summary = summarise(data);
console.log(renderConsole(data, summary));
const out = opt('out', 'reports/openrouter-model-bakeoff.md');
writeFileSync(out, renderMarkdown(data, summary));
console.log(`\nReport written to ${out}`);
