/**
 * Reference runner (CC-2) — generic "run this tool → compare to a reference
 * fixture → within tolerance" harness. Real COBRApy/eQuilibrator/COPASI
 * fixtures are exported offline and committed later; this module ships only the
 * machinery plus synthetic self-test fixtures. Pure and deterministic.
 */

export interface ReferenceCase<I, O> {
  id: string;
  input: I;
  expected: O;
  /** Relative or absolute tolerance, per `metric`. */
  tolerance: number;
  metric: "rel" | "abs";
  /** Literature / tool+version, for the Citation test. */
  source: string;
}

export interface ReferenceReport {
  caseId: string;
  ok: boolean;
  observed: number;
  expected: number;
  error: number;
  source: string;
}

/** Run one reference case, comparing scalar-by-scalar; error ≤ tolerance ⇒ ok. */
export function runReferenceCase<I, O extends number | number[]>(
  compute: (input: I) => O,
  c: ReferenceCase<I, O>,
): ReferenceReport[] {
  const observed = compute(c.input);
  const obsArr: number[] = Array.isArray(observed) ? observed : [observed];
  const expArr: number[] = Array.isArray(c.expected) ? (c.expected as number[]) : [c.expected as number];
  const n = Math.max(obsArr.length, expArr.length);

  const reports: ReferenceReport[] = [];
  for (let i = 0; i < n; i++) {
    const o = obsArr[i] ?? Number.NaN;
    const e = expArr[i] ?? Number.NaN;
    const error = c.metric === "rel" ? Math.abs(o - e) / Math.max(Math.abs(e), 1e-12) : Math.abs(o - e);
    reports.push({
      caseId: n > 1 ? `${c.id}[${i}]` : c.id,
      ok: Number.isFinite(error) && error <= c.tolerance,
      observed: o,
      expected: e,
      error,
      source: c.source,
    });
  }
  return reports;
}

/** Deterministic self-test function used by the built-in fixtures. */
export function selfTestDouble(x: number): number {
  return 2 * x;
}

/** Synthetic self-test fixtures (placeholder until real reference fixtures land). */
export const SELF_TEST_CASES: ReferenceCase<number, number>[] = [
  { id: "double-2", input: 2, expected: 4, tolerance: 0, metric: "abs", source: "self-test: 2·x" },
  { id: "double-3", input: 3, expected: 6, tolerance: 1e-9, metric: "rel", source: "self-test: 2·x" },
];
