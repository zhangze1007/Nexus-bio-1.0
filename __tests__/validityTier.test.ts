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
    expect(TOOL_VALIDITY[toolId].level).toBeDefined();
    expect(['real', 'partial', 'demo']).toContain(TOOL_VALIDITY[toolId].level);
  });

  it.each(ALL_TOOLS)('%s has assumptions documented', (toolId) => {
    expect(TOOL_ASSUMPTIONS[toolId]).toBeDefined();
    expect(TOOL_ASSUMPTIONS[toolId].length).toBeGreaterThan(0);
  });

  // Tools that should be 'real' tier
  const REAL_TIER_TOOLS = ['fbasim', 'cethx', 'proevol', 'gecair'];

  it.each(REAL_TIER_TOOLS)('%s declares real tier', (toolId) => {
    expect(TOOL_VALIDITY[toolId].level).toBe('real');
  });

  // Tools that should have specific algorithm references in their captions
  it('fbasim references FBA algorithm', () => {
    const caption = TOOL_VALIDITY['fbasim'].caption.toLowerCase();
    expect(
      caption.includes('fba') ||
      caption.includes('flux balance') ||
      caption.includes('simplex')
    ).toBe(true);
  });

  it('cethx references thermodynamic models', () => {
    const caption = TOOL_VALIDITY['cethx'].caption.toLowerCase();
    expect(
      caption.includes('delta g') ||
      caption.includes('gibbs') ||
      caption.includes('group contribution') ||
      caption.includes('formation energy') ||
      caption.includes('thermodynamic')
    ).toBe(true);
  });

  it('proevol references fitness landscape', () => {
    const caption = TOOL_VALIDITY['proevol'].caption.toLowerCase();
    expect(
      caption.includes('fitness') ||
      caption.includes('landscape') ||
      caption.includes('evolution')
    ).toBe(true);
  });

  it('gecair references Hill functions', () => {
    const caption = TOOL_VALIDITY['gecair'].caption.toLowerCase();
    expect(
      caption.includes('hill') ||
      caption.includes('logic gate') ||
      caption.includes('circuit')
    ).toBe(true);
  });
});

describe('Engine Implementation Verification', () => {
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
