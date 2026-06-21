/**
 * Real-time Anomaly Detection
 *
 * Pure-statistics anomaly detection for streaming data. Provides threshold-based
 * alerts, sliding window statistics, standard and robust (MAD-based) z-score
 * detection, and a composite AnomalyDetector that combines all methods.
 *
 * All computations are numerically stable and handle edge cases (empty windows,
 * zero standard deviation, single values) gracefully.
 *
 * @module streaming/anomaly
 */

import type { AnomalyEvent, ThresholdRule, Severity } from './types';

// ── SlidingWindow ────────────────────────────────────────────────────────────

/**
 * Fixed-size sliding window that maintains running statistics over a stream
 * of numeric values. When the window reaches capacity, the oldest value is
 * evicted each time a new one is added.
 *
 * @example
 * ```ts
 * const w = new SlidingWindow(100);
 * w.add(10); w.add(20); w.add(30);
 * console.log(w.mean()); // 20
 * console.log(w.std());  // ~8.16
 * ```
 */
export class SlidingWindow {
  private readonly values: number[] = [];
  private readonly maxSize: number;

  /**
   * Create a new SlidingWindow.
   *
   * @param windowSize - Maximum number of values retained in the window
   */
  constructor(windowSize: number) {
    this.maxSize = windowSize;
  }

  /**
   * Add a value to the window. If the window is full, the oldest value
   * is evicted first.
   *
   * @param value - The numeric value to add
   */
  add(value: number): void {
    if (this.values.length >= this.maxSize) {
      this.values.shift();
    }
    this.values.push(value);
  }

  /**
   * Compute the arithmetic mean of values in the window.
   *
   * @returns The mean, or 0 if the window is empty
   */
  mean(): number {
    if (this.values.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.values.length; i++) {
      sum += this.values[i];
    }
    return sum / this.values.length;
  }

  /**
   * Compute the population standard deviation of values in the window.
   *
   * Uses the population formula (divides by N, not N-1) for consistency
   * with z-score computation against the observed window.
   *
   * @returns The standard deviation, or 0 if the window has fewer than 2 values
   */
  std(): number {
    const n = this.values.length;
    if (n < 2) return 0;
    const m = this.mean();
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const diff = this.values[i] - m;
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq / n);
  }

  /**
   * Get the minimum value in the window.
   *
   * @returns The minimum value, or 0 if the window is empty
   */
  min(): number {
    if (this.values.length === 0) return 0;
    let m = this.values[0];
    for (let i = 1; i < this.values.length; i++) {
      if (this.values[i] < m) m = this.values[i];
    }
    return m;
  }

  /**
   * Get the maximum value in the window.
   *
   * @returns The maximum value, or 0 if the window is empty
   */
  max(): number {
    if (this.values.length === 0) return 0;
    let m = this.values[0];
    for (let i = 1; i < this.values.length; i++) {
      if (this.values[i] > m) m = this.values[i];
    }
    return m;
  }

  /**
   * Get the current number of values in the window.
   *
   * @returns The count of values
   */
  count(): number {
    return this.values.length;
  }

  /**
   * Get a copy of the values currently in the window.
   *
   * Returns a shallow copy in insertion order (oldest first).
   *
   * @returns Array of values currently in the window
   */
  getValues(): number[] {
    return [...this.values];
  }

  /**
   * Clear all values from the window, resetting it to empty.
   */
  reset(): void {
    this.values.length = 0;
  }
}

// ── Threshold-Based Alerts ───────────────────────────────────────────────────

/**
 * Check whether a value violates a threshold rule.
 *
 * Compares the value against the rule's min and max bounds (inclusive).
 * If the value falls outside the acceptable range, an AnomalyEvent is
 * returned with the rule's severity and message.
 *
 * @param value - The numeric value to check
 * @param rule - The threshold rule defining acceptable bounds
 * @returns An AnomalyEvent if the value violates the rule, or `null` if within bounds
 *
 * @example
 * ```ts
 * const rule = { metric: 'ph', min: 6, max: 8, severity: 'high', message: 'pH out of range' };
 * checkThreshold(9, rule); // AnomalyEvent
 * checkThreshold(7, rule); // null
 * ```
 */
export function checkThreshold(value: number, rule: ThresholdRule): AnomalyEvent | null {
  const belowMin = rule.min !== undefined && value < rule.min;
  const aboveMax = rule.max !== undefined && value > rule.max;

  if (!belowMin && !aboveMax) return null;

  const threshold = belowMin ? rule.min! : rule.max!;
  const direction = belowMin ? 'below minimum' : 'above maximum';

  return {
    timestamp: Date.now(),
    metric: rule.metric,
    value,
    threshold,
    severity: rule.severity,
    reason: `${rule.message} (${direction}: ${threshold})`,
  };
}

// ── Z-Score Anomaly Detection ────────────────────────────────────────────────

/**
 * Detect anomalies using the standard z-score method.
 *
 * Computes z = (value - mean) / std from the sliding window. If |z| exceeds
 * the threshold (default 3), an AnomalyEvent is returned. Severity is mapped
 * from z-score magnitude: |z| > 5 = critical, |z| > 4 = high, otherwise medium.
 *
 * Returns null when the window is empty, has only one value, or when std is zero
 * (all values identical) to avoid division by zero.
 *
 * @param value - The value to evaluate
 * @param window - The SlidingWindow containing historical data
 * @param threshold - |z-score| threshold for anomaly flagging (default: 3)
 * @returns An AnomalyEvent if anomalous, or `null`
 *
 * @example
 * ```ts
 * const w = new SlidingWindow(100);
 * for (let i = 0; i < 50; i++) w.add(100);
 * detectZScoreAnomaly(200, w); // AnomalyEvent with high z-score
 * detectZScoreAnomaly(101, w); // null — near the mean
 * ```
 */
export function detectZScoreAnomaly(
  value: number,
  window: SlidingWindow,
  threshold: number = 3,
): AnomalyEvent | null {
  const count = window.count();
  if (count < 2) return null;

  const mean = window.mean();
  const std = window.std();

  // When std is zero (all window values identical), any deviation from
  // the mean is a clear anomaly. Treat it as an infinite z-score.
  if (std === 0) {
    if (value === mean) return null;
    // Deviation from constant stream is always critical
    return {
      timestamp: Date.now(),
      metric: 'stream',
      value,
      zScore: value > mean ? Infinity : -Infinity,
      severity: 'critical',
      reason: `Z-score anomaly: value ${value} deviates from constant stream (mean=${mean})`,
      windowStats: { mean, std: 0, count },
    };
  }

  const zScore = (value - mean) / std;
  if (Math.abs(zScore) <= threshold) return null;

  const absZ = Math.abs(zScore);
  let severity: Severity = 'medium';
  if (absZ > 5) severity = 'critical';
  else if (absZ > 4) severity = 'high';

  return {
    timestamp: Date.now(),
    metric: 'stream',
    value,
    zScore,
    severity,
    reason: `Z-score anomaly: z=${zScore.toFixed(2)} exceeds threshold ${threshold}`,
    windowStats: { mean, std, count },
  };
}

// ── Robust Z-Score (MAD-Based) ───────────────────────────────────────────────

/**
 * Compute the Median Absolute Deviation (MAD) of an array of values.
 * MAD = median(|xi - median(x)|). Returns 0 for empty arrays.
 *
 * @param values - The numeric array
 * @returns The median value
 */
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Detect anomalies using the robust z-score method (Median Absolute Deviation).
 *
 * Unlike the standard z-score, this method uses the median and MAD instead of
 * mean and standard deviation, making it far more resistant to outliers already
 * present in the window.
 *
 * Robust z-score = 0.6745 * (value - median) / MAD
 * The constant 0.6745 is the 0.75th quantile of the standard normal distribution,
 * which makes the MAD a consistent estimator of std for normal data.
 *
 * Returns null when the window is empty, has fewer than 2 values, or when MAD is zero.
 *
 * @param value - The value to evaluate
 * @param window - The SlidingWindow containing historical data
 * @param threshold - |robust z-score| threshold for anomaly flagging (default: 3.5)
 * @returns An AnomalyEvent if anomalous, or `null`
 *
 * @example
 * ```ts
 * const w = new SlidingWindow(100);
 * fillWindow(w, [10, 12, 11, 13, 10, 1000, 11, 12]); // outlier in data
 * detectRobustZScoreAnomaly(500, w); // still detects anomaly despite outlier
 * ```
 */
export function detectRobustZScoreAnomaly(
  value: number,
  window: SlidingWindow,
  threshold: number = 3.5,
): AnomalyEvent | null {
  const count = window.count();
  if (count < 2) return null;

  // Compute median and MAD from the window's raw values
  const values = window.getValues();
  const median = computeMedian(values);
  const deviations = values.map((v) => Math.abs(v - median));
  const mad = computeMedian(deviations);

  // Guard against zero MAD (all values identical or nearly so).
  // When MAD is zero and the value deviates from the median, flag it as critical.
  if (mad === 0) {
    if (value === median) return null;
    return {
      timestamp: Date.now(),
      metric: 'stream',
      value,
      zScore: value > median ? Infinity : -Infinity,
      severity: 'critical',
      reason: `Robust z-score anomaly: value ${value} deviates from constant stream (median=${median})`,
      windowStats: {
        mean: window.mean(),
        std: window.std(),
        count,
      },
    };
  }

  // Robust z-score using the 0.75th quantile constant
  const robustZScore = 0.6745 * (value - median) / mad;
  if (Math.abs(robustZScore) <= threshold) return null;

  const absZ = Math.abs(robustZScore);
  let severity: Severity = 'medium';
  if (absZ > 5) severity = 'critical';
  else if (absZ > 4) severity = 'high';

  return {
    timestamp: Date.now(),
    metric: 'stream',
    value,
    zScore: robustZScore,
    severity,
    reason: `Robust z-score anomaly: z=${robustZScore.toFixed(2)} exceeds threshold ${threshold}`,
    windowStats: {
      mean: window.mean(),
      std: window.std(),
      count,
    },
  };
}

// ── AnomalyDetector ──────────────────────────────────────────────────────────

/**
 * Composite anomaly detector that combines threshold rules and z-score detection.
 *
 * Maintains per-metric sliding windows and a set of threshold rules. Each call
 * to `check()` evaluates the incoming data point against all applicable rules
 * and the z-score detector, returning all triggered anomalies.
 *
 * Supports both standard z-score and robust (MAD-based) z-score detection.
 * Enable robust mode via `useRobustZScore: true` in the constructor options
 * for better outlier resistance.
 *
 * @example
 * ```ts
 * // Standard mode
 * const detector = new AnomalyDetector({ windowSize: 200, zScoreThreshold: 2.5 });
 *
 * // Robust mode (MAD-based, better outlier resistance)
 * const robustDetector = new AnomalyDetector({ windowSize: 200, useRobustZScore: true });
 * detector.addRule({ metric: 'ph', min: 6, max: 8, severity: 'critical', message: 'pH out of range' });
 *
 * // Feed data
 * for (const reading of readings) {
 *   const anomalies = detector.check(reading);
 *   if (anomalies.length > 0) handleAnomalies(anomalies);
 * }
 * ```
 */
export class AnomalyDetector {
  private readonly windowSize: number;
  private readonly zScoreThreshold: number;
  private readonly useRobustZScore: boolean;
  private readonly rules: Map<string, ThresholdRule[]> = new Map();
  private readonly windows: Map<string, SlidingWindow> = new Map();

  /**
   * Create a new AnomalyDetector.
   *
   * @param options - Configuration options
   * @param options.windowSize - Size of the sliding window per metric (default: 100)
   * @param options.zScoreThreshold - |z-score| threshold for anomaly flagging (default: 3)
   * @param options.useRobustZScore - Use MAD-based robust z-score instead of standard z-score (default: false)
   */
  constructor(options?: { windowSize?: number; zScoreThreshold?: number; useRobustZScore?: boolean }) {
    this.windowSize = options?.windowSize ?? 100;
    this.zScoreThreshold = options?.zScoreThreshold ?? 3;
    this.useRobustZScore = options?.useRobustZScore ?? false;
  }

  /**
   * Add a threshold rule. Multiple rules can be added for the same metric.
   *
   * @param rule - The threshold rule to add
   */
  addRule(rule: ThresholdRule): void {
    const existing = this.rules.get(rule.metric);
    if (existing) {
      existing.push(rule);
    } else {
      this.rules.set(rule.metric, [rule]);
    }
  }

  /**
   * Remove all threshold rules for a given metric.
   *
   * @param metric - The metric name whose rules should be removed
   */
  removeRule(metric: string): void {
    this.rules.delete(metric);
  }

  /**
   * Get all registered threshold rules across all metrics.
   *
   * @returns Array of all threshold rules
   */
  getRules(): ThresholdRule[] {
    const all: ThresholdRule[] = [];
    for (const rules of this.rules.values()) {
      all.push(...rules);
    }
    return all;
  }

  /**
   * Evaluate a data point against all detection methods.
   *
   * Checks the value against:
   * 1. All threshold rules registered for the metric
   * 2. Z-score anomaly detection using the metric's sliding window
   *
   * After checking, the value is added to the metric's sliding window
   * for future z-score computations.
   *
   * @param data - The data point to evaluate
   * @param data.metric - The metric name
   * @param data.value - The numeric value
   * @returns Array of all triggered AnomalyEvents (may be empty)
   */
  check(data: { metric: string; value: number }): AnomalyEvent[] {
    const { metric, value } = data;
    const anomalies: AnomalyEvent[] = [];

    // 1. Check threshold rules
    const metricRules = this.rules.get(metric);
    if (metricRules) {
      for (const rule of metricRules) {
        const event = checkThreshold(value, rule);
        if (event) {
          anomalies.push(event);
        }
      }
    }

    // 2. Check z-score anomaly (before adding the new value)
    let window = this.windows.get(metric);
    if (!window) {
      window = new SlidingWindow(this.windowSize);
      this.windows.set(metric, window);
    }

    const zEvent = this.useRobustZScore
      ? detectRobustZScoreAnomaly(value, window, this.zScoreThreshold)
      : detectZScoreAnomaly(value, window, this.zScoreThreshold);
    if (zEvent) {
      // Override the metric name (detectZScoreAnomaly uses 'stream')
      anomalies.push({ ...zEvent, metric });
    }

    // Add the value to the window after checking
    window.add(value);

    return anomalies;
  }

  /**
   * Reset the detector: clear all rules and all per-metric windows.
   */
  reset(): void {
    this.rules.clear();
    this.windows.clear();
  }
}
