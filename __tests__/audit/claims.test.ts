import { extractClaims } from '../../scripts/audit/detectors/claims';

describe('extractClaims', () => {
  it('detects @scientific_provenance and a journal citation', () => {
    const src = `/**\n * @scientific_provenance\n * Watson JL et al., Nature 2023;620:1089-1100.\n */`;
    const c = extractClaims(src, 'x.ts');
    expect(c.hasProvenance).toBe(true);
    expect(c.citations.length).toBeGreaterThan(0);
  });

  it('returns no claims for a plain util', () => {
    const src = `export function add(a: number, b: number) { return a + b; }`;
    const c = extractClaims(src, 'x.ts');
    expect(c.hasProvenance).toBe(false);
    expect(c.citations).toEqual([]);
  });
});
