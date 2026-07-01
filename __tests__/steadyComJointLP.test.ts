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
    const varNames = m.bounds?.map((b) => b.name) ?? [];
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
    const xa = m.bounds?.find((b) => b.name === 'X__A')!;
    expect(xa.lb).toBe(0);
    expect(xa.ub).toBe(1);
  });
});
