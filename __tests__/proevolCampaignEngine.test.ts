import { buildProEvolCampaignInput } from '../src/data/proevolMockCampaign';
import { buildProEvolCampaign, scoreVariant } from '../src/services/ProEvolCampaignEngine';

function makeInput(overrides?: Partial<Parameters<typeof buildProEvolCampaignInput>[0]>) {
  return buildProEvolCampaignInput({
    project: null,
    analyzeArtifact: null,
    catalyst: null,
    fba: null,
    cethx: null,
    totalRounds: 3,
    librarySize: 16,
    survivorCount: 5,
    selectionStringency: 0.65,
    ...overrides,
  });
}

describe('ProEvolCampaignEngine', () => {
  test('produces deterministic campaign outputs for a fixed seed', () => {
    const input = makeInput();
    const left = buildProEvolCampaign(input);
    const right = buildProEvolCampaign(input);

    expect(left.leadVariant.id).toBe(right.leadVariant.id);
    expect(left.leadVariant.mutationString).toBe(right.leadVariant.mutationString);
    expect(left.currentRoundResult.selectedSurvivors.map((variant) => variant.mutationString))
      .toEqual(right.currentRoundResult.selectedSurvivors.map((variant) => variant.mutationString));
    expect(left.nextRoundRecommendation.action).toBe('narrow-library');
  });

  test('penalizes burdened and risky variants in the scoring model', () => {
    const efficient = scoreVariant({
      activity: 82,
      stability: 76,
      expression: 71,
      specificity: 75,
      mutationBurden: 1,
      riskPenalty: 0.5,
    });
    const burdened = scoreVariant({
      activity: 82,
      stability: 76,
      expression: 71,
      specificity: 75,
      mutationBurden: 5,
      riskPenalty: 3.4,
    });

    expect(efficient.composite).toBeGreaterThan(burdened.composite);
    expect(burdened.burdenPenalty).toBeGreaterThan(efficient.burdenPenalty);
    expect(burdened.riskPenalty).toBeGreaterThan(efficient.riskPenalty);
  });

  test('annotates survivor and rejection reasons for the current round library', () => {
    const campaign = buildProEvolCampaign(makeInput());

    expect(campaign.currentRoundResult.selectedSurvivors).toHaveLength(5);
    expect(campaign.currentRoundResult.rejectedVariants.length).toBeGreaterThan(0);
    campaign.currentRoundResult.selectedSurvivors.forEach((variant) => {
      expect(variant.status).toBe('selected');
      expect(variant.selectionReason.length).toBeGreaterThan(20);
    });
    campaign.currentRoundResult.rejectedVariants.slice(0, 4).forEach((variant) => {
      expect(variant.status).toBe('rejected');
      expect(variant.rejectionReason.length).toBeGreaterThan(20);
    });
  });

  test('classifies diversity and convergence signals for the survivor pool', () => {
    const campaign = buildProEvolCampaign(makeInput());

    expect(campaign.diversitySummary.classification).toBe('converging around one family');
    expect(campaign.convergenceSignal.state).toBe('productive-convergence');
    expect(campaign.diversitySummary.index).toBeGreaterThan(0.5);
    expect(campaign.convergenceSignal.persistenceSignals.length).toBeGreaterThan(0);
  });

  test('changes next-round recommendation when the campaign stage changes', () => {
    const earlyCampaign = buildProEvolCampaign(makeInput({
      totalRounds: 2,
      librarySize: 16,
      survivorCount: 4,
      selectionStringency: 0.55,
    }));
    const defaultCampaign = buildProEvolCampaign(makeInput());
    const lateCampaign = buildProEvolCampaign(makeInput({
      totalRounds: 5,
      librarySize: 16,
      survivorCount: 5,
      selectionStringency: 0.65,
    }));

    expect(earlyCampaign.nextRoundRecommendation.action).toBe('continue-another-round');
    expect(defaultCampaign.nextRoundRecommendation.action).toBe('narrow-library');
    expect(lateCampaign.nextRoundRecommendation.action).toBe('stop-campaign');
  });

  test('builds a landscape map with linked points, edges, and family hotspots', () => {
    const campaign = buildProEvolCampaign(makeInput());

    expect(campaign.landscape.points.length).toBeGreaterThan(campaign.currentRoundResult.librarySize);
    expect(campaign.landscape.edges.length).toBeGreaterThan(0);
    expect(campaign.landscape.hotspots.length).toBeGreaterThan(1);
    expect(campaign.landscape.edges.some((edge) => edge.active)).toBe(true);
    expect(campaign.landscape.hotspots[0]).toEqual(expect.objectContaining({
      round: expect.any(Number),
      leadScore: expect.any(Number),
      label: expect.any(String),
    }));
  });
});
