/**
 * Streaming Module — Public API
 *
 * WebSocket-based real-time streaming with pub/sub messaging.
 * Includes streaming pipeline with backpressure-aware buffer queue
 * and real-time anomaly detection with z-score and threshold-based alerts.
 * Dashboard event schemas with runtime validation for state, events,
 * metric curves, alerts, and model outputs.
 */

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
