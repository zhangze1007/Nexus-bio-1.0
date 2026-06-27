import {
  integrateOmics,
  runPCA,
  runDifferentialExpression,
  runPathwayEnrichment,
  type OmicsDataset,
} from "../src/services/omics/multiOmicsPipeline";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeDataset(
  layer: string,
  featureNames: string[],
  sampleNames: string[],
  matrix: number[][],
): OmicsDataset {
  return { layer, featureNames, sampleNames, matrix };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. integrateOmics
// ─────────────────────────────────────────────────────────────────────────────

describe("integrateOmics", () => {
  it("returns empty result when no data is provided", () => {
    const result = integrateOmics({});
    expect(result.features).toHaveLength(0);
    expect(result.totalFeatures).toBe(0);
    expect(result.missingRate).toBe(0);
    expect(result.layerCorrelation).toHaveLength(0);
  });

  it("merges a single omics layer correctly", () => {
    const tx = makeDataset(
      "transcriptomics",
      ["geneA", "geneB"],
      ["s1", "s2"],
      [
        [10, 20],
        [30, 40],
      ],
    );
    const result = integrateOmics({ transcriptomics: tx });

    expect(result.totalFeatures).toBe(2);
    expect(result.sharedFeatures).toBe(2); // shared across the single layer
    expect(result.missingRate).toBe(0);
    expect(result.layerNames).toEqual(["transcriptomics"]);

    const geneA = result.features.find((f) => f.feature === "geneA");
    expect(geneA).toBeDefined();
    expect(geneA!.layers.transcriptomics).toBeCloseTo(15, 5); // mean of 10, 20
  });

  it("merges three layers and reports missing data correctly", () => {
    const tx = makeDataset(
      "transcriptomics",
      ["geneA", "geneB", "geneC"],
      ["s1"],
      [[1], [2], [3]],
    );
    const pr = makeDataset("proteomics", ["geneA", "geneB"], ["s1"], [[10], [20]]);
    const mx = makeDataset("metabolomics", ["geneA"], ["s1"], [[100]]);

    const result = integrateOmics({ transcriptomics: tx, proteomics: pr, metabolomics: mx });

    expect(result.totalFeatures).toBe(3); // geneA, geneB, geneC
    expect(result.sharedFeatures).toBe(1); // only geneA in all three
    expect(result.layerNames).toEqual(["transcriptomics", "proteomics", "metabolomics"]);

    // geneC is only in transcriptomics => 2/3 layers missing
    const geneC = result.features.find((f) => f.feature === "geneC");
    expect(geneC).toBeDefined();
    expect(geneC!.layers.transcriptomics).toBe(3);
    expect(geneC!.layers.proteomics).toBeUndefined();
    expect(geneC!.layers.metabolomics).toBeUndefined();

    // Total cells = 3 features * 3 layers = 9.
    // geneA: 0 missing, geneB: 1 missing (metabolomics), geneC: 2 missing (proteomics, metabolomics) = 3 total
    expect(result.missingRate).toBeCloseTo(3 / 9, 5);
  });

  it("computes cross-layer correlation for perfectly correlated data", () => {
    // Two layers with identical values for shared features
    const tx = makeDataset("t", ["a", "b", "c"], ["s1"], [[1], [2], [3]]);
    const pr = makeDataset("p", ["a", "b", "c"], ["s1"], [[1], [2], [3]]);

    const result = integrateOmics({ transcriptomics: tx, proteomics: pr });
    expect(result.layerCorrelation[0][1]).toBeCloseTo(1, 5);
  });

  it("computes cross-layer correlation for anti-correlated data", () => {
    const tx = makeDataset("t", ["a", "b", "c"], ["s1"], [[1], [2], [3]]);
    const pr = makeDataset("p", ["a", "b", "c"], ["s1"], [[3], [2], [1]]);

    const result = integrateOmics({ transcriptomics: tx, proteomics: pr });
    expect(result.layerCorrelation[0][1]).toBeCloseTo(-1, 5);
  });

  it("features are sorted alphabetically", () => {
    const tx = makeDataset("t", ["zeta", "alpha", "mu"], ["s1"], [[1], [2], [3]]);
    const result = integrateOmics({ transcriptomics: tx });
    expect(result.features.map((f) => f.feature)).toEqual(["alpha", "mu", "zeta"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. runPCA
// ─────────────────────────────────────────────────────────────────────────────

describe("runPCA", () => {
  it("returns empty result for empty data", () => {
    const result = runPCA([], 2);
    expect(result.eigenvalues).toHaveLength(0);
    expect(result.scores).toHaveLength(0);
  });

  it("returns correct dimensions for scores and loadings", () => {
    // 6 samples, 4 features
    const data = [
      [2.5, 2.4, 3.5, 1.0],
      [0.5, 0.7, 1.2, 0.3],
      [2.2, 2.9, 3.1, 0.8],
      [1.9, 2.2, 2.8, 1.1],
      [3.1, 3.0, 4.0, 0.9],
      [2.3, 2.7, 3.2, 0.5],
    ];
    const result = runPCA(data, 2);

    expect(result.scores).toHaveLength(6);
    expect(result.scores[0]).toHaveLength(2);
    expect(result.loadings).toHaveLength(2);
    expect(result.loadings[0]).toHaveLength(4);
  });

  it("eigenvalues are in descending order", () => {
    const data = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [2, 4, 6],
      [3, 6, 9],
    ];
    const result = runPCA(data, 3);
    for (let i = 1; i < result.eigenvalues.length; i++) {
      expect(result.eigenvalues[i]).toBeLessThanOrEqual(result.eigenvalues[i - 1]);
    }
  });

  it("variance explained sums to <= 1 and is non-negative", () => {
    const data = [
      [5, 3, 1, 2],
      [4, 2, 3, 1],
      [6, 4, 2, 3],
      [3, 1, 4, 5],
      [7, 5, 1, 2],
    ];
    const result = runPCA(data, 3);

    const totalVar = result.varianceExplained.reduce((a, b) => a + b, 0);
    expect(totalVar).toBeLessThanOrEqual(1.001); // allow tiny FP error
    expect(totalVar).toBeGreaterThan(0);

    for (const ve of result.varianceExplained) {
      expect(ve).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses provided feature and sample names", () => {
    const data = [
      [1, 2],
      [3, 4],
    ];
    const result = runPCA(data, 2, ["f1", "f2"], ["s1", "s2"]);
    expect(result.featureNames).toEqual(["f1", "f2"]);
    expect(result.sampleNames).toEqual(["s1", "s2"]);
  });

  it("caps nComponents to the number of features", () => {
    const data = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    const result = runPCA(data, 10);
    expect(result.eigenvalues).toHaveLength(2); // capped to d=2
    expect(result.scores[0]).toHaveLength(2);
  });

  it("scores are mean-centered (each column has mean near 0)", () => {
    const data = [
      [10, 20],
      [30, 40],
      [50, 60],
      [70, 80],
    ];
    const result = runPCA(data, 2);

    for (let k = 0; k < 2; k++) {
      const colMean = result.scores.reduce((s, row) => s + row[k], 0) / result.scores.length;
      expect(Math.abs(colMean)).toBeLessThan(1e-8);
    }
  });

  it("cumulative variance is monotonically non-decreasing", () => {
    const data = [
      [1, 5, 9],
      [2, 6, 8],
      [3, 7, 7],
      [4, 8, 6],
      [5, 9, 5],
    ];
    const result = runPCA(data, 3);
    for (let i = 1; i < result.cumulativeVariance.length; i++) {
      expect(result.cumulativeVariance[i]).toBeGreaterThanOrEqual(result.cumulativeVariance[i - 1] - 1e-10);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. runDifferentialExpression
// ─────────────────────────────────────────────────────────────────────────────

describe("runDifferentialExpression", () => {
  it("detects a clearly differentially expressed feature", () => {
    // Use 8 samples per group for enough power in the normal approximation.
    // Feature 0: group A high (~100), group B low (~1) → strong DE
    // Feature 1: same distribution in both groups → not DE
    const deData = [
      [100, 102, 98, 101, 99, 100, 103, 97, 1, 3, 0, 2, 1, 2, 0, 3], // feature 0
      [50, 52, 48, 51, 49, 50, 53, 47, 50, 52, 48, 51, 49, 50, 53, 47], // feature 1
    ];
    const groups = ["A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B", "B", "B"];
    const sampleNames = groups.map((_, i) => `s${i}`);
    const result = runDifferentialExpression(deData, ["feature0", "feature1"], sampleNames, groups);

    expect(result.nSignificant).toBeGreaterThanOrEqual(1);
    const f0 = result.features.find((f) => f.feature === "feature0");
    expect(f0).toBeDefined();
    expect(f0!.significant).toBe(true);
    expect(f0!.log2FoldChange).toBeLessThan(0); // group B is lower
  });

  it("returns correct group sizes", () => {
    const data = [[1, 2, 3, 4, 5]];
    const groups = ["control", "control", "treatment", "treatment", "treatment"];
    const result = runDifferentialExpression(data, ["f1"], ["s1", "s2", "s3", "s4", "s5"], groups);

    expect(result.groupSizes.control).toBe(2);
    expect(result.groupSizes.treatment).toBe(3);
    expect(result.groups).toEqual(["control", "treatment"]);
  });

  it("throws if groups do not contain exactly 2 unique values", () => {
    const data = [[1, 2, 3]];
    expect(() =>
      runDifferentialExpression(data, ["f1"], ["s1", "s2", "s3"], ["A", "B", "C"]),
    ).toThrow("Exactly 2 groups required");
  });

  it("log2FC is positive when group2 mean > group1 mean", () => {
    const data = [[1, 2, 3, 100, 200, 300]]; // group A: low, group B: high
    const result = runDifferentialExpression(
      data,
      ["f1"],
      ["s1", "s2", "s3", "s4", "s5", "s6"],
      ["A", "A", "A", "B", "B", "B"],
    );
    expect(result.features[0].log2FoldChange).toBeGreaterThan(0);
  });

  it("adjusted p-values are >= raw p-values (BH correction)", () => {
    const data = [
      [1, 2, 3, 10, 11, 12],
      [4, 5, 6, 7, 8, 9],
      [1, 1, 1, 100, 100, 100],
    ];
    const result = runDifferentialExpression(
      data,
      ["f1", "f2", "f3"],
      ["s1", "s2", "s3", "s4", "s5", "s6"],
      ["A", "A", "A", "B", "B", "B"],
    );

    for (const f of result.features) {
      expect(f.adjustedPValue).toBeGreaterThanOrEqual(f.pValue - 1e-10);
    }
  });

  it("results are sorted by adjusted p-value ascending", () => {
    const data = [
      [1, 1, 1, 100, 100, 100],
      [5, 5, 5, 6, 6, 6],
      [10, 20, 30, 40, 50, 60],
    ];
    const result = runDifferentialExpression(
      data,
      ["f1", "f2", "f3"],
      ["s1", "s2", "s3", "s4", "s5", "s6"],
      ["A", "A", "A", "B", "B", "B"],
    );

    for (let i = 1; i < result.features.length; i++) {
      expect(result.features[i].adjustedPValue).toBeGreaterThanOrEqual(
        result.features[i - 1].adjustedPValue - 1e-10,
      );
    }
  });

  it("returns empty result for empty data", () => {
    const result = runDifferentialExpression([], [], [], []);
    expect(result.features).toHaveLength(0);
    expect(result.nSignificant).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. runPathwayEnrichment
// ─────────────────────────────────────────────────────────────────────────────

describe("runPathwayEnrichment", () => {
  it("detects an enriched pathway with low p-value", () => {
    // Universe: 20 genes in one pathway, query overlaps 8 of them
    const pathwayGenes = Array.from({ length: 20 }, (_, i) => `gene${i}`);
    const queryGenes = pathwayGenes.slice(0, 8); // 8 out of 20

    const db = new Map<string, string[]>();
    db.set("Glycolysis", pathwayGenes);
    db.set("TCA cycle", Array.from({ length: 15 }, (_, i) => `other${i}`));

    const result = runPathwayEnrichment(queryGenes, db, "test");

    const glycolysis = result.pathways.find((p) => p.pathway === "Glycolysis");
    expect(glycolysis).toBeDefined();
    expect(glycolysis!.pValue).toBeLessThan(0.05);
    expect(glycolysis!.overlapCount).toBe(8);
  });

  it("returns p-value ≈ 1 for non-overlapping pathway", () => {
    const query = ["geneA", "geneB"];
    const db = new Map<string, string[]>();
    db.set("Pathway1", ["geneX", "geneY", "geneZ"]);

    const result = runPathwayEnrichment(query, db, "test");
    expect(result.pathways[0].pValue).toBeCloseTo(1, 3);
    expect(result.pathways[0].overlapCount).toBe(0);
  });

  it("fold enrichment is correct for perfect overlap", () => {
    // Query = all 5 genes in pathway, universe = 5
    const db = new Map<string, string[]>();
    db.set("P1", ["a", "b", "c", "d", "e"]);

    const result = runPathwayEnrichment(["a", "b", "c", "d", "e"], db, "test");
    const p1 = result.pathways[0];

    // expected = (5 * 5) / 5 = 5, actual = 5 → FE = 1.0
    expect(p1.foldEnrichment).toBeCloseTo(1.0, 5);
  });

  it("fold enrichment > 1 for over-represented pathway", () => {
    // Universe: 100 genes total (pathway has 10, rest are in other pathway)
    const bigPathway = Array.from({ length: 10 }, (_, i) => `g${i}`);
    const other = Array.from({ length: 90 }, (_, i) => `o${i}`);
    const db = new Map<string, string[]>();
    db.set("SmallPathway", bigPathway);
    db.set("BigPathway", other);

    // Query: 8 out of 10 genes from SmallPathway
    const query = bigPathway.slice(0, 8);
    const result = runPathwayEnrichment(query, db, "test");

    const small = result.pathways.find((p) => p.pathway === "SmallPathway")!;
    // expected = (8 * 10) / 100 = 0.8, actual = 8 → FE = 10
    expect(small.foldEnrichment).toBeGreaterThan(1);
    expect(small.pValue).toBeLessThan(0.001);
  });

  it("returns empty pathways for empty query", () => {
    const db = new Map<string, string[]>();
    db.set("P1", ["a", "b"]);

    const result = runPathwayEnrichment([], db, "test");
    // The pathway should still appear but with p-value = 1 and overlap = 0
    expect(result.pathways).toHaveLength(1);
    expect(result.pathways[0].pValue).toBeCloseTo(1, 5);
    expect(result.pathways[0].overlapCount).toBe(0);
    expect(result.querySize).toBe(0);
  });

  it("reports correct universe size", () => {
    const db = new Map<string, string[]>();
    db.set("P1", ["a", "b", "c"]);
    db.set("P2", ["b", "c", "d", "e"]); // 'b', 'c' are shared

    const result = runPathwayEnrichment(["a"], db, "test");
    // Universe = {a, b, c, d, e} = 5
    expect(result.universeSize).toBe(5);
  });

  it("pathways are sorted by p-value ascending", () => {
    const db = new Map<string, string[]>();
    // Create multiple pathways with varying overlap
    db.set("high_overlap", Array.from({ length: 20 }, (_, i) => `g${i}`));
    db.set("no_overlap", ["x1", "x2", "x3"]);
    db.set("medium_overlap", [...Array.from({ length: 10 }, (_, i) => `g${i}`), "extra1", "extra2"]);

    const query = Array.from({ length: 10 }, (_, i) => `g${i}`);
    const result = runPathwayEnrichment(query, db, "test");

    for (let i = 1; i < result.pathways.length; i++) {
      expect(result.pathways[i].pValue).toBeGreaterThanOrEqual(result.pathways[i - 1].pValue - 1e-10);
    }
  });

  it("overlapping genes are reported correctly", () => {
    const db = new Map<string, string[]>();
    db.set("P1", ["a", "b", "c", "d", "e"]);

    const result = runPathwayEnrichment(["a", "c", "e", "z"], db, "test");
    expect(result.pathways[0].overlappingGenes).toEqual(
      expect.arrayContaining(["a", "c", "e"]),
    );
    expect(result.pathways[0].overlappingGenes).toHaveLength(3);
  });
});
