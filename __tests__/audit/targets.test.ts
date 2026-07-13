import { filterTargets } from '../../scripts/audit/targets';

describe('filterTargets', () => {
  it('keeps engine/data/route source, drops tests/node_modules/decls', () => {
    const { audit } = filterTargets([
      'src/server/fbaEngine.ts',
      'src/server/fbaEngine.test.ts',
      '__tests__/audit/x.test.ts',
      'node_modules/foo/index.ts',
      'src/types/x.d.ts',
    ]);
    expect(audit).toEqual(['src/server/fbaEngine.ts']);
  });

  it('routes FORBIDDEN files to the forbidden bucket, not audit', () => {
    const { audit, forbidden } = filterTargets([
      'src/components/tools/ProEvolPage.tsx',
      'src/server/crisprEditingEngine.ts',
    ]);
    expect(forbidden).toContain('src/components/tools/ProEvolPage.tsx');
    expect(audit).toEqual(['src/server/crisprEditingEngine.ts']);
  });

  it('normalizes Windows backslashes', () => {
    const { audit } = filterTargets(['src\\server\\fbaEngine.ts']);
    expect(audit).toEqual(['src/server/fbaEngine.ts']);
  });
});
