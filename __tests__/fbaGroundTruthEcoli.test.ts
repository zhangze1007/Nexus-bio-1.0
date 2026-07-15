import {
  solveAuthorityFBA,
  solveExpandedFBA,
  buildAuthorityFBAModel,
  type SingleSpeciesFBARequest,
} from '../src/server/fbaEngine';
import { solveLP } from '../src/server/highsSolver';

/**
 * Ground-truth check for the single-species E. coli FBA path.
 *
 * The user-facing "single" FBA (mode:"single", action:"fba") must solve the REAL
 * e_coli_core stoichiometric model — the same model `solveExpandedFBA` uses and
 * that COBRApy verifies to ~0.87 h⁻¹ on glucose minimal media (Orth 2010).
 *
 * Regression guard: a prior implementation routed this path through a 10-reaction
 * toy network whose biomass pseudo-reaction consumed acetyl-CoA 1:1 (no ATP
 * maintenance, no real precursor draw), yielding a biologically impossible
 * 12–20 h⁻¹. This test pins the path to physical values and to the real solver.
 */

const REAL_ECOLI_MAX_GROWTH = 1.5; // hard physical ceiling for E. coli on glucose (real max ≈ 0.87)

describe('FBA ground truth — E. coli single-species uses the real e_coli_core model', () => {
  it('default single FBA growth is physical (not the toy 12–20 h⁻¹)', async () => {
    const req: SingleSpeciesFBARequest = {
      species: 'ecoli',
      objective: 'biomass',
      glucoseUptake: 10,
      oxygenUptake: 20,
    };
    const result = await solveAuthorityFBA(req);
    expect(result.feasible).toBe(true);
    expect(result.growthRate).toBeGreaterThan(0.3);
    expect(result.growthRate).toBeLessThan(REAL_ECOLI_MAX_GROWTH);
  });

  it('single FBA growth equals the real solveExpandedFBA solve at matched bounds', async () => {
    for (const [glc, o2] of [[10, 12], [10, 20], [8, 15]] as const) {
      const single = await solveAuthorityFBA({ species: 'ecoli', objective: 'biomass', glucoseUptake: glc, oxygenUptake: o2 });
      const expanded = await solveExpandedFBA({ objective: 'biomass', glucoseUptake: glc, oxygenUptake: o2 });
      expect(single.growthRate).toBeCloseTo(expanded.growthRate, 3);
    }
  });

  it('growth increases with oxygen availability (aerobic > oxygen-limited)', async () => {
    const low = await solveAuthorityFBA({ species: 'ecoli', objective: 'biomass', glucoseUptake: 10, oxygenUptake: 5 });
    const high = await solveAuthorityFBA({ species: 'ecoli', objective: 'biomass', glucoseUptake: 10, oxygenUptake: 20 });
    expect(high.growthRate).toBeGreaterThan(low.growthRate);
    expect(high.growthRate).toBeLessThan(REAL_ECOLI_MAX_GROWTH);
  });

  it('FVA/pFBA model builder returns the real e_coli_core model (physical optimum)', async () => {
    const model = buildAuthorityFBAModel({ species: 'ecoli', objective: 'biomass', glucoseUptake: 10, oxygenUptake: 20 });
    const solved = await solveLP(model);
    expect(solved.status).toBe('optimal');
    expect(solved.objectiveValue).toBeGreaterThan(0.3);
    expect(solved.objectiveValue).toBeLessThan(REAL_ECOLI_MAX_GROWTH);
  });

  it('is deterministic', async () => {
    const req: SingleSpeciesFBARequest = { species: 'ecoli', objective: 'biomass', glucoseUptake: 10, oxygenUptake: 20 };
    const a = await solveAuthorityFBA(req);
    const b = await solveAuthorityFBA(req);
    expect(a.growthRate).toBe(b.growthRate);
  });
});
