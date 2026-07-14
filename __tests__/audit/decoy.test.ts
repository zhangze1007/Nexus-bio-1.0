// __tests__/audit/decoy.test.ts
import { scanDecoys } from '../../scripts/audit/detectors/decoy';

describe('scanDecoys', () => {
  it('flags a function that ignores a parameter', () => {
    const src = `function findAB(minDist, spread) {\n  const a = 1.929;\n  return [a, 0.79];\n}`;
    const hits = scanDecoys(src, 'x.ts');
    expect(hits.map((h) => h.param).sort()).toEqual(['minDist', 'spread']);
  });

  it('does NOT flag a function that uses its parameters', () => {
    const src = `function scale(x, k) {\n  return x * k;\n}`;
    expect(scanDecoys(src, 'x.ts')).toEqual([]);
  });

  it('ignores underscore-prefixed params', () => {
    const src = `function f(_ctx, v) {\n  return v + 1;\n}`;
    expect(scanDecoys(src, 'x.ts')).toEqual([]);
  });
});
