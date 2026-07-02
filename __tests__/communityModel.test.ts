/**
 * Curated 2-species community model tests (Task 3).
 *
 * Verifies that `buildCommunityModel` produces a literature-grounded
 * E. coli + yeast consortium whose cross-feeding (acetate + ethanol) is REAL:
 * every numeric assertion below holds because of the stoichiometric coupling
 * enforced by the SteadyCom joint LP (Chan et al. 2017), never because a value
 * was hardcoded.
 *
 * Cross-feeding biology:
 *   - E. coli secretes acetate as an obligate ATP-overflow byproduct
 *     (Basan et al. 2015, Nature 528:99-104).
 *   - Yeast ferments glucose to ethanol (Crabtree effect; De Deken 1966,
 *     J Gen Microbiol 44(2):149-156).
 *   - The shared extracellular pool is CLOSED, so acetate reaches yeast ONLY
 *     via E. coli secretion, and ethanol reaches E. coli ONLY via yeast
 *     secretion. Coexistence is therefore obligate mutualism.
 */

import { buildCommunityModel, COMMUNITY_SHARED_METABOLITES } from '../src/data/communityModel';
import { steadyCom } from '../src/server/fbaSteadyCom';

describe('communityModel', () => {
  it('builds two species with biomass + shared-pool exchange reactions', () => {
    const { species, sharedMetabolites } = buildCommunityModel({
      ecoli: { glucoseUptake: 10 },
      yeast: { glucoseUptake: 10 },
    });
    expect(species.map((s) => s.id).sort()).toEqual(['ecoli', 'yeast']);
    expect(sharedMetabolites).toEqual(COMMUNITY_SHARED_METABOLITES);
    for (const sp of species) {
      expect(sp.reactions.find((r) => r.id === sp.biomassReaction)).toBeTruthy();
    }
    // at least one reaction touches a shared metabolite in each species
    for (const sp of species) {
      const touchesShared = sp.reactions.some((r) =>
        sharedMetabolites.some((m) => r.stoichiometry[m] !== undefined),
      );
      expect(touchesShared).toBe(true);
    }
  });

  it('applies glucose uptake bounds from the request', () => {
    const { species } = buildCommunityModel({
      ecoli: { glucoseUptake: 7 },
      yeast: { glucoseUptake: 3 },
    });
    const ecoli = species.find((s) => s.id === 'ecoli')!;
    const yeast = species.find((s) => s.id === 'yeast')!;
    expect(ecoli.reactions.find((r) => r.id === 'EX_glc')!.upperBound).toBe(7);
    expect(yeast.reactions.find((r) => r.id === 'EX_glc_y')!.upperBound).toBe(3);
  });

  it('returns fixedAbundance only when alpha is provided', () => {
    const withAlpha = buildCommunityModel({ ecoli: {}, yeast: {}, alpha: 0.4 });
    expect(withAlpha.fixedAbundance).toEqual({ yeast: 0.4, ecoli: 0.6 });
    const noAlpha = buildCommunityModel({ ecoli: {}, yeast: {} });
    expect(noAlpha.fixedAbundance).toBeUndefined();
  });

  it('produces real cross-feeding coexistence when run through steadyCom', async () => {
    const { species, sharedMetabolites } = buildCommunityModel({
      ecoli: { glucoseUptake: 10 },
      yeast: { glucoseUptake: 10 },
    });
    const res = await steadyCom(species, sharedMetabolites);

    expect(res.status).toBe('optimal');
    expect(res.communityGrowthRate).toBeGreaterThan(0);

    // BOTH species grow: genuine coexistence via mutual cross-feeding, not one
    // species zeroed out. This holds only because the closed shared pool makes
    // each species obligately dependent on the other's secreted byproduct.
    expect(res.speciesGrowthRates.ecoli).toBeGreaterThan(1e-4);
    expect(res.speciesGrowthRates.yeast).toBeGreaterThan(1e-4);

    // Some cross-feeding flux is strictly > 0 (real exchange occurring).
    const acetateSecretion = res.speciesFluxes.ecoli.EX_ac;
    const acetateUptake = res.speciesFluxes.yeast.UP_ac;
    const ethanolSecretion = res.speciesFluxes.yeast.EX_etoh;
    const ethanolUptake = res.speciesFluxes.ecoli.UP_etoh;
    expect(acetateSecretion).toBeGreaterThan(1e-4);
    expect(ethanolSecretion).toBeGreaterThan(1e-4);

    // Shared-pool conservation (closed pool): secretion == uptake for each shared metabolite.
    expect(acetateSecretion).toBeCloseTo(acetateUptake, 4);
    expect(ethanolSecretion).toBeCloseTo(ethanolUptake, 4);
  });

  it('cross-feeding sensitivity: removing yeast ethanol secretion collapses E. coli growth', async () => {
    // E. coli has no glucose of its own -> it depends entirely on yeast's ethanol.
    const base = buildCommunityModel({ ecoli: { glucoseUptake: 0 }, yeast: { glucoseUptake: 10 } });
    const withSecretion = await steadyCom(base.species, base.sharedMetabolites);

    const knocked = buildCommunityModel({ ecoli: { glucoseUptake: 0 }, yeast: { glucoseUptake: 10 } });
    const y = knocked.species.find((s) => s.id === 'yeast')!;
    y.reactions = y.reactions.filter((r) => r.id !== 'EX_etoh'); // knock out ethanol secretion
    const withoutSecretion = await steadyCom(knocked.species, knocked.sharedMetabolites);

    // With ethanol secretion, E. coli grows on the cross-fed ethanol.
    expect(withSecretion.speciesGrowthRates.ecoli).toBeGreaterThan(1e-4);
    // Removing the only ethanol source drives E. coli growth to ~0.
    expect(withoutSecretion.speciesGrowthRates.ecoli).toBeCloseTo(0, 4);
    // Cross-feeding strictly increases both E. coli growth and community growth.
    expect(withSecretion.speciesGrowthRates.ecoli).toBeGreaterThan(
      withoutSecretion.speciesGrowthRates.ecoli,
    );
    expect(withSecretion.communityGrowthRate).toBeGreaterThan(withoutSecretion.communityGrowthRate);
  });

  it('applies a per-species knockout to the joint SteadyCom solve (was silently discarded)', async () => {
    // Baseline: no knockouts -> E. coli grows via its own biomass reaction.
    const baseline = buildCommunityModel({
      ecoli: { glucoseUptake: 10 },
      yeast: { glucoseUptake: 10 },
    });
    const baseRes = await steadyCom(baseline.species, baseline.sharedMetabolites);
    expect(baseRes.status).toBe('optimal');
    expect(baseRes.speciesGrowthRates.ecoli).toBeGreaterThan(1e-4);

    // Knock out E. coli's REAL curated biomass reaction id (BIOMASS_ecoli).
    const knocked = buildCommunityModel({
      ecoli: { glucoseUptake: 10, knockouts: ['BIOMASS_ecoli'] },
      yeast: { glucoseUptake: 10 },
    });
    const ecoli = knocked.species.find((s) => s.id === 'ecoli')!;
    const biomassRxn = ecoli.reactions.find((r) => r.id === 'BIOMASS_ecoli')!;
    // The knockout is actually applied to the model (bounds pinned to zero),
    // not silently discarded before ever reaching the LP.
    expect(biomassRxn.lowerBound).toBe(0);
    expect(biomassRxn.upperBound).toBe(0);

    const knockedRes = await steadyCom(knocked.species, knocked.sharedMetabolites);
    // With biomass production disabled, E. coli cannot grow at all.
    expect(knockedRes.speciesGrowthRates.ecoli).toBeCloseTo(0, 6);
    // The knockout genuinely changes the outcome relative to baseline.
    expect(knockedRes.speciesGrowthRates.ecoli).toBeLessThan(baseRes.speciesGrowthRates.ecoli);

    // A non-matching knockout id (not a reaction in this curated model) has no
    // effect — this is the documented curated-model scope limitation, not a bug.
    const unaffected = buildCommunityModel({
      ecoli: { glucoseUptake: 10, knockouts: ['b_iJO1366_fakeGeneId'] },
      yeast: { glucoseUptake: 10 },
    });
    const unaffectedRes = await steadyCom(unaffected.species, unaffected.sharedMetabolites);
    expect(unaffectedRes.speciesGrowthRates.ecoli).toBeGreaterThan(1e-4);
  });
});
