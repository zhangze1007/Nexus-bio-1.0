/**
 * P2-T1 realness (input-sensitivity) tests for the protein/enzyme cluster. Each
 * de-stubbed function must genuinely use its formerly-ignored argument: a
 * scientifically meaningful perturbation of that argument changes the output.
 */
import { assertInputSensitive } from "./_harness";
import { computeSolvation, computeVdW, scanAllMutations } from "../../src/server/ddgPrediction";
import { computeDesignScore, runInverseFolding, sampleSequence } from "../../src/server/inverseFoldingEngine";
import { optimizeCDS } from "../../src/server/plasmidDesignEngine";
import { generateHeuristicSequence } from "../../src/server/rfdiffusion";
import { computeStandbySite, optimizeCodons } from "../../src/server/regulatoryDesignEngine";
import { computeSpacing } from "../../src/server/rbsCalculator";
import type { PDBAtom, PDBStructure } from "../../src/utils/pdbParser";
import { makeRng } from "../../src/utils/rng";

function atom(x: number, y: number, z: number, name = "C", residueName = "ALA"): PDBAtom {
  return { x, y, z, name, element: name.charAt(0), residueName, residueNumber: 1 } as unknown as PDBAtom;
}
function structure(atoms: PDBAtom[]): PDBStructure {
  return { atoms } as unknown as PDBStructure;
}
type AAP = { volume: number; hydrophobicity: number; charge: number; isSmall: boolean; isCharged: boolean };
const A_PROPS: AAP = { volume: 88, hydrophobicity: 1.8, charge: 0, isSmall: true, isCharged: false };
const W_PROPS: AAP = { volume: 227, hydrophobicity: -0.9, charge: 0, isSmall: false, isCharged: false };
const L_PROPS: AAP = { volume: 124, hydrophobicity: 3.8, charge: 0, isSmall: false, isCharged: false };
const D_PROPS: AAP = { volume: 111, hydrophobicity: -3.5, charge: -1, isSmall: true, isCharged: true };

const TWO_CHAIN_PDB = [
  "ATOM      1  N   LEU A   1       0.000   0.000   0.000  1.00 10.00           N",
  "ATOM      2  CA  LEU A   1       1.000   0.000   0.000  1.00 10.00           C",
  "ATOM      3  C   LEU A   1       2.000   0.000   0.000  1.00 10.00           C",
  "ATOM      4  O   LEU A   1       3.000   0.000   0.000  1.00 10.00           O",
  "ATOM      5  CB  LEU A   1       1.000   1.000   0.000  1.00 10.00           C",
  "ATOM      6  CG  LEU A   1       1.000   2.000   0.000  1.00 10.00           C",
  "ATOM      7  CD1 LEU A   1       0.000   3.000   0.000  1.00 10.00           C",
  "ATOM      8  CD2 LEU A   1       2.000   3.000   0.000  1.00 10.00           C",
  "ATOM      9  N   ALA B   1       0.000   0.000   5.000  1.00 10.00           N",
  "ATOM     10  CA  ALA B   1       1.000   0.000   5.000  1.00 10.00           C",
  "ATOM     11  C   ALA B   1       2.000   0.000   5.000  1.00 10.00           C",
  "ATOM     12  O   ALA B   1       3.000   0.000   5.000  1.00 10.00           O",
  "ATOM     13  CB  ALA B   1       1.000   1.000   5.000  1.00 10.00           C",
  "END",
].join("\n");

describe("realness — P2 protein/enzyme de-stubs", () => {
  it("ddgPrediction.computeVdW uses structure coordinates (packing density)", () => {
    const mut = [atom(0, 0, 0, "C", "LEU")];
    const neigh = [atom(3, 0, 0, "C", "VAL")];
    const sparse = structure([atom(0, 0, 0)]);
    const dense = structure(Array.from({ length: 60 }, (_, i) => atom(i * 0.1, 0, 0)));
    assertInputSensitive(computeVdW, [sparse, mut, neigh, A_PROPS, W_PROPS], 0, [dense]);
  });

  it("ddgPrediction.computeSolvation uses structure (burial/accessibility)", () => {
    const mut = [atom(0, 0, 0, "C", "LEU")];
    const neigh = [atom(3, 0, 0, "C", "LEU"), atom(4, 0, 0, "C", "VAL")];
    const sparse = structure([atom(0, 0, 0)]);
    const dense = structure(Array.from({ length: 60 }, (_, i) => atom(i * 0.1, 0, 0)));
    assertInputSensitive(computeSolvation, [sparse, mut, neigh, L_PROPS, D_PROPS], 0, [dense]);
  });

  it("ddgPrediction.scanAllMutations restricts by chainId", () => {
    assertInputSensitive(scanAllMutations, [TWO_CHAIN_PDB, "L", "A"], 2, ["B"]);
  });

  it("inverseFoldingEngine.sampleSequence modulates the softmax by temperature", () => {
    const pssm = Array.from({ length: 12 }, () => {
      const p = new Array(20).fill(0.02);
      p[0] = 0.62;
      return p;
    });
    assertInputSensitive(sampleSequence, [pssm, undefined, undefined, 0.5, 42], 3, [0.05, 5.0]);
  });

  it("inverseFoldingEngine.computeDesignScore uses the pssm", () => {
    const backbone = Array.from({ length: 20 }, (_, i) => ({
      residueIndex: i,
      residueName: "ALA",
      x: 10 * Math.cos((i * 100 * Math.PI) / 180),
      y: 10 * Math.sin((i * 100 * Math.PI) / 180),
      z: i * 1.5,
    }));
    const graph = runInverseFolding({ backbone, nSequences: 1 }).graph;
    const seq = "A".repeat(graph.nodes.length);
    const perScores = new Array(seq.length).fill(0.5);
    const uniform = graph.nodes.map(() => new Array(20).fill(1 / 20));
    const peaked = graph.nodes.map(() => {
      const p = new Array(20).fill(0.01);
      p[0] = 0.81;
      return p;
    });
    assertInputSensitive(computeDesignScore, [seq, graph, uniform, perScores], 2, [peaked]);
  });

  it("rfdiffusion.generateHeuristicSequence modulates sampling by temperature", () => {
    // Stateful rng, so re-seed per call and vary only temperature.
    const lo = generateHeuristicSequence(60, "unconditional", undefined, 0.1, makeRng(1));
    const hi = generateHeuristicSequence(60, "unconditional", undefined, 3.0, makeRng(1));
    expect(lo).not.toBe(hi);
  });

  it("regulatoryDesignEngine.computeStandbySite uses the CDS leader", () => {
    const rbs = "GAGGAGGAGGAGGAGGAGGAGG";
    assertInputSensitive(computeStandbySite, [rbs, "ATGAAACGCACC"], 1, ["GGGGCCCCGGGG", "TTTTAAAATTTT"]);
  });

  it("regulatoryDesignEngine.optimizeCodons uses the organism codon bias", () => {
    assertInputSensitive(optimizeCodons, ["LLLLLRRRRRSSSSSAAAAAGGGGG", "ecoli"], 1, ["human", "yeast"]);
  });

  it("plasmidDesignEngine.optimizeCDS uses the host preference", () => {
    const cds = "ATGCTGCTGCGTCGTAGCAGCGCAGCAGGCGGT";
    assertInputSensitive(optimizeCDS, [cds, "ecoli"], 1, ["human", "yeast"]);
  });

  it("rbsCalculator.computeSpacing uses the CDS start-codon context", () => {
    assertInputSensitive(computeSpacing, ["AAGGAGGAAAAA", "ATGAAA", 6], 1, ["GGGGGGATGAAA", "CCCCCCCCCATGAAA"]);
  });
});
