import {
  optimizeFedBatch,
  predictScaleUp,
  calculateEconomics,
  FedBatchParams,
  LabScaleData,
} from '../src/services/bioprocess/bioprocessOptimizer';

// ═════════════════════════════════════════════════════════════════
//  Tolerance helper
// ═════════════════════════════════════════════════════════════════

const TOL = 1e-6;

function expectClose(actual: number, expected: number, tol = TOL) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// ═════════════════════════════════════════════════════════════════
//  Fixtures
// ═════════════════════════════════════════════════════════════════

const defaultParams: FedBatchParams = {
  volume: 10,
  substrateConc: 10,
  feedRate: 0.5,
  temperature: 37,
  pH: 7.0,
  dissolvedO2: 80,
};

const labData: LabScaleData = {
  agitationSpeed: 200,
  powerInput: 50,
  volume: 10,
  vesselDiameter: 0.2,
  kLa: 50,
  aerationRate: 1.0,
  yield: 5.0,
};

// ═════════════════════════════════════════════════════════════════
//  1. optimizeFedBatch
// ═════════════════════════════════════════════════════════════════

describe('optimizeFedBatch', () => {
  it('returns a valid optimization result with positive optimal feed rate', () => {
    const result = optimizeFedBatch(defaultParams);
    expect(result.optimalFeedRate).toBeGreaterThan(0);
    expect(result.predictedYield).toBeGreaterThan(0);
    expect(result.convergenceHistory.length).toBeGreaterThanOrEqual(2);
  });

  it('convergence history shows non-decreasing yield', () => {
    const result = optimizeFedBatch(defaultParams);
    for (let i = 1; i < result.convergenceHistory.length; i++) {
      const prev = result.convergenceHistory[i - 1][2];
      const curr = result.convergenceHistory[i][2];
      // Allow small numerical noise
      expect(curr).toBeGreaterThanOrEqual(prev - 1e-10);
    }
  });

  it('optimal feed rate is within search bounds [0, maxFeedRate]', () => {
    const maxFeed = 1.5;
    const result = optimizeFedBatch(defaultParams, 48, maxFeed);
    expect(result.optimalFeedRate).toBeGreaterThanOrEqual(0);
    expect(result.optimalFeedRate).toBeLessThanOrEqual(maxFeed + 0.01);
  });

  it('higher temperature (away from optimum) reduces predicted yield', () => {
    const optResult = optimizeFedBatch(defaultParams);
    const hotResult = optimizeFedBatch({ ...defaultParams, temperature: 50 });
    // 50 degC is far from optimum (37), so yield should be lower
    expect(hotResult.predictedYield).toBeLessThan(optResult.predictedYield);
  });

  it('very low dissolved oxygen reduces yield', () => {
    const normalResult = optimizeFedBatch(defaultParams);
    const lowDOResult = optimizeFedBatch({ ...defaultParams, dissolvedO2: 5 });
    expect(lowDOResult.predictedYield).toBeLessThan(normalResult.predictedYield);
  });

  it('handles zero initial substrate gracefully', () => {
    const result = optimizeFedBatch({ ...defaultParams, substrateConc: 0 });
    // With zero initial substrate, yield should be low but result is valid
    expect(result.optimalFeedRate).toBeGreaterThanOrEqual(0);
    expect(result.predictedYield).toBeGreaterThanOrEqual(0);
  });
});

// ═════════════════════════════════════════════════════════════════
//  2. predictScaleUp
// ═════════════════════════════════════════════════════════════════

describe('predictScaleUp', () => {
  it('returns valid results for 100x scale-up', () => {
    const result = predictScaleUp(labData, 1000);
    expect(result.targetVolume).toBe(1000);
    expect(result.constantPV.powerInput).toBeGreaterThan(0);
    expect(result.constantPV.agitationSpeed).toBeGreaterThan(0);
    expect(result.constantPV.predictedKLa).toBeGreaterThan(0);
    expect(result.constantKLa.powerInput).toBeGreaterThan(0);
    expect(result.constantKLa.agitationSpeed).toBeGreaterThan(0);
  });

  it('constant P/V method scales power linearly with volume', () => {
    const scaleRatio = 100;
    const result = predictScaleUp(labData, labData.volume * scaleRatio);
    // P2 = P1 * (V2/V1)
    expectClose(result.constantPV.powerInput, labData.powerInput * scaleRatio);
  });

  it('constant P/V method reduces agitation speed at larger scale', () => {
    const result = predictScaleUp(labData, 1000);
    // N2 = N1 / (V2/V1)^(2/3) → speed decreases with scale
    expect(result.constantPV.agitationSpeed).toBeLessThan(labData.agitationSpeed);
  });

  it('constant kLa and constant P/V give different power inputs', () => {
    const result = predictScaleUp(labData, 1000);
    // The two methods should yield different power requirements
    expect(result.constantKLa.powerInput).not.toBeCloseTo(result.constantPV.powerInput, 0);
  });

  it('1x scale-up returns lab-scale values for constant P/V', () => {
    const result = predictScaleUp(labData, labData.volume);
    expectClose(result.constantPV.powerInput, labData.powerInput);
    expectClose(result.constantPV.agitationSpeed, labData.agitationSpeed, 0.1);
  });

  it('scale-up factor equals targetVolume / labVolume', () => {
    const targetVol = 500;
    const result = predictScaleUp(labData, targetVol);
    expectClose(result.constantKLa.scaleFactor, targetVol / labData.volume);
  });
});

// ═════════════════════════════════════════════════════════════════
//  3. calculateEconomics
// ═════════════════════════════════════════════════════════════════

describe('calculateEconomics', () => {
  it('returns positive profit for a profitable scenario', () => {
    // 500g yield, 100L, 10 g/L substrate, $20/g price
    // Revenue = 500 * 20 = $10,000; costs ~$2,790 → profitable
    const result = calculateEconomics(500, 100, 10, 20);
    expect(result.revenue).toBe(10000);
    expect(result.profit).toBeGreaterThan(0);
    expect(result.profitMargin).toBeGreaterThan(0);
  });

  it('cost breakdown sums to total cost', () => {
    const result = calculateEconomics(50, 50, 15, 10);
    const sum = result.costBreakdown.rawMaterials
      + result.costBreakdown.utilities
      + result.costBreakdown.labor
      + result.costBreakdown.depreciation
      + result.costBreakdown.consumables;
    expectClose(sum, result.totalCost);
  });

  it('costPerGram is Infinity when yield is zero', () => {
    const result = calculateEconomics(0, 100, 10, 20);
    expect(result.costPerGram).toBe(Infinity);
    expect(result.breakEvenPrice).toBe(0);
  });

  it('profit is zero when selling at break-even price', () => {
    const base = calculateEconomics(80, 100, 10, 15);
    // Re-run economics at the break-even price
    const breakEven = calculateEconomics(80, 100, 10, base.breakEvenPrice);
    expectClose(breakEven.profit, 0, 0.01);
  });

  it('ROI equals profit / totalCost', () => {
    const result = calculateEconomics(100, 100, 10, 20);
    const expectedRoi = result.profit / result.totalCost;
    expectClose(result.roi, expectedRoi);
  });

  it('higher market price increases profit linearly', () => {
    const r1 = calculateEconomics(50, 50, 10, 10);
    const r2 = calculateEconomics(50, 50, 10, 20);
    // Revenue doubles, cost stays the same, so profit increases by 50*10=500
    expectClose(r2.profit - r1.profit, 50 * 10);
  });

  it('payback period is Infinity when annual profit is zero or negative', () => {
    // Very low price to ensure no profit
    const result = calculateEconomics(10, 100, 50, 0.01);
    if (result.profit <= 0) {
      expect(result.paybackPeriod).toBe(Infinity);
    }
  });
});
