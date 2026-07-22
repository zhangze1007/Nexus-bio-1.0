/**
 * Regression test for the solveDynamicFBA exchange-identification bug.
 *
 * The old code decided which exchange carried the user's glucose / oxygen uptake
 * bound with name-substring tests (`id.includes("o2")`, `id.includes("glu")`).
 * Those match innocent exchanges — `EX_co2_e` contains "o2", `EX_glu__L_e`
 * contains "glu" — and wrongly forced their bounds open, letting the cell take
 * up CO2 / glutamate. The fix matches the substrate by its external metabolite
 * id instead. `buildDynamicFBAModel` is the extracted, testable model builder.
 */
import { buildDynamicFBAModel, type DynamicReaction } from "../../src/server/fbaEngine";

describe("solveDynamicFBA exchange identification (bug fix)", () => {
  // Exchange ids deliberately containing the misleading substrings "o2" and "glu".
  const reactions: DynamicReaction[] = [
    { id: "EX_glc__D_e", name: "D-Glucose exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { glc__D_e: -1 } },
    { id: "EX_o2_e", name: "O2 exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { o2_e: -1 } },
    { id: "EX_co2_e", name: "CO2 exchange", subsystem: "Exchange", lb: -1000, ub: 1000, stoichiometry: { co2_e: -1 } },
    { id: "EX_glu__L_e", name: "L-Glutamate exchange", subsystem: "Exchange", lb: 0, ub: 1000, stoichiometry: { glu__L_e: -1 } },
    { id: "EX_gln__L_e", name: "L-Glutamine exchange", subsystem: "Exchange", lb: 0, ub: 1000, stoichiometry: { gln__L_e: -1 } },
    { id: "BIOMASS", name: "biomass", subsystem: "Biomass", lb: 0, ub: 1000, stoichiometry: { glc__D_e: -1, o2_e: -1 } },
  ];

  function boundOf(model: ReturnType<typeof buildDynamicFBAModel>, id: string) {
    const b = model.bounds?.find((x) => x.name === id);
    if (!b) throw new Error(`no bound for ${id}`);
    return b;
  }

  it("clamps ONLY the true glucose and oxygen uptake exchanges", () => {
    const model = buildDynamicFBAModel(reactions, "BIOMASS", { glucoseUptake: 10, oxygenUptake: 20 });
    expect(boundOf(model, "EX_glc__D_e").lb).toBe(-10); // glucose → -glucoseUptake
    expect(boundOf(model, "EX_o2_e").lb).toBe(-20); // oxygen  → -oxygenUptake
  });

  it("does NOT clamp EX_co2_e / EX_glu__L_e / EX_gln__L_e (regression on 'o2'/'glu' substrings)", () => {
    const model = buildDynamicFBAModel(reactions, "BIOMASS", { glucoseUptake: 10, oxygenUptake: 20 });
    // Native bounds preserved. The buggy code forced EX_co2_e→-20 and EX_glu__L_e→-10.
    expect(boundOf(model, "EX_co2_e").lb).toBe(-1000);
    expect(boundOf(model, "EX_glu__L_e").lb).toBe(0);
    expect(boundOf(model, "EX_gln__L_e").lb).toBe(0);
    // Explicitly assert they are NOT the old mis-clamped values.
    expect(boundOf(model, "EX_co2_e").lb).not.toBe(-20);
    expect(boundOf(model, "EX_glu__L_e").lb).not.toBe(-10);
  });

  it("still applies knockouts (ub → 0) without mis-clamping the lower bound", () => {
    const model = buildDynamicFBAModel(reactions, "BIOMASS", {
      glucoseUptake: 10,
      oxygenUptake: 20,
      knockouts: ["EX_co2_e"],
    });
    expect(boundOf(model, "EX_co2_e").ub).toBe(0); // knocked out
    expect(boundOf(model, "EX_co2_e").lb).toBe(-1000); // lb still native, not oxygen-clamped
  });
});
