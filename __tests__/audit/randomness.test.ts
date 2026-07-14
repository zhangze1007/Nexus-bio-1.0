import { scanRandomness } from '../../scripts/audit/detectors/randomness';

describe('scanRandomness', () => {
  it('flags random-derived returned SCORE as fabrication', () => {
    const src = `const confidence = 0.4 + 0.3 * Math.random();\nreturn confidence;`;
    const hits = scanRandomness(src, 'x.ts').filter((h) => h.klass === 'fabrication');
    expect(hits.length).toBe(1);
  });

  it('classifies unseeded sampling as reproducibility (not fabrication)', () => {
    const src = `let vec = arr.map(() => Math.random()); // power-iteration init`;
    const hits = scanRandomness(src, 'x.ts');
    expect(hits[0].klass).toBe('reproducibility');
  });

  it('excludes id generators', () => {
    const src = `const id = Math.random().toString(36).slice(2);`;
    expect(scanRandomness(src, 'x.ts')[0].klass).toBe('excluded');
  });

  it('excludes ACKNOWLEDGED legit randomness by file+snippet', () => {
    const src = `      p *= Math.random(); // Knuth`;
    expect(scanRandomness(src, 'src/server/digitalCellEngine.ts')[0].klass).toBe('excluded');
  });

  it('flags multi-line fabrication with a neutral variable name via forward-window return check', () => {
    const src = `function f(seq) {\n  const base = 0.5;\n  const jitter = Math.random() * 0.1;\n  const total = base + jitter;\n  return total;\n}`;
    const hits = scanRandomness(src, 'x.ts');
    const hit = hits.find((h) => h.snippet.includes('Math.random()'));
    expect(hit?.klass).toBe('fabrication');
  });
});
