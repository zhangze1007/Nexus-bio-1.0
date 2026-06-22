/**
 * Streaming Module — Public API
 *
 * WebSocket-based real-time streaming with pub/sub messaging.
 * Includes streaming pipeline with backpressure-aware buffer queue
 * and real-time anomaly detection with z-score and threshold-based alerts.
 * Dashboard event schemas with runtime validation for state, events,
 * metric curves, alerts, and model outputs.
 *
 * Provides factory functions to create fully wired streaming stacks
 * that connect server, pipeline, and anomaly detector into a single
 * ready-to-use unit.
 *
 * @module streaming
 */

// ── Re-exports ───────────────────────────────────────────────────────────────

export { StreamingServer } from './server';
export { StreamingPipeline, BufferQueue, composeStages } from './pipeline';
export {
  SlidingWindow,
  checkThreshold,
  detectZScoreAnomaly,
  detectRobustZScoreAnomaly,
  AnomalyDetector,
} from './anomaly';
export {
  validateDashboardState,
  validateDashboardEvent,
  validateMetricCurve,
  validateDashboardAlert,
  validateModelOutput,
} from './schemas';
export type {
  StreamingMessage,
  StreamingOptions,
  MessageType,
  ClientInfo,
  PipelineStage,
  PipelineOptions,
  AnomalyEvent,
  ThresholdRule,
  Severity,
  StreamingStackOptions,
  StreamingStack,
} from './types';
export type {
  DashboardState,
  DashboardEvent,
  DashboardEvents,
  MetricPoint,
  MetricCurve,
  DashboardMetrics,
  DashboardAlert,
  DashboardAlerts,
  ModelOutput,
  DashboardModelOutputs,
} from './schemas';

// ── Imports for factory functions ────────────────────────────────────────────

import { StreamingServer } from './server';
import { StreamingPipeline } from './pipeline';
import { AnomalyDetector } from './anomaly';
import type { StreamingStackOptions, StreamingStack } from './types';

// ── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a fully configured streaming stack with server, pipeline, and anomaly detector.
 *
 * Wires the three components together:
 * - Creates a StreamingServer on the specified port
 * - Creates a StreamingPipeline with the specified buffer size
 * - Creates an AnomalyDetector with the specified window size and z-score threshold
 *
 * The caller is responsible for starting the server and adding pipeline stages.
 *
 * @param options - Optional configuration for the stack components
 * @param options.serverPort - Port for the WebSocket server (default: 8080)
 * @param options.bufferSize - Pipeline buffer queue size (default: 100)
 * @param options.windowSize - Anomaly detector sliding window size (default: 100)
 * @param options.zScoreThreshold - |z-score| threshold for anomaly flagging (default: 3)
 * @returns A StreamingStack containing the server, pipeline, and detector
 *
 * @example
 * ```ts
 * const stack = createStreamingStack({ serverPort: 9090, zScoreThreshold: 2.5 });
 * stack.pipeline.addStage({ name: 'parse', process: async (d) => JSON.parse(d) });
 * stack.detector.addRule({ metric: 'flux', min: 0, max: 100, severity: 'high', message: 'Flux out of range' });
 * await stack.server.start();
 * ```
 */
export function createStreamingStack(options?: StreamingStackOptions): StreamingStack {
  const serverPort = options?.serverPort ?? 8080;
  const bufferSize = options?.bufferSize ?? 100;
  const windowSize = options?.windowSize ?? 100;
  const zScoreThreshold = options?.zScoreThreshold ?? 3;

  const server = new StreamingServer({ port: serverPort });
  const pipeline = new StreamingPipeline({ bufferSize });
  const detector = new AnomalyDetector({ windowSize, zScoreThreshold });

  // Wire pipeline to detector: when pipeline processes data, check for anomalies
  const originalProcess = pipeline.process.bind(pipeline);
  pipeline.process = async (data: any) => {
    const result = await originalProcess(data);

    // Check for anomalies if data has metric and value
    if (data && typeof data.metric === 'string' && typeof data.value === 'number') {
      const anomalies = detector.check({ metric: data.metric, value: data.value });
      if (anomalies.length > 0) {
        // Publish anomalies to server
        for (const anomaly of anomalies) {
          server.publish('anomalies', anomaly);
        }
      }
    }

    return result;
  };

  return { server, pipeline, detector };
}

/**
 * Create a streaming stack with sensible default configuration.
 *
 * Equivalent to calling `createStreamingStack()` with no arguments.
 * Returns a ready-to-use stack where:
 * - Server listens on port 8080 with 30s heartbeat
 * - Pipeline has a 100-item buffer queue
 * - Detector uses a 100-sample sliding window with z-score threshold of 3
 *
 * The caller should add pipeline stages and threshold rules before starting.
 *
 * @returns A StreamingStack with default configuration
 *
 * @example
 * ```ts
 * const stack = createDefaultStreamingStack();
 * stack.detector.addRule({
 *   metric: 'ph',
 *   min: 6,
 *   max: 8,
 *   severity: 'critical',
 *   message: 'pH out of physiological range',
 * });
 * await stack.server.start();
 * ```
 */
export function createDefaultStreamingStack(): StreamingStack {
  const stack = createStreamingStack();

  // Add default pipeline stages
  stack.pipeline.addStage({
    name: 'validate',
    process: async (data) => {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data: must be an object');
      }
      return data;
    },
  });

  stack.pipeline.addStage({
    name: 'timestamp',
    process: async (data) => ({
      ...data,
      timestamp: data.timestamp || Date.now(),
    }),
  });

  // Add default anomaly rules
  stack.detector.addRule({
    metric: 'cpu',
    max: 90,
    severity: 'high',
    message: 'CPU usage exceeded 90%',
  });

  stack.detector.addRule({
    metric: 'memory',
    max: 85,
    severity: 'medium',
    message: 'Memory usage exceeded 85%',
  });

  return stack;
}
