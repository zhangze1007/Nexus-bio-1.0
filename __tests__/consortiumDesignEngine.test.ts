import {
  optimizeConsortium,
  computeEigenvaluesQR,
  simulateQuorumSensing,
  type Strain,
} from '../src/server/consortiumDesignEngine';

// ═══════════════════════════════════════════════════════════════
//  Test Fixtures
// ═══════════════════════════════════════════════════════════════

function makeProducer(): Strain {
  return {
    id: 'producer',
    name: 'Acetate Producer',
    organism: 'E. coli',
    growthRate: 0.5,
    monod: {
      muMax: 0.7,     // h⁻¹ — Koch (1998) E. coli ~0.7
      ks: 0.1,        // g/L — Koch (1998) glucose Ks
      yieldCoeff: 0.5, // gDW/g — Varma & Palsson (1994)
    },
    metabolites: {
      produces: ['acetate'],
      consumes: ['glucose'],
    },
  };
}

function makeConsumer(): Strain {
  return {
    id: 'consumer',
    name: 'Acetate Consumer',
    organism: 'E. coli',
    growthRate: 0.3,
    monod: {
      muMax: 0.5,     // h⁻¹ — Koch (1998)
      ks: 0.2,        // g/L — Koch (1998) acetate Ks
      yieldCoeff: 0.4, // gDW/g — Varma & Palsson (1994)
    },
    metabolites: {
      produces: [],
      consumes: ['acetate'],
    },
  };
}

function makeQSStrain(): Strain {
  return {
    id: 'qs_strain',
    name: 'QS Strain',
    organism: 'V. fischeri',
    growthRate: 0.4,
    monod: {
      muMax: 0.6,
      ks: 0.15,
      yieldCoeff: 0.45,
    },
    metabolites: {
      produces: [],
      consumes: [],
    },
    qsParameters: {
      ahlProductionRate: 1.0,  // nM/h — Winson et al. (2005)
      ahlDegradationRate: 0.1, // 1/h — Horswill et al. (2007)
      threshold: 5,            // nM — Waters & Bassler (2005)
      hillCoeff: 2,            // — Waters & Bassler (2005)
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  SteadyCom LP Tests
// ═══════════════════════════════════════════════════════════════

describe('steadyComOptimize (via optimizeConsortium)', () => {
  it('should find balanced growth for 2 strains with cross-feeding', async () => {
    const strains = [makeProducer(), makeConsumer()];
    const result = await optimizeConsortium(strains, 'acetate', 2);

    // Community growth rate should be positive
    expect(result.communityGrowthRate).toBeGreaterThan(0);
    // Both strains should be selected
    expect(result.strains).toHaveLength(2);
    // Should identify cross-feeding interaction
    expect(result.interactions.length).toBeGreaterThan(0);
    // Interaction should be producer -> consumer for acetate
    const acetateInteraction = result.interactions.find(i => i.metabolite === 'acetate');
    expect(acetateInteraction).toBeDefined();
    expect(acetateInteraction!.producer).toBe('producer');
    expect(acetateInteraction!.consumer).toBe('consumer');
  });

  it('should return positive product flux from producer strain', async () => {
    const strains = [makeProducer(), makeConsumer()];
    const result = await optimizeConsortium(strains, 'acetate', 2);

    // Total product flux should be positive (producer makes acetate)
    expect(result.totalProductFlux).toBeGreaterThan(0);
  });

  it('should include design notes with community metrics', async () => {
    const strains = [makeProducer(), makeConsumer()];
    const result = await optimizeConsortium(strains, 'acetate', 2);

    expect(result.designNotes.length).toBeGreaterThan(0);
    expect(result.designNotes.some(n => n.includes('strains selected'))).toBe(true);
    expect(result.designNotes.some(n => n.includes('cross-feeding'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  QR Eigenvalue Tests
// ═══════════════════════════════════════════════════════════════

describe('computeEigenvaluesQR', () => {
  it('should compute eigenvalues of a known 2x2 matrix', () => {
    // Matrix: [[-1, 0.5], [0.3, -2]]
    // Characteristic polynomial: λ² + 3λ + 1.85 = 0
    // Eigenvalues: λ = (-3 ± sqrt(1.6)) / 2
    // λ₁ = -0.868, λ₂ = -2.132
    const A = [[-1, 0.5], [0.3, -2]];
    const eigenvalues = computeEigenvaluesQR(A);

    expect(eigenvalues).toHaveLength(2);

    // Sort eigenvalues for comparison
    const sorted = eigenvalues.sort((a, b) => a - b);
    // λ₂ = -2.132 (analytically)
    expect(sorted[0]).toBeCloseTo(-2.132, 2);
    // λ₁ = -0.868 (analytically)
    expect(sorted[1]).toBeCloseTo(-0.868, 2);
  });

  it('should compute eigenvalues of a 1x1 matrix', () => {
    const A = [[42]];
    const eigenvalues = computeEigenvaluesQR(A);
    expect(eigenvalues).toHaveLength(1);
    expect(eigenvalues[0]).toBeCloseTo(42, 10);
  });

  it('should compute eigenvalues of a 3x3 diagonal matrix', () => {
    // Diagonal matrix: eigenvalues are the diagonal entries
    const A = [[3, 0, 0], [0, -1, 0], [0, 0, 5]];
    const eigenvalues = computeEigenvaluesQR(A);

    expect(eigenvalues).toHaveLength(3);
    const sorted = eigenvalues.sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(-1, 5);
    expect(sorted[1]).toBeCloseTo(3, 5);
    expect(sorted[2]).toBeCloseTo(5, 5);
  });

  it('should return empty array for empty matrix', () => {
    const eigenvalues = computeEigenvaluesQR([]);
    expect(eigenvalues).toEqual([]);
  });

  it('should compute eigenvalues of identity matrix', () => {
    // Identity matrix: all eigenvalues = 1
    const A = [[1, 0], [0, 1]];
    const eigenvalues = computeEigenvaluesQR(A);

    expect(eigenvalues).toHaveLength(2);
    for (const λ of eigenvalues) {
      expect(λ).toBeCloseTo(1, 5);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
//  Quorum Sensing Tests
// ═══════════════════════════════════════════════════════════════

describe('simulateQuorumSensing', () => {
  it('should activate when AHL accumulates above threshold', () => {
    const strains = [makeQSStrain()];
    // High cell density (1e8 cells/mL) should produce enough AHL
    // AHL threshold = 5 nM, production rate = 1.0 nM/h per cell scaled by 1e-6
    const result = simulateQuorumSensing(strains, [1e8], 0.1, 200);

    // After sufficient time, AHL should exceed threshold and activate TF
    expect(result.active[0]).toBe(true);
    expect(result.ahlConcentrations[0]).toBeGreaterThan(0);
  });

  it('should not activate at low cell density', () => {
    const strains = [makeQSStrain()];
    // Very low cell density — AHL won't reach threshold
    const result = simulateQuorumSensing(strains, [1e4], 0.1, 100);

    // At low density, AHL production is too low to activate
    expect(result.active[0]).toBe(false);
  });

  it('should return correct number of results', () => {
    const strains = [makeQSStrain(), makeQSStrain()];
    const result = simulateQuorumSensing(strains, [1e8, 1e8], 0.1, 50);

    expect(result.active).toHaveLength(2);
    expect(result.ahlConcentrations).toHaveLength(2);
  });

  it('should handle strains without QS parameters', () => {
    const strains = [makeProducer()]; // no qsParameters
    const result = simulateQuorumSensing(strains, [1e8], 0.1, 100);

    // Strain without QS parameters should not be active
    expect(result.active[0]).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Stability Analysis Tests
// ═══════════════════════════════════════════════════════════════

describe('community stability', () => {
  it('should classify stable community with negative eigenvalues', async () => {
    const strains = [makeProducer(), makeConsumer()];
    const result = await optimizeConsortium(strains, 'acetate', 2);

    // With mutualistic cross-feeding, community should be stable or neutral
    expect(['stable', 'neutral']).toContain(result.stability);
    // All eigenvalues should be negative (stable)
    for (const λ of result.stabilityEigenvalues) {
      expect(λ).toBeLessThan(0.1); // allow small numerical error
    }
  });

  it('should include eigenvalues in result', async () => {
    const strains = [makeProducer(), makeConsumer()];
    const result = await optimizeConsortium(strains, 'acetate', 2);

    expect(result.stabilityEigenvalues.length).toBeGreaterThan(0);
  });
});
