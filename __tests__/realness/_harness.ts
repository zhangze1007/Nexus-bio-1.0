/**
 * Realness harness (CC-1) — the dual of the determinism guard.
 *
 * Determinism guarantees "same input → same output"; this guarantees
 * "different input → different output", i.e. it catches decoy/canned functions
 * that declare a parameter but ignore it. Not a Jest suite itself (excluded via
 * testPathIgnorePatterns); imported by realness property tests.
 */

/**
 * Assert `fn` is sensitive to the argument at `argIndex`: at least one of the
 * supplied perturbations must change the (JSON-serialized) output. Throws with a
 * decoy diagnostic otherwise.
 */
export function assertInputSensitive<A extends unknown[]>(
  fn: (...args: A) => unknown,
  baseArgs: A,
  argIndex: number,
  perturbations: Array<A[number]>,
): void {
  const base = JSON.stringify(fn(...baseArgs));
  const changed = perturbations.some((p) => {
    const args = [...baseArgs] as A;
    args[argIndex] = p;
    return JSON.stringify(fn(...args)) !== base;
  });
  if (!changed) {
    throw new Error(
      `Input ${argIndex} of ${fn.name || "fn"} is ignored (decoy/canned): no perturbation changed the output.`,
    );
  }
}
