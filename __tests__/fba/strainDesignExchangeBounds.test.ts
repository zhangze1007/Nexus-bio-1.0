/**
 * Regression test: the strain-design modules (FSEOF, OptKnock, RobustKnock) must
 * identify the glucose/oxygen uptake exchanges by external metabolite id — the
 * same fix already applied to solveDynamicFBA — and must NOT mis-clamp exchanges
 * whose ids merely contain the substrings "o2" (EX_co2_e) or "glu"
 * (EX_glu__L_e). EX_gln__L_e is a control (never matched by the old bug either).
 *
 * Each module's LP builder is exercised directly and its exchange bounds are
 * asserted: only the true glucose (glc__D_e) / oxygen (o2_e) exchanges get the
 * user uptake bound; every other exchange keeps its native model bound.
 */
import {
  GLUCOSE_EXCHANGE_METS,
  OXYGEN_EXCHANGE_METS,
  exchangeMetaboliteId,
} from "../../src/server/fbaEngine";
import { buildFSEOFLP } from "../../src/server/fbaFSEOF";
import { buildOptKnockLP, buildOptKnockMILP } from "../../src/server/fbaOptKnock";
import { buildBounds } from "../../src/server/fbaRobustKnock";

type Rxn = { id: string; lb: number; ub: number; stoichiometry: Record<string, number> };

// A model whose exchange ids deliberately contain the misleading substrings.
// Native bounds: CO2/glutamate/glutamine cannot be taken up (lb = 0 or the model
// default), which the old `.includes("o2")` / `.includes("glu")` code violated.
const reactions: Rxn[] = [
  { id: "EX_glc__D_e", lb: -1000, ub: 1000, stoichiometry: { glc__D_e: -1 } },
  { id: "EX_o2_e", lb: -1000, ub: 1000, stoichiometry: { o2_e: -1 } },
  { id: "EX_co2_e", lb: -1000, ub: 1000, stoichiometry: { co2_e: -1 } },
  { id: "EX_glu__L_e", lb: 0, ub: 1000, stoichiometry: { glu__L_e: -1 } },
  { id: "EX_gln__L_e", lb: 0, ub: 1000, stoichiometry: { gln__L_e: -1 } },
  { id: "GLCpts", lb: 0, ub: 1000, stoichiometry: { glc__D_e: -1, g6p: 1 } },
  { id: "BIOMASS", lb: 0, ub: 1000, stoichiometry: { g6p: -1, biomass: 1 } },
  { id: "PRODUCT", lb: 0, ub: 1000, stoichiometry: { g6p: -1, product: 1 } },
  { id: "EX_biomass", lb: 0, ub: 1000, stoichiometry: { biomass: -1 } },
  { id: "EX_product", lb: 0, ub: 1000, stoichiometry: { product: -1 } },
];

const GLC = 10;
const O2 = 20;

function lbByName(bounds: Array<{ name: string; lb: number }> | undefined, name: string): number {
  const b = bounds?.find((x) => x.name === name);
  if (!b) throw new Error(`no bound for ${name}`);
  return b.lb;
}

// Assert the exchange bounds for a builder, given a reaction-id → bound-name map.
function assertExchangeBounds(bounds: Array<{ name: string; lb: number }> | undefined, nameOf: (id: string) => string) {
  // Correctly clamped: the true glucose and oxygen uptakes.
  expect(lbByName(bounds, nameOf("EX_glc__D_e"))).toBe(-GLC);
  expect(lbByName(bounds, nameOf("EX_o2_e"))).toBe(-O2);
  // NOT clamped: native bounds preserved (old bug forced -O2 / -GLC).
  expect(lbByName(bounds, nameOf("EX_co2_e"))).toBe(-1000);
  expect(lbByName(bounds, nameOf("EX_co2_e"))).not.toBe(-O2);
  expect(lbByName(bounds, nameOf("EX_glu__L_e"))).toBe(0);
  expect(lbByName(bounds, nameOf("EX_glu__L_e"))).not.toBe(-GLC);
  expect(lbByName(bounds, nameOf("EX_gln__L_e"))).toBe(0);
}

describe("strain-design exchange identification (bug fix propagation)", () => {
  it("shared classifier treats co2_e/glu__L_e/gln__L_e as neither glucose nor oxygen", () => {
    expect(exchangeMetaboliteId({ id: "EX_co2_e", stoichiometry: { co2_e: -1 } })).toBe("co2_e");
    expect(exchangeMetaboliteId({ id: "EX_glu__L_e", stoichiometry: { glu__L_e: -1 } })).toBe("glu__L_e");
    // Real substrates are still recognized.
    expect(GLUCOSE_EXCHANGE_METS.has("glc__D_e")).toBe(true);
    expect(OXYGEN_EXCHANGE_METS.has("o2_e")).toBe(true);
    // The mis-matched ones are not.
    expect(GLUCOSE_EXCHANGE_METS.has("glu__L_e")).toBe(false);
    expect(GLUCOSE_EXCHANGE_METS.has("gln__L_e")).toBe(false);
    expect(OXYGEN_EXCHANGE_METS.has("co2_e")).toBe(false);
  });

  it("fbaFSEOF.buildFSEOFLP does not mis-clamp EX_co2_e / EX_glu__L_e", () => {
    const model = buildFSEOFLP(reactions, "BIOMASS", 0, GLC, O2, []);
    assertExchangeBounds(model.bounds, (id) => id);
  });

  it("fbaOptKnock.buildOptKnockLP (inner FBA) does not mis-clamp EX_co2_e / EX_glu__L_e", () => {
    const model = buildOptKnockLP(reactions, "BIOMASS", [], 0, GLC, O2);
    assertExchangeBounds(model.bounds, (id) => id);
  });

  it("fbaOptKnock.buildOptKnockMILP (bilevel) does not mis-clamp EX_co2_e / EX_glu__L_e", () => {
    const model = buildOptKnockMILP(reactions, "BIOMASS", "PRODUCT", [], 0, GLC, O2, 1);
    // Bilevel primal flux bounds are named `v_<rxnId>`.
    assertExchangeBounds(model.bounds, (id) => `v_${id}`);
  });

  it("fbaRobustKnock.buildBounds does not mis-clamp EX_co2_e / EX_glu__L_e", () => {
    const bounds = buildBounds(reactions, [], GLC, O2);
    assertExchangeBounds(bounds, (id) => id);
  });
});
