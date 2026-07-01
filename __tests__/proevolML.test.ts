import {
  reconstructVariantSequence,
  buildProEvolFitnessData,
  trainProEvolFitnessModel,
  predictVariantFitness,
} from '../src/services/proevolML';
import type { ProEvolArtifact, ProEvolVariant } from '../src/domain/proevolArtifact';

/**
 * T3-2: src/modules/ml is wired into ProEvol as a real, reproducible feature.
 * These tests exercise the genuine ML pipeline (feature extraction → train →
 * evaluate → predict) and assert reproducibility.
 */

const WT = 'MKAILVGADPQRSTNEWYFHCMKAILVGADPQRSTNEWYFHC'; // 42 aa wild-type

// Build an artifact with `n` variants, each carrying a couple of point
// mutations and a measuredActivity that depends on sequence content (so the
// surrogate has a real signal to fit).
function makeArtifact(n: number): ProEvolArtifact {
  const aas = 'ACDEFGHIKLMNPQRSTVWY';
  const variants: ProEvolVariant[] = [];
  for (let i = 0; i < n; i++) {
    const pos1 = (i % (WT.length - 1)) + 1;
    const to1 = aas[(i * 7) % aas.length];
    const pos2 = ((i * 3) % (WT.length - 1)) + 1;
    const to2 = aas[(i * 5) % aas.length];
    const mutations = [
      { position: pos1, from: WT[pos1 - 1], to: to1 },
      { position: pos2, from: WT[pos2 - 1], to: to2 },
    ];
    // Label correlates with hydrophobic content of the mutated residues.
    const hydro = 'VILFMWYA';
    const activity = (hydro.includes(to1) ? 1 : 0) + (hydro.includes(to2) ? 1 : 0) + i * 0.01;
    variants.push({
      id: `v${i}`,
      label: `v${i}`,
      parentId: 'v0',
      familyId: 'f',
      familyLabel: 'F',
      mutations,
      mutationString: `${mutations[0].from}${pos1}${to1}`,
      mutationBurden: 2,
      observations: [],
      phenotype: { measuredActivity: activity },
      selectionStatus: 'selected',
      riskFlags: [],
    });
  }
  return {
    version: 'proevol.campaign.v1',
    meta: {
      id: 'c', name: 'C', targetProtein: 'E', targetProduct: 'P',
      wildTypeId: 'v0', wildTypeLabel: 'v0', startingSequence: WT,
      hostSystem: 'h', screeningSystem: 's', assayCondition: 'a',
      selectionPressure: 'p', objective: 'o', totalRounds: 1,
      librarySizePerRound: n, selectionStringency: 0.5,
    },
    rounds: [],
    variants,
    provenance: {
      kind: 'user-supplied', validity: 'real', bandSemantic: 'measurement',
      isModeled: false, source: 't', replicateCount: 1, statisticalNotes: [],
      generatedAt: 0,
    },
  } as ProEvolArtifact;
}

describe('reconstructVariantSequence', () => {
  it('applies point mutations at 1-indexed positions', () => {
    const seq = reconstructVariantSequence('AAAA', [{ position: 2, from: 'A', to: 'C' }]);
    expect(seq).toBe('ACAA');
  });
  it('ignores out-of-range mutations', () => {
    const seq = reconstructVariantSequence('AAAA', [{ position: 99, from: 'A', to: 'C' }]);
    expect(seq).toBe('AAAA');
  });
});

describe('buildProEvolFitnessData', () => {
  it('produces labeled sequence data from the artifact', () => {
    const data = buildProEvolFitnessData(makeArtifact(10));
    expect(data.length).toBe(10);
    expect(data[0].sequence.length).toBe(WT.length);
    expect(data[0].labelSource).toBe('measuredActivity');
    expect(Number.isFinite(data[0].activity)).toBe(true);
  });
});

describe('trainProEvolFitnessModel', () => {
  it('returns null when there are too few labeled variants', () => {
    expect(trainProEvolFitnessModel(makeArtifact(3))).toBeNull();
  });

  it('trains a ridge surrogate and reports real metrics', () => {
    const fit = trainProEvolFitnessModel(makeArtifact(40), { modelType: 'ridge', seed: 7 });
    expect(fit).not.toBeNull();
    expect(fit!.nSamples).toBe(40);
    expect(fit!.nTrain).toBeGreaterThan(0);
    expect(fit!.nTest).toBeGreaterThan(0);
    expect(Number.isFinite(fit!.testMetrics.r2)).toBe(true);
    expect(fit!.featureImportances.length).toBeGreaterThan(0);
  });

  it('is reproducible for a fixed seed (ridge)', () => {
    const a = trainProEvolFitnessModel(makeArtifact(40), { modelType: 'ridge', seed: 7 })!;
    const b = trainProEvolFitnessModel(makeArtifact(40), { modelType: 'ridge', seed: 7 })!;
    expect(b.testMetrics).toEqual(a.testMetrics);
    expect(b.trainMetrics).toEqual(a.trainMetrics);
  });

  it('is reproducible for a fixed seed (random_forest, seeded bootstrap)', () => {
    const a = trainProEvolFitnessModel(makeArtifact(40), { modelType: 'random_forest', seed: 11 })!;
    const b = trainProEvolFitnessModel(makeArtifact(40), { modelType: 'random_forest', seed: 11 })!;
    expect(b.testMetrics).toEqual(a.testMetrics);
    expect(b.featureImportances).toEqual(a.featureImportances);
  });
});

describe('predictVariantFitness', () => {
  it('predicts deterministically for the same trained model', () => {
    const fit = trainProEvolFitnessModel(makeArtifact(40), { modelType: 'ridge', seed: 7 })!;
    const p1 = predictVariantFitness(fit, [WT, 'ACDEFGHIKLMNPQRSTVWYACDEFGHIKLMNPQRSTVWYAA']);
    const p2 = predictVariantFitness(fit, [WT, 'ACDEFGHIKLMNPQRSTVWYACDEFGHIKLMNPQRSTVWYAA']);
    expect(p2).toEqual(p1);
    expect(p1.length).toBe(2);
  });
});
