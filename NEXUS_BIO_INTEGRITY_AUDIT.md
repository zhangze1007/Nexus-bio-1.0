# Nexus-Bio — Integrity & Architecture Audit + Execution Plan

**Audit date:** 2026-07-01
**Commit audited:** `5ca88bb` (2026-06-29)
**Scope:** Logic bugs, fabricated science, architectural imbalance across the 14-tool platform.
**NOT in scope of this doc:** "is the algorithm good enough / is there enough data." This is strictly about **what is currently WRONG, faked, decoy'd, or structurally broken.**

---

## 0. How to use this document (READ FIRST — anti-fabrication protocol)

This plan is written to be handed directly to Claude Code. There is a documented history in this project of Claude Code reporting fixes that were never actually implemented (signature changed, comment added, logic untouched — see the `findAB` case in T0-3 below, which is a live example of exactly this).

**Therefore every task below has a `VERIFY` block. A task is NOT done until its VERIFY assertion passes.** The VERIFY steps are designed so they CANNOT be satisfied by a fake fix:

- Rule 1 — **No self-report.** Do not write "✅ fixed" in a summary. Run the VERIFY command/test and paste the actual output.
- Rule 2 — **Ground truth, not internal consistency.** A passing unit test that the same commit wrote does not prove correctness. Where a VERIFY calls for comparison to an external reference (COBRApy, eQuilibrator, published supp data), that comparison is the proof, not a green Jest run.
- Rule 3 — **A decoy is worse than a stub.** If a function accepts parameters and ignores them (see `findAB`), the fix must make the output *change* when the input changes. Several VERIFY blocks assert exactly this.

Work the tiers in order. Do **not** start Tier 3 (architecture) before Tier 0 (credibility bombs) is closed.

---

## 1. Executive summary — is the foundation broken?

**No. The foundation is not broken. Do not do a big-bang rewrite.** Verified state:

- `workbenchStore` (235 LOC) is referenced by **49 files** and is the real, working data backbone.
- The provenance / validity-tier layer is genuinely pervasive and is the platform's real asset — keep it.
- What actually exists is three *localized* problems, in priority order:
  1. **A cluster of algorithm-integrity fabrications** (Tier 0/1). These are existential because they are *credibility* failures, not build failures. One reviewer opening `rfdiffusion.ts` ends the platform's scientific credibility. Fix first.
  2. **A half-finished data-layer migration** (Tier 3). The new `artifactStore` + `toolDataContract` layer is used by **only 2 components** while 49 use the old store. This is *debt/confusion*, not *failure*. Resolve by direction-setting, not rewrite.
  3. **Two fully dead ML modules** (Tier 3). ~100KB of ML code imported by **zero** non-test files, plus an ONNX serving layer with no shipped weights. Delete or wire, don't leave dangling.

**Bottom line:** optimizing is NOT useless. But optimizing *algorithms that lie* is worse than useless — a lying prediction tool sends a researcher into the wrong wet-lab experiment. So integrity (Tier 0/1) is the precondition for everything else.

---

## TIER 0 — CREDIBILITY BOMBS (fix before anything else)

These are cases where a prestigious real citation or an elaborate "solved" appearance is attached to code that does none of what it claims. Each one, seen by a knowledgeable reviewer, discredits the whole platform.

### T0-1 · `src/server/rfdiffusion.ts` — citation laundering (Watson 2023 Nature over `Math.random()`)

**What it claims (file header + `@scientific_provenance`):**
- `ALGORITHM: Denoising diffusion probabilistic model (DDPM) for protein structures`
- `ARCHITECTURE: Fine-tuned RoseTTAFold`
- `TRAINING: PDB structures` · `VALIDATION: Experimental validation (Watson et al. 2023)`
- Cites: Watson JL et al., *Nature* 2023;620:1089-1100.

**What it actually does:**
- `line 175`: `const residueConfidence = sequence.split("").map(() => confidence + (Math.random() - 0.5) * 0.1);` — per-residue confidence is pure noise.
- `line 392`: weighted-random draw for sequence generation. There is no diffusion model, no RoseTTAFold, no learned weights.

**Why it matters:** This is the single highest-risk file in the repo. It is not "an unfinished feature" — it is a fabricated provenance claim. It must be defused *today*.

**FIX (choose ONE path — do not leave it as-is):**
- **Path A (recommended, honest relabel):**
  1. Strip the `@scientific_provenance` block and the Watson 2023 citation from the header. Replace with an honest description: *"Heuristic backbone/sequence generator for UI prototyping. NOT RFdiffusion. Does not implement a diffusion model."*
  2. Set the tool's validity tier to **`demo`** (not `real`, not `partial`) in `src/config/toolValidity.ts`.
  3. Rename any user-facing label from "RFdiffusion" to something that does not claim the method (e.g. "Backbone Sketch (heuristic)").
  4. Replace `residueConfidence = Math.random()...` with a deterministic, clearly-heuristic proxy (e.g. derived from a seeded position/hydrophobicity heuristic) OR remove the per-residue confidence field entirely rather than fabricate it.
- **Path B (do it for real):** wire to a real backend — NVIDIA Build hosts protein models (ESM/BioNeMo family); or call a hosted RFdiffusion. Only then may the citation stay. This is a multi-day task; **do Path A now regardless**, and upgrade to B later if the tool survives customer validation.

**VERIFY:**
```
grep -n "Watson\|RFdiffusion\|DDPM\|RoseTTAFold" src/server/rfdiffusion.ts
```
Must return **nothing** unless a real model call now exists in the same file. Then:
```
grep -n "Math.random" src/server/rfdiffusion.ts
```
`residueConfidence` line must be gone. Then confirm the tier string is literally `"demo"` in `toolValidity.ts` for this tool.

---

### T0-2 · `src/server/syntheticGenomicsEngine.ts` — SCRaMbLE fitness is fabricated (Richardson 2017 Science)

**What it claims:** header cites Richardson et al. (2017) *Science* 355:1040-1044 (Sc2.0 / SCRaMbLE).

**What it actually does (`lines 283-288`):**
```ts
const fitnessEffect =
  type === "deletion"   ? -0.5 - Math.random() * 0.5
  : type === "inversion" ? -0.1 + Math.random() * 0.2
  :                        -0.2 + Math.random() * 0.4;
```
Fitness effect of a genome rearrangement is drawn from a fixed random range *by event type only*. It ignores **which genes are in the affected region** — the one thing that actually determines fitness. A deletion spanning an essential gene should be lethal; a deletion in a redundant region should be near-neutral. Current code cannot tell these apart.

**Why it matters:** This is the same disease as T0-1 (real citation, random output) and it is in the DBTL-adjacent path where a wrong fitness prediction has real downstream cost.

**FIX:**
1. The engine already knows the rearranged region (`region1`/`region2`, loxP coordinates). Map the affected region to the genes/reactions it contains.
2. Replace the random draw with an **essentiality-based** fitness effect:
   - If a gene-essentiality annotation is available for the chassis, use it (essential → strong negative; non-essential → mild).
   - Better: run single-reaction / single-gene deletion FBA (you already have `fbaEngine.ts`) on the affected reactions and derive `fitnessEffect` from the predicted growth-rate ratio (`Δgrowth / wildtype_growth`).
3. Keep event *occurrence* stochastic (that part is biologically fine) but **seed it** (see Tier 2) so a run is reproducible. Randomness is allowed for *which* event fires; it is NOT allowed for *how bad* the event is.

**VERIFY:** Add a test: construct a region containing a known-essential reaction and a region containing a known-redundant one; assert the essential-region deletion yields a *more negative* `fitnessEffect` than the redundant one, across a fixed seed. If `fitnessEffect` does not depend on region content, the fix is fake.

---

### T0-3 · `src/server/umapEngine.ts` — `findAB` is a DECOY (accepts params, ignores them)

**This is the live example of the fake-fix pattern.** Someone (likely a prior Claude Code session) "fixed" the old hardcode by changing the signature and adding a paragraph of solver comments — but the body still returns constants.

**Current body (`lines 333-346`):**
```ts
function findAB(minDist: number, spread: number): [number, number] {
  // ...long comment claiming to solve w(minDist)=1, w(spread)=0.1...
  const a = 1.929; // Fixed for standard UMAP
  const b = 0.7915; // Fixed for standard UMAP
  return [a, b];
}
```
`minDist` and `spread` are threaded all the way through (`line 253: const [a, b] = findAB(minDist, spread)`) but have **zero effect** on the embedding. Changing `minDist` from 0.1 to 0.5 produces an identical layout. The elaborate comment makes it *look* solved, which is worse than an honest `// TODO`.

**FIX:** Implement the actual fit. UMAP derives `a, b` by least-squares fitting the smooth curve `w(d) = 1 / (1 + a * d^(2b))` to the piecewise target (`w=1` for `d<minDist`, exponential decay with scale `spread` beyond). Port the standard routine (curve fit over a sampled `d` grid, e.g. Levenberg–Marquardt or a small Gauss–Newton loop). Reference: McInnes et al. (2018), UMAP `find_ab_params`.

**VERIFY (anti-decoy):** Add a test asserting the function is actually sensitive to its inputs:
```ts
const [a1, b1] = findAB(0.1, 1.0);
const [a2, b2] = findAB(0.5, 1.0);
expect(a1).not.toBeCloseTo(a2);   // MUST differ — if equal, fix is fake
```
Also assert `findAB(0.1, 1.0)` returns approximately the canonical `a≈1.577, b≈0.895` (the value the doc-comment itself cites at line 253/329) — note the current hardcoded `1.929/0.7915` doesn't even match the comment's own stated answer, another tell.

---

## TIER 1 — FABRICATED NUMBERS / NON-REPRODUCIBLE OUTPUT

Not citation laundering, but each emits numbers that look like analysis and aren't, or that change every run. Users can't tell.

### T1-1 · `src/server/crisprEditingEngine.ts` (`line 403`) — bystander editing efficiency is random

```ts
const bystanderEff = Math.max(0.05, efficiency * (0.5 + 0.3 * Math.random()));
```
Real base-editor bystander activity depends on the **position within the editing window** (e.g. ABE peak activity ~positions 4–8, protospacer-relative) and local sequence context — not a random 50–80% fraction of the on-target rate.

**FIX:** Replace with a position-weighted activity profile: model bystander efficiency as a function of the base's offset inside the editing window (a per-position weight vector for the editor type, ABE8e / CGBE), optionally scaled by nearest-neighbor context. Seed any residual stochasticity.

**VERIFY:** Two bystander bases at different window positions must yield *different, position-ordered* efficiencies deterministically. Assert `eff(pos=5) > eff(pos=1)` for ABE8e under a fixed seed.

### T1-2 · `src/server/regulatoryDesignEngine.ts` (`designPromoter`, `lines 108-118`) — "design" is random-generate-then-score

- `-35`/`-10` boxes are consensus with random mismatches at a strength-dependent rate; **spacer is fully random ATCG** (`line 110`); result changes every call and isn't guaranteed to hit `targetStrength` (it generates, then scores whatever came out).

**FIX (pick scope):**
- Minimum: **seed** it (reproducible) and set validity tier to `partial`; rename UI from "design promoter of strength X" to "sample a promoter candidate."
- Better: make it actually targeted — iterate/optimize toward `targetStrength` (rejection-sample or hill-climb until `scorePromoter(seq) ≈ targetStrength ± tol`), and stop claiming exact strength control if you can't hit it.

**VERIFY:** Under a fixed seed, `designPromoter(0.8)` returns the same sequence twice, and `scorePromoter(result)` is within tolerance of `0.8`. If it can't hit target, the UI copy must not claim it does.

### T1-3 · `src/server/bioreactorAnalyticsEngine.ts` (`line 194`) — PCA power-iteration random init, unseeded

```ts
let vec = new Array(p).fill(0).map(() => Math.random());
```
Power iteration itself is fine, but random unseeded init means the principal components (and any sign/order) can vary run-to-run. `line 566` bootstrap resampling is also unseeded.

**FIX:** Seed the init via `SeededRNG` (already in repo, used by `scVAEEngine`). Deterministic init (e.g. first standard basis vector, or seeded) + fixed convergence tolerance. Seed the bootstrap too.

**VERIFY:** Run PCA twice on the same matrix; assert identical eigenvectors (up to fixed sign convention). Cross-check the top PC against a reference (e.g. `numpy.linalg.svd` on a small fixed matrix) in `reference_impl_py/`.

### T1-4 · `src/server/closedLoopDBTLEngine.ts` (`lines 318, 322, 425`) — Latin Hypercube Sampling + shuffle unseeded

The GP/Bayesian-opt core is real; the problem is the **sampling** that feeds it is non-reproducible: LHS jitter `(i + Math.random())/nSamples` (318), Fisher–Yates shuffle (322), random candidate init (425). Two identical DBTL requests yield different suggested experiments.

**FIX:** Thread a seed through the whole sampler (LHS jitter, shuffle, candidate init). `SeededRNG`.

**VERIFY:** Same inputs + same seed → byte-identical suggested next experiments. Assert in a test.

### T1-5 · `src/services/esm3Client.ts` + `app/api/esm3/route.ts` — heuristic fallback must be labeled to the user

Architecture here is **honest by design** (cascade: real ESM-3 Python backend → ESM Atlas → local heuristic, and the route returns a `source` field). The risk is only if the heuristic fallback's fabricated scores reach the UI *without the `source` label*:
```ts
const foldability = Math.min(1, 0.4 + 0.3 * hydrophobicFraction + 0.1 * Math.random());
const functionConfidence = Math.min(1, 0.2 + 0.2 * (biasSet.length / 20) + 0.1 * Math.random());
```
These are `constant + noise`, not model outputs.

**FIX:** No need to remove the fallback — just guarantee the `source` (`esm3-backend` vs `esm-atlas` vs `heuristic-fallback`) is surfaced in the UI, and when `source === heuristic-fallback`, the `foldability`/`functionConfidence` are shown as "heuristic estimate," not model confidence. Seed the noise.

**VERIFY:** Force the fallback path (unset backend env); confirm the UI badge/state shows the heuristic source and does not present the numbers as ESM-3 confidence.

---

## TIER 2 — REPRODUCIBILITY (correct algorithms, but unseeded)

These are **legitimate stochastic methods**. The algorithm is right; it just needs a seed so scientific results are reproducible. Lower priority than T0/T1 but important for a tool whose value prop is trustworthy prediction. Thread a single `seed` param (default fixed) through each:

- `src/server/digitalTwinEngine.ts` (577-578) — Box–Muller process noise. OK, seed it.
- `src/server/mfa13CEngine.ts` (595-596) — Box–Muller for MFA confidence intervals. OK, seed it (unreproducible CIs are a real reporting problem).
- `src/services/fba/fluxSampling.ts` (196-197, 453) — ACHR / hit-and-run flux sampling. Randomness *is* the method; seed it.
- `src/services/protein/mdIntegrator.ts` (121-122) — Langevin/MD Gaussian. OK, seed it.
- `src/services/fba/fbaEnsemble.ts` (129) — ensemble sampling. Seed it.

**VERIFY (all):** same input + same seed → identical output; different seed → different output. One parametrized test can cover the set.

### ⚠️ DO-NOT-TOUCH (verified correct — flagging these as bugs would be a NEW error)

- `src/server/digitalCellEngine.ts` (`line 5195`) `p *= Math.random()` — this is **Knuth's Poisson sampler**, textbook-correct. It is *supposed* to use `Math.random()` in that loop. Only change: optionally accept a seeded RNG for reproducibility. **Do not "fix" it as if it were fake.**
- `src/services/ProEvolCampaignEngine.ts` (`line 2062`) `Math.random(); // OK for design diversity` — legitimate diversity injection. Seed if you want reproducibility; do not treat as fabrication.
- All `Math.random().toString(36)` **ID generators** (AxonOrchestrator, axonExecutionLog, n8nClient, zapierClient, inventoryImport, toolCaller, conversationManager, featureFlags, axonPlanner, axonDAGPlanner, modelTraining id, accountLockout) — fine. Do not touch.

---

## TIER 3 — ARCHITECTURAL IMBALANCE (structure, not correctness)

### T3-1 · Three competing data-flow systems — resolve by DIRECTION, not rewrite

**Verified consumer counts (non-test):**
| System | Defined in | Real consumers |
|---|---|---|
| `workbenchStore` | `src/store/workbenchStore.ts` (235 LOC) | **49 files** — the actual backbone |
| `artifactStore` + `toolDataContract` (new) | `src/store/artifactStore.ts` (91 LOC) + `src/domain/toolDataContract.ts` (256 LOC) | **2 files** — `useFBASimState.ts`, `NextStepButton.tsx` |
| `sessionStorage` (ad hoc) | scattered | 4 files |

The "new unified contract" is a near-empty shell (1 of 14 tools writes to it). This is the biggest source of architectural confusion, but it is NOT failure — the 49-file store works.

**DECISION (do this, do not big-bang refactor):**
1. **Freeze `workbenchStore`** — no new features added to it, but leave all 49 consumers working. No rip-and-replace.
2. **Route ALL new cross-tool data flow through ONE system.** Pick `artifactStore`/`toolDataContract` as the go-forward layer *only if* you first make it non-shell: give it a real read/write API and migrate 2–3 high-value flows (e.g. PathD → FBASim, ProEvol → CatDes) as proof it can carry weight. If it can't, kill it and standardize on `workbenchStore` instead. Do not keep a third abstraction half-alive.
3. **Delete the ad-hoc `sessionStorage` paths** — fold them into whichever store wins. Two systems is tolerable during migration; three is the bug.

**VERIFY:** After the decision, `grep -rl "sessionStorage" src --include=*.ts* | grep -v __tests__` trends toward 0, and any *new* tool added references exactly one store. Document the chosen direction in `CLAUDE.md` so future sessions don't reintroduce a competing pattern.

### T3-2 · Two DEAD ML modules — delete or wire (currently pure dead weight)

- `src/modules/ml/` (~100KB: Linear/Ridge/Lasso/DecisionTree/RandomForest + training + CV + gridsearch + interpretability). Imported by **0** non-test files.
- `src/services/ml/` (ONNX predictor/registry/loader). Imported by **0** non-test files, AND **no weight files ship** (`*.onnx/*.pt/*.safetensors` all absent) — so even if wired, it has nothing to serve.

**DECISION:**
- If ProEvol (or metabolic-eng) is going to be the validated core (see the strategic thread — sequence→function is where ML has real, published value), **wire `src/modules/ml` into that ONE tool** as a real feature: BRENDA/assay data → features → trained model → prediction, with the interpretability output surfaced. That turns 100KB of dead code into the platform's differentiator.
- Otherwise **delete both modules.** Dead ML that looks impressive but connects to nothing is exactly the kind of thing a technical reviewer will find and hold against you.
- Do not leave them dangling as-is.

**VERIFY:** Either `grep -rl "modules/ml" src | grep -v __tests__ | grep -v "modules/ml/"` returns ≥1 real consumer (wired), or the directories are gone (deleted). No middle state.

### T3-3 · Compute/presentation boundary — 7 client components import server engines directly

**Verified:** these `"use client"` files import `src/server/*Engine` directly, pulling server compute into the browser bundle:
`PathDPage.tsx`, `cethx/sharedComponents.tsx`, `cethx/useCETHXState.ts`, `cethx/TFAAnalysis.tsx`, `dbtlflow/ClosedLoopDBTLPanel.tsx`, `fbasim/ConsortiumPanel.tsx`, `genmim/CRISPREDITingPanels.tsx`.

Risk: bundle bloat + heavy compute running client-side. Higher risk if any pulled engine uses Node-only APIs — note `src/server/inverseFoldingEngine.ts` and several `scspatial*`/`*Db.ts` files DO use Node APIs; those must never reach a client bundle.

**FIX:** Move engine invocation behind API routes (`app/api/*`). Client components call `fetch('/api/<tool>')`; engines stay server-side. Do this per-tool, starting with any that transitively import a Node-API engine.

**VERIFY:** After refactor, `grep` for `server/.*Engine` imports inside `"use client"` files returns 0. Build with `next build` and confirm no server-only module resolution warnings, and check the client bundle no longer contains engine code.

### T3-4 · No unified input schema — 14 tools hand-roll adapters

**Verified:** **0** Zod input/output schemas in `src/components/tools`; **8** files pass tool inputs as untyped `Record<string, unknown>`. Every tool hand-writes its own input adapter, so there's no single validated contract between UI and engine.

**FIX (incremental, low-risk):** Define `inputSchema`/`outputSchema` (Zod) per tool, colocated with the engine. Parse at the API boundary. Start with the tools you're actively developing (ProEvol/FBASim); don't schematize all 14 at once. This also gives you the typed contract the new `artifactStore` layer needs to be worth keeping (ties into T3-1).

**VERIFY:** Each converted tool rejects malformed input at the boundary with a typed error (add a test passing a bad payload and asserting a schema error, not a downstream crash).

---

## 3. Suggested execution order (for Claude Code)

1. **T0-1, T0-2, T0-3** — defuse credibility bombs. (Same day. These are the existential ones.)
2. **T1-1 … T1-5** — stop fabricated numbers; add seeds where the value is a *result*.
3. **T2** — seed the legitimate stochastic methods. (Batch; one parametrized test.)
4. **T3-1** — make the data-flow direction decision; write it into `CLAUDE.md`.
5. **T3-2** — wire ML into the core tool OR delete it.
6. **T3-3, T3-4** — boundary + schemas, per-tool, starting with the tool you're actively validating.

## 4. Global verification harness (build this — it's the real anti-fabrication insurance)

Tests passing ≠ science correct. A fabricated function passes type checks and any test written in the same breath. The only durable defense is **ground-truth comparison**, and `reference_impl_py/` + `proof-package/` already exist as the skeleton for this but cover under half the tools. Extend them:

- **FBA:** growth rate vs COBRApy on iJO1366 → expect ≈0.87 h⁻¹. Assert |Δ| < tolerance.
- **Thermodynamics (CETHX):** ΔG vs eQuilibrator API for a set of reactions.
- **CRISPR on-target (Doench):** vs the 2016 Rule Set 2 supplementary data.
- **UMAP `findAB`:** vs Python `umap.umap_.find_ab_params(spread, min_dist)`.
- **PCA:** vs `numpy.linalg.svd` on fixed matrices.

Each of these is a check the model **cannot** satisfy by self-reporting — either the number matches the external reference or it doesn't. Wire them into CI. That is how "validity tier: real" stops being a self-written string and becomes a verified fact.

---

## 5. What this audit did NOT find (so you can stop worrying about it)

- No evidence the foundation is unrecoverable. `workbenchStore` + provenance layer are sound.
- The stochastic methods flagged in Tier 2 are *correct*; they only need seeding.
- `poissonSample` and the ID generators are fine — do not let anyone "fix" them into new bugs.

The real risk was never architectural collapse. It's that a handful of files claim science they don't do. Close Tier 0, and the platform goes from "a reviewer will catch this and distrust everything" to "honest tool with clearly-labeled tiers." That distinction is worth more than any optimization.
