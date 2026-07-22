import { gaussian, makeRng, randInt } from "../../src/utils/rng";

describe("makeRng", () => {
  it("same seed produces identical sequence", () => {
    const a = makeRng(123);
    const b = makeRng(123);
    const seqA = Array.from({ length: 16 }, () => a());
    const seqB = Array.from({ length: 16 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const seqA = Array.from({ length: 16 }, ((r) => () => r())(makeRng(1)));
    const seqB = Array.from({ length: 16 }, ((r) => () => r())(makeRng(2)));
    expect(seqA).not.toEqual(seqB);
  });

  it("returns values in [0, 1)", () => {
    const r = makeRng(42);
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randInt stays in range and is deterministic", () => {
    const a = makeRng(5);
    const b = makeRng(5);
    for (let i = 0; i < 100; i++) {
      const x = randInt(a, 7);
      expect(randInt(b, 7)).toBe(x);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(7);
    }
  });

  it("gaussian is deterministic for a fixed seed and roughly standard-normal", () => {
    expect(gaussian(makeRng(7))).toBe(gaussian(makeRng(7)));
    const r = makeRng(99);
    const N = 5000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const x = gaussian(r);
      sum += x;
      sumSq += x * x;
    }
    const mean = sum / N;
    const sd = Math.sqrt(sumSq / N - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(Math.abs(sd - 1)).toBeLessThan(0.1);
  });
});
