/**
 * Dashboard Event Schema Tests
 *
 * Tests cover:
 *   1. Dashboard State validation
 *   2. Dashboard Event validation
 *   3. Metric Curve validation
 *   4. Dashboard Alert validation
 *   5. Model Output validation
 *
 * @jest-environment node
 */

import {
  validateDashboardState,
  validateDashboardEvent,
  validateMetricCurve,
  validateDashboardAlert,
  validateModelOutput,
} from '../schemas';
import type {
  DashboardState,
  DashboardEvent,
  MetricCurve,
  DashboardAlert,
  ModelOutput,
} from '../schemas';

// ── Helpers ──────────────────────────────────────────────────────────────────

function validDashboardState(): DashboardState {
  return {
    timestamp: Date.now(),
    status: 'healthy',
    activeConnections: 5,
    activeTopics: ['metrics', 'alerts'],
    metrics: { cpu: 42.5, memory: 68.3 },
  };
}

function validDashboardEvent(): DashboardEvent {
  return {
    id: 'evt-001',
    timestamp: Date.now(),
    type: 'anomaly',
    severity: 'warning',
    message: 'CPU usage spike detected',
  };
}

function validMetricCurve(): MetricCurve {
  return {
    metric: 'cpu_usage',
    points: [
      { timestamp: 1000, value: 10 },
      { timestamp: 2000, value: 20 },
      { timestamp: 3000, value: 15 },
    ],
    unit: '%',
    min: 0,
    max: 100,
  };
}

function validDashboardAlert(): DashboardAlert {
  return {
    id: 'alert-001',
    timestamp: Date.now(),
    metric: 'cpu_usage',
    value: 95,
    threshold: 90,
    severity: 'high',
    message: 'CPU usage exceeded threshold',
    acknowledged: false,
  };
}

function validModelOutput(): ModelOutput {
  return {
    timestamp: Date.now(),
    modelId: 'model-001',
    input: { sequence: 'ATCG' },
    output: { fold: 'alpha-helix' },
    confidence: 0.95,
    latencyMs: 150,
  };
}

// ── Dashboard State ──────────────────────────────────────────────────────────

describe('validateDashboardState', () => {
  describe('validates correct data', () => {
    it('accepts a valid healthy state', () => {
      const data = validDashboardState();
      const result = validateDashboardState(data);
      expect(result.status).toBe('healthy');
      expect(result.activeConnections).toBe(5);
    });

    it('accepts degraded status', () => {
      const data = validDashboardState();
      data.status = 'degraded';
      const result = validateDashboardState(data);
      expect(result.status).toBe('degraded');
    });

    it('accepts critical status', () => {
      const data = validDashboardState();
      data.status = 'critical';
      const result = validateDashboardState(data);
      expect(result.status).toBe('critical');
    });

    it('accepts zero active connections', () => {
      const data = validDashboardState();
      data.activeConnections = 0;
      const result = validateDashboardState(data);
      expect(result.activeConnections).toBe(0);
    });

    it('accepts empty active topics', () => {
      const data = validDashboardState();
      data.activeTopics = [];
      const result = validateDashboardState(data);
      expect(result.activeTopics).toEqual([]);
    });

    it('accepts empty metrics', () => {
      const data = validDashboardState();
      data.metrics = {};
      const result = validateDashboardState(data);
      expect(result.metrics).toEqual({});
    });
  });

  describe('throws on invalid data', () => {
    it('throws on null input', () => {
      expect(() => validateDashboardState(null)).toThrow();
    });

    it('throws on undefined input', () => {
      expect(() => validateDashboardState(undefined)).toThrow();
    });

    it('throws on non-object input', () => {
      expect(() => validateDashboardState('string')).toThrow();
      expect(() => validateDashboardState(42)).toThrow();
      expect(() => validateDashboardState(true)).toThrow();
    });
  });

  describe('handles missing fields', () => {
    it('throws when timestamp is missing', () => {
      const data = validDashboardState();
      delete (data as any).timestamp;
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when status is missing', () => {
      const data = validDashboardState();
      delete (data as any).status;
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when activeConnections is missing', () => {
      const data = validDashboardState();
      delete (data as any).activeConnections;
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when activeTopics is missing', () => {
      const data = validDashboardState();
      delete (data as any).activeTopics;
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when metrics is missing', () => {
      const data = validDashboardState();
      delete (data as any).metrics;
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when status is invalid', () => {
      const data = validDashboardState();
      data.status = 'offline' as any;
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when timestamp is not a number', () => {
      const data = validDashboardState();
      (data as any).timestamp = 'not-a-number';
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when activeTopics is not an array', () => {
      const data = validDashboardState();
      (data as any).activeTopics = 'not-an-array';
      expect(() => validateDashboardState(data)).toThrow();
    });

    it('throws when metrics is not an object', () => {
      const data = validDashboardState();
      (data as any).metrics = 'not-an-object';
      expect(() => validateDashboardState(data)).toThrow();
    });
  });
});

// ── Dashboard Events ─────────────────────────────────────────────────────────

describe('validateDashboardEvent', () => {
  describe('validates correct data', () => {
    it('accepts a valid anomaly event', () => {
      const data = validDashboardEvent();
      const result = validateDashboardEvent(data);
      expect(result.type).toBe('anomaly');
      expect(result.severity).toBe('warning');
    });

    it('accepts threshold event type', () => {
      const data = validDashboardEvent();
      data.type = 'threshold';
      const result = validateDashboardEvent(data);
      expect(result.type).toBe('threshold');
    });

    it('accepts connection event type', () => {
      const data = validDashboardEvent();
      data.type = 'connection';
      const result = validateDashboardEvent(data);
      expect(result.type).toBe('connection');
    });

    it('accepts subscription event type', () => {
      const data = validDashboardEvent();
      data.type = 'subscription';
      const result = validateDashboardEvent(data);
      expect(result.type).toBe('subscription');
    });

    it('accepts error event type', () => {
      const data = validDashboardEvent();
      data.type = 'error';
      const result = validateDashboardEvent(data);
      expect(result.type).toBe('error');
    });

    it('accepts all severity levels', () => {
      for (const severity of ['info', 'warning', 'error', 'critical'] as const) {
        const data = validDashboardEvent();
        data.severity = severity;
        const result = validateDashboardEvent(data);
        expect(result.severity).toBe(severity);
      }
    });

    it('accepts event with optional data field', () => {
      const data = validDashboardEvent();
      data.data = { detail: 'extra info' };
      const result = validateDashboardEvent(data);
      expect(result.data).toEqual({ detail: 'extra info' });
    });

    it('accepts event without optional data field', () => {
      const data = validDashboardEvent();
      const result = validateDashboardEvent(data);
      expect(result.data).toBeUndefined();
    });
  });

  describe('throws on invalid data', () => {
    it('throws on null input', () => {
      expect(() => validateDashboardEvent(null)).toThrow();
    });

    it('throws on undefined input', () => {
      expect(() => validateDashboardEvent(undefined)).toThrow();
    });

    it('throws on non-object input', () => {
      expect(() => validateDashboardEvent(123)).toThrow();
      expect(() => validateDashboardEvent([])).toThrow();
    });
  });

  describe('handles event types', () => {
    it('throws when type is invalid', () => {
      const data = validDashboardEvent();
      data.type = 'unknown' as any;
      expect(() => validateDashboardEvent(data)).toThrow();
    });

    it('throws when severity is invalid', () => {
      const data = validDashboardEvent();
      data.severity = 'none' as any;
      expect(() => validateDashboardEvent(data)).toThrow();
    });

    it('throws when id is missing', () => {
      const data = validDashboardEvent();
      delete (data as any).id;
      expect(() => validateDashboardEvent(data)).toThrow();
    });

    it('throws when timestamp is missing', () => {
      const data = validDashboardEvent();
      delete (data as any).timestamp;
      expect(() => validateDashboardEvent(data)).toThrow();
    });

    it('throws when message is missing', () => {
      const data = validDashboardEvent();
      delete (data as any).message;
      expect(() => validateDashboardEvent(data)).toThrow();
    });

    it('throws when message is not a string', () => {
      const data = validDashboardEvent();
      (data as any).message = 42;
      expect(() => validateDashboardEvent(data)).toThrow();
    });
  });
});

// ── Metric Curves ────────────────────────────────────────────────────────────

describe('validateMetricCurve', () => {
  describe('validates correct data', () => {
    it('accepts a valid metric curve', () => {
      const data = validMetricCurve();
      const result = validateMetricCurve(data);
      expect(result.metric).toBe('cpu_usage');
      expect(result.points).toHaveLength(3);
    });

    it('accepts curve without optional fields', () => {
      const data = { metric: 'mem', points: [{ timestamp: 1, value: 5 }] };
      const result = validateMetricCurve(data);
      expect(result.unit).toBeUndefined();
      expect(result.min).toBeUndefined();
      expect(result.max).toBeUndefined();
    });

    it('accepts curve with empty points array', () => {
      const data = { metric: 'test', points: [] };
      const result = validateMetricCurve(data);
      expect(result.points).toEqual([]);
    });

    it('preserves unit, min, max when provided', () => {
      const data = validMetricCurve();
      const result = validateMetricCurve(data);
      expect(result.unit).toBe('%');
      expect(result.min).toBe(0);
      expect(result.max).toBe(100);
    });
  });

  describe('throws on invalid data', () => {
    it('throws on null input', () => {
      expect(() => validateMetricCurve(null)).toThrow();
    });

    it('throws on undefined input', () => {
      expect(() => validateMetricCurve(undefined)).toThrow();
    });

    it('throws on non-object input', () => {
      expect(() => validateMetricCurve('string')).toThrow();
    });
  });

  describe('handles time ranges', () => {
    it('throws when metric is missing', () => {
      const data = validMetricCurve();
      delete (data as any).metric;
      expect(() => validateMetricCurve(data)).toThrow();
    });

    it('throws when points is missing', () => {
      const data = validMetricCurve();
      delete (data as any).points;
      expect(() => validateMetricCurve(data)).toThrow();
    });

    it('throws when points is not an array', () => {
      const data = validMetricCurve();
      (data as any).points = 'not-an-array';
      expect(() => validateMetricCurve(data)).toThrow();
    });

    it('throws when point has invalid timestamp', () => {
      const data = validMetricCurve();
      (data as any).points = [{ timestamp: 'bad', value: 1 }];
      expect(() => validateMetricCurve(data)).toThrow();
    });

    it('throws when point has invalid value', () => {
      const data = validMetricCurve();
      (data as any).points = [{ timestamp: 1, value: 'bad' }];
      expect(() => validateMetricCurve(data)).toThrow();
    });

    it('throws when metric is not a string', () => {
      const data = validMetricCurve();
      (data as any).metric = 42;
      expect(() => validateMetricCurve(data)).toThrow();
    });
  });
});

// ── Dashboard Alerts ─────────────────────────────────────────────────────────

describe('validateDashboardAlert', () => {
  describe('validates correct data', () => {
    it('accepts a valid alert', () => {
      const data = validDashboardAlert();
      const result = validateDashboardAlert(data);
      expect(result.id).toBe('alert-001');
      expect(result.severity).toBe('high');
      expect(result.acknowledged).toBe(false);
    });

    it('accepts acknowledged alert', () => {
      const data = validDashboardAlert();
      data.acknowledged = true;
      const result = validateDashboardAlert(data);
      expect(result.acknowledged).toBe(true);
    });
  });

  describe('throws on invalid data', () => {
    it('throws on null input', () => {
      expect(() => validateDashboardAlert(null)).toThrow();
    });

    it('throws on undefined input', () => {
      expect(() => validateDashboardAlert(undefined)).toThrow();
    });

    it('throws on non-object input', () => {
      expect(() => validateDashboardAlert([])).toThrow();
    });
  });

  describe('handles severity levels', () => {
    it('accepts low severity', () => {
      const data = validDashboardAlert();
      data.severity = 'low';
      const result = validateDashboardAlert(data);
      expect(result.severity).toBe('low');
    });

    it('accepts medium severity', () => {
      const data = validDashboardAlert();
      data.severity = 'medium';
      const result = validateDashboardAlert(data);
      expect(result.severity).toBe('medium');
    });

    it('accepts high severity', () => {
      const data = validDashboardAlert();
      data.severity = 'high';
      const result = validateDashboardAlert(data);
      expect(result.severity).toBe('high');
    });

    it('accepts critical severity', () => {
      const data = validDashboardAlert();
      data.severity = 'critical';
      const result = validateDashboardAlert(data);
      expect(result.severity).toBe('critical');
    });

    it('throws on invalid severity', () => {
      const data = validDashboardAlert();
      data.severity = 'extreme' as any;
      expect(() => validateDashboardAlert(data)).toThrow();
    });

    it('throws when id is missing', () => {
      const data = validDashboardAlert();
      delete (data as any).id;
      expect(() => validateDashboardAlert(data)).toThrow();
    });

    it('throws when value is not a number', () => {
      const data = validDashboardAlert();
      (data as any).value = 'high';
      expect(() => validateDashboardAlert(data)).toThrow();
    });

    it('throws when threshold is missing', () => {
      const data = validDashboardAlert();
      delete (data as any).threshold;
      expect(() => validateDashboardAlert(data)).toThrow();
    });

    it('throws when acknowledged is not a boolean', () => {
      const data = validDashboardAlert();
      (data as any).acknowledged = 1;
      expect(() => validateDashboardAlert(data)).toThrow();
    });
  });
});

// ── Model Outputs ────────────────────────────────────────────────────────────

describe('validateModelOutput', () => {
  describe('validates correct data', () => {
    it('accepts a valid model output', () => {
      const data = validModelOutput();
      const result = validateModelOutput(data);
      expect(result.modelId).toBe('model-001');
      expect(result.confidence).toBe(0.95);
      expect(result.latencyMs).toBe(150);
    });

    it('accepts output without optional confidence', () => {
      const data = validModelOutput();
      delete data.confidence;
      const result = validateModelOutput(data);
      expect(result.confidence).toBeUndefined();
    });

    it('accepts output with zero confidence', () => {
      const data = validModelOutput();
      data.confidence = 0;
      const result = validateModelOutput(data);
      expect(result.confidence).toBe(0);
    });

    it('accepts output with confidence of 1', () => {
      const data = validModelOutput();
      data.confidence = 1;
      const result = validateModelOutput(data);
      expect(result.confidence).toBe(1);
    });
  });

  describe('throws on invalid data', () => {
    it('throws on null input', () => {
      expect(() => validateModelOutput(null)).toThrow();
    });

    it('throws on undefined input', () => {
      expect(() => validateModelOutput(undefined)).toThrow();
    });

    it('throws on non-object input', () => {
      expect(() => validateModelOutput(42)).toThrow();
    });
  });

  describe('handles confidence scores', () => {
    it('throws when modelId is missing', () => {
      const data = validModelOutput();
      delete (data as any).modelId;
      expect(() => validateModelOutput(data)).toThrow();
    });

    it('throws when modelId is not a string', () => {
      const data = validModelOutput();
      (data as any).modelId = 123;
      expect(() => validateModelOutput(data)).toThrow();
    });

    it('throws when latencyMs is missing', () => {
      const data = validModelOutput();
      delete (data as any).latencyMs;
      expect(() => validateModelOutput(data)).toThrow();
    });

    it('throws when latencyMs is not a number', () => {
      const data = validModelOutput();
      (data as any).latencyMs = 'slow';
      expect(() => validateModelOutput(data)).toThrow();
    });

    it('throws when confidence is not a number', () => {
      const data = validModelOutput();
      (data as any).confidence = 'high';
      expect(() => validateModelOutput(data)).toThrow();
    });

    it('throws when input is missing', () => {
      const data = validModelOutput();
      delete (data as any).input;
      expect(() => validateModelOutput(data)).toThrow();
    });

    it('throws when output is missing', () => {
      const data = validModelOutput();
      delete (data as any).output;
      expect(() => validateModelOutput(data)).toThrow();
    });
  });
});
