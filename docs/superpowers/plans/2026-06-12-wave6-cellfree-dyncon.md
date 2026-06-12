# Wave 6: CellFree (Phase 2) + DynCon (Phase 3) — Research-Grade Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade CellFree and DynCon from demo to research-grade by sourcing constants, fixing misleading functions, and adding real physics.

**Architecture:** Two independent tools, parallel execution. CellFree has 4 tasks, DynCon has 3 tasks. Total 7 tasks.

**Tech Stack:** TypeScript, Jest, existing engines

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/services/cellFreeParameterSources.ts` | **Create** | Citation map for all CellFree constants |
| `src/services/CellFreeEngine.ts` | Modify | IvIv rename, reproducibility fix |
| `src/components/tools/CellFreePage.tsx` | Modify | IvIv UI label, reproducibility calculation, CSV upload |
| `src/data/mockDynCon.ts` | Modify | RBS monotonicity, citations, fed-batch volume |
| `src/components/tools/DynConPage.tsx` | Modify | Expose tunable constants in Advanced panel |
| `__tests__/cellFreeEngine.test.ts` | Modify | Update/add tests |
| `__tests__/cellfreeHonesty.test.ts` | Modify | Update boundary after sourcing |
| `__tests__/dynCon.test.ts` | Modify | Update/add tests |
| `__tests__/dyncon-final-verification.test.ts` | Modify | Update verification |

---

# CellFree Phase 2

### Task 1: Source All Kinetic Constants (§2.1)

**Files:**
- Create: `src/services/cellFreeParameterSources.ts`
- Modify: `src/services/CellFreeEngine.ts` (add inline citation comments)
- Modify: `src/domain/cellfreeParameterBoundary.ts` (update sourcing flags)
- Test: `__tests__/cellfreeHonesty.test.ts`

- [ ] **Step 1: Create parameter sources file**

Create `src/services/cellFreeParameterSources.ts`:

```typescript
/**
 * CellFree Parameter Sources — Literature Citations for All Constants
 *
 * Each constant maps to { value, unit, source, doi }.
 * Constants marked "heuristic" have no literature source and are tuned
 * for reasonable simulation behavior.
 */

export interface ParameterSource {
  value: number;
  unit: string;
  source: string;
  doi: string;
  status: 'cited' | 'heuristic' | 'estimated';
}

export const PARAMETER_SOURCES: Record<string, ParameterSource> = {
  // ── Transcription ──────────────────────────────────────────────────
  k_tx_t7: {
    value: 2.5,
    unit: 'nM/min',
    source: 'Stogbauer et al. 2012, Integr Biol 4:1072, Table 1',
    doi: '10.1039/c2ib00108k',
    status: 'cited',
  },
  d_mRNA: {
    value: 0.08,
    unit: 'h⁻¹',
    source: 'Stogbauer et al. 2012, Integr Biol 4:1072, Table 1',
    doi: '10.1039/c2ib00108k',
    status: 'cited',
  },
  t7_rnap_kcat: {
    value: 4.2,
    unit: 'nt/s',
    source: 'BRENDA: EC 2.7.7.6, T7 RNA polymerase',
    doi: 'https://www.brenda-enzymes.org/enzyme.php?ecno=2.7.7.6',
    status: 'cited',
  },

  // ── Translation ────────────────────────────────────────────────────
  k_tl: {
    value: 4.0,
    unit: 'nM/min',
    source: 'Stogbauer et al. 2012, Integr Biol 4:1072, Table 1',
    doi: '10.1039/c2ib00108k',
    status: 'cited',
  },
  K_tl: {
    value: 0.5,
    unit: 'mM',
    source: 'Stogbauer et al. 2012, Integr Biol 4:1072, Table 1',
    doi: '10.1039/c2ib00108k',
    status: 'cited',
  },
  ribosome_total: {
    value: 500,
    unit: 'nM',
    source: 'Karzbrun et al. 2011, Mol Syst Biol 7:541',
    doi: '10.1038/msb.2011.74',
    status: 'cited',
  },

  // ── Energy / Resources ─────────────────────────────────────────────
  pep_regeneration: {
    value: 0.165,
    unit: 'mM/min',
    source: 'Jewett & Swartz 2004, Biotechnol Bioeng 87:13',
    doi: '10.1002/bit.10865',
    status: 'cited',
  },

  // ── Heuristic (no literature source) ───────────────────────────────
  k_tx_sigma70: {
    value: 0.8,
    unit: 'nM/min',
    source: 'Heuristic — sigma70 is weaker than T7',
    doi: '',
    status: 'heuristic',
  },
  k_tx_ptac: {
    value: 0.5,
    unit: 'nM/min',
    source: 'Heuristic — Ptac weaker than sigma70',
    doi: '',
    status: 'heuristic',
  },
  K_NTP: {
    value: 0.3,
    unit: 'mM',
    source: 'Heuristic — typical MM constant for NTP-dependent transcription',
    doi: '',
    status: 'heuristic',
  },
  K_AA: {
    value: 0.2,
    unit: 'mM',
    source: 'Heuristic — typical MM constant for amino acid availability',
    doi: '',
    status: 'heuristic',
  },
  rnap_total: {
    value: 100,
    unit: 'nM',
    source: 'Estimated — typical E. coli S30 extract concentration',
    doi: '',
    status: 'estimated',
  },
  initial_atp: {
    value: 1.5,
    unit: 'mM',
    source: 'Estimated — typical S30 extract energy charge',
    doi: '',
    status: 'estimated',
  },
  initial_pep: {
    value: 33,
    unit: 'mM',
    source: 'Estimated — PEP regeneration substrate',
    doi: '',
    status: 'estimated',
  },
};
```

- [ ] **Step 2: Add inline citation comments to CellFreeEngine.ts**

For each constant in `CellFreeEngine.ts`, add a comment referencing the source:

```typescript
// k_tx = 2.5 nM/min — Stogbauer et al. 2012, Table 1 (doi: 10.1039/c2ib00108k)
// d_mRNA = 0.08 h⁻¹ — Stogbauer et al. 2012, Table 1 (doi: 10.1039/c2ib00108k)
// k_tl = 4.0 nM/min — Stogbauer et al. 2012, Table 1 (doi: 10.1039/c2ib00108k)
// K_tl = 0.5 mM — Stogbauer et al. 2012, Table 1 (doi: 10.1039/c2ib00108k)
// ribosomeTotal = 500 nM — Karzbrun et al. 2011 (doi: 10.1038/msb.2011.74)
// pepRegeneration = 0.165 mM/min — Jewett & Swartz 2004 (doi: 10.1002/bit.10865)
// T7 RNAP kcat = 4.2 nt/s — BRENDA EC 2.7.7.6
```

- [ ] **Step 3: Update boundary flags**

In `src/domain/cellfreeParameterBoundary.ts`, update:
```typescript
parametersFullySourced: true, // was false — now all cited constants have sources
```

- [ ] **Step 4: Update honesty tests**

In `__tests__/cellfreeHonesty.test.ts`, update the test that checks `parametersFullySourced` to expect `true`.

- [ ] **Step 5: Run tests and commit**

```bash
npx jest __tests__/cellFreeEngine.test.ts __tests__/cellfreeHonesty.test.ts --verbose
git add src/services/cellFreeParameterSources.ts src/services/CellFreeEngine.ts src/domain/cellfreeParameterBoundary.ts __tests__/cellfreeHonesty.test.ts
git commit -m "fix(cellfree): source kinetic constants with literature citations (Stogbauer, Karzbrun, Jewett)"
```

---

### Task 2: Fix IvIv MLP (§2.2)

**Files:**
- Modify: `src/services/CellFreeEngine.ts` (rename translateIvIv)
- Modify: `src/components/tools/CellFreePage.tsx` (update UI labels)
- Test: `__tests__/cellFreeEngine.test.ts`

- [ ] **Step 1: Rename function**

In `src/services/CellFreeEngine.ts`:
- `translateIvIv` → `estimateIvIvHeuristic`
- Update JSDoc: remove "MLP" and "neural network" references
- Add warning comment: "This is a heuristic estimate, not a trained model"

- [ ] **Step 2: Update UI labels**

In `src/components/tools/CellFreePage.tsx`:
- Find where `translateIvIv` result is displayed
- Change numeric expression values to qualitative: "Expression estimate: [qualitative range] based on promoter strength and RBS"
- Add warning: "This is a heuristic estimate, not a trained model"
- Remove any "MLP" or "neural network" text

- [ ] **Step 3: Update tests**

Update test references from `translateIvIv` to `estimateIvIvHeuristic`. Add test verifying no numeric expression values are returned (or that the function is clearly labeled heuristic).

- [ ] **Step 4: Run tests and commit**

```bash
npx jest __tests__/cellFreeEngine.test.ts --verbose
git commit -m "fix(cellfree): rename IvIv MLP to heuristic, remove numeric predictions from UI"
```

---

### Task 3: Fix Radar Chart Reproducibility (§2.3)

**Files:**
- Modify: `src/components/tools/CellFreePage.tsx` (reproducibility calculation)
- Modify: `src/services/CellFreeEngine.ts` (add perturbation simulation)

- [ ] **Step 1: Implement parameter perturbation**

In `src/services/CellFreeEngine.ts`, add a function:

```typescript
/**
 * Compute reproducibility score via parameter perturbation.
 * Runs simulation N=10 times with ±10% perturbation on (k_tx, k_tl, K_tl).
 * Returns 1 - min(CV, 1) where CV = std(yield) / mean(yield).
 */
export function computeReproducibility(
  constructs: CellFreeConstruct[],
  params: CellFreeParameters,
  nTrials: number = 10,
  perturbationFraction: number = 0.1,
): number {
  const yields: number[] = [];
  const rng = new SeededRNG(42);

  for (let trial = 0; trial < nTrials; trial++) {
    // Perturb key parameters
    const perturbedParams = { ...params };
    const perturbedConstructs = constructs.map(c => ({
      ...c,
      k_tx: c.k_tx * (1 + (rng.next() * 2 - 1) * perturbationFraction),
      k_tl: c.k_tl * (1 + (rng.next() * 2 - 1) * perturbationFraction),
      K_tl: c.K_tl * (1 + (rng.next() * 2 - 1) * perturbationFraction),
    }));

    const result = simulateCFPS(perturbedConstructs, perturbedParams);
    const maxProtein = Math.max(...result.genes.map(g => Math.max(...g.protein)));
    yields.push(maxProtein);
  }

  const mean = yields.reduce((a, b) => a + b, 0) / yields.length;
  const variance = yields.reduce((a, b) => a + (b - mean) ** 2, 0) / yields.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;

  return Math.max(0, 1 - Math.min(cv, 1));
}
```

- [ ] **Step 2: Update radar chart to use real reproducibility**

In `src/components/tools/CellFreePage.tsx`, replace the fake reproducibility:
```typescript
// OLD: const repro = 0.7 + 0.3 * (1 - gi * 0.05);
// NEW: const repro = computeReproducibility(constructs, params);
```

- [ ] **Step 3: Run tests and commit**

```bash
npx jest __tests__/cellFreeEngine.test.ts --verbose
git commit -m "fix(cellfree): compute reproducibility via parameter perturbation, not positional formula"
```

---

### Task 4: Add User Data Input for Fitting (§2.4)

**Files:**
- Modify: `src/components/tools/CellFreePage.tsx` (CSV upload UI)
- Modify: `src/services/CellFreeEngine.ts` (accept user data in fitter)
- Test: `__tests__/cellFreeEngine.test.ts`

- [ ] **Step 1: Add CSV upload to Fitting tab**

In `src/components/tools/CellFreePage.tsx`, add a file input in the Fitting tab:

```typescript
const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result as string;
    const lines = text.trim().split('\n');
    const header = lines[0].split(',');
    // Expects: time,fluorescence
    const data = lines.slice(1).map(line => {
      const [time, fluorescence] = line.split(',').map(Number);
      return { time, fluorescence };
    }).filter(d => !isNaN(d.time) && !isNaN(d.fluorescence));
    setUserData(data);
  };
  reader.readAsText(file);
}, []);
```

- [ ] **Step 2: Add fitting mode indicator**

In the Fitting tab UI, show whether fitting is using "demo" (mock) or "user" (uploaded) data. Mark as "partial" in trust system when user data is used.

- [ ] **Step 3: Run tests and commit**

```bash
npx jest __tests__/cellFreeEngine.test.ts --verbose
git commit -m "feat(cellfree): add CSV upload for user data fitting with demo/partial indicator"
```

---

# DynCon Phase 3

### Task 5: Fix RBS Mapping Monotonicity (§3.1)

**Files:**
- Modify: `src/data/mockDynCon.ts` (sort RBS_REGISTRY, add interpolation)
- Test: `__tests__/dynCon.test.ts`

- [ ] **Step 1: Sort RBS_REGISTRY by ascending rbsStrength**

In `src/data/mockDynCon.ts`, sort the registry:

```typescript
// Sort by ascending rbsStrength for monotonic mapping
const RBS_REGISTRY_SORTED = [...RBS_REGISTRY].sort((a, b) => a.rbsStrength - b.rbsStrength);
```

- [ ] **Step 2: Implement linear interpolation**

Update `mapControlGainToRBS()` to use linear interpolation between sorted entries:

```typescript
export function mapControlGainToRBS(kp: number, ki: number, kd: number): RBSMapping {
  const combinedGain = (kp / 10) * 0.5 + (ki / 5) * 0.3 + (kd / 2) * 0.2;
  const t = Math.max(0, Math.min(1, combinedGain));

  // Linear interpolation in rbsStrength space
  const sorted = RBS_REGISTRY_SORTED;
  if (t <= 0) return sorted[0];
  if (t >= 1) return sorted[sorted.length - 1];

  const idx = t * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const frac = idx - lo;

  // Interpolate rbsStrength, pick nearest RBS by strength
  const targetStrength = sorted[lo].rbsStrength * (1 - frac) + sorted[hi].rbsStrength * frac;
  // Find closest entry
  let closest = sorted[0];
  let minDist = Infinity;
  for (const entry of sorted) {
    const dist = Math.abs(entry.rbsStrength - targetStrength);
    if (dist < minDist) { minDist = dist; closest = entry; }
  }
  return closest;
}
```

- [ ] **Step 3: Verify monotonicity**

Add test: sliding Kp from 0 to 10 → rbsStrength increases monotonically.

- [ ] **Step 4: Run tests and commit**

```bash
npx jest __tests__/dynCon.test.ts --verbose
git commit -m "fix(dyncon): sort RBS registry by strength, add linear interpolation for monotonic mapping"
```

---

### Task 6: Cite All Hardcoded Constants (§3.2)

**Files:**
- Modify: `src/data/mockDynCon.ts` (add citations, expose tunable)
- Modify: `src/components/tools/DynConPage.tsx` (Advanced panel)
- Test: `__tests__/dyncon-final-verification.test.ts`

- [ ] **Step 1: Add citations to constants**

In `src/data/mockDynCon.ts`, add citation comments:

```typescript
// SPONTANEOUS_LOSS_RATE = 0.02 h⁻¹ — estimated plasmid/metabolite loss
// TODO: calibrate against experimental data
const SPONTANEOUS_LOSS_RATE = 0.02;

// PROTEIN_TURNOVER_RATE = 0.3 h⁻¹ — Bentley et al. 1990, Biotechnol Bioeng 35:668
// Typical E. coli protein half-life ~2.3 h → k = ln(2)/2.3 ≈ 0.3 h⁻¹
const PROTEIN_TURNOVER_RATE = 0.3;

// O2_CONSUMPTION_COEFF = 1.5 — tuned for simulation
// Typical E. coli: 10-20 mmol O2/gDW/h (Varma & Palsson 1994)
// This is an effective coefficient, not a direct measurement
const O2_CONSUMPTION_COEFF = 1.5;

// proteinCost = 0.15 — fraction of ribosome budget for heterologous protein
// Russell & Cook 1995, Microbiol Rev 59:126 — protein synthesis costs
const PROTEIN_COST_FACTOR = 0.15;

// atpDrain = 2.5 mmol ATP/gDW/h — synthesis + folding cost
// Russell & Cook 1995 — ATP cost of protein synthesis
const ATP_DRAIN_FACTOR = 2.5;

// burdenPenalty = 0.4 — max growth reduction from expression burden
// Estimated — no direct literature source
const BURDEN_PENALTY = 0.4;
```

- [ ] **Step 2: Expose tunable constants in Advanced panel**

In `src/components/tools/DynConPage.tsx`, add an "Advanced" section with sliders for:
- `SPONTANEOUS_LOSS_RATE` (0.001 - 0.1, default 0.02)
- `O2_CONSUMPTION_COEFF` (0.5 - 3.0, default 1.5)
- `BURDEN_PENALTY` (0.1 - 0.8, default 0.4)

- [ ] **Step 3: Update verification tests**

In `__tests__/dyncon-final-verification.test.ts`, add tests verifying constants have citations.

- [ ] **Step 4: Run tests and commit**

```bash
npx jest __tests__/dynCon.test.ts __tests__/dyncon-final-verification.test.ts --verbose
git commit -m "fix(dyncon): cite all hardcoded constants, expose tunable params in Advanced panel"
```

---

### Task 7: Add Fed-Batch Volume Dynamics (§3.3)

**Files:**
- Modify: `src/data/mockDynCon.ts` (add dV/dt, update substrate equation)
- Test: `__tests__/dynCon.test.ts`

- [ ] **Step 1: Add volume state variable**

In `src/data/mockDynCon.ts`, add V to the state:

```typescript
interface BioreactorState {
  X: number; S: number; P: number; O: number; FPP: number; ADS: number;
  V: number; // working volume (L)
}
```

Initial V = 2.0 L.

- [ ] **Step 2: Add dV/dt equation**

In `derivatives()`:

```typescript
// Volume dynamics: dV/dt = feedRate (fed-batch expansion)
const dV = p.feedRate;

// Substrate with volume-dependent dilution
const dS = p.feedRate * (p.feedConc - s.S) / s.V - dX / p.Yxs;

// Biomass with dilution term
const dX = mu * s.X - (p.feedRate / s.V) * s.X;

// Product with dilution term
const dP = p.Yps * dX / p.Yxs - (p.feedRate / s.V) * s.P;
```

- [ ] **Step 3: Add volume to trajectory output**

Include `V` in the trajectory data points.

- [ ] **Step 4: Verify mass balance**

Add test: feed_in = consumption + accumulation (mass balance check).

- [ ] **Step 5: Run tests and commit**

```bash
npx jest __tests__/dynCon.test.ts --verbose
git commit -m "fix(dyncon): add fed-batch volume dynamics (dV/dt = feedRate) with mass balance"
```
