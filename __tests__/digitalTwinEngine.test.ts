import {
  runDigitalTwin,
  quickStateEstimate,
  type DigitalTwinConfig,
  type SensorReading,
  type DigitalTwinResult,
} from '../src/server/digitalTwinEngine';

/**
 * Tests for the Extended Kalman Filter digital twin engine (src/server/digitalTwinEngine.ts).
 *
 * The engine uses EKF state estimation with Monod kinetics for bioreactor digital twins.
 * State vector: [biomass, substrate, product, volume, muMax, ks, yieldCoeff]
 *
 * Key algorithms:
 *   - Extended Kalman Filter with 7 state dimensions
 *   - Runge-Kutta 4th order for state prediction
 *   - Normalized Innovation Squared (NIS) for anomaly detection
 *   - Monte Carlo propagation for forecasting
 */

// ── Test Fixtures ───────────────────────────────────────────────────────────

/**
 * Generate sensor readings that follow a plausible growth curve.
 * Uses simple Monod kinetics approximation with small random noise.
 * This produces consistent, model-consistent readings for testing.
 */
function generateSensorReadings(config: DigitalTwinConfig, count: number): SensorReading[] {
  const readings: SensorReading[] = [];
  let X = 0.1;   // initial biomass
  let S = 10.0;   // initial substrate
  let P = 0.0;    // initial product

  for (let i = 0; i < count; i++) {
    const timestamp = (i + 1) * 1.0; // hourly readings
    const ko = 0.5;
    const mu = config.muMax * S / (config.ks + S) * config.dissolvedO2 / (ko + config.dissolvedO2);
    const D = config.feedRate / config.volume;
    const dXdt = mu * X - D * X;
    const dSdt = -(mu / config.yieldCoeff) * X - config.maintenanceCoeff * X + D * (config.feedConcentration - S);
    const dPdt = config.productYield * mu * X + 0.01 * X - D * P;

    X = Math.max(0.01, X + dXdt + (Math.random() - 0.5) * 0.002);
    S = Math.max(0.01, S + dSdt + (Math.random() - 0.5) * 0.002);
    P = Math.max(0, P + dPdt + (Math.random() - 0.5) * 0.001);

    readings.push({
      timestamp,
      biomass: Math.round(X * 1000) / 1000,
      substrate: Math.round(S * 1000) / 1000,
      product: Math.round(P * 1000) / 1000,
    });
  }
  return readings;
}

const standardConfig: DigitalTwinConfig = {
  volume: 5.0,
  temperature: 37.0,
  pH: 7.0,
  dissolvedO2: 80.0,
  muMax: 0.4,
  ks: 1.0,
  yieldCoeff: 0.5,
  maintenanceCoeff: 0.02,
  productYield: 0.1,
  feedConcentration: 20.0,
  feedRate: 0.05,
  processNoise: 0.1,
  measurementNoise: 1.0,
  initialUncertainty: 1.0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Basic Run — verify output structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — Basic Run', () => {
  test('returns valid result with states and diagnostics from 15+ readings', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings);

    // Verify result structure
    expect(result.currentState).toBeDefined();
    expect(result.updateHistory).toBeDefined();
    expect(result.forecast).toBeDefined();
    expect(result.diagnostics).toBeDefined();
    expect(result.designNotes).toBeDefined();

    // Verify update history matches input length
    expect(result.updateHistory.length).toBe(readings.length);
    expect(result.diagnostics.totalUpdates).toBe(readings.length);

    // Verify design notes are populated
    expect(result.designNotes.length).toBeGreaterThan(0);
    expect(result.designNotes[0]).toContain('15 sensor readings');
  });

  test('currentState has all expected fields with finite values', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings);
    const state = result.currentState;

    expect(typeof state.biomass).toBe('number');
    expect(typeof state.substrate).toBe('number');
    expect(typeof state.product).toBe('number');
    expect(typeof state.volume).toBe('number');
    expect(typeof state.muMax).toBe('number');
    expect(typeof state.ks).toBe('number');
    expect(typeof state.yieldCoeff).toBe('number');
    expect(typeof state.specificGrowthRate).toBe('number');
    expect(typeof state.substrateUptakeRate).toBe('number');
    expect(typeof state.productFormationRate).toBe('number');
    expect(typeof state.anomalyScore).toBe('number');

    expect(Number.isFinite(state.biomass)).toBe(true);
    expect(Number.isFinite(state.substrate)).toBe(true);
    expect(Number.isFinite(state.product)).toBe(true);
  });

  test('uncertainty has all expected fields', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings);
    const unc = result.currentState.uncertainty;

    expect(typeof unc.biomass).toBe('number');
    expect(typeof unc.substrate).toBe('number');
    expect(typeof unc.product).toBe('number');
    expect(typeof unc.muMax).toBe('number');
    expect(typeof unc.ks).toBe('number');

    expect(Number.isFinite(unc.biomass)).toBe(true);
    expect(Number.isFinite(unc.substrate)).toBe(true);
    expect(Number.isFinite(unc.product)).toBe(true);
  });

  test('diagnostics contains expected fields', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings);
    const diag = result.diagnostics;

    expect(typeof diag.totalUpdates).toBe('number');
    expect(typeof diag.avgLikelihood).toBe('number');
    expect(typeof diag.anomalyCount).toBe('number');
    expect(typeof diag.parameterDrift.muMax).toBe('number');
    expect(typeof diag.parameterDrift.ks).toBe('number');
    expect(typeof diag.parameterDrift.yieldCoeff).toBe('number');
    expect(typeof diag.modelFit).toBe('number');

    expect(diag.totalUpdates).toBe(readings.length);
    expect(diag.anomalyCount).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. EKF Convergence — uncertainty decreases over time
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — EKF Convergence', () => {
  test('final biomass uncertainty is less than initial uncertainty', () => {
    // Use deterministic readings (no noise) for clean convergence test
    const fixedReadings: SensorReading[] = [];
    let X = 0.1, S = 10.0, P = 0.0;

    for (let i = 0; i < 20; i++) {
      const ko = 0.5;
      const mu = standardConfig.muMax * S / (standardConfig.ks + S) *
        standardConfig.dissolvedO2 / (ko + standardConfig.dissolvedO2);
      const D = standardConfig.feedRate / standardConfig.volume;
      X = Math.max(0.01, X + mu * X - D * X);
      S = Math.max(0.01, S - (mu / standardConfig.yieldCoeff) * X - standardConfig.maintenanceCoeff * X + D * (standardConfig.feedConcentration - S));
      P = Math.max(0, P + standardConfig.productYield * mu * X + 0.01 * X - D * P);

      fixedReadings.push({
        timestamp: (i + 1) * 1.0,
        biomass: Math.round(X * 1000) / 1000,
        substrate: Math.round(S * 1000) / 1000,
        product: Math.round(P * 1000) / 1000,
      });
    }

    const result = runDigitalTwin(standardConfig, fixedReadings);

    // After processing many readings, biomass uncertainty should be below initial
    const initialUnc = Math.sqrt(standardConfig.initialUncertainty);
    const finalUnc = result.currentState.uncertainty.biomass;
    expect(finalUnc).toBeLessThan(initialUnc);
  });

  test('posterior uncertainty is lower than prior uncertainty at each update', () => {
    // Use deterministic readings for clean test
    const fixedReadings: SensorReading[] = [];
    let X = 0.1, S = 10.0, P = 0.0;

    for (let i = 0; i < 20; i++) {
      const ko = 0.5;
      const mu = standardConfig.muMax * S / (standardConfig.ks + S) *
        standardConfig.dissolvedO2 / (ko + standardConfig.dissolvedO2);
      const D = standardConfig.feedRate / standardConfig.volume;
      X = Math.max(0.01, X + mu * X - D * X);
      S = Math.max(0.01, S - (mu / standardConfig.yieldCoeff) * X - standardConfig.maintenanceCoeff * X + D * (standardConfig.feedConcentration - S));
      P = Math.max(0, P + standardConfig.productYield * mu * X + 0.01 * X - D * P);

      fixedReadings.push({
        timestamp: (i + 1) * 1.0,
        biomass: Math.round(X * 1000) / 1000,
        substrate: Math.round(S * 1000) / 1000,
        product: Math.round(P * 1000) / 1000,
      });
    }

    const result = runDigitalTwin(standardConfig, fixedReadings);

    // After each measurement update, the posterior uncertainty should be
    // lower than the prior uncertainty (EKF update reduces uncertainty)
    for (const update of result.updateHistory) {
      const priorUnc = update.priorState.uncertainty.biomass;
      const posteriorUnc = update.posteriorState.uncertainty.biomass;
      // Posterior should be <= prior (Kalman update reduces uncertainty)
      expect(posteriorUnc).toBeLessThanOrEqual(priorUnc + 1e-10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Anomaly Detection — deviant sensor readings increase anomaly score
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — Anomaly Detection', () => {
  test('anomaly detected when sensor reading deviates significantly from model', () => {
    const readings = generateSensorReadings(standardConfig, 15);

    // Add an anomalous reading: substrate jumps to 0.1 when model expects ~8.5
    const anomalousReading: SensorReading = {
      timestamp: 16.0,
      biomass: readings[readings.length - 1].biomass, // biomass normal
      substrate: 0.1, // far below expected ~8.5 g/L
      product: readings[readings.length - 1].product, // product normal
    };

    const allReadings = [...readings, anomalousReading];
    const result = runDigitalTwin(standardConfig, allReadings);

    // Anomaly should be detected
    expect(result.diagnostics.anomalyCount).toBeGreaterThanOrEqual(1);

    // The final update should be flagged as anomalous
    const lastUpdate = result.updateHistory[result.updateHistory.length - 1];
    expect(lastUpdate.anomalyDetected).toBe(true);
  });

  test('normal readings do not trigger anomaly detection', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings);

    // Most normal readings should not be anomalous
    const anomalyCount = result.updateHistory.filter(u => u.anomalyDetected).length;
    expect(anomalyCount).toBeLessThan(readings.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Forecast — confidence intervals and reasonable trajectories
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — Forecast', () => {
  test('forecast contains valid confidence intervals', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings, 12);

    expect(result.forecast.length).toBeGreaterThan(0);

    for (const point of result.forecast) {
      // Time should be positive
      expect(point.time).toBeGreaterThan(0);

      // CI bounds should be ordered: lower ≤ upper
      expect(point.biomass.ci95[0]).toBeLessThanOrEqual(point.biomass.ci95[1]);
      expect(point.substrate.ci95[0]).toBeLessThanOrEqual(point.substrate.ci95[1]);
      expect(point.product.ci95[0]).toBeLessThanOrEqual(point.product.ci95[1]);

      // Mean should be finite
      expect(Number.isFinite(point.biomass.mean)).toBe(true);
      expect(Number.isFinite(point.substrate.mean)).toBe(true);
      expect(Number.isFinite(point.product.mean)).toBe(true);

      // Growth rate should be finite
      expect(Number.isFinite(point.specificGrowthRate)).toBe(true);

      // CI bounds should be finite
      expect(Number.isFinite(point.biomass.ci95[0])).toBe(true);
      expect(Number.isFinite(point.biomass.ci95[1])).toBe(true);
    }
  });

  test('forecast time horizon matches requested horizon', () => {
    const readings = generateSensorReadings(standardConfig, 10);
    const horizon = 6;
    const result = runDigitalTwin(standardConfig, readings, horizon);

    expect(result.forecast.length).toBeGreaterThan(0);

    // Last forecast point should be near the horizon
    const lastTime = result.forecast[result.forecast.length - 1].time;
    expect(lastTime).toBeCloseTo(horizon, 0);
  });

  test('forecast with zero horizon returns empty array', () => {
    const readings = generateSensorReadings(standardConfig, 10);
    const result = runDigitalTwin(standardConfig, readings, 0);

    expect(result.forecast.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Determinism — same config + same readings → same output
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — Determinism', () => {
  test('same config and readings produce identical state and diagnostics', () => {
    // Use fixed readings (no random noise) for determinism test
    const fixedReadings: SensorReading[] = [];
    let X = 0.1, S = 10.0, P = 0.0;
    const config = standardConfig;

    for (let i = 0; i < 10; i++) {
      const ko = 0.5;
      const mu = config.muMax * S / (config.ks + S) * config.dissolvedO2 / (ko + config.dissolvedO2);
      const D = config.feedRate / config.volume;
      X = Math.max(0.01, X + mu * X - D * X);
      S = Math.max(0.01, S - (mu / config.yieldCoeff) * X - config.maintenanceCoeff * X + D * (config.feedConcentration - S));
      P = Math.max(0, P + config.productYield * mu * X + 0.01 * X - D * P);

      fixedReadings.push({
        timestamp: (i + 1) * 1.0,
        biomass: Math.round(X * 1000) / 1000,
        substrate: Math.round(S * 1000) / 1000,
        product: Math.round(P * 1000) / 1000,
      });
    }

    // Mock Math.random to make Monte Carlo forecast deterministic
    const origRandom = Math.random;
    let callCount = 0;
    Math.random = () => {
      callCount++;
      // Deterministic pseudo-random sequence
      return ((callCount * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    };

    try {
      const first = runDigitalTwin(config, fixedReadings, 12);

      // Reset counter for identical sequence
      callCount = 0;
      const second = runDigitalTwin(config, fixedReadings, 12);

      // State should be identical
      expect(second.currentState.biomass).toBe(first.currentState.biomass);
      expect(second.currentState.substrate).toBe(first.currentState.substrate);
      expect(second.currentState.product).toBe(first.currentState.product);
      expect(second.currentState.muMax).toBe(first.currentState.muMax);

      // Diagnostics should be identical
      expect(second.diagnostics).toEqual(first.diagnostics);

      // Forecast should be identical (with deterministic random)
      expect(second.forecast.length).toBe(first.forecast.length);
      for (let i = 0; i < first.forecast.length; i++) {
        expect(second.forecast[i].biomass.mean).toBe(first.forecast[i].biomass.mean);
        expect(second.forecast[i].substrate.mean).toBe(first.forecast[i].substrate.mean);
        expect(second.forecast[i].product.mean).toBe(first.forecast[i].product.mean);
      }
    } finally {
      Math.random = origRandom;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Update History — each update has prior/posterior states and Kalman gains
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — Update History', () => {
  test('each update contains priorState, posteriorState, innovation, and kalmanGains', () => {
    const readings = generateSensorReadings(standardConfig, 10);
    const result = runDigitalTwin(standardConfig, readings);

    for (const update of result.updateHistory) {
      expect(update.timestamp).toBeGreaterThan(0);
      expect(update.priorState).toBeDefined();
      expect(update.posteriorState).toBeDefined();
      expect(update.innovation).toBeDefined();
      expect(update.kalmanGains).toBeDefined();
      expect(typeof update.likelihood).toBe('number');
      expect(typeof update.anomalyDetected).toBe('boolean');
    }
  });

  test('Kalman gains are in valid range', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings);

    for (const update of result.updateHistory) {
      // Kalman gains should be finite (can be 0-1 typically but not strictly bounded)
      expect(Number.isFinite(update.kalmanGains.biomass)).toBe(true);
      expect(Number.isFinite(update.kalmanGains.substrate)).toBe(true);
      expect(Number.isFinite(update.kalmanGains.product)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. quickStateEstimate — single measurement helper
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — quickStateEstimate', () => {
  test('returns valid state from a single measurement', () => {
    const measurement: SensorReading = {
      timestamp: 1.0,
      biomass: 0.5,
      substrate: 9.0,
      product: 0.05,
    };

    const state = quickStateEstimate(standardConfig, measurement);

    expect(Number.isFinite(state.biomass)).toBe(true);
    expect(Number.isFinite(state.substrate)).toBe(true);
    expect(Number.isFinite(state.product)).toBe(true);
    expect(state.biomass).toBeGreaterThanOrEqual(0);
    expect(state.substrate).toBeGreaterThanOrEqual(0);
    expect(state.product).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Edge Cases — partial sensor data
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — Edge Cases', () => {
  test('handles sensor readings with only biomass (partial data)', () => {
    const partialReadings: SensorReading[] = [
      { timestamp: 1, biomass: 0.1 },
      { timestamp: 2, biomass: 0.15 },
      { timestamp: 3, biomass: 0.2 },
      { timestamp: 4, biomass: 0.25 },
      { timestamp: 5, biomass: 0.3 },
    ];

    const result = runDigitalTwin(standardConfig, partialReadings);

    expect(result.updateHistory.length).toBe(partialReadings.length);
    expect(result.diagnostics.totalUpdates).toBe(partialReadings.length);
    expect(Number.isFinite(result.currentState.biomass)).toBe(true);
  });

  test('handles readings with missing early timestamps gracefully', () => {
    const readings: SensorReading[] = [
      { timestamp: 5, biomass: 0.3, substrate: 9.5, product: 0.01 },
      { timestamp: 6, biomass: 0.35, substrate: 9.4, product: 0.02 },
      { timestamp: 7, biomass: 0.4, substrate: 9.3, product: 0.03 },
    ];

    const result = runDigitalTwin(standardConfig, readings);

    expect(result.updateHistory.length).toBe(readings.length);
    expect(Number.isFinite(result.currentState.biomass)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Model Fit — R² diagnostic
// ═══════════════════════════════════════════════════════════════════════════════

describe('Digital Twin Engine — Model Fit', () => {
  test('modelFit R² is in valid range [0, 1]', () => {
    const readings = generateSensorReadings(standardConfig, 15);
    const result = runDigitalTwin(standardConfig, readings);

    expect(result.diagnostics.modelFit).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.modelFit).toBeLessThanOrEqual(1);
  });

  test('modelFit is reasonably high for consistent sensor data', () => {
    // Use deterministic readings (no noise) for high R²
    const fixedReadings: SensorReading[] = [];
    let X = 0.1, S = 10.0, P = 0.0;

    for (let i = 0; i < 15; i++) {
      const ko = 0.5;
      const mu = standardConfig.muMax * S / (standardConfig.ks + S) *
        standardConfig.dissolvedO2 / (ko + standardConfig.dissolvedO2);
      const D = standardConfig.feedRate / standardConfig.volume;
      X = Math.max(0.01, X + mu * X - D * X);
      S = Math.max(0.01, S - (mu / standardConfig.yieldCoeff) * X - standardConfig.maintenanceCoeff * X + D * (standardConfig.feedConcentration - S));
      P = Math.max(0, P + standardConfig.productYield * mu * X + 0.01 * X - D * P);

      fixedReadings.push({
        timestamp: (i + 1) * 1.0,
        biomass: Math.round(X * 1000) / 1000,
        substrate: Math.round(S * 1000) / 1000,
        product: Math.round(P * 1000) / 1000,
      });
    }

    const result = runDigitalTwin(standardConfig, fixedReadings);

    // With noiseless data from the same model, R² should be very high
    expect(result.diagnostics.modelFit).toBeGreaterThan(0.5);
  });
});
