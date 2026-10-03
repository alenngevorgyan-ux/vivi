import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Mutation check for the B02 geometry contract. Each mutant is one exact textual change to
 * src/engine/v3/geometry/designAdapter.ts or src/engine/v3/contracts/geometry.ts; the pure B02 suites
 * (test-v3-prebuild.ts, test-v3-geometry-compat.ts) must fail on it ("killed"). A mutant that survives is either
 * reported as a gap or justified as equivalent below. Both files are restored in `finally` and compared byte for byte.
 *
 *   node --import tsx scripts/mutate-v3-b02.ts
 */

const ADAPTER = 'src/engine/v3/geometry/designAdapter.ts';
const CONTRACT = 'src/engine/v3/contracts/geometry.ts';
const SUITES = ['scripts/test-v3-prebuild.ts', 'scripts/test-v3-geometry-compat.ts'];

interface Mutant {
  id: string;
  file: string;
  what: string;
  from: string;
  to: string;
  /** Set only with a reason a mutant cannot change behaviour. */
  equivalent?: string;
}

const M: Mutant[] = [
  // ---- 1. interior cameras / camera validity (adapter) -------------------------------------------------------
  { id: 'A1', file: ADAPTER, what: 'reinstate the global "whole floor in front of every camera" invariant', from: "const finiteAll = (...ns: number[]) => ns.every(Number.isFinite);", to: "if (!(k.cam[2] < zMin)) fail(`camera ${k.id}: the floor is not entirely in front of the camera`);\n    const finiteAll = (...ns: number[]) => ns.every(Number.isFinite);" },
  { id: 'A2', file: ADAPTER, what: 'accept non-finite camera coefficients', from: "!finiteAll(...k.cam) ||", to: "false ||" },
  { id: 'A3', file: ADAPTER, what: 'ignore a non-finite principal point', from: "!finiteAll(k.cx, k.hy, k.viewport.width", to: "!finiteAll(k.viewport.width" },
  { id: 'A4', file: ADAPTER, what: 'ignore a non-finite safe region', from: ", k.safe.x, k.safe.y, k.safe.width, k.safe.height)) fail(`camera", to: ")) fail(`camera" },
  { id: 'A5', file: ADAPTER, what: 'accept a malformed camera position', from: "!Array.isArray(k.cam) || k.cam.length !== 3 ||", to: "" },
  { id: 'A6', file: ADAPTER, what: 'clamp nothing → clamp a camera depth to the floor', from: "camY: (100 * (k.cam[2] - zMin)) / d,", to: "camY: Math.min(0, (100 * (k.cam[2] - zMin)) / d)," },
  { id: 'A7', file: ADAPTER, what: 'drop the focal-length check', from: "if (!Number.isFinite(k.f) || k.f === 0) fail", to: "if (false) fail" },
  // ---- 3. seated semantics (adapter) -------------------------------------------------------------------------
  { id: 'S1', file: ADAPTER, what: 'a seated mark need not lie on its seat', from: "if (!pointInPolygon(mk.at, seat.polygon)) fail(", to: "if (false) fail(" },
  { id: 'S2', file: ADAPTER, what: 'a seat that names no obstacle is accepted (first obstacle assumed)', from: "const seat = l.obstacles.find(ob => ob.id === mk.seat) ?? fail(`${l.location}: seated mark ${role} names no obstacle of this location as its seat`);", to: "const seat = l.obstacles.find(ob => ob.id === mk.seat) ?? l.obstacles[0];" },
  { id: 'S3', file: ADAPTER, what: 'a standing mark may name a seat', from: "if (mk.seat !== undefined) fail(`${l.location}: mark ${role} names a seat but is not seated`);", to: "" },
  { id: 'S4', file: ADAPTER, what: 'an unknown posture is accepted', from: "if (mk.posture !== undefined && mk.posture !== 'stand' && mk.posture !== 'seat') fail(", to: "if (false) fail(" },
  { id: 'S5', file: ADAPTER, what: 'seat declarations are not emitted', from: "...(seats.length ? { seats } : {}),", to: "" },
  { id: 'S6', file: ADAPTER, what: 'an empty seat list is always emitted', from: "...(seats.length ? { seats } : {}),", to: "seats," },
  { id: 'S7', file: ADAPTER, what: 'posture is inferred from the mark name instead of read from Design', from: "if (mk.posture !== 'seat') {", to: "if (mk.posture !== 'seat' && !/seat/.test(role)) {" },
  { id: 'S8', file: ADAPTER, what: 'routes are passed through un-normalized', from: "pts.map((q, i) => floor(q, `route ${name}[${i}]`))", to: "pts.map(q => [q[0], q[1]] as [number, number])" },
  // ---- 2. per-scene recipe coverage (contract) ---------------------------------------------------------------
  { id: 'V1', file: CONTRACT, what: 'validate marks against the first camera of the location, not the selected recipe', from: "      framing = cam;\n", to: "      framing = geo.cameras.find(k => k.location === cs.location);\n" },
  { id: 'V2', file: CONTRACT, what: 'skip the safe-region check for scene marks', from: "else if (!inSafe(framing, mk.x, mk.y, 0))", to: "else if (false)" },
  { id: 'V3', file: CONTRACT, what: 'skip the behind-plane check for scene marks', from: "if (!projectPoint(framing, mk.x, mk.y, 0)) c.add(where, 'graph', `mark is at or behind", to: "if (false) c.add(where, 'graph', `mark is at or behind" },
  { id: 'V4', file: CONTRACT, what: 'a camera of another location is accepted as the recipe', from: "else if (cam.location !== cs.location) c.add(", to: "else if (false) c.add(" },
  { id: 'V5', file: CONTRACT, what: 'a missing recipe is accepted', from: "if (!cam) c.add(`${p}.cameraRecipe`, 'unknown_ref', 'no compiled camera for this recipe');", to: "if (!cam) void 0;" },
  { id: 'V6', file: CONTRACT, what: 'anchors need to be visible in EVERY selected camera instead of one', from: "!cams.some(k => inSafe(k, a.root[0], a.root[1], a.height))", to: "!cams.every(k => inSafe(k, a.root[0], a.root[1], a.height))" },
  { id: 'V7', file: CONTRACT, what: 'anchor visibility is not checked', from: "if (cams.length && !cams.some(", to: "if (false && !cams.some(" },
  { id: 'V8', file: CONTRACT, what: 'unselected cameras count as selected (all cameras of the location)', from: "const cams = [...(selected.get(g.location)?.values() ?? [])];", to: "const cams = geo.cameras.filter(k => k.location === g.location);" },
  // ---- 3. seated waiver (contract) ---------------------------------------------------------------------------
  { id: 'W1', file: CONTRACT, what: 'seated footprint need not be inside the declared seat', from: "if (!seat || !pointInPolygon(pt, seat.polygon)) return false;", to: "if (!seat) return false;" },
  { id: 'W2', file: CONTRACT, what: 'seated footprint may overlap other obstacles', from: "return onFloor && !g.obstacles.some(o => o.id !== obstacle && pointInPolygon(pt, o.polygon));", to: "return onFloor;" },
  { id: 'W3', file: CONTRACT, what: 'seated footprint need not be on walkable floor', from: "return onFloor && !g.obstacles.some(o => o.id !== obstacle", to: "return !g.obstacles.some(o => o.id !== obstacle" },
  { id: 'W4', file: CONTRACT, what: 'every mark may rest on the first declared seat (waiver not tied to the role)', from: "const seatOf = (g: LocationGeometry, role: string) => g.seats?.find(q => q.role === role)?.obstacle;", to: "const seatOf = (g: LocationGeometry, _role: string) => g.seats?.[0]?.obstacle;" },
  { id: 'W5', file: CONTRACT, what: 'the entry mark may rest on a seat', from: "...(cs.entryMark ? [['entryMark', cs.entryMark, undefined] as [string, SpatialMark, undefined]] : []),", to: "...(cs.entryMark ? [['entryMark', cs.entryMark, g.seats?.[0]?.obstacle] as [string, SpatialMark, string | undefined]] : []),", },
  { id: 'W6', file: CONTRACT, what: 'a seated role off its seat is judged as a standing mark (ignored when standable)', from: "if (!seatedStandable(g, [mk.x, mk.y], seat)) c.add(where", to: "if (!seatedStandable(g, [mk.x, mk.y], seat) && !standable(g, [mk.x, mk.y])) c.add(where" },
  { id: 'W7', file: CONTRACT, what: 'routes may touch the seat anywhere along them', from: "const onSeat = (i === 0 || i === pts.length - 1) &&", to: "const onSeat = true &&" },
  { id: 'W8', file: CONTRACT, what: 'a route end may be anywhere once the location has any seated mark, not at the seated point', from: "(seated.get(cs.location) ?? []).some(s => same(s.at, pt));", to: "(seated.get(cs.location) ?? []).length > 0;" },
  { id: 'W9', file: CONTRACT, what: 'a route end is waived by a seated mark that is not actually on its seat', from: "if (obstacle && seatedStandable(g, [mk.x, mk.y], obstacle)) seated.set(", to: "if (obstacle) seated.set("},
  { id: 'W10', file: CONTRACT, what: 'a route may start on the seat with no seated mark in the location', from: "const onSeat = (i === 0 || i === pts.length - 1) && (seated.get(cs.location) ?? []).some(", to: "const onSeat = (i === 0 || i === pts.length - 1) && (seated.get(cs.location) ?? [{ at: pt, obstacle: g.seats?.[0]?.obstacle ?? '' }]).some(" },
  { id: 'W12', file: CONTRACT, what: 'standable() waives a seat (collision for everyone else weakens)', from: "return onFloor && !g.obstacles.some(o => pointInPolygon(pt, o.polygon));\n}", to: "return onFloor && !g.obstacles.some(o => !(g.seats ?? []).some(q => q.obstacle === o.id) && pointInPolygon(pt, o.polygon));\n}" },
  // ---- seat declarations, structurally -----------------------------------------------------------------------
  { id: 'R1', file: CONTRACT, what: 'a seat may rest on an obstacle the location lacks', from: "if (ob && !obstacleIds.has(ob)) c.add(", to: "if (false) c.add(" },
  { id: 'R2', file: CONTRACT, what: 'a role may be declared seated twice', from: "if (role && roles.has(role)) c.add(", to: "if (false) c.add(" },
  { id: 'R3', file: CONTRACT, what: 'unknown keys in a seat declaration are accepted', from: "if (!closed(c, q, `${p}.seats[${j}]`, ['role', 'obstacle'])) return;", to: "if (!isRec(q)) return;" },
  { id: 'R4', file: CONTRACT, what: 'a seat list that is not a list is accepted', from: "(Array.isArray(l.seats) ? l.seats : (c.add(`${p}.seats`, 'type', 'expected a list'), [])).forEach(", to: "(Array.isArray(l.seats) ? l.seats : []).forEach(" },
];

const original = new Map<string, string>();
for (const f of [ADAPTER, CONTRACT]) original.set(f, readFileSync(f, 'utf8'));

// The unmutated suites must pass first: a mutant is only "killed" by a failure the original does not have.
for (const suite of SUITES) execFileSync('node', ['--import', 'tsx', suite], { stdio: 'ignore', timeout: 120_000 });

const rows: Array<{ id: string; verdict: string; what: string; by?: string }> = [];
try {
  for (const mu of M) {
    const src = original.get(mu.file)!;
    const hits = src.split(mu.from).length - 1;
    if (hits !== 1) {
      rows.push({ id: mu.id, verdict: `INVALID (pattern found ${hits}×)`, what: mu.what });
      continue;
    }
    writeFileSync(mu.file, src.replace(mu.from, () => mu.to));
    const failing: string[] = [];
    for (const suite of SUITES) {
      try {
        execFileSync('node', ['--import', 'tsx', suite], { stdio: 'ignore', timeout: 120_000 });
      } catch {
        failing.push(suite.replace('scripts/test-v3-', '').replace('.ts', ''));
      }
    }
    const killedBy = failing.join('+');
    writeFileSync(mu.file, src);
    rows.push({ id: mu.id, verdict: killedBy ? 'killed' : mu.equivalent ? 'SURVIVED (equivalent?)' : 'SURVIVED', what: mu.what, ...(killedBy ? { by: killedBy } : {}) });
  }
} finally {
  for (const [f, s] of original) writeFileSync(f, s);
}
for (const [f, s] of original) if (readFileSync(f, 'utf8') !== s) throw new Error(`${f} was not restored`);

for (const r of rows) console.log(`${r.id.padEnd(4)} ${r.verdict.padEnd(24)} ${(r.by ?? '').padEnd(24)} ${r.what}`);
const killed = rows.filter(r => r.verdict === 'killed').length;
console.log(`\n${killed}/${rows.length} mutants killed; ${rows.filter(r => r.verdict.startsWith('SURVIVED')).length} survived; ${rows.filter(r => r.verdict.startsWith('INVALID')).length} invalid`);
process.exitCode = killed === rows.length ? 0 : 1;
