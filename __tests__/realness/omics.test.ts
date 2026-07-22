/**
 * P4-T1 realness (input-sensitivity) tests for the omics/simulation cluster.
 * Each de-stubbed function must genuinely use its formerly-ignored argument: a
 * scientifically meaningful perturbation changes the (JSON-serialized) output.
 */
import { assertInputSensitive } from "./_harness";
import { buildPredictionMatrices } from "../../src/server/modelPredictiveControl";
import { optimizeEmbedding } from "../../src/server/umapEngine";
import { generateSuggestions } from "../../src/server/geneExpressionPredictor";
import { runDifferentialExpression } from "../../src/services/omics/multiOmicsPipeline";
import { computeModularity, louvainPhase2 } from "../../src/services/ScSpatialEngine";
import { SeededRNG } from "../../src/utils/seededRng";

describe("realness — P4 omics/simulation de-stubs", () => {
  it("modelPredictiveControl.buildPredictionMatrices uses the offset c and control horizon Nc", () => {
    const A = [
      [1, 0.1],
      [0, 1],
    ];
    const B = [[0], [0.1]];
    const c = [0, 0];
    // Offset vector c (arg 2) drives the affine-drift block PhiC.
    assertInputSensitive(buildPredictionMatrices, [A, B, c, 4, 2], 2, [
      [0.5, 0.5],
      [-0.3, 0.2],
    ]);
    // Control horizon Nc (arg 4) sets PhiU's width and the control-hold aggregation.
    assertInputSensitive(buildPredictionMatrices, [A, B, c, 4, 2], 4, [1, 3]);
  });

  it("umapEngine.optimizeEmbedding optimizes on the kNN graph", () => {
    // optimizeEmbedding mutates its embedding in place and consumes a stateful
    // rng, so wrap it: each call gets a fresh embedding copy and a fresh seeded
    // rng, leaving the kNN graph as the only thing that varies.
    const seedEmbedding = [
      [0, 0],
      [1, 0.5],
      [2, -0.5],
      [3, 0.2],
      [4, -0.2],
      [5, 0.1],
    ];
    const weights = new Map<string, number>([
      ["0:1", 1],
      ["1:2", 1],
      ["2:3", 1],
      ["3:4", 1],
      ["4:5", 1],
    ]);
    type KnnArg = Parameters<typeof optimizeEmbedding>[2];
    // Large spread ⇒ every sampled pair is "close" ⇒ repulsion always fires,
    // so which pairs the kNN graph excludes fully determines the outcome.
    const runEmbed = (knnGraph: KnnArg) =>
      optimizeEmbedding(
        seedEmbedding.map((p) => [...p]),
        weights,
        knnGraph,
        25,
        1.0,
        0.1,
        5,
        5,
        new SeededRNG(7),
      ).finalEmbedding;

    // Baseline: every node is everyone's neighbour ⇒ all repulsion suppressed.
    const allNeighbors: KnnArg = [];
    for (let i = 0; i < 6; i++) {
      const row: KnnArg[number] = [];
      for (let j = 0; j < 6; j++) if (j !== i) row.push({ index: j, distance: 1 });
      allNeighbors.push(row);
    }
    // Perturbation: no neighbours ⇒ full repulsion ⇒ a different embedding.
    const noNeighbors: KnnArg = Array.from({ length: 6 }, () => []);

    assertInputSensitive(runEmbed, [allNeighbors], 0, [noNeighbors]);
  });

  it("geneExpressionPredictor.generateSuggestions is driven by the bottlenecks", () => {
    type Features = Parameters<typeof generateSuggestions>[0];
    type Bottlenecks = Parameters<typeof generateSuggestions>[1];
    // Feature scores are all "good" ⇒ no feature-threshold suggestions, so the
    // output is driven purely by the bottleneck list.
    const features = {
      promoterScore: 0.9,
      rbsScore: 0.9,
      dgTotal: -10,
      rareCodonClusters: 0,
      cai: 0.9,
      terminatorScore: 0.9,
    } as unknown as Features;
    const noBottlenecks = [] as unknown as Bottlenecks;
    const transcriptionBn = [
      { stage: "transcription", severity: 0.9, description: "low transcription", confidence: 0.8 },
    ] as unknown as Bottlenecks;
    const foldingBn = [
      { stage: "folding", severity: 0.6, description: "folding stress", confidence: 0.7 },
    ] as unknown as Bottlenecks;

    assertInputSensitive(generateSuggestions, [features, noBottlenecks], 1, [transcriptionBn, foldingBn]);
  });

  it("multiOmicsPipeline.runDifferentialExpression uses sampleNames (replicate collapsing)", () => {
    const data = [[10, 12, 100, 1, 3, 5]];
    const featureNames = ["f0"];
    const groups = ["A", "A", "A", "B", "B", "B"];
    const uniqueNames = ["s0", "s1", "s2", "s3", "s4", "s5"];
    // Naming the first two group-A columns identically collapses them into one
    // biological sample ⇒ group size and statistics change.
    const dupNames = ["rep", "rep", "s2", "s3", "s4", "s5"];
    assertInputSensitive(runDifferentialExpression, [data, featureNames, uniqueNames, groups], 2, [dupNames]);
  });

  it("ScSpatialEngine.computeModularity uses the adjacency list", () => {
    const partition = Int32Array.from([0, 0, 1, 1]);
    const deg = Float64Array.from([1, 2, 2, 1]);
    const edgeWeights = new Map<string, number>([
      ["0_1", 1],
      ["1_2", 1],
      ["2_3", 1],
    ]);
    const adjBase = [[1], [0, 2], [1, 3], [2]];
    // Drop the within-community 0–1 edge from the adjacency ⇒ Q loses that term.
    const adjDropWithin = [[], [2], [1, 3], [2]];
    // Fully disconnected ⇒ no edges enumerated ⇒ Q collapses to the fallback.
    const adjDisconnected = [[], [], [], []];
    assertInputSensitive(computeModularity, [partition, adjBase, deg, edgeWeights], 1, [
      adjDropWithin,
      adjDisconnected,
    ]);
  });

  it("ScSpatialEngine.louvainPhase2 uses the edge weights when coarsening", () => {
    const numNodes = 4;
    const adj = [[1], [0, 2], [1, 3], [2]];
    const nodeDeg = Float64Array.from([1, 2, 2, 1]);
    const partition = Int32Array.from([0, 0, 1, 1]);
    const ewBase = new Map<string, number>([
      ["0_1", 1],
      ["1_2", 1],
      ["2_3", 1],
    ]);
    // Heavier inter-community edge ⇒ heavier coarsened super-edge weight.
    const ewHeavy = new Map<string, number>([
      ["0_1", 1],
      ["1_2", 5],
      ["2_3", 1],
    ]);
    // superWeights is a Map (invisible to JSON.stringify); expose it as entries.
    const phase2Weights = (ew: Map<string, number>) =>
      [...louvainPhase2(numNodes, adj, ew, nodeDeg, partition).superWeights.entries()];
    assertInputSensitive(phase2Weights, [ewBase], 0, [ewHeavy]);
  });
});
