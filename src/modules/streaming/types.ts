/**
 * Streaming Module Types
 *
 * Type definitions for the WebSocket-based real-time streaming server.
 * Supports publish/subscribe messaging, heartbeat monitoring, and
 * session identification for connected clients.
 */

/** Message types supported by the streaming protocol */
export type MessageType = 'subscribe' | 'unsubscribe' | 'publish' | 'heartbeat' | 'error';

/**
 * Standard message format for all streaming communication.
 * Every message exchanged between client and server uses this shape.
 */
export interface StreamingMessage {
  /** Message type discriminator */
  type: MessageType;
  /** Topic name (required for subscribe/unsubscribe/publish) */
  topic?: string;
  /** Payload data (required for publish, optional for error details) */
  data?: unknown;
  /** Client identifier (set by server on connection, or sent by client to claim custom ID) */
  clientId?: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Configuration options for StreamingServer.
 */
export interface StreamingOptions {
  /** Port number to listen on (default: 8080) */
  port?: number;
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval?: number;
}

/**
 * Internal metadata tracked for each connected client.
 */
export interface ClientInfo {
  /** Unique client identifier */
  id: string;
  /** Set of topics the client is subscribed to */
  topics: Set<string>;
  /** Timestamp of the last received heartbeat response */
  lastHeartbeat: number;
}

// ── Anomaly Detection Types ──────────────────────────────────────────────────

/** Severity levels for anomaly events */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * An event emitted when an anomaly is detected.
 * Contains the triggering value, the metric it belongs to,
 * and contextual information about why the anomaly was flagged.
 */
export interface AnomalyEvent {
  /** Unix timestamp in milliseconds when the anomaly was detected */
  timestamp: number;
  /** The metric name that triggered the anomaly */
  metric: string;
  /** The actual value that was flagged */
  value: number;
  /** The threshold value that was violated (if threshold-based) */
  threshold?: number;
  /** The computed z-score (if z-score-based detection) */
  zScore?: number;
  /** Severity level of the anomaly */
  severity: Severity;
  /** Human-readable reason for the anomaly */
  reason: string;
  /** Snapshot of the sliding window statistics at the time of detection */
  windowStats?: {
    mean: number;
    std: number;
    count: number;
  };
}

/**
 * A rule that defines acceptable bounds for a metric.
 * When a value falls outside [min, max], an anomaly event is generated
 * with the configured severity and message.
 */
export interface ThresholdRule {
  /** The metric name this rule applies to */
  metric: string;
  /** Minimum acceptable value (inclusive). If omitted, no lower bound. */
  min?: number;
  /** Maximum acceptable value (inclusive). If omitted, no upper bound. */
  max?: number;
  /** Severity to assign when this rule is violated */
  severity: Severity;
  /** Human-readable description of what this rule checks */
  message: string;
}

// ── Pipeline Types ───────────────────────────────────────────────────────────

/**
 * A single processing stage in a streaming pipeline.
 * Receives input data and returns transformed output.
 */
export interface PipelineStage {
  /** Human-readable stage name (used for identification and ordering) */
  name: string;
  /** Async processing function that transforms data */
  process: (data: any) => Promise<any>;
}

/**
 * Configuration options for StreamingPipeline.
 */
export interface PipelineOptions {
  /** Maximum number of items in the buffer queue (default: 100) */
  bufferSize?: number;
  /** Threshold at which backpressure is applied (default: bufferSize) */
  backpressureThreshold?: number;
}
