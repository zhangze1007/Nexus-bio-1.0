# Community FBA → real SteadyCom joint LP — Design Spec

**Date:** 2026-07-02
**Status:** Approved (brainstorming), pending spec review → writing-plans
**Author:** Zhang Ze Foo + Claude (Opus 4.8)
**Scope:** FBAsim community metabolic modeling (`solveAuthorityCommunityFBA`, `steadyCom`)

---

## 1. Problem

The platform exposes **two community-FBA paths, both scientifically wrong, in opposite ways:**

1. **`solveAuthorityCommunityFBA`** (`src/server/fbaEngine.ts`, used by `/api/fba` `mode:'community'`)
   runs two *independent* single-species LPs, then **fabricates** cross-feeding with magic
   constants (`1.6 / 2.4 / 1.4 / 2 / 0.018`) and blends growth linearly
   `(1-α)·ecoli + α·yeast`. Cross-feeding has **no stoichiometric basis** — it is invented.

2. **`steadyCom`** (`src/server/fbaSteadyCom.ts`, exposed at `/api/fba` `mode:'steadycom'`)
   *looks* real (bisection on community μ) but its `sharedMetabolites` parameter is documented
   "for documentation" and **ignored**: each species LP is solved independently, so it computes
   `community μ = min(individual max growths)` with **zero cross-feeding**.

One over-counts cross-feeding (fabrication); the other omits it (missing coupling). A correct
community FBA is a **single joint LP with a shared extracellular metabolite pool** so cross-feeding
emerges from stoichiometry.

Additionally, the curated `ECOLI_NETWORK` / `YEAST_NETWORK` (glycolysis chains) contain **no
secretion/exchange reactions** for the shared metabolites (acetate, ethanol, …), and
`SHARED_METABOLITES` in `mockFBA.ts` is a mock edge-list disconnected from any real network. So a
correct solver alone is insufficient — a real community metabolic model is also required.

## 2. Goal / Non-goals

**Goal:** Community FBA produces cross-feeding that emerges from real stoichiometry via a real
SteadyCom joint LP. Fix `steadyCom` to be the single correct community engine, and rewrite
`solveAuthorityCommunityFBA` in place to use it. No fabricated numbers anywhere in this path.

**Non-goals:** Genome-scale community models (no yeast GEM in repo). Absolute numbers remain
illustrative at the curated-model scale; the **method, coupling, and cross-feeding physics** are
real. No UI redesign (the `CommunityFBAOutput` contract is preserved).

## 3. Algorithm — real SteadyCom (Chan, Simons & Maranas 2017)

For a fixed community specific growth rate μ, build **one joint LP** over all species. Variables:
per-species reaction fluxes `v_{i,j}` and species abundances `X_i`.

1. **Steady state (per species):** `S_i · v_i = 0`
2. **Shared extracellular pool coupling (the missing physics):** for each shared metabolite `m`,
   `Σ_i (secretion_{i,m} − uptake_{i,m}) = 0` — one species' secretion bounds another's uptake.
   Cross-feeding emerges from this constraint.
3. **Biomass–abundance coupling (SteadyCom's defining feature):**
   `lb_j · X_i ≤ v_{i,j} ≤ ub_j · X_i`, and species biomass flux `v_{i,biomass} = μ · X_i`
   (balanced growth: coexisting species share one community rate μ).
4. **Normalization:** `Σ X_i = 1`.

μ fixed ⇒ all constraints are linear ⇒ each check is one LP (HiGHS). Outer loop: **bisection for the
maximum feasible μ** (the existing bisection scaffold is reused; the per-species independent check is
replaced by this joint feasibility LP).

**Why this cannot be faked / is the fix:** a species with no glucose uptake (μ=0 alone) can grow in
the community on a partner's secreted carbon (μ>0) — impossible for a linear blend or a min() of
independents. Cross-feeding is derived, not assigned.

**`alpha` handling (decision):** repurpose the request's `alpha` as an *optional fixed relative
abundance* (`X_yeast = α`) → a valid SteadyCom variant (fixed-composition); when absent, abundances
are optimized for max μ. The old blend semantics are deleted.

## 4. Components / files

| File | Action | Content |
|------|--------|---------|
| `src/data/communityModel.ts` | **new** | Curated small 2-species community stoichiometric model as `SteadyComSpecies[]`: existing glycolysis + literature-grounded overflow secretion/uptake (E. coli acetyl-CoA→acetate overflow + ethanol uptake; yeast pyruvate→ethanol fermentation + acetate uptake) + shared extracellular pool metabolites. `@scientific_provenance` header with verified citations (§7). Stoichiometry only — no invented scalar outputs. |
| `src/server/fbaSteadyCom.ts` | **rewrite core** | Replace per-species independent feasibility with `buildCommunityLPModel(species, sharedMetabolites, μ)`: joint LP with pool coupling + biomass-abundance coupling + `ΣX=1`. Actually use `sharedMetabolites`. Keep the public `steadyCom(...)` signature. |
| `src/server/fbaEngine.ts` | **rewrite in place** | `solveAuthorityCommunityFBA`: build community model from request (apply per-species uptake bounds + optional `alpha` fixed abundance) → call `steadyCom` → map `SteadyComResult` to `CommunityFBAOutput` (real `communityGrowthRate`, per-species growth, and `exchangeFluxes` derived from real exchange-reaction fluxes). Delete magic constants + `MOCK_DATA` block. |
| `src/data/mockFBA.ts` | **reconcile** | Move the shared-metabolite definitions into `communityModel.ts` as real pool metabolites; remove the disconnected mock edge-list once nothing else consumes it. |
| `src/config/toolValidity.ts` | **update** | fbasim caption: remove "two independent LPs … NOT a joint LP"; describe the real SteadyCom joint LP + curated-model-scale caveat. |

## 5. Data flow (contract preserved)

```
ConsortiumPanel → POST /api/fba {mode:'community', ecoli, yeast, objective, alpha?}
  → solveAuthorityCommunityFBA(request)
  → buildCommunityModel(request)              [new: communityModel.ts]
  → steadyCom(species, sharedMetIds)          [rewritten: joint LP + bisection]
  → SteadyComResult → CommunityFBAOutput       [same shape]
  → JSON → UI renders growth + real cross-feeding fluxes
```

`CommunityFBAOutput` fields (`exchangeFluxes{id,metabolite,fromStrain,toStrain,flux}`,
`communityGrowthRate`, per-species `growthRate`) keep their shape; values become real.
ConsortiumPanel is unchanged.

## 6. Backward compatibility / blast radius

- `steadyCom` behavior changes (now couples). `/api/fba` `steadycom` mode (user-supplied models)
  becomes correct too — but user models must include exchange reactions for shared metabolites to
  exhibit cross-feeding; document this in the schema/route.
- **8 test files touch this area** and assert current behavior — expect updates:
  `steadyCom.test.ts`, `communityFbaHonesty.test.ts`, `fbaEngine.test.ts`, `api/fba-route.test.ts`,
  `FBAAuthorityClient.test.ts`, `consortiumDesignEngine.test.ts`, `engine-integration.test.ts`,
  `performance/fbaBenchmark.test.ts`.

## 7. Anti-fabrication testing (acceptance criteria)

1. **Syntrophy (strongest):** E. coli with glucose uptake disabled → alone `μ=0`; in community it
   grows on yeast's secreted ethanol → assert `community μ > 0` while `ecoli-alone max μ = 0`.
2. **Cross-feeding sensitivity:** knock out yeast ethanol secretion → dependent E. coli growth and
   community μ drop; assert `μ(secretion on) > μ(secretion off)` (content-dependent).
3. **Shared-pool conservation:** in the solution, for each shared metabolite `Σ secretion = Σ uptake`.
4. **Analytic ground-truth (no Python):** hand-derive max community μ from known per-reaction
   stoichiometry of the toy model; assert engine output matches within tolerance.
5. **Determinism:** same input → identical output.
6. **Python reference (honestly blocked):** add a `micom`/`cobra` community-FBA reference script to
   `reference_impl_py/scientific/`; document that it needs a Python env and is not run here.

Do **not** re-assert the old `μ ≤ min(individual)` invariant — it was the wrong behavior.

## 8. Verified provenance (checked 2026-07-02, not from memory)

- **SteadyCom:** Chan SHJ, Simons MN, Maranas CD (2017). *PLOS Comput Biol* **13(5):e1005539**.
  DOI 10.1371/journal.pcbi.1005539. — joint-LP community FBA method.
- **E. coli acetate overflow:** Basan M, Hui S, Okano H, Zhang Z, Shen Y, Williamson JR, Hwa T
  (2015). *Nature* **528:99–104**. DOI 10.1038/nature15765 (PMID 26632588). — acetate overflow reality.
- **Yeast Crabtree/ethanol:** De Deken RH (1966). *J Gen Microbiol* **44(2):149–156** (PMID 5969497).
  — aerobic ethanol fermentation reality.

Every citation independently verified against PLOS/Nature/Microbiology Society/PubMed; DOIs/PMIDs
included so anyone can re-check. No citation is asserted from memory.

## 9. Global constraints (binding for implementation & review)

- **No fabricated scalars.** Every numeric community-FBA output must come from the LP solve. No magic
  constants, no blends, no hardcoded cross-feeding.
- Reuse the existing HiGHS solver (`solveLP`) and the existing `steadyCom` bisection structure.
- Preserve the `CommunityFBAOutput` shape and the `steadyCom(...)` public signature.
- Curated stoichiometry must be literature-grounded (overflow/Crabtree routes), not invented numbers.
- Validity caption must state plainly: method real, model scale illustrative.
- Citations only after independent verification (DOI/PMID).

## 10. Risks / open items

- HiGHS must handle the joint LP with abundance variables (small; expected fine — verify in Task 1).
- `alpha`-as-fixed-abundance must remain feasible (α∈(0,1)); guard degenerate α.
- Reconciling `mockFBA.ts` without breaking other consumers — audit consumers before deletion.
