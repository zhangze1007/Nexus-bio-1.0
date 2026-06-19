# CatalystDesigner + ProEvol Complete Redesign

**Date:** 2026-06-19
**Scope:** 16 changes across both tools + shared infrastructure
**Goal:** Transform CatalystDesigner from a mock analysis panel into a real pathway optimizer, and ProEvol from a fitness landscape visualizer into a real protein engineering engine.

---

## Problem Statement

CatalystDesigner currently uses fake algorithms for protein design (BLOSUM62 sampling, null deltaKcat/deltaKm). ProEvol lacks core protein engineering capabilities (ΔΔG prediction, inverse folding, zero-shot fitness). The two tools overlap in mutagenesis/stability analysis but neither is complete.

**Root cause:** CatalystDesigner tries to do protein design (which ProEvol should do), while ProEvol lacks the computational engines to actually do it.

**Solution:** Reposition CatalystDesigner as a pathway optimizer, reposition ProEvol as a protein engineering engine, and connect them via workbenchStore.

---

## Architecture

```
CatalystDesigner (Pathway Layer)       ProEvol (Protein Layer)
  ├─ Bottleneck identification           ├─ ΔΔG stability prediction
  ├─ Metabolic cost analysis             ├─ Inverse folding (sequence design)
  ├─ Pathway balancing                   ├─ Zero-shot fitness prediction
  ├─ Pareto ranking                      ├─ Conservation analysis
  ├─ Homologous enzyme discovery         ├─ Mutant library design
  └─ "Send to ProEvol" ──workbench──→    └─ Results flow back to DBTLflow
```

Connection: `workbenchStore.setToolPayload('catdes', ...)` → ProEvol reads `toolPayloads.catdes`

---

## Part 1: ProEvol — 5 New Engines

### 1.1 ΔΔG Stability Prediction

**File:** `src/server/ddgPrediction.ts` (existing) → integrate into ProEvol

The FoldX-style ddG predictor already exists with 5 energy components (vdW, solvation, H-bonds, backbone strain, entropy). Changes needed:

- Add multi-mutation support (current: single-point only)
- Add simplified energy minimization (10-step steepest descent)
- Connect to ProEvol UI: scan all single-point mutations for a given PDB
- Output: ΔΔG heatmap (position × amino acid) matching existing ProEvol fitness landscape visualization

**Interface:**
```typescript
function scanMutations(pdbText: string, sequence: string, chainId?: string): Promise<{
  results: Array<{ position: number; wt: string; mut: string; ddg: number; confidence: number }>;
  heatmap: number[][]; // 20 × L matrix
}>;
```

### 1.2 Inverse Folding (Sequence Design)

**File:** `src/services/proevolEngine.ts` — new function `designSequences()`

Simplified ProteinMPNN-style sequence design using structural constraints:

1. Parse PDB → compute per-residue features:
   - Backbone dihedrals (phi, psi)
   - SASA (simplified Shrake-Rupley, 100 test points)
   - Secondary structure (DSSP-lite: dihedral-based)
   - Neighbor composition (residues within 8Å)

2. Generate candidate sequences:
   - For each position, score all 20 amino acids by:
     - BLOSUM62 log-likelihood (evolutionary plausibility)
     - Hydrophobic match (buried → hydrophobic, surface → polar)
     - Backbone compatibility (helix/sheet propensity)
   - Sample from softmax distribution (temperature = 0.3)

3. Rank candidates by composite:
   - 0.4 × ΔΔG stability (from ddgPrediction)
   - 0.3 × BLOSUM62 log-likelihood
   - 0.3 × structural compatibility score

**Interface:**
```typescript
function designSequences(input: {
  pdbText: string;
  sequence: string;
  fixedPositions?: number[];  // catalytic residues to preserve
  numDesigns?: number;        // default 10
}): Promise<{
  designs: Array<{
    sequence: string;
    mutations: Array<{ position: number; wt: string; mut: string }>;
    scores: { stability: number; plausibility: number; compatibility: number; composite: number };
  }>;
}>;
```

### 1.3 Zero-Shot Fitness Prediction

**File:** `src/services/proevolEngine.ts` — new function `predictFitness()`

ESM-1v-style fitness prediction using evolutionary and physical features:

1. For each mutation position:
   - BLOSUM62 substitution score (evolutionary conservation proxy)
   - ΔΔG from ddgPrediction (stability impact)
   - Structural environment score (burial, H-bonds, secondary structure)
   - Shannon entropy from BLOSUM62 column (position conservation)

2. Composite fitness score:
   - 0.4 × BLOSUM62 score (normalized to [0,1])
   - 0.3 × stability score (exp(-|ΔΔG| / 2))
   - 0.3 × structural environment match

3. Classification:
   - score > 0.7 → "likely beneficial"
   - 0.4 < score < 0.7 → "likely neutral"
   - score < 0.4 → "likely deleterious"

**Interface:**
```typescript
function predictFitness(input: {
  sequence: string;
  mutations: Array<{ position: number; mut: string }>;
  pdbText?: string;  // optional, enables structural features
}): Promise<{
  predictions: Array<{
    position: number;
    wt: string;
    mut: string;
    fitnessScore: number;
    classification: 'beneficial' | 'neutral' | 'deleterious';
    confidence: number;
    components: { blosum: number; stability: number; structural: number };
  }>;
}>;
```

### 1.4 Conservation Analysis

**File:** `src/services/proevolEngine.ts` — new function `analyzeConservation()`

MSA-based conservation using BLOSUM62 column entropy as proxy (no external MSA tool needed):

1. For each position i in sequence:
   - Extract BLOSUM62 column for residue `sequence[i]`
   - Convert to probability distribution (softmax over BLOSUM62 row)
   - Shannon entropy: H(i) = -Σ p(a) log2(p(a))
   - Conservation score: C(i) = 1 - H(i)/H_max (normalized to [0,1])

2. Classification:
   - C > 0.8 → "highly conserved" (do not mutate)
   - 0.5 < C < 0.8 → "moderately conserved"
   - C < 0.5 → "variable" (safe to mutate)

**Interface:**
```typescript
function analyzeConservation(sequence: string): Promise<{
  perPosition: Array<{
    position: number;
    residue: string;
    entropy: number;
    conservation: number;
    classification: 'conserved' | 'moderate' | 'variable';
  }>;
  conservedPositions: number[];
  variablePositions: number[];
}>;
```

### 1.5 Mutant Library Design

**File:** `src/services/proevolEngine.ts` — new function `designMutantLibrary()`

Combinatorial library generation with intelligent sampling:

1. Input: wild-type sequence + target positions + candidate AAs per position
2. If total combinations < 10,000: enumerate all
3. If > 10,000: Latin hypercube sampling for uniform coverage
4. Score each variant: ΔΔG + fitness + diversity (Hamming distance from other selected)
5. Select top-N by Pareto front (stability, fitness, diversity)

**Interface:**
```typescript
function designMutantLibrary(input: {
  sequence: string;
  positions: number[];
  candidatesPerPosition: string[][];  // AA options per position
  librarySize?: number;  // default 50
  pdbText?: string;
}): Promise<{
  library: Array<{
    sequence: string;
    mutations: Array<{ position: number; wt: string; mut: string }>;
    scores: { stability: number; fitness: number; diversity: number };
  }>;
  stats: { totalEnumerated: number; librarySize: number; paretoFrontSize: number };
}>;
```

---

## Part 2: CatalystDesigner — 5 New Features

### 2.1 Real Bottleneck Identification

**File:** `src/services/CatalystDesignerEngine.ts` — replace mock bottleneck analysis

Replace the current hardcoded pathway steps with real data from workbenchStore:

1. Read FBA shadow prices: `toolPayloads.fba.result.sensitivityCoefficients`
2. Read CETHX ΔG cascade: `toolPayloads.cethx.result.steps`
3. Read DBTLflow pass rates: `toolPayloads.dbtlflow.result.iterations`
4. Compute per-enzyme bottleneck score:
   - 0.4 × |shadow price| (FBA sensitivity)
   - 0.3 × max(0, ΔG) (thermodynamic barrier)
   - 0.3 × (1 - pass rate) (experimental difficulty)
5. Rank enzymes by bottleneck score

**Interface:**
```typescript
function identifyBottlenecks(input: {
  pathwaySteps: PathwayStep[];
  fbaData?: FBAPayload;
  cethxData?: CETHXPayload;
  dbtlflowData?: DBTLflowPayload;
}): Promise<{
  bottlenecks: Array<{
    enzymeId: string;
    enzymeName: string;
    score: number;
    factors: { fba: number; thermo: number; experimental: number };
    recommendation: string;
  }>;
}>;
```

### 2.2 Homologous Enzyme Discovery

**File:** `src/services/CatalystDesignerEngine.ts` — new function `discoverHomologs()`

Search KEGG + BRENDA for alternative enzymes:

1. Query KEGG by EC number → get list of homologous enzymes
2. Query BRENDA for kinetic parameters (kcat, Km, Ki, Tm, pH optimum)
3. Rank by catalytic efficiency (kcat/Km)
4. Filter by expression compatibility (organism, sequence length)

**Interface:**
```typescript
function discoverHomologs(ecNumber: string, options?: {
  organism?: string;
  minKcat?: number;
}): Promise<{
  homologs: Array<{
    uniprotId: string;
    organism: string;
    kcat: number;
    km: number;
    kcatOverKm: number;
    tm: number;
    pdbId?: string;
    sequence: string;
  }>;
}>;
```

### 2.3 Pathway Variant Library

**File:** `src/services/CatalystDesignerEngine.ts` — new function `generatePathwayVariants()`

Generate pathway variants by substituting homologous enzymes:

1. For each enzyme in pathway, take top-N homologs from `discoverHomologs()`
2. Generate combinatorial variants (cap at 100)
3. Evaluate each variant:
   - Pathway flux (FBA with variant enzyme parameters)
   - Metabolic cost (estimateMetabolicDrain)
   - Thermodynamic feasibility (CETHX ΔG)
4. Rank by Pareto front

### 2.4 CETHX Integration

**File:** `src/services/CatalystDesignerEngine.ts` — new function `evaluateThermodynamics()`

Read CETHX results from workbenchStore and annotate pathway steps with thermodynamic feasibility.

### 2.5 "Send to ProEvol" Button

**File:** `src/components/tools/CatalystDesignerPage.tsx` — UI addition

When user clicks "Send to ProEvol":
1. `setToolPayload('catdes', { targetEnzyme, targetProperty, currentValue, targetValue, pdbId, uniprotId, sequence })`
2. Navigate to `/tools/proevol`
3. ProEvol reads `toolPayloads.catdes` and auto-starts campaign

---

## Part 3: Shared Infrastructure

### 3.1 PDB Parser Enhancement

**File:** `src/utils/pdbParser.ts`

Add:
- `computeDihedrals(pdb, residueIndex)` → { phi, psi, chi1, chi2 }
- `computeSASA(pdb, probeRadius?)` → per-residue SASA
- `assignSecondaryStructure(pdb)` → per-residue H/E/C
- `detectHydrogenBonds(pdb)` → list of H-bonds with geometry

### 3.2 ddgPrediction Enhancement

**File:** `src/server/ddgPrediction.ts`

Add:
- Multi-mutation support (iterate single mutations, sum ΔΔG)
- Simplified energy minimization (10-step steepest descent on side-chain torsions)
- Batch scan interface (all single-point mutations at once)

### 3.3 BRENDA/KEGG Client Enhancement

**File:** `src/services/database/brendaClient.ts`, `src/services/database/keggClient.ts`

Changes:
- Remove mock fallback → return explicit error states with `FallbackResult<T>`
- Add response caching (5-minute TTL)
- Add batch query support

---

## Tab Redesign

### CatalystDesigner: 6 tabs → 4 tabs

| Old Tab | New Tab | Status |
|---------|---------|--------|
| 3D Viewer | 3D Viewer | Keep (enhanced with pathway context) |
| Binding | **Overview** | Replace (bottleneck analysis + cost + action) |
| Sequences | **Pathway Balance** | Replace (Newton-Raphson balance) |
| Pareto | Pareto | Keep (enhanced with variant library) |
| Mutagenesis | — | Remove |
| Docking | — | Remove |

### ProEvol: Keep existing tabs + add new capabilities

Existing tabs (fitness landscape, evolution trajectory, basin climbing, sequence diversity) remain. New capabilities integrate into existing UI:
- ΔΔG heatmap overlays on fitness landscape
- Inverse folding results in sequence diversity tab
- Conservation analysis overlays on landscape
- Mutant library as new sub-panel

---

## Success Criteria

- All 16 changes implemented
- `npx tsc --noEmit` passes
- `npm test` passes
- `npm run build` succeeds
- CatalystDesigner: bottleneck identification uses real FBA/CETHX/DBTLflow data
- CatalystDesigner: "Send to ProEvol" button works end-to-end
- ProEvol: ΔΔG predictions are non-null and physically reasonable
- ProEvol: inverse folding produces valid sequences
- ProEvol: fitness predictions classify mutations correctly
- ProEvol: conservation analysis identifies known conserved residues
