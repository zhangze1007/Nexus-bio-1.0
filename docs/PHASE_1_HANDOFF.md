# Phase 1 → Phase 1.3 Handoff

**Branch:** `main`
**HEAD at handoff:** `fab511b` — `[phase-1] sharpen cellfree.parameters assumption (rename + tighter statement)`
**Date:** 2026-04-26
**Owner of next step:** Codex (Phase 1.3)

---

## 1. Already Completed

### Files added

| Path | Purpose |
|------|---------|
| [src/types/assumptions.ts](src/types/assumptions.ts) | Schema. Defines four runtime-gating interfaces: `ToolAssumption`, `Evidence`, `ProvenanceEntry`, `AssumptionViolation`. JSDoc on every interface explains design intent. No runtime logic. |
| [src/components/tools/shared/toolAssumptions.ts](src/components/tools/shared/toolAssumptions.ts) | Static registry. 56 assumptions across 16 entries (14 tools + `fbasim-single` + `fbasim-community` sub-tiers). 5 `blocking` total, all on demo-tier entries. |
| [docs/assumption-schema.md](docs/assumption-schema.md) | Schema design notes (713 words). Why these four types, what's deliberately not in scope, differentiation vs. MIRIAM/BioModels/COMBINE/Galaxy. |

### Files modified

None. `toolValidity.ts` was NOT changed in Phase 1 (per strict-rule #2: demo-tier tools stay demo). The legacy `fbasim` entry in `toolAssumptions.ts` was preserved verbatim to avoid breaking any future call site.

### Commits on `main` (in order)

```
94f8c19 [phase-1] add assumption schema types and design notes (task 1.1)
9273e73 [phase-1] add per-tool assumption registry covering all 14 tools (task 1.2)
9965f8e [phase-1] split fbasim into single/community sub-tiers + log known inconsistencies (task 1.2)
fab511b [phase-1] sharpen cellfree.parameters assumption (rename + tighter statement)
```

All four pushed to `origin/main`.

---

## 2. Phase 1.3 Todo (for Codex)

### 2a. Payload bus location

The typed payload bus lives in **`src/store/workbenchPayloads.ts`** (NOT in `src/state/` — there is no `src/state/` directory).

Key definitions:
- **`WorkbenchPayloadBase`** at line 20. Already carries a `validity: PayloadValidity` field. This is the precedent — `provenance` should follow the same pattern.
- 13 tool-specific payloads extend `WorkbenchPayloadBase`:
  `PathDWorkbenchPayload` (24), `FBAWorkbenchPayload` (44), `CETHXWorkbenchPayload` (73), `CatalystWorkbenchPayload` (91), `DynConWorkbenchPayload` (115), `CellFreeWorkbenchPayload` (143), `DBTLWorkbenchPayload` (162), `ProEvolWorkbenchPayload` (183), `GECAIRWorkbenchPayload` (209), `GenMIMWorkbenchPayload` (226), `MultiOWorkbenchPayload` (243), `ScSpatialWorkbenchPayload` (266), `NEXAIWorkbenchPayload` (289).
- **`WorkbenchToolPayloadMap`** at line 303 is the typed bus map.

### 2b. What to add

1. Import `ProvenanceEntry` into `workbenchPayloads.ts` from `../types/assumptions`.
2. Add **`runProvenance?: ProvenanceEntry;`** to `WorkbenchPayloadBase`. Use the field name **`runProvenance`**, NOT `provenance`. See gotcha 3a below — the bare name `provenance` is already taken in `ProEvolWorkbenchPayload`.
3. The field MUST be optional. Existing payloads without the field must still type-check.

### 2c. Helper file

Create **`src/utils/provenance.ts`** with:

```ts
import type { ProvenanceEntry, Evidence } from '../types/assumptions';
import { TOOL_VALIDITY } from '../components/tools/shared/toolValidity';

export function createProvenanceEntry(args: {
  toolId: string;
  inputAssumptions?: string[];
  outputAssumptions?: string[];
  evidence?: Evidence[];
  upstreamProvenance?: string[];
}): ProvenanceEntry {
  // Read validity tier from TOOL_VALIDITY at call time so the snapshot
  // reflects the current tier. Fall back to 'partial' if unknown.
  const tier = TOOL_VALIDITY[args.toolId]?.level ?? 'partial';
  return {
    toolId: args.toolId,
    timestamp: Date.now(),
    inputAssumptions: args.inputAssumptions ?? [],
    outputAssumptions: args.outputAssumptions ?? [],
    evidence: args.evidence ?? [],
    validityTier: tier,
    upstreamProvenance: args.upstreamProvenance ?? [],
  };
}
```

No external dependencies needed.

### 2d. FBAsim write-in path

The FBA solver entry points are in **`src/server/fbaEngine.ts`**:

- `solveAuthorityFBA(request: SingleSpeciesFBARequest)` at line 277 — **single-species path, the safest place to wire provenance** (it's `partial`-tier real LP).
- `solveAuthorityCommunityFBA(request: CommunityFBARequest)` at line 292 — community/two-species path.
- `solveExpandedFBA(request: ExpandedFBARequest)` at line 366.

The HTTP boundary is **`app/api/fba/route.ts`**:
- POST handler at line 24.
- Single-species response at line 60: `NextResponse.json({ ok: true, mode: 'single', result })`.
- Community response at line 49.

**Recommended write site:** in the API route handler, after the solver returns, attach the provenance entry to the response payload. Example for single-species:

```ts
const result = await solveAuthorityFBA(req);
const provenanceEntry = createProvenanceEntry({
  toolId: 'fbasim-single',                       // canonical sub-tier ID
  outputAssumptions: [
    'fbasim-single.steady_state',
    'fbasim-single.biomass_objective',
    'fbasim-single.no_regulation',
    'fbasim-single.simplex_real',
  ],
  evidence: [{
    id: `fba-${Date.now()}`,
    source: 'computation',
    reference: 'two-phase simplex LP on iJO1366Subset',
    confidence: 'high',
  }],
});
return NextResponse.json({ ok: true, mode: 'single', result, provenance: provenanceEntry });
```

The client-side `FBAWorkbenchPayload` builder (find via `grep "FBAWorkbenchPayload" src/`) should then assign the API-returned provenance to its `runProvenance` field.

### 2e. Verification

`npm run build` MUST pass. Run it before AND after the changes.

---

## 3. Known Gotchas

### 3a. Field name collision: `provenance`

**`ProEvolWorkbenchPayload`** (line 195 of `workbenchPayloads.ts`) already has a field named `provenance` typed as a string union: `'simulated' | 'inferred' | 'literature-backed' | 'user-supplied'`. This pre-dates Phase 1.

**Decision recorded here:** add the new field to `WorkbenchPayloadBase` as **`runProvenance: ProvenanceEntry`**, not `provenance`. Do NOT rename the ProEvol field — that is out of Phase-1.3 scope and would touch unknown call sites.

### 3b. fbasim split

The legacy `fbasim` key in `TOOL_ASSUMPTIONS` is kept for backward compat. The canonical sub-tier entries are `fbasim-single` (partial) and `fbasim-community` (demo). Use the **sub-tier IDs** when writing provenance from FBAsim — the legacy `fbasim` IDs should not appear in new provenance writes.

`fbasim-community.community_not_joint_lp` is `blocking`; the legacy `fbasim.community_not_joint_lp` is only `warning`. Sub-tier wins for downstream gating.

### 3c. cellfree assumption — final decision

After auditing `src/services/CellFreeEngine.ts:893–928` and `:942–960`:

- The header docstring cites Noireaux 2003 / Jewett 2004 / Karzbrun 2011 at the *framework* level.
- Per-value `k_tx`, `k_tl`, `k_decay` only have qualitative inline comments (T7 > sigma70 > Ptac, strong/medium/weak RBS) — **no paper-table citation per value**.
- This is closer to "hand-picked plausible magnitudes informed by domain knowledge" than to "literature-fit values".

**Final decision:** assumption ID is **`cellfree.parameters_unsourced`** (not `parameters_curated`), severity is **`blocking`**, statement is "k_tx, k_tl, k_decay reflect qualitative promoter/RBS strength ordering; no per-value paper-table citation."

### 3d. CellFree validity tier vs. code

`toolValidity.ts` says cellfree is `demo` with caption "no live TXTL kinetic model". `CellFreeEngine.ts` actually implements a real ODE. **Tier was NOT touched in Phase 1** (strict-rule #2). The header NOTE block in `toolAssumptions.ts` records this for Phase-2 calibration. Do not adjust the tier in Phase 1.3.

### 3e. Strict rules continue to apply

1. Algorithmic-implementation files must carry `@scientific_provenance` docstring blocks (REFERENCE / NOT_IMPLEMENTED / KNOWN_LIMITATIONS).
2. No demo-tier tool may be promoted to `partial` in this phase, regardless of how clean the changes look.
3. No fabricated DOIs. Unsourced values must be marked `MOCK` or `unsourced` explicitly.

### 3f. Branch hygiene

During Phase 1.2 the working branch silently switched to `feat/assumption-gated-runtime-codex-handoff` mid-session (likely an IDE side-effect). It was fast-forwarded back to `main` before this handoff. Codex should `git branch --show-current` before every commit.

### 3g. Edge case noted but not resolved

`metabolic-eng` payload exists as a UI entry but has no independent payload type — it is a thin wrapper around PathD. Its assumption list (2 entries in `toolAssumptions.ts`) is informational; downstream consumers reading provenance from `metabolic-eng` should fall back to `pathd` provenance if missing.

---

## 4. Recommended First Steps for Codex

In this order:

1. `npm run build` — confirm the ground is stable before any change. If it fails, stop and report; nothing was broken at handoff time.
2. `git log --oneline -6` — confirm HEAD is `fab511b` and the four `[phase-1]` commits are present.
3. `cat docs/assumption-schema.md` — read the design intent first. The "What is deliberately not in this schema" section answers most "why didn't they..." questions.
4. `cat src/types/assumptions.ts` — internalize the four interfaces, especially `ProvenanceEntry`.
5. `cat src/components/tools/shared/toolAssumptions.ts` — skim the registry, paying attention to the header NOTE block and the `fbasim` / `fbasim-single` / `fbasim-community` triple.
6. `grep -n "WorkbenchPayloadBase\|validity:" src/store/workbenchPayloads.ts` — confirm the precedent (`validity` already on base) before adding `runProvenance` the same way.
7. `grep -rn "FBAWorkbenchPayload" src/ app/` — find every site that constructs an FBA payload; only these need to be updated to populate `runProvenance` after the field is added.
8. Build the helper (`src/utils/provenance.ts`) before wiring it anywhere. It has no dependencies on the payload bus, so a build break here is isolated.
9. Add `runProvenance?` to `WorkbenchPayloadBase`. Run `npm run build`.
10. Wire one call site in the FBA path. Run `npm run build` again.
11. Commit with `[phase-1]` prefix per the brief.

---

## Phase-1 exit criteria status at handoff

| Criterion | Status |
|---|---|
| `src/types/assumptions.ts` exists, compiles | DONE (`94f8c19`) |
| `toolAssumptions.ts` covers 14 tools | DONE — actually 16 entries (14 + 2 sub-tier) (`9273e73`, `9965f8e`) |
| Workbench payload base has optional `runProvenance` | **TODO — Phase 1.3** |
| FBAsim writes provenance at least once | **TODO — Phase 1.3** |
| `mockCETHX.ts` has `@scientific_provenance` docstring | **TODO — Phase 1.4** |
| CETHX page has demo banner | **TODO — Phase 1.4** |
| `npm run build` passes | At handoff: passes (no Phase-1 change touched runtime code) |
| All 14 pages render without console error | At handoff: not re-verified this session — Codex should spot-check after wiring 1.3 |
