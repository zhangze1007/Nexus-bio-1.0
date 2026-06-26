import { detectConflicts, type Conflict } from "../../src/services/diagnosis/conflictDetector";

describe("conflictDetector", () => {
  describe("detectConflicts", () => {
    it("should return empty array for well-formed bounds", () => {
      const reactions = [
        { id: "R1", lowerBound: -10, upperBound: 10 },
        { id: "R2", lowerBound: 0, upperBound: 100 },
        { id: "R3", lowerBound: -1000, upperBound: 1000 },
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(0);
    });

    it("should detect bounds_crossed when lowerBound > upperBound", () => {
      const reactions = [
        { id: "R1", lowerBound: 10, upperBound: 5 },
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(1);
      expect(result[0].reaction).toBe("R1");
      expect(result[0].issue).toBe("bounds_crossed");
      expect(result[0].lowerBound).toBe(10);
      expect(result[0].upperBound).toBe(5);
    });

    it("should detect fixed_to_zero when both bounds are 0", () => {
      const reactions = [
        { id: "R1", lowerBound: 0, upperBound: 0 },
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(1);
      expect(result[0].reaction).toBe("R1");
      expect(result[0].issue).toBe("fixed_to_zero");
    });

    it("should detect multiple conflicts", () => {
      const reactions = [
        { id: "R1", lowerBound: 5, upperBound: 3 }, // bounds_crossed
        { id: "R2", lowerBound: 0, upperBound: 10 }, // fine
        { id: "R3", lowerBound: 0, upperBound: 0 }, // fixed_to_zero
        { id: "R4", lowerBound: 10, upperBound: 2 }, // bounds_crossed
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(3);

      const crossed = result.filter((c) => c.issue === "bounds_crossed");
      const fixed = result.filter((c) => c.issue === "fixed_to_zero");
      expect(crossed).toHaveLength(2);
      expect(fixed).toHaveLength(1);
    });

    it("should not flag negative lower bound with positive upper bound", () => {
      // This is normal for reversible reactions
      const reactions = [
        { id: "R1", lowerBound: -1000, upperBound: 1000 },
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(0);
    });

    it("should not flag forward-only reaction (lb=0, ub>0)", () => {
      const reactions = [
        { id: "R1", lowerBound: 0, upperBound: 10 },
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(0);
    });

    it("should not flag reverse-only reaction (lb<0, ub=0)", () => {
      const reactions = [
        { id: "R1", lowerBound: -10, upperBound: 0 },
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(0);
    });

    it("should handle empty reactions array", () => {
      const result = detectConflicts([]);
      expect(result).toHaveLength(0);
    });

    it("should sort results by reaction ID", () => {
      const reactions = [
        { id: "Z_R", lowerBound: 10, upperBound: 5 },
        { id: "A_R", lowerBound: 0, upperBound: 0 },
      ];

      const result = detectConflicts(reactions);
      expect(result[0].reaction).toBe("A_R");
      expect(result[1].reaction).toBe("Z_R");
    });

    it("should handle equal bounds (lb === ub, not zero)", () => {
      // Equal non-zero bounds means the reaction is fixed to a specific flux
      // This is not a conflict — it's a valid constraint
      const reactions = [
        { id: "R1", lowerBound: 5, upperBound: 5 },
      ];

      const result = detectConflicts(reactions);
      expect(result).toHaveLength(0);
    });
  });
});
