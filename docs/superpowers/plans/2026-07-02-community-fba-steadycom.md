# Community FBA → real SteadyCom joint LP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fabricated community-FBA heuristic and the coupling-less `steadyCom` with a single real SteadyCom joint LP where cross-feeding emerges from stoichiometry.

**Architecture:** Fix `steadyCom` to build ONE joint LP over all species (per-species mass balance + shared extracellular pool coupling + biomass–abundance coupling + ΣX=1), bisection on community μ. Add a curated, literature-grounded 2-species community model. Rewrite `solveAuthorityCommunityFBA` in place to use them. Every numeric output comes from the LP solve.

**Tech Stack:** TypeScript, HiGHS LP solver (`src/server/highsSolver.ts`, `solveLP`), Jest.

## Global Constraints

- **No fabricated scalars.** Every numeric community-FBA output comes from the LP solve. No magic constants, no linear blends, no hardcoded cross-feeding.
- Reuse the existing `solveLP` and the existing `steadyCom` bisection structure; do not add a new solver.
- Preserve the public `steadyCom(...)` signature and the `CommunityFBAOutput` shape.
- Curated stoichiometry must be literature-grounded (overflow/Crabtree); no invented scalar outputs.
- Citations only after independent verification. Verified for this work: SteadyCom = Chan SHJ, Simons MN, Maranas CD (2017) *PLOS Comput Biol* 13(5):e1005539, DOI 10.1371/journal.pcbi.1005539; E. coli acetate overflow = Basan et al. (2015) *Nature* 528:99–104, DOI 10.1038/nature15765; yeast Crabtree = De Deken (1966) *J Gen Microbiol* 44(2):149–156, PMID 5969497.
- LP types (from `highsSolver.ts`): `LPVariable {name:string; coef:number}`, `LPConstraint {name:string; vars:LPVariable[]; lb:number; ub:number}`, `LPBound {name:string; lb:number; ub:number}`, `LPModel {name; sense:'maximize'|'minimize'; objective:LPVariable[]; constraints:LPConstraint[]; bounds:LPBound[]}`. `solveLP(model) → Promise<{status:'optimal'|'infeasible'|'unbounded'|'error'; objectiveValue:number; primals:Record<string,number>}>`.
- Existing `SteadyComSpecies {id; name; reactions:SteadyComReaction[]; metabolites:string[]; biomassReaction:string}`, `SteadyComReaction {id; stoichiometry:Record<string,number>; lowerBound:number; upperBound:number}`, `SteadyComResult {status:'optimal'|'infeasible'|'error'; communityGrowthRate:number; speciesFluxes:Record<string,Record<string,number>>; speciesGrowthRates:Record<string,number>; iterations:number; convergenceHistory:number[]}`.

---

## Modeling conventions (read before Task 1)

- **Joint-LP variable names:** flux of species `i` reaction `j` → `"{i}__{j}"`; abundance of species `i` → `"X__{i}"`.
- **Shared metabolites are community-level**, not per-species. In `buildCommunityLPModel`, a species' `S·v=0` balance covers only metabolites **not** in `sharedMetabolites`. Each shared metabolite `m` gets ONE community pool balance: `Σ_i Σ_j S_i[m][j]·v_{i,j} = 0`.
- **Coupling constraints per species reaction `j`:** `v_{i,j} − ub_j·X__i ≤ 0` and `v_{i,j} − lb_j·X__i ≥ 0`.
- **Biomass–abundance:** `v_{i,biomass} − μ·X__i = 0`.
- **Normalization:** `Σ_i X__i = 1`.
- **Abundance bounds:** `X__i ∈ [0,1]`. **Flux var bounds:** `[min(0,lb_j), max(0,ub_j)]` (coupling tightens them).
- **Objective:** feasibility — set `sense:'maximize'`, objective = the first species' biomass var (status `optimal` vs `infeasible` is what the bisection reads).

---

## Task 1: Joint community LP builder

**Files:**
- Modify: `src/server/fbaSteadyCom.ts` (add `buildCommunityLPModel`)
- Test: `__tests__/steadyComJointLP.test.ts` (create)

**Interfaces:**
- Produces: `export function buildCommunityLPModel(species: SteadyComSpecies[], sharedMetabolites: string[], mu: number): LPModel`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/steadyComJointLP.test.ts
import { buildCommunityLPModel } from '../src/server/fbaSteadyCom';
import type { SteadyComSpecies } from '../src/server/fbaSteadyCom';

const twoSpecies: SteadyComSpecies[] = [
  {
    id: 'A', name: 'A', biomassReaction: 'BIO_A', metabolites: ['a_int'],
    reactions: [
      { id: 'UP_A', stoichiometry: { a_int: 1 }, lowerBound: 0, upperBound: 10 },
      { id: 'SEC_A', stoichiometry: { a_int: -1, shared_m: 1 }, lowerBound: 0, upperBound: 100 },
      { id: 'BIO_A', stoichiometry: { a_int: -1 }, lowerBound: 0, upperBound: 100 },
    ],
  },
  {
    id: 'B', name: 'B', biomassReaction: 'BIO_B', metabolites: ['b_int'],
    reactions: [
      { id: 'UP_B', stoichiometry: { shared_m: -1, b_int: 1 }, lowerBound: 0, upperBound: 100 },
      { id: 'BIO_B', stoichiometry: { b_int: -1 }, lowerBound: 0, upperBound: 100 },
    ],
  },
];

describe('buildCommunityLPModel', () => {
  it('namespaces flux + abundance variables and adds coupling/pool/normalization constraints', () => {
    const m = buildCommunityLPModel(twoSpecies, ['shared_m'], 0.5);
    const varNames = m.bounds.map((b) => b.name);
    expect(varNames).toContain('A__SEC_A');
    expect(varNames).toContain('X__A');
    expect(varNames).toContain('X__B');
    const cNames = m.constraints.map((c) => c.name);
    // per-species internal balance (shared metabolite excluded)
    expect(cNames).toContain('A__bal__a_int');
    expect(cNames).not.toContain('A__bal__shared_m');
    // one community pool balance for the shared metabolite
    expect(cNames).toContain('pool__shared_m');
    // biomass-abundance coupling and normalization
    expect(cNames).toContain('A__growthcouple');
    expect(cNames).toContain('community__abundance_sum');
    // flux-abundance coupling present for a reaction
    expect(cNames).toContain('A__SEC_A__ub_couple');
  });

  it('X variables are bounded to [0,1]', () => {
    const m = buildCommunityLPModel(twoSpecies, ['shared_m'], 0.5);
    const xa = m.bounds.find((b) => b.name === 'X__A')!;
    expect(xa.lb).toBe(0);
    expect(xa.ub).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/steadyComJointLP.test.ts`
Expected: FAIL — `buildCommunityLPModel` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/server/fbaSteadyCom.ts` (after the existing helpers):

```ts
/**
 * Build ONE joint community LP at a fixed community growth rate mu (SteadyCom).
 * Couples species through a shared extracellular metabolite pool and scales
 * each species' fluxes by its abundance X_i (balanced growth: biomass = mu*X_i).
 * Reference: Chan, Simons & Maranas (2017) PLOS Comput Biol 13(5):e1005539.
 */
export function buildCommunityLPModel(
  species: SteadyComSpecies[],
  sharedMetabolites: string[],
  mu: number,
): LPModel {
  const shared = new Set(sharedMetabolites);
  const vname = (sp: string, rxn: string) => `${sp}__${rxn}`;
  const xname = (sp: string) => `X__${sp}`;

  const bounds: LPBound[] = [];
  const constraints: LPConstraint[] = [];

  for (const sp of species) {
    // Flux variable bounds (coupling constraints tighten these).
    for (const r of sp.reactions) {
      bounds.push({ name: vname(sp.id, r.id), lb: Math.min(0, r.lowerBound), ub: Math.max(0, r.upperBound) });
    }
    // Abundance variable.
    bounds.push({ name: xname(sp.id), lb: 0, ub: 1 });

    // Per-species internal mass balance (shared metabolites excluded — pooled below).
    for (const met of sp.metabolites) {
      if (shared.has(met)) continue;
      const vars = sp.reactions
        .filter((r) => r.stoichiometry[met] !== undefined)
        .map((r) => ({ name: vname(sp.id, r.id), coef: r.stoichiometry[met] }));
      constraints.push({ name: `${sp.id}__bal__${met}`, vars, lb: 0, ub: 0 });
    }

    // Flux-abundance coupling: lb_j*X <= v <= ub_j*X.
    for (const r of sp.reactions) {
      constraints.push({
        name: `${sp.id}__${r.id}__ub_couple`,
        vars: [{ name: vname(sp.id, r.id), coef: 1 }, { name: xname(sp.id), coef: -r.upperBound }],
        lb: -Infinity,
        ub: 0,
      });
      constraints.push({
        name: `${sp.id}__${r.id}__lb_couple`,
        vars: [{ name: vname(sp.id, r.id), coef: 1 }, { name: xname(sp.id), coef: -r.lowerBound }],
        lb: 0,
        ub: Infinity,
      });
    }

    // Biomass-abundance coupling: v_biomass - mu*X = 0.
    constraints.push({
      name: `${sp.id}__growthcouple`,
      vars: [{ name: vname(sp.id, sp.biomassReaction), coef: 1 }, { name: xname(sp.id), coef: -mu }],
      lb: 0,
      ub: 0,
    });
  }

  // Community shared-pool balance: sum over all species/reactions of S[m]*v = 0.
  for (const m of sharedMetabolites) {
    const vars: LPVariable[] = [];
    for (const sp of species) {
      for (const r of sp.reactions) {
        if (r.stoichiometry[m] !== undefined) vars.push({ name: vname(sp.id, r.id), coef: r.stoichiometry[m] });
      }
    }
    constraints.push({ name: `pool__${m}`, vars, lb: 0, ub: 0 });
  }

  // Normalization: sum X_i = 1.
  constraints.push({
    name: 'community__abundance_sum',
    vars: species.map((sp) => ({ name: xname(sp.id), coef: 1 })),
    lb: 1,
    ub: 1,
  });

  // Objective: feasibility (maximize first species' biomass for a direction).
  const objective: LPVariable[] = [{ name: vname(species[0].id, species[0].biomassReaction), coef: 1 }];

  return { name: `steadycom_community_mu${mu.toFixed(4)}`, sense: 'maximize', objective, constraints, bounds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/steadyComJointLP.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/fbaSteadyCom.ts __tests__/steadyComJointLP.test.ts
git commit -m "feat(steadycom): joint community LP builder with shared-pool + abundance coupling"
```

---

## Task 2: Rewire `steadyCom` bisection to the joint LP + correct provenance

**Files:**
- Modify: `src/server/fbaSteadyCom.ts` (`steadyCom` main loop; header citation)
- Modify: `__tests__/steadyCom.test.ts` (update expectations to coupled behavior)

**Interfaces:**
- Consumes: `buildCommunityLPModel` (Task 1)
- Produces: `steadyCom(species, sharedMetabolites, maxIterations?, tolerance?)` — same signature, now enforces coupling. Returns `SteadyComResult` with `speciesFluxes` = per-species map of reaction→flux (from joint primals, de-namespaced) and `speciesGrowthRates[sp] = primals["{sp}__{biomass}"]`.

- [ ] **Step 1: Write the failing test** (syntrophy + conservation)

```ts
// append to __tests__/steadyCom.test.ts
import { steadyCom, buildCommunityLPModel } from '../src/server/fbaSteadyCom';
import type { SteadyComSpecies } from '../src/server/fbaSteadyCom';

// Producer P ferments substrate -> shared_c (+ grows); Consumer C grows ONLY on shared_c.
const producer: SteadyComSpecies = {
  id: 'P', name: 'P', biomassReaction: 'BIO_P', metabolites: ['s', 'p_int'],
  reactions: [
    { id: 'UP_S', stoichiometry: { s: 1 }, lowerBound: 0, upperBound: 10 },
    { id: 'FERM', stoichiometry: { s: -1, p_int: 1, shared_c: 1 }, lowerBound: 0, upperBound: 100 },
    { id: 'BIO_P', stoichiometry: { p_int: -1 }, lowerBound: 0, upperBound: 100 },
  ],
};
const consumer: SteadyComSpecies = {
  id: 'C', name: 'C', biomassReaction: 'BIO_C', metabolites: ['c_int'],
  reactions: [
    { id: 'UP_C', stoichiometry: { shared_c: -1, c_int: 1 }, lowerBound: 0, upperBound: 100 },
    { id: 'BIO_C', stoichiometry: { c_int: -1 }, lowerBound: 0, upperBound: 100 },
  ],
};

describe('steadyCom cross-feeding (coupled)', () => {
  it('consumer that cannot grow alone grows in community on producer secretion (syntrophy)', async () => {
    // Consumer alone: no shared_c source -> community of just C cannot grow.
    const soloC = await steadyCom([consumer], ['shared_c']);
    expect(soloC.communityGrowthRate).toBeCloseTo(0, 4);
    // Community P+C: C grows on P's secreted shared_c.
    const comm = await steadyCom([producer, consumer], ['shared_c']);
    expect(comm.status).toBe('optimal');
    expect(comm.communityGrowthRate).toBeGreaterThan(0);
  });

  it('shared pool is conserved: total secretion = total uptake', async () => {
    const comm = await steadyCom([producer, consumer], ['shared_c']);
    const secreted = comm.speciesFluxes['P']['FERM'];       // produces shared_c (coef +1)
    const consumed = comm.speciesFluxes['C']['UP_C'];        // consumes shared_c (coef -1)
    expect(secreted).toBeGreaterThan(0);
    expect(secreted).toBeCloseTo(consumed, 4);
  });

  it('is deterministic', async () => {
    const a = await steadyCom([producer, consumer], ['shared_c']);
    const b = await steadyCom([producer, consumer], ['shared_c']);
    expect(b.communityGrowthRate).toBe(a.communityGrowthRate);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/steadyCom.test.ts -t "cross-feeding"`
Expected: FAIL — current `steadyCom` ignores the pool, `communityGrowthRate` for the community does not reflect coupling / conservation assertion fails.

- [ ] **Step 3: Rewrite the `steadyCom` main loop and correct the header**

Replace the file header's provenance block so it cites the verified SteadyCom reference (remove the `Heinken et al., 2015` attribution for "the SteadyCom algorithm"):

```ts
 * @scientific_provenance
 *   REFERENCE: Chan SHJ, Simons MN, Maranas CD (2017).
 *     "SteadyCom: Predicting microbial abundances while ensuring community stability."
 *     PLOS Computational Biology 13(5): e1005539. DOI 10.1371/journal.pcbi.1005539.
 *   ALGORITHM: SteadyCom -- one joint LP over all species (per-species mass balance +
 *     shared extracellular pool coupling + biomass-abundance coupling + sum(X)=1),
 *     bisection on community growth rate mu.
```

Replace the body of `steadyCom` so each bisection feasibility check solves ONE joint LP via `buildCommunityLPModel`, and results are read from the joint primals:

```ts
export async function steadyCom(
  species: SteadyComSpecies[],
  sharedMetabolites: string[],
  maxIterations = 100,
  tolerance = 1e-6,
): Promise<SteadyComResult> {
  for (const sp of species) {
    if (!sp.reactions.find((r) => r.id === sp.biomassReaction)) {
      return { status: 'error', communityGrowthRate: 0, speciesFluxes: {}, speciesGrowthRates: {}, iterations: 0, convergenceHistory: [] };
    }
  }

  const check = async (mu: number) => solveLP(buildCommunityLPModel(species, sharedMetabolites, mu));

  // mu = 0 must be feasible (no growth).
  const zero = await check(0);
  if (zero.status !== 'optimal') {
    return { status: 'infeasible', communityGrowthRate: 0, speciesFluxes: {}, speciesGrowthRates: {}, iterations: 0, convergenceHistory: [] };
  }

  // Upper bound: max individual growth over species (community mu cannot exceed the fastest single species' unconstrained max). Use existing findMaxGrowthRate.
  let muHigh = 0;
  for (const sp of species) muHigh = Math.max(muHigh, await findMaxGrowthRate(sp));
  if (muHigh <= 0) {
    return { status: 'optimal', communityGrowthRate: 0, speciesFluxes: readFluxes(species, zero.primals), speciesGrowthRates: readGrowth(species, zero.primals), iterations: 0, convergenceHistory: [0] };
  }

  let muLow = 0;
  let best = zero;
  const convergenceHistory: number[] = [];
  let iterations = 0;
  while (muHigh - muLow > tolerance && iterations < maxIterations) {
    iterations++;
    const muMid = (muLow + muHigh) / 2;
    convergenceHistory.push(round(muMid));
    const sol = await check(muMid);
    if (sol.status === 'optimal') { muLow = muMid; best = sol; } else { muHigh = muMid; }
  }

  return {
    status: 'optimal',
    communityGrowthRate: round(muLow),
    speciesFluxes: readFluxes(species, best.primals),
    speciesGrowthRates: readGrowth(species, best.primals),
    iterations,
    convergenceHistory,
  };
}

// De-namespace joint primals back to per-species reaction fluxes.
function readFluxes(species: SteadyComSpecies[], primals: Record<string, number>): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const sp of species) {
    out[sp.id] = {};
    for (const r of sp.reactions) out[sp.id][r.id] = round(primals[`${sp.id}__${r.id}`] ?? 0);
  }
  return out;
}
function readGrowth(species: SteadyComSpecies[], primals: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sp of species) out[sp.id] = round(primals[`${sp.id}__${sp.biomassReaction}`] ?? 0);
  return out;
}
```

Delete the now-unused `buildSpeciesLPModel` / `checkSpeciesFeasibility` if nothing else references them (grep first; `findMaxGrowthRate` / `buildMaxGrowthLPModel` stay).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/steadyCom.test.ts`
Expected: PASS. If pre-existing cases asserted the old `min(individual)` behavior, update them to the coupled semantics (syntrophy/conservation). Do not re-add a `mu <= min(individual)` assertion.

- [ ] **Step 5: Commit**

```bash
git add src/server/fbaSteadyCom.ts __tests__/steadyCom.test.ts
git commit -m "feat(steadycom): joint-LP bisection with real pool coupling; correct citation to Chan 2017"
```

---

## Task 3: Curated community model + `buildCommunityModel(request)`

**Files:**
- Create: `src/data/communityModel.ts`
- Test: `__tests__/communityModel.test.ts` (create)

**Interfaces:**
- Consumes: `SteadyComSpecies` (fbaSteadyCom), `steadyCom` (Task 2)
- Produces:
  - `export const COMMUNITY_SHARED_METABOLITES: string[]` (e.g. `['acetate_e','ethanol_e']`)
  - `export interface CommunityModelRequest { ecoli:{glucoseUptake?:number;oxygenUptake?:number}; yeast:{glucoseUptake?:number;oxygenUptake?:number}; alpha?:number }`
  - `export function buildCommunityModel(req: CommunityModelRequest): { species: SteadyComSpecies[]; sharedMetabolites: string[]; fixedAbundance?: Record<string,number> }`

**Modeling (literature-grounded; stoichiometry only):**
- E. coli species `ecoli`: glucose uptake → glycolysis → acetyl-CoA → {BIOMASS, acetate overflow `EX_ac: accoa → acetate_e` (Basan 2015)}; ethanol uptake `UP_etoh: ethanol_e → accoa`.
- Yeast species `yeast`: glucose uptake → glycolysis → pyruvate → {BIOMASS, ethanol fermentation `EX_etoh: pyr → ethanol_e` (De Deken 1966)}; acetate uptake `UP_ac: acetate_e → accoa_y`.
- Shared pool: `acetate_e`, `ethanol_e` (extracellular, community-balanced).
- `glucoseUptake`/`oxygenUptake` set the upper bounds of each species' uptake reactions; `alpha` (if provided, 0<α<1) is returned as `fixedAbundance = { yeast: α, ecoli: 1-α }` for the engine to impose.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/communityModel.test.ts
import { buildCommunityModel, COMMUNITY_SHARED_METABOLITES } from '../src/data/communityModel';
import { steadyCom } from '../src/server/fbaSteadyCom';

describe('communityModel', () => {
  it('builds two species with biomass + shared-pool exchange reactions', () => {
    const { species, sharedMetabolites } = buildCommunityModel({ ecoli: { glucoseUptake: 10 }, yeast: { glucoseUptake: 10 } });
    expect(species.map((s) => s.id).sort()).toEqual(['ecoli', 'yeast']);
    expect(sharedMetabolites).toEqual(COMMUNITY_SHARED_METABOLITES);
    for (const sp of species) expect(sp.reactions.find((r) => r.id === sp.biomassReaction)).toBeTruthy();
    // at least one exchange reaction touches a shared metabolite in each species
    for (const sp of species) {
      const touchesShared = sp.reactions.some((r) => sharedMetabolites.some((m) => r.stoichiometry[m] !== undefined));
      expect(touchesShared).toBe(true);
    }
  });

  it('produces real cross-feeding when run through steadyCom', async () => {
    const { species, sharedMetabolites } = buildCommunityModel({ ecoli: { glucoseUptake: 10 }, yeast: { glucoseUptake: 10 } });
    const res = await steadyCom(species, sharedMetabolites);
    expect(res.status).toBe('optimal');
    expect(res.communityGrowthRate).toBeGreaterThan(0);
  });

  it('cross-feeding sensitivity: removing yeast ethanol secretion lowers community growth', async () => {
    const base = buildCommunityModel({ ecoli: { glucoseUptake: 0 }, yeast: { glucoseUptake: 10 } }); // ecoli has no glucose -> depends on ethanol
    const withSecretion = await steadyCom(base.species, base.sharedMetabolites);
    const knocked = buildCommunityModel({ ecoli: { glucoseUptake: 0 }, yeast: { glucoseUptake: 10 } });
    const y = knocked.species.find((s) => s.id === 'yeast')!;
    y.reactions = y.reactions.filter((r) => r.id !== 'EX_etoh'); // knock out ethanol secretion
    const withoutSecretion = await steadyCom(knocked.species, knocked.sharedMetabolites);
    expect(withSecretion.communityGrowthRate).toBeGreaterThan(withoutSecretion.communityGrowthRate);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/communityModel.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/data/communityModel.ts`**

Write the module with a `@scientific_provenance` header citing Chan 2017 (method), Basan 2015 (acetate overflow), De Deken 1966 (Crabtree ethanol), each with DOI/PMID. Define `COMMUNITY_SHARED_METABOLITES = ['acetate_e','ethanol_e']`, the two `SteadyComSpecies` with the reactions described above (glycolysis chain expressed as stoichiometry maps + secretion/uptake reactions touching `acetate_e`/`ethanol_e`), and `buildCommunityModel(req)` that clones the base species, sets uptake `upperBound` from `glucoseUptake`/`oxygenUptake`, and returns `{ species, sharedMetabolites, fixedAbundance }`. Keep the model minimal but mass-consistent (each internal metabolite balanced). No scalar outputs — only stoichiometry and bounds.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/communityModel.test.ts`
Expected: PASS (3 tests). Tune reaction bounds/stoichiometry until the syntrophy + sensitivity cases hold (they must hold because of real coupling, not tuning of outputs).

- [ ] **Step 5: Commit**

```bash
git add src/data/communityModel.ts __tests__/communityModel.test.ts
git commit -m "feat(fba): curated literature-grounded 2-species community model"
```

---

## Task 4: Rewrite `solveAuthorityCommunityFBA` in place

**Files:**
- Modify: `src/server/fbaEngine.ts` (`solveAuthorityCommunityFBA` — replace body; delete magic constants)
- Modify: `__tests__/fbaEngine.test.ts`, `__tests__/api/fba-route.test.ts`, `__tests__/FBAAuthorityClient.test.ts` (community expectations → real behavior)

**Interfaces:**
- Consumes: `buildCommunityModel` (Task 3), `steadyCom` (Task 2)
- Produces: `solveAuthorityCommunityFBA(request: CommunityFBARequest): Promise<CommunityFBAOutput>` (same signature/shape)

- [ ] **Step 1: Write the failing test**

```ts
// append to __tests__/fbaEngine.test.ts
import { solveAuthorityCommunityFBA } from '../src/server/fbaEngine';

describe('solveAuthorityCommunityFBA (real SteadyCom)', () => {
  it('returns real cross-feeding exchange fluxes and positive community growth', async () => {
    const out = await solveAuthorityCommunityFBA({
      objective: 'biomass', ecoli: { glucoseUptake: 10, oxygenUptake: 20 }, yeast: { glucoseUptake: 10, oxygenUptake: 20 },
    } as any);
    expect(out.communityGrowthRate).toBeGreaterThan(0);
    expect(Array.isArray(out.exchangeFluxes)).toBe(true);
    // exchange fluxes are derived from the solve (finite numbers), not magic constants
    for (const ex of out.exchangeFluxes) expect(Number.isFinite(ex.flux)).toBe(true);
  });

  it('is deterministic for identical requests', async () => {
    const req = { objective: 'biomass', ecoli: { glucoseUptake: 10 }, yeast: { glucoseUptake: 10 } } as any;
    const a = await solveAuthorityCommunityFBA(req);
    const b = await solveAuthorityCommunityFBA(req);
    expect(b.communityGrowthRate).toBe(a.communityGrowthRate);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/fbaEngine.test.ts -t "real SteadyCom"`
Expected: FAIL — current body still uses the magic-constant blend (may pass growth>0 but the magic constants remain; this test drives the rewrite and later grep guards).

- [ ] **Step 3: Replace the `solveAuthorityCommunityFBA` body**

Rewrite to: `buildCommunityModel({ ecoli, yeast, alpha })` → `steadyCom(species, sharedMetabolites)` (or fixed-abundance variant if `alpha` given — see note) → map to `CommunityFBAOutput`:
- `communityGrowthRate` / `communityBiomassObjective` = `result.communityGrowthRate`.
- per-species `growthRate` = `result.speciesGrowthRates[id]`.
- `exchangeFluxes` = for each shared metabolite, read the real secretion/uptake reaction flux from `result.speciesFluxes` and emit `{ id:`EX_${m}`, metabolite, fromStrain, toStrain, flux }` (fromStrain = the species whose reaction has +coef for m; flux = that reaction's flux).
Delete the `1.6/2.4/1.4/2/0.018` constants and the `MOCK_DATA` comment block.

Note on `alpha` fixed abundance: if `buildCommunityModel` returned `fixedAbundance`, impose it by adding equality constraints on `X__{id}` — implement by extending `steadyCom` to accept an optional `fixedAbundance?: Record<string,number>` param that adds `X__id = value` constraints in `buildCommunityLPModel` (thread the param through). If `alpha` is undefined, abundances are optimized. Add a focused test for the fixed-abundance path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/fbaEngine.test.ts __tests__/api/fba-route.test.ts __tests__/FBAAuthorityClient.test.ts`
Expected: PASS. Update any community expectations in those files that assumed the old blend.

- [ ] **Step 5: Commit**

```bash
git add src/server/fbaEngine.ts __tests__/fbaEngine.test.ts __tests__/api/fba-route.test.ts __tests__/FBAAuthorityClient.test.ts
git commit -m "feat(fba): real SteadyCom community FBA; delete fabricated cross-feeding heuristic"
```

---

## Task 5: Reconcile mockFBA, validity tier, honesty test, remaining suites

**Files:**
- Modify: `src/data/mockFBA.ts` (remove disconnected `SHARED_METABOLITES` edge-list once unused)
- Modify: `src/config/toolValidity.ts` (fbasim caption)
- Modify: `__tests__/communityFbaHonesty.test.ts` (strengthen), `__tests__/consortiumDesignEngine.test.ts`, `__tests__/engine-integration.test.ts`, `__tests__/performance/fbaBenchmark.test.ts`

- [ ] **Step 1: Add anti-fabrication guard test**

```ts
// __tests__/communityFbaHonesty.test.ts — add
import * as fs from 'fs';
import * as path from 'path';
it('community FBA source contains no magic cross-feeding constants', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/server/fbaEngine.ts'), 'utf8');
  const body = src.slice(src.indexOf('solveAuthorityCommunityFBA'));
  expect(body).not.toMatch(/0\.018|\* 1\.6|\* 2\.4|\* 1\.4/);
});
it('syntrophy: a species with no carbon grows only via community cross-feeding', async () => {
  const { buildCommunityModel } = await import('../src/data/communityModel');
  const { steadyCom } = await import('../src/server/fbaSteadyCom');
  const m = buildCommunityModel({ ecoli: { glucoseUptake: 0 }, yeast: { glucoseUptake: 10 } });
  const res = await steadyCom(m.species, m.sharedMetabolites);
  expect(res.speciesGrowthRates['ecoli']).toBeGreaterThan(0); // grows on yeast ethanol
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/communityFbaHonesty.test.ts`
Expected: FAIL until Task 4 constants are removed / model wired (may already pass the grep if Task 4 done — run after).

- [ ] **Step 3: Reconcile + caption**

Grep consumers of `SHARED_METABOLITES` in `mockFBA.ts`; if only the old heuristic used it, remove it (its real replacement is `COMMUNITY_SHARED_METABOLITES`). Update the `fbasim` caption in `toolValidity.ts`:

```
"Single-species FBA: real two-phase simplex LP (HiGHS) on iJO1366. Community mode: real SteadyCom joint LP (Chan et al. 2017) — shared extracellular pool coupling + biomass-abundance coupling, bisection on community growth rate; cross-feeding emerges from stoichiometry. Community metabolic model is a curated small 2-species model (glycolysis + literature overflow secretion: E. coli acetate, yeast ethanol) — method is real, absolute numbers illustrative at this scale."
```

- [ ] **Step 4: Run affected suites**

Run: `npx jest __tests__/communityFbaHonesty.test.ts __tests__/consortiumDesignEngine.test.ts __tests__/engine-integration.test.ts __tests__/performance/fbaBenchmark.test.ts`
Expected: PASS (update any community expectations to the new real behavior).

- [ ] **Step 5: Commit**

```bash
git add src/data/mockFBA.ts src/config/toolValidity.ts __tests__/communityFbaHonesty.test.ts __tests__/consortiumDesignEngine.test.ts __tests__/engine-integration.test.ts __tests__/performance/fbaBenchmark.test.ts
git commit -m "chore(fba): reconcile mockFBA, update validity tier + honesty tests for real community FBA"
```

---

## Task 6: Analytic ground-truth + Python reference (honestly blocked)

**Files:**
- Test: `__tests__/communityFbaGroundTruth.test.ts` (create)
- Create: `reference_impl_py/scientific/community_fba_reference.py`
- Modify: `reference_impl_py/scientific/README.md` (add a status row)

- [ ] **Step 1: Write the analytic ground-truth test**

```ts
// __tests__/communityFbaGroundTruth.test.ts
import { steadyCom } from '../src/server/fbaSteadyCom';
import type { SteadyComSpecies } from '../src/server/fbaSteadyCom';
// Minimal analytically-solvable community: producer converts 10 s -> 10 shared_c,
// consumer needs 1 shared_c per biomass; with balanced growth mu the closed-form
// community mu is derivable. Assert engine matches the hand-derived value.
it('matches the analytic community growth rate for a solvable toy model', async () => {
  const P: SteadyComSpecies = { id:'P', name:'P', biomassReaction:'BIO_P', metabolites:['s','pi'],
    reactions:[
      { id:'UP_S', stoichiometry:{s:1}, lowerBound:0, upperBound:10 },
      { id:'FERM', stoichiometry:{s:-1, pi:1, shared_c:1}, lowerBound:0, upperBound:100 },
      { id:'BIO_P', stoichiometry:{pi:-1}, lowerBound:0, upperBound:100 },
    ] };
  const C: SteadyComSpecies = { id:'C', name:'C', biomassReaction:'BIO_C', metabolites:['ci'],
    reactions:[
      { id:'UP_C', stoichiometry:{shared_c:-1, ci:1}, lowerBound:0, upperBound:100 },
      { id:'BIO_C', stoichiometry:{ci:-1}, lowerBound:0, upperBound:100 },
    ] };
  const res = await steadyCom([P, C], ['shared_c']);
  // Derivation documented in reference_impl_py/scientific/community_fba_reference.py.
  const ANALYTIC = /* fill from the hand derivation once bounds are fixed */ res.communityGrowthRate;
  expect(res.communityGrowthRate).toBeCloseTo(ANALYTIC, 3);
});
```
(When implementing, replace `ANALYTIC` with the literal hand-derived number and document the derivation in the Python file; do not leave it equal to the engine output.)

- [ ] **Step 2: Run to verify it fails, then set the analytic constant**

Run: `npx jest __tests__/communityFbaGroundTruth.test.ts`
Fix `ANALYTIC` to the derived literal; expected PASS.

- [ ] **Step 3: Add the Python reference + README row**

`community_fba_reference.py`: a `micom`/`cobra` community-FBA that reproduces the toy model and prints community μ, plus a comment with the analytic derivation. `README.md`: add a status row "Community FBA | steadyCom | micom/cobra reference | ❌ needs Python | BLOCKED (no system Python)".

- [ ] **Step 4: Run**

Run: `npx jest __tests__/communityFbaGroundTruth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add __tests__/communityFbaGroundTruth.test.ts reference_impl_py/scientific/community_fba_reference.py reference_impl_py/scientific/README.md
git commit -m "test(fba): analytic ground-truth for community FBA + Python reference (blocked)"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx jest __tests__/steadyCom.test.ts __tests__/steadyComJointLP.test.ts __tests__/communityModel.test.ts __tests__/fbaEngine.test.ts __tests__/communityFbaHonesty.test.ts __tests__/communityFbaGroundTruth.test.ts __tests__/api/fba-route.test.ts` → all pass
- [ ] `npx jest` (full suite, `--forceExit`) → all pass
- [ ] Grep guard: no `0.018|* 1.6|* 2.4|* 1.4` magic constants remain in `solveAuthorityCommunityFBA`
</content>
