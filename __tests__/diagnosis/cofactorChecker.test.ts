import {
  checkCofactorBalance,
  COFACTORS,
  type CofactorImbalance,
} from "../../src/services/diagnosis/cofactorChecker";

type Reaction = { id: string; stoichiometry: Record<string, number> };

describe("cofactorChecker", () => {
  describe("COFACTORS", () => {
    it("should include standard metabolic cofactors", () => {
      expect(COFACTORS).toContain("atp");
      expect(COFACTORS).toContain("adp");
      expect(COFACTORS).toContain("nad");
      expect(COFACTORS).toContain("nadh");
      expect(COFACTORS).toContain("nadp");
      expect(COFACTORS).toContain("nadph");
      expect(COFACTORS).toContain("coa");
      expect(COFACTORS).toContain("h2o");
    });

    it("should have at least 10 cofactors", () => {
      expect(COFACTORS.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("checkCofactorBalance", () => {
    it("should return empty array for balanced cofactors", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1, product_a: 1 } },
        { id: "R2", stoichiometry: { atp: -1, product_b: 1 } },
      ];
      const fluxes = { R1: 1.0, R2: 1.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      expect(result).toHaveLength(0);
    });

    it("should detect overproduced cofactor", () => {
      const reactions: Reaction[] = [
        { id: "PROD", stoichiometry: { atp: 1 } },
        { id: "CONS", stoichiometry: { atp: -1 } },
      ];
      const fluxes = { PROD: 10.0, CONS: 5.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      const atpImbalance = result.find((i) => i.cofactor === "atp");
      expect(atpImbalance).toBeDefined();
      expect(atpImbalance!.issue).toBe("overproduced");
      expect(atpImbalance!.netProduction).toBe(10);
      expect(atpImbalance!.netConsumption).toBe(5);
      expect(atpImbalance!.imbalance).toBe(5);
    });

    it("should detect underproduced cofactor", () => {
      const reactions: Reaction[] = [
        { id: "PROD", stoichiometry: { nadh: 1 } },
        { id: "CONS", stoichiometry: { nadh: -1 } },
      ];
      const fluxes = { PROD: 2.0, CONS: 8.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      const nadhImbalance = result.find((i) => i.cofactor === "nadh");
      expect(nadhImbalance).toBeDefined();
      expect(nadhImbalance!.issue).toBe("underproduced");
      expect(nadhImbalance!.imbalance).toBe(-6);
    });

    it("should handle compartment-suffixed metabolite IDs", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp_c: 1 } },
        { id: "R2", stoichiometry: { atp_c: -1 } },
      ];
      const fluxes = { R1: 5.0, R2: 5.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      expect(result).toHaveLength(0);
    });

    it("should handle prefix-suffixed metabolite IDs", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { c_atp: 1 } },
        { id: "R2", stoichiometry: { c_atp: -1 } },
      ];
      const fluxes = { R1: 5.0, R2: 5.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      // c_atp matches atp via endsWith("_atp") — balanced at equal fluxes
      expect(result).toHaveLength(0);
    });

    it("should skip zero-flux reactions", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1 } },
        { id: "R2", stoichiometry: { atp: -1 } },
      ];
      const fluxes = { R1: 0, R2: 0 };

      const result = checkCofactorBalance(reactions, fluxes);
      expect(result).toHaveLength(0);
    });

    it("should handle missing flux entries (treated as zero)", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1 } },
        { id: "R2", stoichiometry: { atp: -1 } },
      ];
      const fluxes = { R1: 5.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      const atpImbalance = result.find((i) => i.cofactor === "atp");
      expect(atpImbalance).toBeDefined();
      expect(atpImbalance!.issue).toBe("overproduced");
      expect(atpImbalance!.netProduction).toBe(5);
      expect(atpImbalance!.netConsumption).toBe(0);
    });

    it("should handle empty inputs", () => {
      const result = checkCofactorBalance([], {});
      expect(result).toHaveLength(0);
    });

    it("should respect custom tolerance", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1 } },
        { id: "R2", stoichiometry: { atp: -1 } },
      ];
      const fluxes = { R1: 1.0, R2: 0.99 };

      const resultDefault = checkCofactorBalance(reactions, fluxes, 0.009);
      expect(resultDefault.length).toBeGreaterThanOrEqual(1);

      const resultHigh = checkCofactorBalance(reactions, fluxes, 0.1);
      expect(resultHigh).toHaveLength(0);
    });

    it("should sort results by absolute imbalance (largest first)", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1, nadh: 1 } },
        { id: "R2", stoichiometry: { atp: -1 } },
        { id: "R3", stoichiometry: { nadh: -1 } },
      ];
      const fluxes = { R1: 10.0, R2: 5.0, R3: 2.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      if (result.length >= 2) {
        expect(Math.abs(result[0].imbalance)).toBeGreaterThanOrEqual(
          Math.abs(result[1].imbalance),
        );
      }
    });

    it("should detect multiple cofactor imbalances simultaneously", () => {
      const reactions: Reaction[] = [
        { id: "R1", stoichiometry: { atp: 1, nadh: 1, coa: -1 } },
        { id: "R2", stoichiometry: { atp: -1 } },
      ];
      const fluxes = { R1: 10.0, R2: 5.0 };

      const result = checkCofactorBalance(reactions, fluxes);
      const cofactors = result.map((i) => i.cofactor);
      expect(cofactors).toContain("atp");
      expect(cofactors).toContain("nadh");
      expect(cofactors).toContain("coa");
    });
  });
});
