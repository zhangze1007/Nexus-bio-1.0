/** A deterministic PRNG: returns a float in [0, 1). Same seed → same sequence. */
export type Rng = () => number;

/**
 * 确定性 PRNG（mulberry32）：同 seed 同序列。计算路径一律用它，禁止裸 Math.random。
 *
 * This is the sanctioned randomness source for compute paths. The determinism
 * guard (`scripts/check-determinism.mjs`) forbids bare `Math.random(` in
 * src/server | src/modules | src/services precisely so callers route through here.
 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller standard-normal sample driven by a seeded {@link Rng}. */
export function gaussian(rng: Rng, mean = 0, sd = 1): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Uniform integer in [0, n) from a seeded {@link Rng}. */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}
