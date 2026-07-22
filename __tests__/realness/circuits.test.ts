/**
 * P3-T1 realness (input-sensitivity) tests for the genome/circuits cluster. Each
 * de-stubbed function must genuinely use its formerly-ignored argument: a
 * scientifically meaningful perturbation changes the output.
 */
import { assertInputSensitive } from "./_harness";
import { clusterGenesIntoRegions, type Gene } from "../../src/server/bgcDetection";
import { calculateGenericEfficiency } from "../../src/server/crisprCas12aEngine";
import { generateOverhang } from "../../src/server/dnaAssemblyEngine";
import { type MinimizationSpec, planKnockdowns } from "../../src/server/genmimPipeline";
import { designgRNAs, evaluateCandidate, type PAMDefinition } from "../../src/server/grnaDesigner";

describe("realness — P3 genome/circuits de-stubs", () => {
  it("genmimPipeline.planKnockdowns is driven by the spec (objective + constraints)", () => {
    const baseSpec: MinimizationSpec = {
      species: "ecoli",
      objective: "biomass",
      glucoseUptake: 10,
      oxygenUptake: 20,
      targetGenomeReduction: 0.2,
      minGrowthFraction: 0.5,
    };
    assertInputSensitive(planKnockdowns, [baseSpec], 0, [
      { ...baseSpec, targetGenomeReduction: 0.7 }, // constraint → different schedule
      { ...baseSpec, objective: "atp" }, // target product → different essentiality
    ]);
  }, 60000);

  it("crisprCas12aEngine.calculateGenericEfficiency uses the PAM and the variant", () => {
    const spacer = "GCGCACGTACGTACGTACGTACGT";
    assertInputSensitive(calculateGenericEfficiency, [spacer, "TTTA", "Cas12a"], 1, ["AAAA", "TTTT"]); // pam
    assertInputSensitive(calculateGenericEfficiency, [spacer, "TTTA", "Cas12a"], 2, ["SpCas9", "Cas13a"]); // variant
  });

  it("grnaDesigner.designgRNAs uses the geneName (target window + scoping)", () => {
    const geneSeq =
      "ATGGCTAGCAAAGGTCTCGGATCCGGTGCAGGCCTTAAGGCCATGGCTAGCAAAGGTCTCGGATCCGGTGCAGGCCTTAAGGCCATGG";
    assertInputSensitive(designgRNAs, [geneSeq, "SpCas9", 10, undefined], 3, ["thrA", "leuB"]);
  });

  it("grnaDesigner.evaluateCandidate uses the PAM definition rules", () => {
    const pamNGG: PAMDefinition = { name: "SpCas9", pamSequence: "NGG", spacerLength: 20, description: "SpCas9 NGG" };
    const pamTTTV: PAMDefinition = { name: "Cas12a", pamSequence: "TTTV", spacerLength: 23, description: "Cas12a TTTV" };
    assertInputSensitive(evaluateCandidate, ["GCGCACGTACGTACGTACGT", "TGG", 0, "+", pamNGG], 4, [pamTTTV]);
  });

  it("dnaAssemblyEngine.generateOverhang uses the second fragment's junction start", () => {
    assertInputSensitive(generateOverhang, ["AAAAAAAAAA", "CCCCCCCCCC", 6], 1, ["GGGGGGGGGG", "TTTTTTTTTT"]);
  });

  it("bgcDetection.clusterGenesIntoRegions uses geneScores", () => {
    const genes: Gene[] = [
      { id: "g1", start: 0, end: 100, strand: "+" },
      { id: "g2", start: 250, end: 350, strand: "+" },
    ];
    type ScoresArg = Parameters<typeof clusterGenesIntoRegions>[2];
    const lowScores = [
      { gene: genes[0], score: 0.1, domains: [], bestType: "unknown" },
      { gene: genes[1], score: 0.1, domains: [], bestType: "unknown" },
    ] as unknown as ScoresArg;
    const highScores = [
      { gene: genes[0], score: 2.0, domains: [], bestType: "unknown" },
      { gene: genes[1], score: 2.0, domains: [], bestType: "unknown" },
    ] as unknown as ScoresArg;
    // Low scores keep the two loci as separate regions; high scores bridge the gap.
    assertInputSensitive(clusterGenesIntoRegions, [genes, genes, lowScores, 50, 50], 2, [highScores]);
  });
});
