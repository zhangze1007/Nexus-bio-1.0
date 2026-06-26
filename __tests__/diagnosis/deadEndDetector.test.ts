import { detectDeadEnds, type DeadEnd } from "../../src/services/diagnosis/deadEndDetector";

type Reaction = { id: string; stoichiometry: Record<string, number> };

describe("deadEndDetector", () => {
  describe("detectDeadEnds", () => {
    it("should return empty array for a balanced linear pathway", () => {
      const reactions: Reaction[] = [
        { id: "EX_A", stoichiometry: { A: 1 } },
        { id: "R1", stoichiometry: { A: -1, B: 1 } },
        { id: "R2", stoichiometry: { B: -1, C: 1 } },
        { id: "EX_C", stoichiometry: { C: -1 } },
      ];

      const result = detectDeadEnds(reactions);
      expect(result).toHaveLength(0);
    });

    it("should detect a metabolite with no producer", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 } },
        { id: "R2", stoichiometry: { B: -1, C: 1 } },
        { id: "R3", stoichiometry: { C: -1, D: 1 } },
        { id: "EX_D", stoichiometry: { D: -1 } },
      ];
      const result = detectDeadEnds(reactions);
      const aDeadEnd = result.find((d) => d.metabolite === "A");
      expect(aDeadEnd).toBeDefined();
      expect(aDeadEnd!.issue).toBe("no_producer");
      expect(aDeadEnd!.consumingReactions).toContain("R1");
    });

    it("should detect a metabolite with no consumer", () => {
      const reactions: Reaction[] = [
        { id: "EX_A", stoichiometry: { A: 1 } },
        { id: "R1", stoichiometry: { A: -1, B: 1 } },
        { id: "R2", stoichiometry: { B: -1, D: 1 } },
      ];

      const result = detectDeadEnds(reactions);
      const dDeadEnd = result.find((d) => d.metabolite === "D");
      expect(dDeadEnd).toBeDefined();
      expect(dDeadEnd!.issue).toBe("no_consumer");
      expect(dDeadEnd!.producingReactions).toContain("R2");
    });

    it("should detect multiple dead ends", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 } },
        { id: "R2", stoichiometry: { C: -1, D: 1 } },
      ];

      const result = detectDeadEnds(reactions);
      const deadEndMetabolites = result.map((d) => d.metabolite);
      expect(deadEndMetabolites).toContain("A");
      expect(deadEndMetabolites).toContain("B");
      expect(deadEndMetabolites).toContain("C");
      expect(deadEndMetabolites).toContain("D");
    });

    it("should handle reactions with multiple reactants and products", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: -1, C: 1, D: 1 } },
        { id: "EX_A", stoichiometry: { A: 1 } },
        { id: "EX_B", stoichiometry: { B: 1 } },
        { id: "EX_C", stoichiometry: { C: -1 } },
        { id: "EX_D", stoichiometry: { D: -1 } },
      ];

      const result = detectDeadEnds(reactions);
      expect(result).toHaveLength(0);
    });

    it("should handle empty reactions array", () => {
      const result = detectDeadEnds([]);
      expect(result).toHaveLength(0);
    });

    it("should handle single reaction with no exchanges", () => {
      const reactions: Reaction[] = [{ id: "R1", stoichiometry: { A: -1, B: 1 } }];

      const result = detectDeadEnds(reactions);
      expect(result).toHaveLength(2);
      const aEnd = result.find((d) => d.metabolite === "A");
      const bEnd = result.find((d) => d.metabolite === "B");
      expect(aEnd!.issue).toBe("no_producer");
      expect(bEnd!.issue).toBe("no_consumer");
    });

    it("should sort results by metabolite ID", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { Z: -1, A: 1 } },
      ];

      const result = detectDeadEnds(reactions);
      expect(result[0].metabolite).toBe("A");
      expect(result[1].metabolite).toBe("Z");
    });

    it("should handle reversible reactions (negative flux coefficients)", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 } },
        { id: "R2", stoichiometry: { B: -1, A: 1 } },
      ];

      const result = detectDeadEnds(reactions);
      expect(result).toHaveLength(0);
    });

    it("should correctly identify producing vs consuming reactions", () => {
      const reactions: Reaction[] = [
        { id: "PROD1", stoichiometry: { A: 1 } },
        { id: "PROD2", stoichiometry: { A: 1 } },
        { id: "CONS1", stoichiometry: { A: -1 } },
      ];

      const result = detectDeadEnds(reactions);
      const aEnd = result.find((d) => d.metabolite === "A");
      expect(aEnd).toBeUndefined();
    });
  });
});
