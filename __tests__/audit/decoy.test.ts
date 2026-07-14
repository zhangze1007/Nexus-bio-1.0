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

  // Regression: nested-paren param lists must not fabricate a phantom
  // parameter from a typed callback's own signature.
  it('does NOT fabricate a param from a typed multi-arg callback signature', () => {
    const src = `function reduce(arr, fn: (acc: number, cur: number) => number) {\n  return arr.reduce(fn, 0);\n}`;
    expect(scanDecoys(src, 'x.ts')).toEqual([]);
  });

  // Regression: a default no-op callback (`= () => {}`) must not be mistaken
  // for the function body, which would wrongly flag every real parameter.
  it('does NOT flag params when a default param has a no-op arrow body', () => {
    const src = `function attach(el, onClick = () => {}) {\n  el.on('click', onClick);\n}`;
    expect(scanDecoys(src, 'x.ts')).toEqual([]);
  });

  // Regression: an inline object-literal return-type annotation must not be
  // mistaken for the function body, which would wrongly flag every real
  // parameter as unused.
  it('does NOT flag params when the return type is an inline object annotation', () => {
    const src = `function makePoint(x, y): { a: number; b: number } {\n  return { a: x, b: y };\n}`;
    expect(scanDecoys(src, 'x.ts')).toEqual([]);
  });

  // Regression: a nested function that shadows the outer parameter name must
  // not hide the fact that the OUTER parameter is genuinely unused.
  it('flags an outer param shadowed (and thus never itself used) by a nested function', () => {
    const src = `function process(data) {\n  [].forEach(function(data) {\n    console.log(data);\n  });\n}`;
    const hits = scanDecoys(src, 'x.ts');
    expect(hits).toEqual([{ file: 'x.ts', line: 1, fn: 'process', param: 'data' }]);
  });
});
