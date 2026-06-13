# Direction I: Enzyme Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add molecular docking (via external API proxy), FoldX-style ddG prediction, and ML-guided directed evolution (Gaussian Process) to CATDES/PROEvol — enabling real enzyme engineering workflows.

**Architecture:** Molecular docking via RCSB/SwissDock API proxy (Edge Runtime). ddG prediction via empirical FoldX-style force field operating on parsed PDB coordinates. ML-guided evolution via Gaussian Process regression with RBF kernel over sequence-fitness data.

**Tech Stack:** TypeScript, PDB parser, Gaussian Process implementation, existing AlphaFold proxy

---

## Task I1: Add PDB Coordinate Parser

CATDES currently operates on hardcoded scalar distances. This task adds a PDB parser that extracts atomic coordinates from PDB/mmCIF files.

**Files:**
- Create: `src/utils/pdbParser.ts`
- Test: `__tests__/catdes/pdbParser.test.ts`

### Step 1: Write failing test

```typescript
import { parsePDB, type PDBStructure, type PDBAtom } from '../../src/utils/pdbParser';

describe('PDB parser', () => {
  it('parses ATOM records from PDB text', () => {
    const pdb = `ATOM      1  N   ALA A   1       1.000   2.000   3.000  1.00 10.00           N
ATOM      2  CA  ALA A   1       2.000   3.000   4.000  1.00 10.00           C
ATOM      3  C   ALA A   1       3.000   4.000   5.000  1.00 10.00           C
ATOM      4  O   ALA A   1       4.000   5.000   6.000  1.00 10.00           O
END`;
    const result = parsePDB(pdb);
    expect(result.atoms.length).toBe(4);
    expect(result.atoms[0].element).toBe('N');
    expect(result.atoms[0].x).toBeCloseTo(1.0);
    expect(result.atoms[0].residueName).toBe('ALA');
    expect(result.atoms[0].residueNumber).toBe(1);
    expect(result.atoms[0].chainId).toBe('A');
  });

  it('computes inter-atomic distances', () => {
    const pdb = `ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 10.00           N
ATOM      2  CA  ALA A   1       1.000   0.000   0.000  1.00 10.00           C
END`;
    const result = parsePDB(pdb);
    const dist = result.distance(0, 1);
    expect(dist).toBeCloseTo(1.0);
  });

  it('identifies catalytic residues within distance of substrate', () => {
    // Parse a PDB with a ligand and find residues within 5Å
    const result = parsePDB(pdbWithLigand);
    const nearSubstrate = result.residuesNear(0, 5.0); // atom 0 = ligand
    expect(nearSubstrate.length).toBeGreaterThan(0);
  });
});
```

### Step 2-5: TDD implementation

Parse PDB ATOM/HETATM records. Store atoms with coordinates, residue info, chain ID. Provide distance computation and proximity search methods.

---

## Task I2: Implement FoldX-style ddG Prediction

**Files:**
- Create: `src/server/ddgPrediction.ts`
- Test: `__tests__/catdes/ddgPrediction.test.ts`

### Step 1: Write failing test

```typescript
import { predictDDG, type DDGMutation, type DDGResult } from '../../src/server/ddgPrediction';

describe('ddG prediction', () => {
  it('predicts destabilizing effect of buried charged mutation', () => {
    const wildtype = { position: 42, wtResidue: 'L', mutantResidue: 'D' };
    const structure = parsePDB(pdbText); // from Task I1
    const result = predictDDG(structure, wildtype);
    expect(result.ddG).toBeGreaterThan(0); // destabilizing
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('predicts stabilizing effect of disulfide bond formation', () => {
    const mutation = { position: 30, wtResidue: 'G', mutantResidue: 'C' };
    const structure = parsePDB(pdbWithNearbyCys);
    const result = predictDDG(structure, mutation);
    // If there's a nearby Cys, forming a disulfide should be stabilizing
    expect(result.ddG).toBeLessThan(0);
  });

  it('handles mutations at surface residues', () => {
    const mutation = { position: 100, wtResidue: 'D', mutantResidue: 'N' };
    const structure = parsePDB(pdbText);
    const result = predictDDG(structure, mutation);
    // Surface mutations typically have small ddG
    expect(Math.abs(result.ddG)).toBeLessThan(2.0);
  });
});
```

### Step 2-5: TDD implementation

FoldX-style empirical force field (Guerois et al. 2002 J Mol Biol):
- Van der Waals: LJ 6-12 over atom pairs near mutation site
- Solvation: Lazaridis-Karplus implicit solvation
- Hydrogen bonds: geometry-based H-bond scoring
- Backbone strain: Ramachandran penalty
- Entropy: side-chain rotamer entropy loss

---

## Task I3: Implement Gaussian Process for ML-Guided Evolution

**Files:**
- Create: `src/server/gaussianProcess.ts`
- Test: `__tests__/proevol/gaussianProcess.test.ts`

### Step 1: Write failing test

```typescript
import { GaussianProcess, type GPConfig } from '../../src/server/gaussianProcess';

describe('Gaussian Process', () => {
  it('fits a simple 1D function', () => {
    const gp = new GaussianProcess({ kernel: 'rbf', lengthScale: 1.0, signalVariance: 1.0 });
    // Training data: sin(x)
    const X = [[0], [1], [2], [3], [4]];
    const y = [0, 0.84, 0.91, 0.14, -0.76];
    gp.fit(X, y);

    // Predict at x=0.5
    const pred = gp.predict([[0.5]]);
    expect(pred.mean).toBeCloseTo(0.5, 0); // rough estimate
    expect(pred.variance).toBeGreaterThan(0);
  });

  it('returns high uncertainty far from training data', () => {
    const gp = new GaussianProcess({ kernel: 'rbf', lengthScale: 1.0 });
    gp.fit([[0]], [1]);
    const near = gp.predict([[0.1]]);
    const far = gp.predict([[100]]);
    expect(far.variance).toBeGreaterThan(near.variance);
  });

  it('computes expected improvement acquisition function', () => {
    const gp = new GaussianProcess({ kernel: 'rbf', lengthScale: 1.0 });
    gp.fit([[0], [1], [2]], [0, 1, 0.5]);
    const ei = gp.expectedImprovement([[1.5]], 1.0); // best so far = 1.0
    expect(ei).toBeGreaterThanOrEqual(0);
  });
});
```

### Step 2-5: TDD implementation

Gaussian Process with RBF kernel:
- Kernel: k(x, x') = σ² * exp(-||x - x'||² / (2l²))
- Prediction: posterior mean and variance via Cholesky decomposition
- Acquisition: Expected Improvement (EI) for next-variant selection

---

## Task I4: Integrate GP into PROEvol

**Files:**
- Modify: `src/components/tools/ProEvolPage.tsx`

### Step 1: Add "ML-Guided" mode

When enabled, use GP to:
1. Predict fitness for all candidate variants
2. Select next library via Expected Improvement
3. Show uncertainty bands on fitness predictions

### Step 2: Commit

---

## Task I5: Add Molecular Docking Proxy API

**Files:**
- Create: `app/api/docking/route.ts`
- Create: `src/services/database/dockingClient.ts`

### Step 1: Create Edge Runtime proxy

Proxy to SwissDock or AutoDock Vina web API. Accept protein PDB + ligand SMILES, return docking score and binding pose.

### Step 2: Commit

---

## Task I6: Add Docking Results to CATDES

**Files:**
- Modify: `src/components/tools/CatalystDesignerPage.tsx`

### Step 1: Add "Docking" tab

Show binding pose (3Dmol.js), docking score, binding energy decomposition, comparison with MM-PBSA prediction.

### Step 2: Commit

---

## Summary

| Task | What It Builds | Priority |
|------|---------------|----------|
| I1 | PDB coordinate parser | 🔴 CRITICAL |
| I2 | FoldX-style ddG prediction | 🔴 CRITICAL |
| I3 | Gaussian Process implementation | 🟡 IMPORTANT |
| I4 | GP → PROEvol integration | 🟡 IMPORTANT |
| I5 | Molecular docking proxy API | 🔴 CRITICAL |
| I6 | Docking UI in CATDES | 🔴 CRITICAL |

**Total: 6 tasks, ~20 commits**
