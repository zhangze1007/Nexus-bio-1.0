/**
 * FBAsim Strain Design Pipeline — Integration Test
 *
 * Tests the full pipeline: OptKnock + FSEOF → FBA evaluation → Pareto ranking.
 * Mocks FBAAuthorityClient to call fbaEngine.solveAuthorityFBA directly
 * (bypassing HTTP), since the pipeline runs server-side.
 *
 * Reference: Burgard et al. (2003) Biotechnol Bioeng — OptKnock
 * Reference: Choi et al. (2010) BMC Bioinformatics — FSEOF
 */

// Mock FBAAuthorityClient to call fbaEngine directly (no HTTP)
jest.mock('../src/services/FBAAuthorityClient', () => {
  const fbaEngine = jest.requireActual('../src/server/fbaEngine');
  return {
    solveAuthorityFBA: fbaEngine.solveAuthorityFBA,
  };
});

import { runStrainDesignPipeline, type StrainDesignSpec, type StrainDesignResult } from '../src/server/fbaStrainPipeline';

const BASE_SPEC: StrainDesignSpec = {
  species: 'ecoli',
  objective: 'biomass',
  glucoseUptake: 10,
  oxygenUptake: 20,
  targetProduct: 'PRODUCT',
  maxKnockouts: 2,
  growthFractionConstraint: 0.1,
};

describe('FBAsim Strain Design Pipeline', () => {
  let result: StrainDesignResult;

  beforeAll(async () => {
    result = await runStrainDesignPipeline(BASE_SPEC);
  }, 60_000); // OptKnock enumeration can be slow

  // ── Output structure ────────────────────────────────────────────────────

  test('returns a valid StrainDesignResult with all required fields', () => {
    expect(result).toBeDefined();
    expect(result.spec).toEqual(BASE_SPEC);
    expect(result.wildType).toBeDefined();
    expect(result.optKnock).toBeDefined();
    expect(result.fseof).toBeDefined();
    expect(result.evaluations).toBeDefined();
    expect(result.paretoFront).toBeDefined();
    expect(result.bestDesign).toBeDefined();
    expect(result.allSolverCalls).toBeDefined();
  });

  // ── Wild-type baseline ──────────────────────────────────────────────────

  test('wild-type FBA is feasible with positive growth rate', () => {
    expect(result.wildType.feasible).toBe(true);
    expect(result.wildType.growthRate).toBeGreaterThan(0);
  });

  // ── OptKnock results ───────────────────────────────────────────────────

  test('OptKnock returns at least one knockout set', () => {
    expect(result.optKnock.length).toBeGreaterThanOrEqual(1);
    for (const ks of result.optKnock) {
      expect(ks.reactions).toBeDefined();
      expect(Array.isArray(ks.reactions)).toBe(true);
      expect(ks.reactions.length).toBeLessThanOrEqual(BASE_SPEC.maxKnockouts);
    }
  });

  // ── FSEOF results ──────────────────────────────────────────────────────

  test('FSEOF returns overexpression targets', () => {
    expect(result.fseof.overexpressionTargets).toBeDefined();
    expect(Array.isArray(result.fseof.overexpressionTargets)).toBe(true);
  });

  // ── Pareto front ───────────────────────────────────────────────────────

  test('paretoFront is a non-empty array', () => {
    expect(Array.isArray(result.paretoFront)).toBe(true);
    expect(result.paretoFront.length).toBeGreaterThanOrEqual(1);
  });

  test('each Pareto front element has the expected structure', () => {
    for (const entry of result.paretoFront) {
      expect(entry.strategy).toBeDefined();
      expect(entry.strategy.knockouts).toBeDefined();
      expect(Array.isArray(entry.strategy.knockouts)).toBe(true);
      expect(typeof entry.growthRate).toBe('number');
      expect(typeof entry.productFlux).toBe('number');
      expect(typeof entry.carbonEfficiency).toBe('number');
      expect(typeof entry.growthFractionOfWT).toBe('number');
      expect(typeof entry.feasible).toBe('boolean');
    }
  });

  test('Pareto front entries satisfy growth fraction constraint', () => {
    for (const entry of result.paretoFront) {
      expect(entry.growthFractionOfWT).toBeGreaterThanOrEqual(
        BASE_SPEC.growthFractionConstraint - 0.001, // floating-point tolerance
      );
    }
  });

  test('Pareto front is non-dominated (no entry dominates another)', () => {
    for (const candidate of result.paretoFront) {
      for (const other of result.paretoFront) {
        if (other === candidate) continue;
        const betterProduct = other.productFlux >= candidate.productFlux;
        const betterGrowth = other.growthFractionOfWT >= candidate.growthFractionOfWT;
        const strictlyBetter = other.productFlux > candidate.productFlux || other.growthFractionOfWT > candidate.growthFractionOfWT;
        // No other entry should dominate this candidate
        if (betterProduct && betterGrowth && strictlyBetter) {
          throw new Error(
            `Pareto front entry (product=${candidate.productFlux}, growth=${candidate.growthFractionOfWT}) ` +
            `is dominated by (product=${other.productFlux}, growth=${other.growthFractionOfWT})`,
          );
        }
      }
    }
  });

  // ── Best design ────────────────────────────────────────────────────────

  test('bestDesign is a valid evaluation with positive values', () => {
    expect(result.bestDesign).toBeDefined();
    expect(result.bestDesign.growthRate).toBeGreaterThanOrEqual(0);
    expect(result.bestDesign.feasible).toBe(true);
  });

  // ── Solver calls are tracked ───────────────────────────────────────────

  test('allSolverCalls is non-empty and tracks all solver invocations', () => {
    expect(result.allSolverCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of result.allSolverCalls) {
      expect(typeof call.solver).toBe('string');
      expect(typeof call.description).toBe('string');
    }
  });

  // ── Determinism ────────────────────────────────────────────────────────

  test('running the same spec twice produces identical results', async () => {
    const result2 = await runStrainDesignPipeline(BASE_SPEC);
    expect(result2.wildType.growthRate).toBeCloseTo(result.wildType.growthRate, 4);
    expect(result2.paretoFront.length).toBe(result.paretoFront.length);
    // Compare best designs
    expect(result2.bestDesign.growthRate).toBeCloseTo(result.bestDesign.growthRate, 4);
    expect(result2.bestDesign.productFlux).toBeCloseTo(result.bestDesign.productFlux, 4);
  }, 60_000);
});
