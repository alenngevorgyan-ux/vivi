# V3 runtime fixtures (development)

Executable adaptations of the gold specs in `../spec/` through the real V3 Foundation contracts. Full handoff: [`docs/v3/THE_CORRECTION_RUNTIME_HANDOFF.md`](../../../../docs/v3/THE_CORRECTION_RUNTIME_HANDOFF.md).

- `../spec/` is the gold planning source. It is read here, never modified (the test pins its bytes).
- `adaptGoldSpec.ts` and `compileFixturePlan.ts` are generic: no story ids, no branches. Story interpretation is data in the per-story module.
- **Private files:** only `*.reveal.ts` (the author record) and `*.provenance.ts` (the pre-boundary ledger) may import a `*.private.json`. The public module (`theCorrection.ts`), the design slots and `src/components/experience/v3/visualHooks.ts` must not, directly or transitively. The test walks the import graph.
- Geometry is Design r4 (`correction-geo-r4`), compiled by `scripts/build-v3-correction-geometry.ts` into the GENERATED `theCorrection.geometry.ts` (never edit it by hand; `--check` proves it is fresh). `placeholderGeometry.ts` remains only as a swap witness in tests.
- Nothing in the production app imports this directory.
