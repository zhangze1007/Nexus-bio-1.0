/**
 * Streaming Module — Public API
 *
 * WebSocket-based real-time streaming with pub/sub messaging.
 * Includes streaming pipeline with backpressure-aware buffer queue
 * and real-time anomaly detection with z-score and threshold-based alerts.
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
