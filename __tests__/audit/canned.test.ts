import { scanCannedReturns } from '../../scripts/audit/detectors/canned';

describe('scanCannedReturns', () => {
  it('flags a function that uses NONE of its parameters (input-independent / canned)', () => {
    const src = `function predict(seq, temp) { return 0.87; }`;
    const hits = scanCannedReturns(src, 'x.ts');
    expect(hits.map((h) => h.fn)).toEqual(['predict']);
  });

  it('does NOT flag a function that uses at least one parameter', () => {
    const src = `function score(x, y) { return x + 1; }`;
    expect(scanCannedReturns(src, 'x.ts')).toEqual([]);
  });

  it('does NOT flag a parameterless function (nothing to ignore)', () => {
    const src = `function now() { return Date.now(); }`;
    expect(scanCannedReturns(src, 'x.ts')).toEqual([]);
  });

  it('ignores underscore / rest params when deciding "uses none"', () => {
    const src = `function f(_ctx, ...rest) { return 5; }`;
    expect(scanCannedReturns(src, 'x.ts')).toEqual([]);
  });

  it('a nested use of a param that is actually shadowed does NOT count as using the outer param', () => {
    const src = `function outer(data) { [].forEach(function (data) { console.log(data); }); return 1; }`;
    expect(scanCannedReturns(src, 'x.ts').map((h) => h.fn)).toEqual(['outer']);
  });
});
