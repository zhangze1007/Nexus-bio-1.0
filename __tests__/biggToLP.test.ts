/**
 * Tests for BiGG to LP converter.
 *
 * Verifies that the converter correctly:
 *   1. Builds stoichiometric matrix from BiGG reactions
 *   2. Identifies biomass reaction
 *   3. Detects exchange reactions
 *   4. Applies knockouts
 *   5. Generates valid LP model for HiGHS
 */

import { biggToLP } from '../src/server/biggToLP';
import type { FullBiGGModel } from '../src/services/database/biggClient';

// Minimal test model
const TEST_MODEL: FullBiGGModel = {
  modelId: 'test_model',
  reactions: [
    {
      id: 'R1',
      name: 'Glucose uptake',
      subsystem: 'Exchange',
      lb: -10,
      ub: 100,
      stoichiometry: { glc_e: -1, glc_c: 1 },
    },
    {
      id: 'R2',
      name: 'Glycolysis',
      subsystem: 'Glycolysis',
      lb: 0,
      ub: 100,
      stoichiometry: { glc_c: -1, pyr_c: 2 },
    },
    {
      id: 'BIOMASS',
      name: 'Biomass reaction',
      subsystem: 'Biomass',
      lb: 0,
      ub: 100,
      stoichiometry: { pyr_c: -1, biomass_c: 1 },
    },
    {
      id: 'EX_glc__D_e',
      name: 'Glucose exchange',
      subsystem: 'Exchange',
      lb: -10,
      ub: 100,
      stoichiometry: { glc_e: 1 },
    },
  ],
  metabolites: ['glc_e', 'glc_c', 'pyr_c', 'biomass_c'],
  reactionCount: 4,
  metaboliteCount: 4,
};

describe('biggToLP', () => {
  it('creates LP model with correct number of variables', () => {
    const result = biggToLP(TEST_MODEL);
    expect(result.lpModel.objective).toHaveLength(4);
    expect(result.reactionIds).toEqual(['R1', 'R2', 'BIOMASS', 'EX_glc__D_e']);
  });

  it('creates constraints for each metabolite', () => {
    const result = biggToLP(TEST_MODEL);
    // Each metabolite with non-zero stoichiometry gets a constraint
    expect(result.lpModel.constraints.length).toBeGreaterThan(0);
  });

  it('identifies biomass reaction as objective', () => {
    const result = biggToLP(TEST_MODEL);
    expect(result.biomassId).toBe('BIOMASS');

    // Objective should have coefficient -1 for biomass (maximize)
    const objVar = result.lpModel.objective.find((v) => v.name === 'BIOMASS');
    expect(objVar?.coef).toBe(-1);
  });

  it('detects exchange reactions', () => {
    const result = biggToLP(TEST_MODEL);
    expect(result.exchangeReactions).toContain('EX_glc__D_e');
  });

  it('applies knockouts', () => {
    const result = biggToLP(TEST_MODEL, { knockouts: ['R2'] });
    const r2Bound = result.lpModel.bounds?.find((b) => b.name === 'R2');
    expect(r2Bound?.lb).toBe(0);
    expect(r2Bound?.ub).toBe(0);
  });

  it('applies custom glucose uptake', () => {
    const result = biggToLP(TEST_MODEL, { glucoseUptake: 20 });
    const glcBound = result.lpModel.bounds?.find((b) => b.name === 'EX_glc__D_e');
    expect(glcBound?.lb).toBe(-20);
  });

  it('generates valid LP model structure', () => {
    const result = biggToLP(TEST_MODEL);
    expect(result.lpModel.sense).toBe('maximize');
    expect(result.lpModel.constraints.length).toBeGreaterThan(0);
    expect(result.lpModel.bounds).toBeDefined();
  });
});
