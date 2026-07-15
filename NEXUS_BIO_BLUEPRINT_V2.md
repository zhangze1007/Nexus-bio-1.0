# Nexus-Bio Blueprint v2 — Wedge-First Realignment

**Date:** 2026-07-01
**Supersedes:** the original L1–L5 blueprint (Phases 1–7).
**Audience:** Claude Code (execution) + Zhang Ze (direction).
**Status of codebase at time of writing:** commit `5ca88bb`, ~300K LOC, 1647 commits, 14 tools.

---

## 0. What changed, and why (read this first)

The original blueprint was **OS-first / breadth-first**: it marched through Phases 1–7 building infrastructure (full iJO1366 model, SBML, REST API, GECAIR migration) and a *generic* data pipeline across all 14 tools — **before proving that any single tool delivers something a real lab wants.** That ordering builds the operating system before the first application anyone would use.

This v2 is **wedge-first / measurement-first**. It takes **one** capability — protein fitness prediction + active-learning experiment selection (the ProEvol line) — and drives it to a **measurable, defensible outcome**, while everything else is frozen. The OS remains the north star; it is not the starting build target.

**The distinction this whole blueprint is built on:**
- **Vision (may be an OS):** an AI-native synthetic-biology design operating system.
- **This year's execution (must be a single point):** make ProEvol predict protein fitness *well enough to measure*, and *cheaply enough* (via active learning) to cut real wet-lab cycles.

OS is the name you earn at day 100 by looking back, not the flag you plant on day 1. AlphaFold, Figma, and Unix all grew from one sharp wedge. This blueprint encodes that.

### The one-line value proposition (sharpened, verified against the literature)
> **NOT** "make DBTL faster." Build and Test are physical wet-lab steps; software cannot make cells grow *in silico*.
> **The defensible value is:** *more accurate design prediction → fewer expensive wet-lab iterations.*

This makes **algorithm honesty existential**, not cosmetic. A lying predictor sends a researcher into the wrong real experiment — worse than no tool. That is why Track A (integrity) blocks everything.

### The two objective anchors the old blueprint completely lacked
1. **ProteinGym** — the public benchmark for protein fitness prediction (~217 DMS assays, >2.5M mutants). Current SOTA ≈ 0.52 Spearman → a large, open gap. This gives you a way to *measure* whether ProEvol's predictions are good, instead of believing they are.
2. **Experiments-to-target** — measured on public sequence-fitness datasets: how many wet-lab rounds does your active-learning loop need to reach a target activity, vs naive directed evolution. This measures the *cost-reduction* claim directly.

Everything below is gated on producing real numbers on these two anchors.

---

## 1. North star vs beachhead

| | Beachhead (this year) | North star (later, gated) |
|---|---|---|
| Scope | ProEvol: fitness prediction + active-learning selection | Full AI-native synbio design OS |
| User | Directed-evolution / enzyme-engineering labs without an ML team | Any synbio researcher across the DBTL design surface |
| Proof | ProteinGym Spearman + experiments-to-target | Adoption + revenue |
| Levels | L1 → L2 → L3 (revised below) | L4 → L5 |
| Business | Free tool → beachhead adoption | OS monetization (retained, see §7) |

---

## 2. Revised L1–L5 (spine kept, near-term re-sequenced around the wedge)

| Level | Original meaning | v2 meaning | Gate to enter |
|---|---|---|---|
| **L1** | Algorithm authenticity | **Unchanged priority.** Fix credibility bombs + ProEvol-relevant integrity first. | none — start now |
| **L2** | Generic 14-tool data pipeline | **The wedge loop.** Make ProEvol fitness prediction *real* and *benchmarked on ProteinGym*. | L1 credibility bombs closed |
| **L3** | iJO1366 + SBML + REST API | **The reusable rocket.** Active-learning loop + measure experiments-to-target. (Old L3 infra → moved to L4-gated.) | L2 produces a real Spearman |
| **L4** | Lab integration (post-funding) | **OS infrastructure**, now GATED: full models, SBML, REST API, cross-tool pipeline, lab hardware. | A real demand signal (see §5 GATE) |
| **L5** | AI-native OS (post-funding) | Unchanged vision: LLM-agent-driven automated DBTL. | L4 + funding |

**Key move:** the old L2 (generic pipeline) and old L3 (full models / SBML / REST API) are **breadth infrastructure**. They are deferred into gated L4. Near-term L2/L3 are redefined as *the wedge* and *the cost-reduction proof*.

---

## 3. Branch decomposition ("拆成分支")

All near-term work is organized as discrete git branches. Each branch has: **scope · files · deliverable · VERIFY (anti-fabrication) · merge criteria.** Branches within a track can run in parallel unless a dependency is noted. **Track A must merge before Track C ships.**

> **Anti-fabrication rule (applies to every branch):** A branch is not done because a summary says "✅". It is done when its VERIFY assertion produces real output. Where VERIFY calls for an external reference (ProteinGym, COBRApy, eQuilibrator), that comparison *is* the proof — a green Jest run written in the same commit is not. A function that accepts parameters and ignores them is a decoy, not a fix (see A-2).

### Track A — INTEGRITY (blocks everything; merge first)

| Branch | Scope |
|---|---|
| `fix/rfdiffusion-decitation` | Defuse the Watson-2023-over-`Math.random()` citation laundering in `src/server/rfdiffusion.ts`. |
| `fix/umap-findab-real` | Replace the `findAB` decoy in `src/server/umapEngine.ts` with a real a/b fit. |
| `fix/scramble-essentiality-fitness` | Replace random SCRaMbLE `fitnessEffect` in `src/server/syntheticGenomicsEngine.ts` with essentiality-based fitness. |
| `fix/fabricated-numbers` | CRISPR bystander (`crisprEditingEngine.ts:403`), promoter "design" (`regulatoryDesignEngine.ts:108`), PCA init (`bioreactorAnalyticsEngine.ts:194`). |
| `fix/seed-stochastic` | Seed the *legitimate* stochastic methods for reproducibility (closedLoop LHS, MFA13C, fluxSampling, digitalTwin, mdIntegrator) via existing `SeededRNG`. |

### Track B — THE WEDGE (ProEvol made real + measurable)

| Branch | Scope | Depends on |
|---|---|---|
| `feat/proevol-esm-features` | Use a **frozen** ESM model as a per-variant feature extractor, called via the existing `/api/esm3` route (backend: NVIDIA Build free ESM/BioNeMo endpoint). No training of the big model. | — |
| `feat/proevol-fitness-head` | A **small** trained head on top of ESM features: reuse the **dead** `src/modules/ml` (Ridge / RandomForest) OR the GP — trained on assay data. This is the "less-ML-more-result" architecture. | `feat/proevol-esm-features` |
| `bench/proteingym-harness` | Download one ProteinGym DMS assay, run ProEvol's fitness scoring, compute **Spearman** vs experimental values. **This is the objective anchor — highest-value single technical action in this blueprint.** | `feat/proevol-fitness-head` (or run against current heuristic first for a baseline) |
| `feat/proevol-honest-scoring` | The current composite in `ProEvolCampaignEngine.ts` (`scoreVariant`, hand-tuned carry coefficients `0.74/0.72/0.7/0.68`) is a heuristic, **not** a sequence→function model. Either replace it with the ESM+head path, or clearly relabel it `partial`/`heuristic` in `toolValidity.ts` and keep it only as a fast pre-filter. | Track A |

### Track C — THE REUSABLE ROCKET (active learning; the SpaceX move)

| Branch | Scope | Depends on |
|---|---|---|
| `feat/active-learning-loop` | Add uncertainty-based acquisition: use the **real GP already in** `src/server/closedLoopDBTLEngine.ts` to rank candidate variants by expected improvement / uncertainty, select the next small batch to "test." Foundation: Romero, Krause & Arnold — GP navigation of protein fitness landscapes. | Track B + A |
| `bench/experiments-to-target` | On a public sequence-fitness dataset, simulate the loop: measure **rounds-to-target** (active learning vs naive DE). This measures the cost-reduction claim directly. | `feat/active-learning-loop` |
| `feat/proevol-experiment-selection-ui` | The surface a real lab uses: paste a sequence + a handful of assayed variants → get a ranked shortlist of the next N variants to build, with uncertainty shown. This is the Figma-angle deliverable (usable loop, no ML team required). | `feat/active-learning-loop` |

### Track D — HOUSEKEEPING (de-risk architecture; NO rewrite)

| Branch | Scope |
|---|---|
| `chore/freeze-workbench-store` | `workbenchStore` (49 consumers) is frozen — no new features added to it, existing consumers untouched. Document the go-forward store in `CLAUDE.md`. Do not maintain three data systems. |
| `chore/ml-modules-decide` | The two dead ML modules (`src/modules/ml`, `src/services/ml`) have **0** non-test consumers. Either wire `src/modules/ml` into `feat/proevol-fitness-head`, or delete both. No dangling state. |
| `chore/client-server-boundary` | The 7 `"use client"` files importing `src/server/*Engine` directly — move the **wedge-relevant** ones (ProEvol/FBASim path) behind `app/api/*` routes. Not all 14; just the wedge. |

### Track E — GATED (do NOT start until the demand GATE in §5 is passed)

This is where the **old blueprint's L2/L3 infrastructure goes.** It is real, valuable work — but it is *expansion*, and building it now is the OS-first trap.

| Deferred item | Old location |
|---|---|
| Full iJO1366 model + `biggToLP.ts` | old Phase 3 |
| Generic `toolDataContract` across all tools | old Phase 2 |
| SBML export/import + REST API v1 | old Phase 7 |
| Lab integration (Opentrons/LIMS) | old L4 |

---

## 4. Per-branch detail (Tracks A, B, C)

### A-1 · `fix/rfdiffusion-decitation`
- **File:** `src/server/rfdiffusion.ts`
- **Problem:** header `@scientific_provenance` claims DDPM / fine-tuned RoseTTAFold / PDB training / experimental validation, cites Watson 2023 *Nature*; code does none of it (`line 175` `residueConfidence = Math.random()`; `line 392` weighted-random gen).
- **Fix (Path A, do now):** strip the provenance block + Watson citation; rewrite header as *"heuristic backbone/sequence sketch, NOT RFdiffusion, no diffusion model"*; set tier `demo` in `toolValidity.ts`; rename any UI label off "RFdiffusion"; remove or deterministically replace the fabricated `residueConfidence`.
- **VERIFY:** `grep -n "Watson\|RFdiffusion\|DDPM\|RoseTTAFold" src/server/rfdiffusion.ts` returns nothing (unless a real model call now exists); `residueConfidence = Math.random()` is gone; tier string is literally `"demo"`.
- **Merge when:** VERIFY passes and no user-facing string claims the method.

### A-2 · `fix/umap-findab-real`
- **File:** `src/server/umapEngine.ts` (`findAB`, ~line 333)
- **Problem (decoy):** accepts `minDist, spread`, ignores them, returns hardcoded `[1.929, 0.7915]` behind a solver-shaped comment. This is the live example of the fake-fix pattern.
- **Fix:** implement the real least-squares fit of `w(d)=1/(1+a·d^(2b))` to the piecewise target (port UMAP `find_ab_params`).
- **VERIFY (anti-decoy):**
  ```
  const [a1] = findAB(0.1, 1.0); const [a2] = findAB(0.5, 1.0);
  expect(a1).not.toBeCloseTo(a2);   // if equal, the fix is fake
  ```
  Also assert `findAB(0.1,1.0) ≈ (1.577, 0.895)` (the value the doc-comment itself cites — the current hardcode doesn't even match it).
- **Merge when:** output changes with input, and matches Python `umap.umap_.find_ab_params` on 3 fixed pairs.

### A-3 · `fix/scramble-essentiality-fitness`
- **File:** `src/server/syntheticGenomicsEngine.ts` (`simulateSCRaMbLE`, `lines 283–288`)
- **Problem:** `fitnessEffect` drawn from fixed random ranges by event type; ignores which genes are in the affected region. Cites Richardson 2017 *Science*.
- **Fix:** map the rearranged region → affected genes/reactions; derive `fitnessEffect` from essentiality (annotation, or single-deletion FBA via `fbaEngine.ts` → growth-ratio). Keep *which* event fires stochastic but seeded.
- **VERIFY:** deletion over a known-essential reaction yields a more-negative `fitnessEffect` than over a redundant one, under a fixed seed. If `fitnessEffect` doesn't depend on region content, the fix is fake.

### A-4 · `fix/fabricated-numbers`
- **Files/changes:**
  - `crisprEditingEngine.ts:403` — bystander efficiency is `efficiency*(0.5+0.3*random)`. Replace with a **position-weighted** activity profile inside the editing window (per-editor weight vector), seeded.
  - `regulatoryDesignEngine.ts:108–118` (`designPromoter`) — random-generate-then-score, fully random spacer. Minimum: seed + relabel `partial` + change UI copy from "design strength X" to "sample candidate." Better: optimize toward target strength.
  - `bioreactorAnalyticsEngine.ts:194` — PCA power-iteration random init → `SeededRNG` (and seed the `line 566` bootstrap).
- **VERIFY:** each output is now (a) deterministic under a seed and (b) sensitive to the biologically-meaningful input (window position / target strength / matrix). PCA top-PC cross-checked against `numpy.linalg.svd` on a fixed matrix.

### A-5 · `fix/seed-stochastic`
- **Files:** `closedLoopDBTLEngine.ts` (LHS 318 / shuffle 322 / candidate init 425), `mfa13CEngine.ts` (595–596), `fluxSampling.ts` (196–197, 453), `digitalTwinEngine.ts` (577–578), `mdIntegrator.ts` (121–122).
- **Fix:** thread one `seed` param (default fixed) through each; use `SeededRNG`. These algorithms are **correct** — this is reproducibility only.
- **⚠ DO NOT TOUCH:** `digitalCellEngine.ts:5195` `p *= Math.random()` is a correct **Knuth Poisson sampler**; `ProEvolCampaignEngine.ts:2062` is legitimate diversity; all `Math.random().toString(36)` ID generators are fine. "Fixing" these creates new bugs.
- **VERIFY:** same input + same seed → identical output; different seed → different output (one parametrized test).

### B-1 · `feat/proevol-esm-features`
- **Files:** `src/services/esm3Client.ts`, `app/api/esm3/route.ts`, new `src/services/protein/esmFeatures.ts`.
- **Scope:** given a sequence (+ variants), obtain per-sequence ESM embeddings by calling the existing `/api/esm3` route with the backend pointed at **NVIDIA Build's free ESM/BioNeMo endpoint**. The big model is **frozen** — you never train it. Cache embeddings.
- **Note:** the existing `/api/esm3` cascade (backend → ESM Atlas → heuristic) is honest *if the `source` label is surfaced*. Ensure `source` reaches the caller so a heuristic fallback is never presented as a model embedding.
- **VERIFY:** embeddings returned with correct dimensionality and a `source` field; with the real backend set, `source !== "heuristic-fallback"`. Key is read from Vercel env only.

### B-2 · `feat/proevol-fitness-head`
- **Files:** wire `src/modules/ml` (currently dead: `models.ts` Ridge/RandomForest, `training.ts`) into a new `src/services/protein/fitnessHead.ts`.
- **Scope:** train a **small** head (Ridge or RandomForest, or the GP) mapping ESM features → a scalar fitness, on a handful of assayed variants. This is the "big frozen PLM + tiny top-layer regression" pattern (EVOLVEpro-style) — the architecture where *fewer* parameters + *less* data is correct, not a compromise.
- **VERIFY:** on a held-out split of one assay, the head produces fitness scores; report train/test R² or Spearman. This is the first moment the dead ML module does real work — confirm `grep -rl "modules/ml" src | grep -v __tests__ | grep -v "modules/ml/"` now returns this file.

### B-3 · `bench/proteingym-harness` ⭐ (do this early — it's the anchor)
- **Files:** new `benchmarks/proteingym/` + `reference_impl_py/` entry.
- **Scope:** download **one** ProteinGym substitution DMS assay; run ProEvol's fitness scoring (current heuristic first, for a baseline, then the ESM+head path); compute **Spearman** between predicted and experimental fitness.
- **Why first:** it converts "are my predictions good?" from belief into a number you can put next to SOTA ≈ 0.52. It is the anchor that a rejection email cannot break.
- **VERIFY:** a printed Spearman value on a named assay, reproducible, checked into `benchmarks/`. Not a Jest green — an actual correlation number.
- **Deliverable:** `benchmarks/proteingym/RESULTS.md` with assay name, method, Spearman, date.

### B-4 · `feat/proevol-honest-scoring`
- **File:** `ProEvolCampaignEngine.ts` (`scoreVariant` / `scoreVariantMetrics`, coefficients `0.74/0.72/0.7/0.68`).
- **Scope:** the hand-tuned composite is a heuristic, not a learned model. Decide: (a) replace with ESM+head output as the primary fitness, keeping the composite as a fast heuristic pre-filter clearly labeled; or (b) if kept as primary, set tier `partial`/`heuristic` in `toolValidity.ts` and never present it as a learned prediction.
- **VERIFY:** the tier string matches reality; the ProteinGym harness (B-3) reports the *actual* method's Spearman, not the heuristic's, if the heuristic is demoted.

### C-1 · `feat/active-learning-loop`
- **Files:** `src/server/closedLoopDBTLEngine.ts` (real GP already here), new `src/services/protein/acquisition.ts`.
- **Scope:** given assayed variants + candidate pool, use the GP's posterior to rank candidates by an acquisition function (expected improvement / upper-confidence-bound), returning the next small batch to test. This is the "reusable rocket": maximum information per expensive experiment.
- **VERIFY:** the selected batch changes as observations are added; higher-uncertainty/higher-EI candidates are preferred; deterministic under a seed.

### C-2 · `bench/experiments-to-target`
- **Files:** `benchmarks/active-learning/`.
- **Scope:** on a public sequence-fitness dataset, simulate: start from a small seed set, iterate select→reveal→refit, and count **rounds to reach a target fitness percentile**, active-learning vs random/greedy DE. Report the delta.
- **VERIFY:** a printed table — rounds-to-target for AL vs baseline, on a named dataset, reproducible. This is the direct measurement of the cost-reduction value prop.
- **Deliverable:** `benchmarks/active-learning/RESULTS.md`.

### C-3 · `feat/proevol-experiment-selection-ui`
- **Files:** `src/components/tools/proevol/*`.
- **Scope:** paste WT sequence + a handful of assayed variants → ranked shortlist of next-N variants to build, uncertainty shown, one-click export. The loop made usable for a lab with no ML team.
- **VERIFY:** end-to-end run from UI produces a ranked shortlist backed by the GP; no server engine imported into the client component (routes only).

---

## 5. Milestones & the one GATE

| Milestone | Definition of done |
|---|---|
| **M1 — Integrity clean** | Track A merged. No live credibility bombs; `demo`/`partial` tiers honest. |
| **M2 — First objective number** | `bench/proteingym-harness` prints a real Spearman on a named assay. You now know if the science is good. |
| **M3 — Cost-reduction proof** | `bench/experiments-to-target` shows rounds-to-target reduced vs baseline on public data. The value prop is now demonstrated, not claimed. |
| **M4 — Usable loop** | `feat/proevol-experiment-selection-ui` runs end-to-end. |

**THE GATE (before any Track E / L4 infrastructure):**
Do **not** start full iJO1366 / SBML / REST API / lab integration until there is a **demand signal** — evidence that a real directed-evolution lab would use the loop. What counts as a signal is *your* decision (this blueprint does not force it). It notes only: the question is now narrow and answerable — *"which enzyme-engineering labs would use a tool that ranks their next variants to build?"* — not the un-answerable *"does anyone want a synbio OS?"* Building L4 before this signal is the OS-first trap this whole document exists to avoid.

---

## 6. Verification protocol (ground-truth harness — the real insurance)

Tests passing ≠ science correct. A fabricated function passes type checks and any test written in the same commit. The only durable defense is comparison to an **external** reference. `reference_impl_py/` and `proof-package/` exist as this skeleton (covering <half the tools) — extend them for the wedge:

| Check | Reference | Expected |
|---|---|---|
| ProEvol fitness | ProteinGym DMS assay | Spearman reported vs SOTA ≈ 0.52 |
| Active-learning loop | public sequence-fitness dataset | rounds-to-target < baseline |
| FBA growth | COBRApy iJO1366 | ≈ 0.87 h⁻¹, |Δ| < tol |
| Thermo ΔG (CETHX) | eQuilibrator API | within tol |
| UMAP a/b | Python `find_ab_params` | matches on fixed pairs |
| PCA | `numpy.linalg.svd` | matches on fixed matrix |

Each is a check the model **cannot** satisfy by self-report. Wire the wedge checks into CI. This is how a `validity: "real"` string stops being self-written and becomes verified.

---

## 7. Business model (retained, re-sequenced)

The long-term OS monetization vision is **kept**. What changes is the *order* revenue is pursued:

- **Beachhead (now):** ProEvol fitness + active-learning loop, free, aimed at enzyme-engineering / directed-evolution labs. Goal is not revenue yet — it is adoption + proof (M2/M3) + the demand signal (GATE).
- **Expansion (post-GATE, L4):** once the wedge is used, broaden to the surrounding DBTL design surface (the other tools, cross-tool pipeline, models, API). *This* is where OS-shaped monetization (seats/usage/API) becomes real, because there is now something people use.
- **Principle you set:** AI4S should improve how research is done, not only extract $. That principle is *served*, not contradicted, by validation — "making the world better" is only real if a real lab's work got better. The wedge is how you find out it did.

Revenue follows adoption; adoption follows a wedge that works; a wedge that works follows integrity + measurement. That is the whole causal chain of this blueprint.

---

## 8. What this blueprint deliberately does NOT do

- **No big-bang refactor.** `workbenchStore` (49 files) is frozen and left working, not rewritten.
- **No OS infrastructure before the GATE.** Full models / SBML / REST API / lab integration are gated L4, not near-term.
- **No treating 14 tools equally.** 13 are frozen; ProEvol is the wedge. Breadth is deferred, not deleted.
- **No "fixing" correct code.** Poisson sampler, diversity RNG, ID generators stay. Mis-flagging correct code is the same disease as fabricating a fix — both are dishonest about the state of the science.
- **No stopping at a beautiful framing.** "Synbio OS," "reusable rocket," "AlphaFold problem" — all real, all useless until there is a Spearman number and a rounds-to-target number. The blueprint is done when those numbers exist, not when the vision is articulated.

---

### Suggested first three actions for Claude Code
1. Branch `fix/rfdiffusion-decitation` → close A-1 (defuse the highest-risk credibility bomb).
2. Branch `fix/umap-findab-real` → close A-2 (kill the decoy; prove fixes are real via the anti-decoy assertion).
3. Branch `bench/proteingym-harness` → produce the first real Spearman (the anchor). This can run against the current heuristic immediately for a baseline, before B-1/B-2 land.

Land Track A, get one number from M2, and the project moves from "a reviewer will catch this" to "an honest tool with a measurable, defensible core."
