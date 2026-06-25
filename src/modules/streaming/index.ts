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

export {
  AnomalyDetector,
  checkThreshold,
  detectRobustZScoreAnomaly,
  detectZScoreAnomaly,
  SlidingWindow,
} from "./anomaly";
export { BufferQueue, composeStages, StreamingPipeline } from "./pipeline";
export type {
  DashboardAlert,
  DashboardAlerts,
  DashboardEvent,
  DashboardEvents,
  DashboardMetrics,
  DashboardModelOutputs,
  DashboardState,
  MetricCurve,
  MetricPoint,
  ModelOutput,
} from "./schemas";
export {
  validateDashboardAlert,
  validateDashboardEvent,
  validateDashboardState,
  validateMetricCurve,
  validateModelOutput,
} from "./schemas";
export { StreamingServer } from "./server";
export type {
  AnomalyEvent,
  ClientInfo,
  MessageType,
  PipelineOptions,
  PipelineStage,
  Severity,
  StreamingMessage,
  StreamingOptions,
  StreamingStack,
  StreamingStackOptions,
  ThresholdRule,
} from "./types";

// ── Imports for factory functions ────────────────────────────────────────────

import { AnomalyDetector } from "./anomaly";
import { StreamingPipeline } from "./pipeline";
import { StreamingServer } from "./server";
import type { StreamingStack, StreamingStackOptions } from "./types";

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
    if (data && typeof data.metric === "string" && typeof data.value === "number") {
      const anomalies = detector.check({ metric: data.metric, value: data.value });
      for (const anomaly of anomalies) {
        server.publish("anomalies", anomaly);
      }
    }

    return result;
  };

  // Also wire processNext() — it calls this.processItem() directly, bypassing process()
  const originalProcessNext = pipeline.processNext.bind(pipeline);
  pipeline.processNext = async () => {
    const result = await originalProcessNext();
    if (result !== undefined && result && typeof result.metric === "string" && typeof result.value === "number") {
      const anomalies = detector.check({ metric: result.metric, value: result.value });
      for (const anomaly of anomalies) {
        server.publish("anomalies", anomaly);
      }
    }
    return result;
  };

  return { server, pipeline, detector };
}

/**
 * Create a fully configured streaming stack with default stages and anomaly rules.
 *
 * Includes:
 *   - Pipeline stages: 'validate' (rejects non-objects), 'timestamp' (adds missing timestamps)
 *   - Anomaly rules: CPU > 90% (high), Memory > 85% (medium)
 *   - Wiring: pipeline → detector → server auto-publish
 *
 * @returns A StreamingStack with default configuration, ready to start
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
    name: "validate",
    process: async (data) => {
      if (!data || typeof data !== "object") {
        throw new Error("Invalid data: must be an object");
      }
      return data;
    },
  });

  stack.pipeline.addStage({
    name: "timestamp",
    process: async (data) => ({
      ...data,
      timestamp: data.timestamp || Date.now(),
    }),
  });

  // Add default anomaly rules
  stack.detector.addRule({
    metric: "cpu",
    max: 90,
    severity: "high",
    message: "CPU usage exceeded 90%",
  });

  stack.detector.addRule({
    metric: "memory",
    max: 85,
    severity: "medium",
    message: "Memory usage exceeded 85%",
  });

  return stack;
}
