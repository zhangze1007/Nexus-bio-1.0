import {
  type ReferenceCase,
  runReferenceCase,
  SELF_TEST_CASES,
  selfTestDouble,
} from "../../src/services/benchmark/referenceRunner";

describe("referenceRunner (CC-2)", () => {
  it("passes the built-in self-test fixtures within tolerance", () => {
    for (const c of SELF_TEST_CASES) {
      const reports = runReferenceCase(selfTestDouble, c);
      expect(reports.every((r) => r.ok)).toBe(true);
      expect(reports[0].observed).toBe(2 * c.input);
    }
  });

  it("flags a case outside tolerance (does not silently pass)", () => {
    const bad: ReferenceCase<number, number> = {
      id: "bad",
      input: 2,
      expected: 100,
      tolerance: 0.01,
      metric: "rel",
      source: "self-test",
    };
    const reports = runReferenceCase(selfTestDouble, bad);
    expect(reports[0].ok).toBe(false);
    expect(reports[0].observed).toBe(4);
    expect(reports[0].error).toBeGreaterThan(0.01);
  });

  it("compares array outputs scalar-by-scalar", () => {
    const c: ReferenceCase<number[], number[]> = {
      id: "vec",
      input: [1, 2, 3],
      expected: [2, 4, 6],
      tolerance: 1e-9,
      metric: "abs",
      source: "self-test",
    };
    const reports = runReferenceCase((xs: number[]) => xs.map((v) => 2 * v), c);
    expect(reports).toHaveLength(3);
    expect(reports.every((r) => r.ok)).toBe(true);
  });

  it("carries the source string through for the Citation test", () => {
    const [report] = runReferenceCase(selfTestDouble, SELF_TEST_CASES[0]);
    expect(report.source).toContain("self-test");
  });
});
