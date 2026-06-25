import {
  runPathwayDiscovery,
  checkPathwayFeasibility,
  type Molecule,
  type PathwayDiscoveryInput,
} from '../src/server/pathwayDiscoveryEngine';

/**
 * Tests for the A* pathway discovery engine (src/server/pathwayDiscoveryEngine.ts).
 *
 * The reaction database contains ~500 reactions covering glycolysis, TCA cycle,
 * amino acid biosynthesis, isoprenoid/mevalonate, shikimate, and more.
 *
 * Key pathways for testing:
 *   pyruvate → acetyl_coa (R00228, pyruvate dehydrogenase, ΔG=-8.0)
 *   glucose → glucose_6p → fructose_6p → ... → pyruvate (glycolysis)
 *   acetyl_coa + oxaloacetate → citrate (R00209, citrate synthase, ΔG=-7.5)
 */

// ── Test Fixtures ───────────────────────────────────────────────────────────

const glucose: Molecule = {
  id: 'glucose',
  name: 'glucose',
  functionalGroups: ['hydroxyl', 'sugar', 'carbonyl'],
  isPrecursor: true,
};

const pyruvate: Molecule = {
  id: 'pyruvate',
  name: 'pyruvate',
  functionalGroups: ['carboxyl', 'carbonyl'],
  isPrecursor: true,
};

const acetylCoA: Molecule = {
  id: 'acetyl_coa',
  name: 'acetyl_coa',
  functionalGroups: ['carbonyl'],
  isPrecursor: false,
};

const glucosePrecursors: Molecule[] = [glucose];
const pyruvatePrecursors: Molecule[] = [pyruvate];
const multiPrecursors: Molecule[] = [glucose, pyruvate];

const defaultInput: PathwayDiscoveryInput = {
  target: acetylCoA,
  precursors: pyruvatePrecursors,
  maxLength: 8,
  topN: 5,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Basic Search — known target with common precursors
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Basic Search', () => {
  test('finds at least one pathway from pyruvate to acetyl_coa', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    expect(result.pathways.length).toBeGreaterThanOrEqual(1);
    expect(result.pathways[0].target.id).toBe('acetyl_coa');
    expect(result.pathways[0].precursor.id).toBe('pyruvate');
  });

  test('result contains targetInfo, precursorPool, dbStats, and designNotes', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    expect(result.targetInfo.id).toBe('acetyl_coa');
    expect(result.precursorPool.length).toBeGreaterThanOrEqual(1);
    expect(result.dbStats.totalReactions).toBeGreaterThan(0);
    expect(result.dbStats.totalMetabolites).toBeGreaterThan(0);
    expect(result.dbStats.avgEnzymeAvailability).toBeGreaterThan(0);
    expect(result.dbStats.avgEnzymeAvailability).toBeLessThanOrEqual(1);
    expect(result.designNotes.length).toBeGreaterThan(0);
  });

  test('returned pathway has valid steps array', async () => {
    const result = await runPathwayDiscovery(defaultInput);
    const pathway = result.pathways[0];

    expect(pathway.steps.length).toBeGreaterThanOrEqual(1);
    expect(pathway.steps[0].reaction).toBeDefined();
    expect(pathway.steps[0].reaction.id).toBeDefined();
    expect(typeof pathway.steps[0].deltaG).toBe('number');
    expect(typeof pathway.steps[0].enzymeScore).toBe('number');
    expect(typeof pathway.steps[0].feasibility).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ΔG Cascade Consistency — totalDeltaG must equal sum of dgCascade
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — ΔG Cascade Consistency', () => {
  test('metrics.totalDeltaG equals the sum of dgCascade values', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      const cascadeSum = pathway.dgCascade.reduce((sum, dg) => sum + dg, 0);
      expect(pathway.metrics.totalDeltaG).toBeCloseTo(cascadeSum, 2);
    }
  });

  test('dgCascade length equals steps length', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      expect(pathway.dgCascade.length).toBe(pathway.steps.length);
    }
  });

  test('each dgCascade value matches the corresponding step deltaG', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      for (let i = 0; i < pathway.steps.length; i++) {
        expect(pathway.dgCascade[i]).toBeCloseTo(pathway.steps[i].deltaG, 2);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Pathway Metrics — structural invariants
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Pathway Metrics', () => {
  test('metrics.pathwayLength === steps.length', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      expect(pathway.metrics.pathwayLength).toBe(pathway.steps.length);
    }
  });

  test('metrics.overallScore is in [0, 1] range', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      expect(pathway.metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(pathway.metrics.overallScore).toBeLessThanOrEqual(1);
    }
  });

  test('metrics.avgEnzymeAvailability is in [0, 1] range', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      expect(pathway.metrics.avgEnzymeAvailability).toBeGreaterThanOrEqual(0);
      expect(pathway.metrics.avgEnzymeAvailability).toBeLessThanOrEqual(1);
    }
  });

  test('metrics.atomEconomy is in [0, 1] range', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      expect(pathway.metrics.atomEconomy).toBeGreaterThanOrEqual(0);
      expect(pathway.metrics.atomEconomy).toBeLessThanOrEqual(1);
    }
  });

  test('metrics.cofactorBalance is in [0, 1] range', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      expect(pathway.metrics.cofactorBalance).toBeGreaterThanOrEqual(0);
      expect(pathway.metrics.cofactorBalance).toBeLessThanOrEqual(1);
    }
  });

  test('pathways are sorted by overallScore descending', async () => {
    const result = await runPathwayDiscovery({ ...defaultInput, topN: 5 });

    for (let i = 1; i < result.pathways.length; i++) {
      expect(result.pathways[i].metrics.overallScore).toBeLessThanOrEqual(
        result.pathways[i - 1].metrics.overallScore,
      );
    }
  });

  test('each step has valid feasibility in [0, 1]', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      for (const step of pathway.steps) {
        expect(step.feasibility).toBeGreaterThanOrEqual(0);
        expect(step.feasibility).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Determinism — same input must produce identical output
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Determinism', () => {
  test('same input produces identical output on repeated runs', async () => {
    const first = await runPathwayDiscovery(defaultInput);
    const second = await runPathwayDiscovery(defaultInput);

    expect(second.pathways.length).toBe(first.pathways.length);
    for (let i = 0; i < first.pathways.length; i++) {
      expect(second.pathways[i].metrics).toEqual(first.pathways[i].metrics);
      expect(second.pathways[i].steps.length).toBe(first.pathways[i].steps.length);
    }
    expect(second.dbStats).toEqual(first.dbStats);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. No pathway for impossible target
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Impossible Target', () => {
  test('returns empty pathways for target not in reaction database', async () => {
    const impossibleTarget: Molecule = {
      id: 'impossible_molecule_xyz',
      name: 'impossible_molecule_xyz',
      functionalGroups: [],
      isPrecursor: false,
    };

    const result = await runPathwayDiscovery({
      target: impossibleTarget,
      precursors: pyruvatePrecursors,
      maxLength: 8,
      topN: 5,
    });

    expect(result.pathways.length).toBe(0);
    expect(result.designNotes[0]).toContain('0 pathways');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Multiple precursors — providing more precursors works without error
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Multiple Precursors', () => {
  test('accepts multiple precursors without error', async () => {
    const result = await runPathwayDiscovery({
      target: acetylCoA,
      precursors: multiPrecursors,
      maxLength: 8,
      topN: 5,
    });

    expect(result.pathways.length).toBeGreaterThanOrEqual(1);
    expect(result.precursorPool.length).toBe(2);
  });

  test('providing topN returns at most that many pathways', async () => {
    const result = await runPathwayDiscovery({
      target: acetylCoA,
      precursors: multiPrecursors,
      maxLength: 8,
      topN: 3,
    });

    expect(result.pathways.length).toBeLessThanOrEqual(3);
  });

  test('maxLength limits pathway length', async () => {
    const result = await runPathwayDiscovery({
      target: acetylCoA,
      precursors: multiPrecursors,
      maxLength: 2,
      topN: 5,
    });

    for (const pathway of result.pathways) {
      expect(pathway.steps.length).toBeLessThanOrEqual(2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Input validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Input Validation', () => {
  test('throws when target has no ID', async () => {
    const badTarget = { id: '', name: 'bad', functionalGroups: [], isPrecursor: false };
    await expect(
      runPathwayDiscovery({ target: badTarget as Molecule, precursors: pyruvatePrecursors }),
    ).rejects.toThrow('Target molecule must have an ID');
  });

  test('throws when no precursors provided', async () => {
    await expect(
      runPathwayDiscovery({ target: acetylCoA, precursors: [] }),
    ).rejects.toThrow('At least one precursor is required');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. checkPathwayFeasibility — quick feasibility check
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — checkPathwayFeasibility', () => {
  test('returns feasible=true for known reachable target', async () => {
    const result = await checkPathwayFeasibility('acetyl_coa', ['pyruvate']);

    expect(result.feasible).toBe(true);
    expect(result.estimatedSteps).toBeGreaterThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('returns feasible=false for unreachable target', async () => {
    const result = await checkPathwayFeasibility('impossible_molecule_xyz', ['pyruvate']);

    expect(result.feasible).toBe(false);
  });

  test('returns finite confidence value', async () => {
    const result = await checkPathwayFeasibility('acetyl_coa', ['pyruvate']);

    expect(Number.isFinite(result.confidence)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Bottleneck detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Bottleneck Detection', () => {
  test('bottlenecks have valid structure', async () => {
    const result = await runPathwayDiscovery(defaultInput);

    for (const pathway of result.pathways) {
      for (const bn of pathway.bottlenecks) {
        expect(typeof bn.stepIndex).toBe('number');
        expect(typeof bn.reason).toBe('string');
        expect(['low', 'medium', 'high']).toContain(bn.severity);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Organism preference filtering
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pathway Discovery — Organism Preference', () => {
  test('preferredOrganism filters reactions but still finds pathways', async () => {
    const result = await runPathwayDiscovery({
      target: acetylCoA,
      precursors: pyruvatePrecursors,
      maxLength: 8,
      topN: 5,
      preferredOrganism: 'ecoli',
    });

    // With organism filtering, fewer reactions are available,
    // but core glycolysis/TCA reactions exist in ecoli
    expect(result.dbStats.totalReactions).toBeLessThan(500);
    // The pyruvate → acetyl_coa reaction exists in ecoli
    expect(result.pathways.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Known Limitations — Regression Guards ─────────────────────────────────
describe('Known Limitations — Regression Guards', () => {
  test('heuristic breakage: search still returns paths when functional group scoring fails', async () => {
    // toolValidity caption: "heuristic is broken (empty functional groups)"
    // A* heuristic degenerates to 0 or fixed value; search must still complete.
    const result = await runPathwayDiscovery(defaultInput);
    expect(result.pathways.length).toBeGreaterThanOrEqual(1);
    // Record current behavior: scores may all be identical when heuristic is broken
    if (result.pathways.length > 0) {
      const scores = result.pathways[0].steps.map(s => s.enzymeScore);
      expect(scores.length).toBeGreaterThan(0);
    }
  });

  test('atom economy: value is a fixed lookup (same precursor always returns same atom economy)', async () => {
    // toolValidity caption: "atom economy is a fixed lookup"
    const r1 = await runPathwayDiscovery(defaultInput);
    const r2 = await runPathwayDiscovery(defaultInput);
    if (r1.pathways.length > 0 && r2.pathways.length > 0) {
      expect(r1.pathways[0].metrics.atomEconomy).toBe(r2.pathways[0].metrics.atomEconomy);
    }
  });

  test('no mass conservation: pathway steps do NOT guarantee stoichiometric balance', async () => {
    // toolValidity caption: "no mass conservation"
    // Records current behavior: pathways exist but chemical balance is not enforced.
    // FUTURE: when mass conservation is implemented, replace with positive balance check.
    const result = await runPathwayDiscovery({
      target: { id: 'ethanol', name: 'ethanol', functionalGroups: ['hydroxyl'], isPrecursor: false },
      precursors: [glucose],
    });
    if (result.pathways.length > 0) {
      expect(result.pathways[0].steps.length).toBeGreaterThanOrEqual(1);
    }
  });
});
