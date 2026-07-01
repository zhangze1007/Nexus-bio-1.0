import { generateProteinLocalHeuristic } from '../src/services/esm3Client';

/**
 * T1-5: the ESM-3 local heuristic fallback must (a) be seeded/reproducible and
 * (b) self-label its provenance so heuristic scores are never mistaken for
 * ESM-3 model confidence.
 */
describe('generateProteinLocalHeuristic', () => {
  it('is reproducible for a fixed seed', () => {
    const a = generateProteinLocalHeuristic(120, 'enzyme', 7);
    const b = generateProteinLocalHeuristic(120, 'enzyme', 7);
    expect(a).toEqual(b);
  });

  it('varies with the seed', () => {
    const a = generateProteinLocalHeuristic(120, 'enzyme', 1);
    const b = generateProteinLocalHeuristic(120, 'enzyme', 2);
    expect(a.sequence).not.toBe(b.sequence);
  });

  it('self-labels provenance as a heuristic estimate', () => {
    const r = generateProteinLocalHeuristic(80, 'structural', 3);
    expect(r.scoreType).toBe('heuristic_estimate');
    expect(r.source).toBe('local_heuristic');
  });
});
