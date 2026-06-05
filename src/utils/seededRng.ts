/** Linear congruential PRNG for deterministic reproducibility. */
export class SeededRNG {
  private state: number;
  constructor(seed: number = 42) { this.state = seed; }
  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }
  /** Box-Muller transform → standard normal sample. */
  gaussian(): number {
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}
