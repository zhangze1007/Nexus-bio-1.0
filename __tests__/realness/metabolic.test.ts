/**
 * P1-T1 realness (input-sensitivity) tests. Each de-stubbed compute function
 * must actually use the argument that used to be ignored: perturbing it changes
 * the output. If any of these throw, the function has regressed to a decoy.
 */
import { assertInputSensitive } from "./_harness";
import { computeDerivative as fbaComputeDerivative } from "../../src/server/fbaDynamic";
import { modelEnergySystem } from "../../src/server/cellFreeMetabolicEngine";
import { detectLoops, hasLoops } from "../../src/server/looplessFBA";
import { simulateNetworkMIDs } from "../../src/server/mfa13CEngine";
import { computeScore } from "../../src/server/retrosynthesis";

describe("realness — P1 metabolic core de-stubs", () => {
  it("fbaDynamic.computeDerivative uses reaction stoichiometry (arg: reactions)", () => {
    const reactions = [
      { id: "EX_a", lb: -10, ub: 0, stoichiometry: { a: -1 }, isExchange: true },
    ];
    const base: Parameters<typeof fbaComputeDerivative> = [
      reactions,
      { EX_a: -5 },
      ["a"],
      "BIOMASS",
      { a: 10 },
      { exchangeMetIds: new Map<string, string>(), biomassMetIds: new Set<string>() },
    ];
    const doubledStoich = [{ id: "EX_a", lb: -10, ub: 0, stoichiometry: { a: -2 }, isExchange: true }];
    assertInputSensitive(fbaComputeDerivative, base, 0, [doubledStoich]);
  });

  it("looplessFBA.detectLoops uses externalMetabolites (arg: externalMetabolites)", () => {
    const base: Parameters<typeof detectLoops> = [{ v0: 5e-7 }, ["R1"], []];
    assertInputSensitive(detectLoops, base, 2, [["R1"]]);
  });

  it("looplessFBA.hasLoops uses externalMetabolites (arg: externalMetabolites)", () => {
    const base: Parameters<typeof hasLoops> = [{ R1: 5e-7 }, ["R1"], []];
    assertInputSensitive(hasLoops, base, 2, [["R1"]]);
  });

  it("mfa13CEngine.simulateNetworkMIDs uses fluxes (arg: fluxes)", () => {
    const input: Parameters<typeof simulateNetworkMIDs>[0] = {
      metabolites: [
        { id: "S1", name: "S1", nCarbon: 2 },
        { id: "S2", name: "S2", nCarbon: 2 },
        { id: "P", name: "P", nCarbon: 2 },
      ],
      reactions: [
        { id: "r1", substrates: [{ metabolite: "S1", stoichiometry: 1 }], products: [{ metabolite: "P", stoichiometry: 1 }], reversible: false },
        { id: "r2", substrates: [{ metabolite: "S2", stoichiometry: 1 }], products: [{ metabolite: "P", stoichiometry: 1 }], reversible: false },
      ],
      labelSubstrate: "S1",
      labelPattern: [0, 1],
    };
    // Two reactions produce P from differently-labeled substrates; the flux ratio
    // sets P's mass-isotopomer distribution.
    assertInputSensitive(simulateNetworkMIDs, [input, [1, 1]], 1, [
      [1, 0],
      [0, 1],
      [10, 1],
    ]);
  });

  it("retrosynthesis.computeScore uses targetNorm and precursors (args: targetNorm, precursors)", () => {
    const steps = [
      {
        ruleId: "r",
        ruleName: "n",
        enzymeClass: "2.7.1.1",
        reactantSmiles: ["CCO"],
        productSmiles: ["CC=O"],
        reversibility: true,
        cofactors: [] as string[],
      },
    ];
    const base: Parameters<typeof computeScore> = [steps, "CCO", new Set(["CCO"])];
    assertInputSensitive(computeScore, base, 1, ["ZZZZZ", ""]); // targetNorm
    assertInputSensitive(computeScore, base, 2, [new Set(["OP(O)(O)=O"]), new Set<string>()]); // precursors
  });

  it("cellFreeMetabolicEngine.modelEnergySystem uses initialConc and dt (args: initialConc, dt)", () => {
    const base: Parameters<typeof modelEnergySystem> = ["PEP", 10, 0.1];
    assertInputSensitive(modelEnergySystem, base, 1, [100, 0.001]); // initialConc (MM saturation)
    assertInputSensitive(modelEnergySystem, base, 2, [5, 100]); // dt (first-order decay)
  });
});
