/**
 * Tests for artifactStore — inter-tool data flow.
 *
 * Verifies that:
 *   1. Artifacts can be stored and retrieved
 *   2. Each artifact type has independent storage
 *   3. getAllArtifacts returns all non-null artifacts
 *   4. clear() resets all artifacts
 */

import { useArtifactStore } from '../src/store/artifactStore';
import type { FBAArtifact, PathwayArtifact } from '../src/domain/toolDataContract';

// Reset store before each test
beforeEach(() => {
  useArtifactStore.getState().clear();
});

describe('artifactStore', () => {
  const mockPathway: PathwayArtifact = {
    type: 'pathway',
    targetProduct: 'artemisinin',
    reactions: [{ id: 'R1', name: 'Test', subsystem: 'Glycolysis' }],
    metabolites: [{ id: 'M1', name: 'Glucose' }],
    enzymes: [],
    bottleneckCount: 1,
    thermodynamicConcerns: 0,
    pathwayScore: 0.8,
    timestamp: Date.now(),
  };

  const mockFBA: FBAArtifact = {
    type: 'fba',
    species: 'ecoli',
    objective: 'biomass',
    fluxes: { R1: 10, R2: 5 },
    shadowPrices: { atp: 0.01 },
    growthRate: 0.87,
    atpYield: 14,
    carbonEfficiency: 75,
    feasible: true,
    bottleneckReactions: [],
    knockouts: [],
    timestamp: Date.now(),
  };

  it('stores and retrieves pathway artifact', () => {
    useArtifactStore.getState().setPathway(mockPathway);
    const retrieved = useArtifactStore.getState().getArtifact('pathway');
    expect(retrieved).toEqual(mockPathway);
  });

  it('stores and retrieves FBA artifact', () => {
    useArtifactStore.getState().setFBA(mockFBA);
    const retrieved = useArtifactStore.getState().getArtifact('fba');
    expect(retrieved).toEqual(mockFBA);
  });

  it('returns null for unset artifact types', () => {
    const retrieved = useArtifactStore.getState().getArtifact('thermodynamic');
    expect(retrieved).toBeNull();
  });

  it('getAllArtifacts returns all non-null artifacts', () => {
    useArtifactStore.getState().setPathway(mockPathway);
    useArtifactStore.getState().setFBA(mockFBA);

    const all = useArtifactStore.getState().getAllArtifacts();
    expect(all.pathway).toEqual(mockPathway);
    expect(all.fba).toEqual(mockFBA);
    expect(all.thermodynamic).toBeUndefined();
  });

  it('clear() resets all artifacts', () => {
    useArtifactStore.getState().setPathway(mockPathway);
    useArtifactStore.getState().setFBA(mockFBA);

    useArtifactStore.getState().clear();

    expect(useArtifactStore.getState().pathway).toBeNull();
    expect(useArtifactStore.getState().fba).toBeNull();
    expect(useArtifactStore.getState().thermodynamic).toBeNull();
  });

  it('overwrites existing artifact of same type', () => {
    useArtifactStore.getState().setFBA(mockFBA);

    const updatedFBA = { ...mockFBA, growthRate: 0.95 };
    useArtifactStore.getState().setFBA(updatedFBA);

    const retrieved = useArtifactStore.getState().getArtifact('fba');
    expect((retrieved as FBAArtifact).growthRate).toBe(0.95);
  });
});
