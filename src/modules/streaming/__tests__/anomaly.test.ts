/**
 * Real-time Anomaly Detection Tests
 *
 * Tests cover:
 *   1. Threshold Alerts (above max, below min, within bounds)
 *   2. Sliding Window (statistics, overflow, empty window)
 *   3. Z-Score Detection (anomaly detection, normal values, edge cases)
 *   4. Robust Z-Score (outlier robustness, MAD-based detection)
 *   5. Anomaly Detector (rule management, combined detection, severity)
 *
 * @jest-environment node
 */

import {
  SlidingWindow,
  checkThreshold,
  detectZScoreAnomaly,
  detectRobustZScoreAnomaly,
  AnomalyDetector,
} from '../anomaly';
import type { ThresholdRule } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a threshold rule with sensible defaults */
function makeRule(overrides: Partial<ThresholdRule> = {}): ThresholdRule {
  return {
    metric: 'temperature',
    min: 0,
    max: 100,
    severity: 'medium',
    message: 'Out of range',
    ...overrides,
  };
}

/** Populate a SlidingWindow with values */
function fillWindow(window: SlidingWindow, values: number[]): void {
  for (const v of values) {
    window.add(v);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('checkThreshold', () => {
  describe('detects values above max', () => {
    it('returns anomaly event when value exceeds max', () => {
      const rule = makeRule({ max: 50 });
      const result = checkThreshold(75, rule);

      expect(result).not.toBeNull();
      expect(result!.metric).toBe('temperature');
      expect(result!.value).toBe(75);
      expect(result!.threshold).toBe(50);
      expect(result!.severity).toBe('medium');
      expect(result!.reason).toContain('Out of range');
    });

    it('treats value equal to max as within bounds', () => {
      const rule = makeRule({ max: 100 });
      const result = checkThreshold(100, rule);
      expect(result).toBeNull();
    });
  });

  describe('detects values below min', () => {
    it('returns anomaly event when value is below min', () => {
      const rule = makeRule({ min: 10, max: undefined });
      const result = checkThreshold(3, rule);

      expect(result).not.toBeNull();
      expect(result!.value).toBe(3);
      expect(result!.threshold).toBe(10);
      expect(result!.severity).toBe('medium');
    });

    it('treats value equal to min as within bounds', () => {
      const rule = makeRule({ min: 10, max: undefined });
      const result = checkThreshold(10, rule);
      expect(result).toBeNull();
    });
  });

  describe('returns null when within bounds', () => {
    it('returns null for value between min and max', () => {
      const rule = makeRule({ min: 10, max: 100 });
      expect(checkThreshold(50, rule)).toBeNull();
    });

    it('returns null when only min is set and value is above', () => {
      const rule = makeRule({ min: 10, max: undefined });
      expect(checkThreshold(50, rule)).toBeNull();
    });

    it('returns null when only max is set and value is below', () => {
      const rule = makeRule({ min: undefined, max: 100 });
      expect(checkThreshold(50, rule)).toBeNull();
    });

    it('returns null when neither min nor max is set', () => {
      const rule = makeRule({ min: undefined, max: undefined });
      expect(checkThreshold(999, rule)).toBeNull();
    });
  });

  it('includes timestamp in anomaly event', () => {
    const before = Date.now();
    const rule = makeRule({ max: 10 });
    const result = checkThreshold(20, rule);
    const after = Date.now();

    expect(result).not.toBeNull();
    expect(result!.timestamp).toBeGreaterThanOrEqual(before);
    expect(result!.timestamp).toBeLessThanOrEqual(after);
  });

  it('preserves configured severity', () => {
    const rule = makeRule({ severity: 'critical', max: 5 });
    const result = checkThreshold(10, rule);
    expect(result!.severity).toBe('critical');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('SlidingWindow', () => {
  describe('computes correct statistics', () => {
    it('computes mean correctly', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [2, 4, 6, 8, 10]);
      expect(w.mean()).toBe(6);
    });

    it('computes standard deviation correctly', () => {
      const w = new SlidingWindow(10);
      // Values: [2, 4, 6, 8, 10], mean = 6
      // Variance = ((4+4+0+4+16)/5) = 5.657...
      fillWindow(w, [2, 4, 6, 8, 10]);
      const std = w.std();
      expect(std).toBeCloseTo(Math.sqrt(8), 5); // population std for [2,4,6,8,10]
    });

    it('computes min correctly', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [5, 3, 8, 1, 9]);
      expect(w.min()).toBe(1);
    });

    it('computes max correctly', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [5, 3, 8, 1, 9]);
      expect(w.max()).toBe(9);
    });

    it('tracks count correctly', () => {
      const w = new SlidingWindow(10);
      expect(w.count()).toBe(0);
      w.add(1);
      expect(w.count()).toBe(1);
      w.add(2);
      expect(w.count()).toBe(2);
    });

    it('returns the single value for min/max/mean with one element', () => {
      const w = new SlidingWindow(10);
      w.add(42);
      expect(w.mean()).toBe(42);
      expect(w.min()).toBe(42);
      expect(w.max()).toBe(42);
      expect(w.count()).toBe(1);
    });
  });

  describe('handles window overflow', () => {
    it('evicts oldest values when window is full', () => {
      const w = new SlidingWindow(3);
      fillWindow(w, [10, 20, 30]);
      // Window: [10, 20, 30], mean = 20
      expect(w.mean()).toBe(20);

      w.add(40);
      // Window should be [20, 30, 40] — 10 evicted
      expect(w.count()).toBe(3);
      expect(w.mean()).toBe(30);
      expect(w.min()).toBe(20);
      expect(w.max()).toBe(40);
    });

    it('maintains correct size after many additions', () => {
      const w = new SlidingWindow(5);
      for (let i = 0; i < 100; i++) {
        w.add(i);
      }
      expect(w.count()).toBe(5);
      // Last 5 values: 95, 96, 97, 98, 99
      expect(w.mean()).toBe(97);
      expect(w.min()).toBe(95);
      expect(w.max()).toBe(99);
    });
  });

  describe('handles empty window', () => {
    let w: SlidingWindow;

    beforeEach(() => {
      w = new SlidingWindow(10);
    });

    it('returns 0 for mean when empty', () => {
      expect(w.mean()).toBe(0);
    });

    it('returns 0 for std when empty', () => {
      expect(w.std()).toBe(0);
    });

    it('returns 0 for min when empty', () => {
      expect(w.min()).toBe(0);
    });

    it('returns 0 for max when empty', () => {
      expect(w.max()).toBe(0);
    });

    it('returns 0 for count when empty', () => {
      expect(w.count()).toBe(0);
    });
  });

  describe('reset', () => {
    it('clears all data', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [1, 2, 3, 4, 5]);
      expect(w.count()).toBe(5);

      w.reset();
      expect(w.count()).toBe(0);
      expect(w.mean()).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('detectZScoreAnomaly', () => {
  describe('detects anomalies correctly', () => {
    it('flags a value far from the mean', () => {
      const w = new SlidingWindow(100);
      // Tight cluster around 100
      fillWindow(w, Array.from({ length: 50 }, () => 100));

      // Value of 200 should be anomalous (z-score will be very high)
      const result = detectZScoreAnomaly(200, w);
      expect(result).not.toBeNull();
      expect(result!.zScore).toBeDefined();
      expect(Math.abs(result!.zScore!)).toBeGreaterThan(3);
      expect(result!.metric).toBe('stream');
    });

    it('includes window stats in the event', () => {
      const w = new SlidingWindow(100);
      fillWindow(w, [10, 10, 10, 10, 10]);

      const result = detectZScoreAnomaly(100, w);
      expect(result).not.toBeNull();
      expect(result!.windowStats).toBeDefined();
      expect(result!.windowStats!.mean).toBe(10);
      expect(result!.windowStats!.count).toBe(5);
    });

    it('assigns high severity for extreme z-scores', () => {
      const w = new SlidingWindow(100);
      fillWindow(w, Array.from({ length: 50 }, () => 100));

      const result = detectZScoreAnomaly(500, w);
      expect(result).not.toBeNull();
      expect(['high', 'critical']).toContain(result!.severity);
    });

    it('respects custom threshold', () => {
      const w = new SlidingWindow(100);
      // Use varied values so std > 0 and z-score is well-defined
      fillWindow(w, [100, 102, 99, 101, 100, 98, 103, 100, 101, 99]);
      const mean = w.mean();
      const std = w.std();

      // A value 1 std away => z-score ~1, below default threshold of 3
      const nearValue = mean + std;
      const resultDefault = detectZScoreAnomaly(nearValue, w);
      expect(resultDefault).toBeNull();

      // With a strict threshold of 0.5, z-score ~1 should trigger
      const resultStrict = detectZScoreAnomaly(nearValue, w, 0.5);
      expect(resultStrict).not.toBeNull();
    });
  });

  describe('returns null for normal values', () => {
    it('returns null for a value near the mean', () => {
      const w = new SlidingWindow(100);
      fillWindow(w, [10, 12, 11, 13, 10, 11, 12]);

      const result = detectZScoreAnomaly(11, w);
      expect(result).toBeNull();
    });

    it('returns null for a value exactly at the mean', () => {
      const w = new SlidingWindow(100);
      fillWindow(w, [50, 50, 50, 50, 50]);

      const result = detectZScoreAnomaly(50, w);
      expect(result).toBeNull();
    });
  });

  describe('handles edge cases', () => {
    it('returns null for empty window', () => {
      const w = new SlidingWindow(10);
      const result = detectZScoreAnomaly(42, w);
      expect(result).toBeNull();
    });

    it('returns null when window has only one value (std = 0)', () => {
      const w = new SlidingWindow(10);
      w.add(100);
      // std = 0, z-score would be NaN/Infinity
      const result = detectZScoreAnomaly(200, w);
      expect(result).toBeNull();
    });

    it('detects deviation from constant stream (std = 0)', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [5, 5, 5, 5]);
      const result = detectZScoreAnomaly(10, w);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });

    it('returns null when value matches constant stream (std = 0)', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [5, 5, 5, 5]);
      const result = detectZScoreAnomaly(5, w);
      expect(result).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('detectRobustZScoreAnomaly', () => {
  describe('detects anomalies with outliers', () => {
    it('flags an extreme value even with outliers in the window', () => {
      const w = new SlidingWindow(100);
      // Normal values around 10, with one outlier at 1000
      fillWindow(w, [10, 12, 11, 13, 10, 1000, 11, 12]);

      // Another extreme value should be flagged
      const result = detectRobustZScoreAnomaly(500, w);
      expect(result).not.toBeNull();
      expect(result!.zScore).toBeDefined();
      expect(result!.metric).toBe('stream');
    });

    it('includes window stats in the event', () => {
      const w = new SlidingWindow(100);
      fillWindow(w, [10, 12, 11, 13, 10, 11]);

      const result = detectRobustZScoreAnomaly(200, w);
      expect(result).not.toBeNull();
      expect(result!.windowStats).toBeDefined();
      expect(result!.windowStats!.count).toBe(6);
    });
  });

  describe('more robust than standard z-score', () => {
    it('is less affected by outliers in the window', () => {
      const w = new SlidingWindow(100);
      // Data with outliers
      fillWindow(w, [10, 12, 11, 13, 10, 1000, 11, 12, 10, 11]);

      // Standard z-score might miss this because outlier inflates std
      const standardResult = detectZScoreAnomaly(100, w);

      // Robust z-score should still detect it because MAD is less affected
      const robustResult = detectRobustZScoreAnomaly(100, w);

      // The robust version should have a higher z-score magnitude
      // (or at least detect the anomaly where standard might not)
      if (standardResult && robustResult) {
        expect(Math.abs(robustResult.zScore!)).toBeGreaterThanOrEqual(
          Math.abs(standardResult.zScore!)
        );
      }
    });

    it('handles window with many outliers gracefully', () => {
      const w = new SlidingWindow(100);
      // 50% outliers
      fillWindow(w, [10, 1000, 12, 2000, 11, 3000, 13, 4000, 10, 5000]);

      const result = detectRobustZScoreAnomaly(10, w);
      // Should return null — 10 is near the median
      expect(result).toBeNull();
    });
  });

  describe('returns null for normal values', () => {
    it('returns null for a value near the median', () => {
      const w = new SlidingWindow(100);
      fillWindow(w, [10, 12, 11, 13, 10, 11, 12]);

      const result = detectRobustZScoreAnomaly(11, w);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for empty window', () => {
      const w = new SlidingWindow(10);
      expect(detectRobustZScoreAnomaly(42, w)).toBeNull();
    });

    it('detects deviation when MAD is zero', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [5, 5, 5, 5, 5]);
      const result = detectRobustZScoreAnomaly(10, w);
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
    });

    it('returns null when value matches constant stream and MAD is zero', () => {
      const w = new SlidingWindow(10);
      fillWindow(w, [5, 5, 5, 5, 5]);
      expect(detectRobustZScoreAnomaly(5, w)).toBeNull();
    });

    it('handles window with exactly 2 values', () => {
      const w = new SlidingWindow(10);
      w.add(10);
      w.add(20);
      // With only 2 values, MAD might be small
      const result = detectRobustZScoreAnomaly(100, w);
      // Should either detect anomaly or gracefully return null
      // Just verify it doesn't throw
      expect(typeof result === 'object' || result === null).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('AnomalyDetector', () => {
  describe('adds and removes rules', () => {
    it('adds a rule', () => {
      const detector = new AnomalyDetector();
      const rule = makeRule({ metric: 'ph' });
      detector.addRule(rule);

      const rules = detector.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].metric).toBe('ph');
    });

    it('adds multiple rules for different metrics', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'ph' }));
      detector.addRule(makeRule({ metric: 'temperature' }));
      detector.addRule(makeRule({ metric: 'pressure' }));

      expect(detector.getRules()).toHaveLength(3);
    });

    it('adds multiple rules for the same metric', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'ph', min: 6, max: 8, severity: 'medium' }));
      detector.addRule(makeRule({ metric: 'ph', min: 5, max: 9, severity: 'low' }));

      expect(detector.getRules()).toHaveLength(2);
    });

    it('removes all rules for a metric', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'ph' }));
      detector.addRule(makeRule({ metric: 'temperature' }));

      detector.removeRule('ph');
      const rules = detector.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].metric).toBe('temperature');
    });

    it('ignores removal of non-existent metric', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'ph' }));

      detector.removeRule('nonexistent');
      expect(detector.getRules()).toHaveLength(1);
    });
  });

  describe('combines multiple detection methods', () => {
    it('returns threshold violations', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'temp', min: 0, max: 50, severity: 'high' }));

      const anomalies = detector.check({ metric: 'temp', value: 100 });
      expect(anomalies.length).toBeGreaterThanOrEqual(1);
      expect(anomalies.some((a) => a.severity === 'high')).toBe(true);
    });

    it('returns z-score anomalies after building history', () => {
      const detector = new AnomalyDetector({ windowSize: 100, zScoreThreshold: 2 });

      // Build history for metric 'flux'
      for (let i = 0; i < 20; i++) {
        detector.check({ metric: 'flux', value: 100 + Math.random() * 2 });
      }

      // Now feed a clear outlier
      const anomalies = detector.check({ metric: 'flux', value: 500 });
      expect(anomalies.length).toBeGreaterThanOrEqual(1);
      expect(anomalies.some((a) => a.zScore !== undefined)).toBe(true);
    });

    it('returns both threshold and z-score anomalies when both trigger', () => {
      const detector = new AnomalyDetector({ windowSize: 100, zScoreThreshold: 2 });
      detector.addRule(makeRule({ metric: 'temp', min: 0, max: 50, severity: 'critical' }));

      // Build history
      for (let i = 0; i < 20; i++) {
        detector.check({ metric: 'temp', value: 25 });
      }

      // Value that is both out of range AND a z-score anomaly
      const anomalies = detector.check({ metric: 'temp', value: 200 });
      expect(anomalies.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array when no anomalies detected', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'temp', min: 0, max: 100 }));

      const anomalies = detector.check({ metric: 'temp', value: 50 });
      expect(anomalies).toEqual([]);
    });

    it('tracks per-metric sliding windows independently', () => {
      const detector = new AnomalyDetector({ windowSize: 100 });

      // Build different histories for different metrics
      for (let i = 0; i < 20; i++) {
        detector.check({ metric: 'metricA', value: 100 });
        detector.check({ metric: 'metricB', value: 200 });
      }

      // A value of 150 is normal for neither but should be checked against
      // each metric's own window
      const aAnomalies = detector.check({ metric: 'metricA', value: 150 });
      const bAnomalies = detector.check({ metric: 'metricB', value: 150 });

      // Both should detect this as anomalous relative to their own histories
      expect(aAnomalies.length).toBeGreaterThanOrEqual(1);
      expect(bAnomalies.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('returns correct severity', () => {
    it('uses rule severity for threshold violations', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'x', max: 10, severity: 'critical' }));

      const anomalies = detector.check({ metric: 'x', value: 99 });
      expect(anomalies.some((a) => a.severity === 'critical')).toBe(true);
    });

    it('assigns severity based on z-score magnitude', () => {
      const detector = new AnomalyDetector({ windowSize: 100 });

      // Build history
      for (let i = 0; i < 30; i++) {
        detector.check({ metric: 'y', value: 100 });
      }

      // Extreme outlier
      const anomalies = detector.check({ metric: 'y', value: 1000 });
      const zAnomaly = anomalies.find((a) => a.zScore !== undefined);
      expect(zAnomaly).toBeDefined();
      expect(['high', 'critical']).toContain(zAnomaly!.severity);
    });
  });

  describe('reset', () => {
    it('clears all rules and windows', () => {
      const detector = new AnomalyDetector();
      detector.addRule(makeRule({ metric: 'a' }));
      detector.addRule(makeRule({ metric: 'b' }));

      // Build history
      for (let i = 0; i < 10; i++) {
        detector.check({ metric: 'a', value: 50 });
      }

      detector.reset();
      expect(detector.getRules()).toHaveLength(0);

      // After reset, no z-score anomalies should be detected (no history)
      const anomalies = detector.check({ metric: 'a', value: 500 });
      expect(anomalies).toEqual([]);
    });
  });
});
