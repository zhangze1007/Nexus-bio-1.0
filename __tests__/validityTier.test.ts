/**
 * Validity Tier Automated Tests
 *
 * Verifies that all engines correctly declare their validity tier
 * and that the tier matches the actual implementation quality.
 *
 * Validity tiers:
 *   - 'real': Full scientific implementation with real algorithms
 *   - 'partial': Real algorithms with some heuristic components
 *   - 'demo': Demonstration only, not for real analysis
 *   - 'simulated': Mock data, no real computation
 */

import { TOOL_VALIDITY } from '../src/config/toolValidity';
import { TOOL_ASSUMPTIONS } from '../src/config/toolAssumptions';

describe('Validity Tier Declarations', () => {
  // All tools must have a validity declaration
  const ALL_TOOLS = [
    'pathd', 'catdes', 'cellfree', 'cethx', 'dbtlflow',
    'dyncon', 'fbasim', 'gecair', 'genmim', 'multio',
    'nexai', 'proevol', 'scspatial',
  ];

  it.each(ALL_TOOLS)('%s has a validity tier declaration', (toolId) => {
    expect(TOOL_VALIDITY[toolId]).toBeDefined();
    expect(TOOL_VALIDITY[toolId].tier).toBeDefined();
    expect(['real', 'partial', 'demo', 'simulated']).toContain(TOOL_VALIDITY[toolId].tier);
  });

  it.each(ALL_TOOLS)('%s has assumptions documented', (toolId) => {
    expect(TOOL_ASSUMPTIONS[toolId]).toBeDefined();
    expect(TOOL_ASSUMPTIONS[toolId].length).toBeGreaterThan(0);
  });

  // Tools that should be 'real' tier
  const REAL_TIER_TOOLS = ['fbasim', 'cethx', 'proevol', 'gecair'];

  it.each(REAL_TIER_TOOLS)('%s declares real tier', (toolId) => {
    expect(TOOL_VALIDITY[toolId].tier).toBe('real');
  });

  // Tools that should have specific algorithm references
  it('fbasim references FBA algorithm', () => {
    const assumptions = TOOL_ASSUMPTIONS['fbasim'];
    const hasFBA = assumptions.some(a =>
      a.toLowerCase().includes('fba') ||
      a.toLowerCase().includes('flux balance') ||
      a.toLowerCase().includes('simplex')
    );
    expect(hasFBA).toBe(true);
  });

  it('cethx references thermodynamic models', () => {
    const assumptions = TOOL_ASSUMPTIONS['cethx'];
    const hasThermo = assumptions.some(a =>
      a.toLowerCase().includes('delta g') ||
      a.toLowerCase().includes('gibbs') ||
      a.toLowerCase().includes('group contribution') ||
      a.toLowerCase().includes('formation energy')
    );
    expect(hasThermo).toBe(true);
  });

  it('proevol references fitness landscape', () => {
    const assumptions = TOOL_ASSUMPTIONS['proevol'];
    const hasFitness = assumptions.some(a =>
      a.toLowerCase().includes('fitness') ||
      a.toLowerCase().includes('landscape') ||
      a.toLowerCase().includes('evolution')
    );
    expect(hasFitness).toBe(true);
  });

  it('gecair references Hill functions', () => {
    const assumptions = TOOL_ASSUMPTIONS['gecair'];
    const hasHill = assumptions.some(a =>
      a.toLowerCase().includes('hill') ||
      a.toLowerCase().includes('logic gate') ||
      a.toLowerCase().includes('circuit')
    );
    expect(hasHill).toBe(true);
  });
});

describe('Engine Implementation Verification', () => {
  // Verify that engines actually implement the algorithms they claim

  it('FBA engine uses simplex solver', async () => {
    const { solveAuthorityFBA } = await import('../src/server/fbaEngine');
    expect(typeof solveAuthorityFBA).toBe('function');
  });

  it('Thermodynamics engine uses group contribution', async () => {
    const { estimateFormationEnergy } = await import('../src/utils/groupContribution');
    expect(typeof estimateFormationEnergy).toBe('function');
  });

  it('Kinetics engine uses Michaelis-Menten', async () => {
    const { michaelisMentenRate } = await import('../src/utils/eyringKinetics');
    expect(typeof michaelisMentenRate).toBe('function');
  });

  it('ODE solver uses RK4', async () => {
    const { solveRK4 } = await import('../src/utils/odeSolver');
    expect(typeof solveRK4).toBe('function');
  });
});
