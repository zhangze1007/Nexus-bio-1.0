import {
  diagnoseFBA,
  type DiagnosisResult,
} from "../../src/services/diagnosis/fbaDiagnosis";

type Reaction = {
  id: string;
  stoichiometry: Record<string, number>;
  lowerBound: number;
  upperBound: number;
};

function makeModel(reactions: Reaction[], metabolites: string[]) {
  return { reactions, metabolites };
}

describe("fbaDiagnosis", () => {
  describe("diagnoseFBA", () => {
    it("should return undetermined status for a clean model with optimal status", async () => {
      const reactions: Reaction[] = [
        { id: "EX_A", stoichiometry: { A: 1 }, lowerBound: -10, upperBound: 10 },
        { id: "R1", stoichiometry: { A: -1, B: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "EX_B", stoichiometry: { B: -1 }, lowerBound: -10, upperBound: 10 },
      ];
      const model = makeModel(reactions, ["A", "B"]);
      const fluxes = { EX_A: 10, R1: 10, EX_B: 10 };

      const result = await diagnoseFBA(model, fluxes, "optimal");
      expect(result.status).toBe("undetermined");
      expect(result.issues).toHaveLength(0);
      expect(result.summary).toContain("No issues detected");
    });

    it("should diagnose dead-end metabolites for infeasible model", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "EX_B", stoichiometry: { B: -1 }, lowerBound: -10, upperBound: 10 },
      ];
      const model = makeModel(reactions, ["A", "B"]);
      const fluxes = { R1: 0, EX_B: 0 };

      const result = await diagnoseFBA(model, fluxes, "infeasible");
      expect(result.status).toBe("diagnosed");

      const deadEndIssues = result.issues.filter((i) => i.type === "dead_end");
      expect(deadEndIssues.length).toBeGreaterThanOrEqual(1);

      const aIssue = deadEndIssues.find((i) => i.affectedMetabolites.includes("A"));
      expect(aIssue).toBeDefined();
      expect(aIssue!.severity).toBe("critical");

      expect(result.summary).toContain("infeasibility");
    });

    it("should diagnose bound conflicts", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 }, lowerBound: 10, upperBound: 5 },
        { id: "EX_A", stoichiometry: { A: 1 }, lowerBound: -10, upperBound: 10 },
        { id: "EX_B", stoichiometry: { B: -1 }, lowerBound: -10, upperBound: 10 },
      ];
      const model = makeModel(reactions, ["A", "B"]);
      const fluxes = { R1: 0, EX_A: 0, EX_B: 0 };

      const result = await diagnoseFBA(model, fluxes, "infeasible");
      expect(result.status).toBe("diagnosed");

      const boundIssues = result.issues.filter((i) => i.type === "conflicting_bounds");
      expect(boundIssues).toHaveLength(1);
      expect(boundIssues[0].affectedReactions).toContain("R1");
      expect(boundIssues[0].severity).toBe("critical");

      const relaxSuggestions = result.suggestions.filter((s) => s.action === "relax_bounds");
      expect(relaxSuggestions.length).toBeGreaterThanOrEqual(1);
    });

    it("should diagnose cofactor imbalances", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1, product: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "R2", stoichiometry: { atp: -1, waste: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "EX_product", stoichiometry: { product: -1 }, lowerBound: -10, upperBound: 10 },
        { id: "EX_waste", stoichiometry: { waste: -1 }, lowerBound: -10, upperBound: 10 },
      ];
      const model = makeModel(reactions, ["atp", "product", "waste"]);
      const fluxes = { R1: 10, R2: 2, EX_product: 10, EX_waste: 2 };

      const result = await diagnoseFBA(model, fluxes, "optimal");
      const cofactorIssues = result.issues.filter((i) => i.type === "missing_cofactor");
      expect(cofactorIssues.length).toBeGreaterThanOrEqual(1);

      const atpIssue = cofactorIssues.find((i) => i.affectedMetabolites.includes("atp"));
      expect(atpIssue).toBeDefined();
    });

    it("should detect blocked reactions (fixed to zero)", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "R2", stoichiometry: { B: -1, C: 1 }, lowerBound: 0, upperBound: 0 },
        { id: "EX_A", stoichiometry: { A: 1 }, lowerBound: -10, upperBound: 10 },
        { id: "EX_C", stoichiometry: { C: -1 }, lowerBound: -10, upperBound: 10 },
      ];
      const model = makeModel(reactions, ["A", "B", "C"]);
      const fluxes = { R1: 0, R2: 0, EX_A: 0, EX_C: 0 };

      const result = await diagnoseFBA(model, fluxes, "infeasible");
      const blockedIssues = result.issues.filter((i) => i.type === "blocked_reaction");
      expect(blockedIssues.length).toBeGreaterThanOrEqual(1);
      expect(blockedIssues[0].affectedReactions).toContain("R2");
    });

    it("should generate suggestions for dead-end external metabolites", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { glc_e: -1, g6p: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "R2", stoichiometry: { g6p: -1, pyr: 1 }, lowerBound: 0, upperBound: 100 },
      ];
      const model = makeModel(reactions, ["glc_e", "g6p", "pyr"]);
      const fluxes = { R1: 0, R2: 0 };

      const result = await diagnoseFBA(model, fluxes, "infeasible");

      const exchangeSugs = result.suggestions.filter(
        (s) => s.action === "add_exchange" && s.details.metabolite === "glc_e",
      );
      expect(exchangeSugs.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle empty model gracefully", async () => {
      const model = makeModel([], []);
      const fluxes: Record<string, number> = {};

      const result = await diagnoseFBA(model, fluxes, "infeasible");
      expect(result.status).toBe("undetermined");
      expect(result.issues).toHaveLength(0);
    });

    it("should combine multiple issue types in a single diagnosis", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "R2", stoichiometry: { B: -1, atp: 1 }, lowerBound: 10, upperBound: 5 },
        { id: "R3", stoichiometry: { atp: -1, C: 1 }, lowerBound: 0, upperBound: 0 },
      ];
      const model = makeModel(reactions, ["A", "B", "atp", "C"]);
      const fluxes = { R1: 0, R2: 0, R3: 0 };

      const result = await diagnoseFBA(model, fluxes, "infeasible");
      expect(result.status).toBe("diagnosed");

      const issueTypes = new Set(result.issues.map((i) => i.type));
      expect(issueTypes.has("dead_end")).toBe(true);
      expect(issueTypes.has("conflicting_bounds")).toBe(true);
      expect(issueTypes.has("blocked_reaction")).toBe(true);

      expect(result.summary).toContain("infeasibility");
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it("should not report cofactor issues when all fluxes are zero", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1 }, lowerBound: 0, upperBound: 100 },
        { id: "R2", stoichiometry: { atp: -1 }, lowerBound: 0, upperBound: 100 },
      ];
      const model = makeModel(reactions, ["atp"]);
      const fluxes = { R1: 0, R2: 0 };

      const result = await diagnoseFBA(model, fluxes, "infeasible");
      const cofactorIssues = result.issues.filter((i) => i.type === "missing_cofactor");
      expect(cofactorIssues).toHaveLength(0);
    });

    it("should include expectedImpact in suggestions", async () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { A: -1, B: 1 }, lowerBound: 10, upperBound: 5 },
        { id: "EX_A", stoichiometry: { A: 1 }, lowerBound: -10, upperBound: 10 },
        { id: "EX_B", stoichiometry: { B: -1 }, lowerBound: -10, upperBound: 10 },
      ];
      const model = makeModel(reactions, ["A", "B"]);
      const fluxes = { R1: 0, EX_A: 0, EX_B: 0 };

      const result = await diagnoseFBA(model, fluxes, "infeasible");
      for (const suggestion of result.suggestions) {
        expect(suggestion.expectedImpact).toBeTruthy();
        expect(suggestion.description).toBeTruthy();
      }
    });
  });
});
