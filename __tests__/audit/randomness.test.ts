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
});
