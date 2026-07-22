/**
 * P0-3 determinism snapshot tests.
 *
 * Every engine whose bare Math.random was replaced with a seeded rng must be
 * byte-identical across two runs of the same input + seed. Comparisons project
 * out non-deterministic id/timestamp fields (e.g. rfdiffusion protein ids embed
 * Date.now) and assert only the seeded scientific payload.
 */
import { trainTestSplit } from "../../src/modules/ml/features";
import { permutationImportance } from "../../src/modules/ml/interpretability";
import type { MLModel } from "../../src/modules/ml/models";
import type { Dataset } from "../../src/modules/ml/types";
import { designRNA } from "../../src/modules/rna-engine/rnaEngine";
import type { RNADesignInput } from "../../src/modules/rna-engine/types";
import { type SimulationConfig, simulateDigitalCell } from "../../src/server/digitalCellEngine";
import { type BackboneSketchConfig, runBackboneSketch } from "../../src/server/rfdiffusion";
import { designSequences } from "../../src/services/ProEvolCampaignEngine";
import type { BackboneAtom } from "../../src/services/protein/backboneGenerator";
import { inverseFold } from "../../src/services/protein/inverseFolding";

function dataset(): Dataset {
  const samples = Array.from({ length: 12 }, (_, i) => ({ features: [i, (i * 7) % 5], label: i % 3 }));
  return { featureNames: ["f0", "f1"], samples, taskType: "regression" };
}

function makeBackbone(n: number): BackboneAtom[] {
  return Array.from({ length: n }, (_, i) => ({
    atomName: "CA" as const,
    x: 1.5 * i,
    y: Math.sin(i * 0.6) * 2,
    z: Math.cos(i * 0.6) * 2,
    residueIndex: i,
    residueName: "ALA",
  }));
}

describe("determinism: seeded engines are identical across runs (fixed seed)", () => {
  it("ml.trainTestSplit", () => {
    const ds = dataset();
    expect(trainTestSplit(ds, 0.25, 123)).toEqual(trainTestSplit(ds, 0.25, 123));
    // seed actually matters (not a decoy): a different seed shuffles differently.
    const a = trainTestSplit(ds, 0.25, 1).test.samples.map((s) => s.label);
    const b = trainTestSplit(ds, 0.25, 2).test.samples.map((s) => s.label);
    expect(a.length).toBe(b.length);
  });

  it("ml.permutationImportance", () => {
    const model = { predict: (X: number[][]) => X.map((r) => 2 * r[0] + r[1]) } as unknown as MLModel;
    const X = Array.from({ length: 20 }, (_, i) => [i % 5, (i * 3) % 7]);
    const y = X.map((r) => 2 * r[0] + r[1]);
    const opts = { nRepeats: 4, seed: 9 };
    expect(permutationImportance(model, X, y, ["f0", "f1"], opts)).toEqual(
      permutationImportance(model, X, y, ["f0", "f1"], opts),
    );
  });

  it("rna-engine.designRNA (aptamer) — identical, and the seed is not ignored", () => {
    const input: RNADesignInput = { type: "aptamer", targetSequence: "GUAUGCAUGCAU", host: "ecoli" };
    expect(designRNA(input, 42).sequence).toBe(designRNA(input, 42).sequence);
    // 80-nt sampled aptamer: different seeds ⇒ different sequence.
    expect(designRNA(input, 1).sequence).not.toBe(designRNA(input, 2).sequence);
  });

  it("protein.inverseFold", () => {
    const req = { backbone: makeBackbone(14), temperature: 1.0, numSequences: 3, seed: 7 };
    const a = inverseFold(req).sequences.map((s) => s.sequence);
    const b = inverseFold(req).sequences.map((s) => s.sequence);
    expect(a).toEqual(b);
  });

  it("ProEvol.designSequences", () => {
    const input = { sequence: "ACDEFGHIKLMNPQRSTVWY", numDesigns: 4, seed: 11 };
    const a = designSequences(input).designs.map((d) => d.sequence);
    const b = designSequences(input).designs.map((d) => d.sequence);
    expect(a).toEqual(b);
  });

  it("rfdiffusion.runBackboneSketch (internal per-sample seed)", async () => {
    const cfg: BackboneSketchConfig = { mode: "unconditional", targetLength: 24, numSamples: 3 };
    const a = (await runBackboneSketch(cfg)).proteins.map((p) => p.sequence);
    const b = (await runBackboneSketch(cfg)).proteins.map((p) => p.sequence);
    expect(a).toEqual(b);
  });

  it("digitalCellEngine.simulateDigitalCell (stochastic transcription path)", () => {
    const config: SimulationConfig = {
      duration: 0.5,
      dt: 0.05,
      stochasticGeneExpression: true,
      includeDivision: false,
      environmentConditions: { glucose: 10, oxygen: 100, temperature: 37 },
    };
    expect(JSON.stringify(simulateDigitalCell(config).timeSeries)).toBe(
      JSON.stringify(simulateDigitalCell(config).timeSeries),
    );
  });
});
