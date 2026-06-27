/**
 * Dashboard Event Schemas
 *
 * Type definitions and runtime validation functions for the streaming
 * dashboard. Covers current state, recent events, metric curves,
 * alert lists, and model outputs.
 *
 * All validation functions throw on invalid input and return typed
 * data on success.
 *
 * @module streaming/schemas
 */

// ── Current State Schema ─────────────────────────────────────────────────────

/**
 * Represents the current state of the streaming dashboard.
 * Contains system health status, connection counts, and live metrics.
 */
export interface DashboardState {
  /** Unix timestamp in milliseconds when this state was captured */
  timestamp: number;
  /** Overall system health status */
  status: "healthy" | "degraded" | "critical";
  /** Number of currently active WebSocket connections */
  activeConnections: number;
  /** List of active topic names with active subscribers */
  activeTopics: string[];
  /** Key-value pairs of current metric values (e.g. cpu, memory, latency) */
  metrics: Record<string, number>;
}

/**
 * Validate and return a DashboardState from untrusted input.
 *
 * Checks that all required fields exist with correct types and that
 * `status` is one of the three allowed values.
 *
 * @param data - Raw input to validate
 * @returns The validated DashboardState
 * @throws {Error} If any field is missing, has wrong type, or status is invalid
 */
export function validateDashboardState(data: unknown): DashboardState {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("DashboardState must be a non-null object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.timestamp !== "number") {
    throw new Error("DashboardState.timestamp must be a number");
  }
  const validStatuses = ["healthy", "degraded", "critical"];
  if (!validStatuses.includes(obj.status as string)) {
    throw new Error(`DashboardState.status must be one of: ${validStatuses.join(", ")}`);
  }
  if (typeof obj.activeConnections !== "number") {
    throw new Error("DashboardState.activeConnections must be a number");
  }
  if (!Array.isArray(obj.activeTopics)) {
    throw new Error("DashboardState.activeTopics must be an array");
  }
  for (let i = 0; i < obj.activeTopics.length; i++) {
    if (typeof obj.activeTopics[i] !== "string") {
      throw new Error(`DashboardState.activeTopics[${i}] must be a string`);
    }
  }
  if (obj.metrics == null || typeof obj.metrics !== "object" || Array.isArray(obj.metrics)) {
    throw new Error("DashboardState.metrics must be a non-null object");
  }
  for (const [key, value] of Object.entries(obj.metrics as Record<string, unknown>)) {
    if (typeof value !== "number") {
      throw new Error(`DashboardState.metrics.${key} must be a number`);
    }
  }

  return {
    timestamp: obj.timestamp as number,
    status: obj.status as DashboardState["status"],
    activeConnections: obj.activeConnections as number,
    activeTopics: obj.activeTopics as string[],
    metrics: obj.metrics as Record<string, number>,
  };
}

// ── Recent Events Schema ─────────────────────────────────────────────────────

/**
 * A single event in the dashboard event log.
 * Events track anomalies, threshold violations, connection changes,
 * subscription changes, and errors.
 */
export interface DashboardEvent {
  /** Unique event identifier */
  id: string;
  /** Unix timestamp in milliseconds when the event occurred */
  timestamp: number;
  /** Discriminator for the event category */
  type: "anomaly" | "threshold" | "connection" | "subscription" | "error";
  /** Severity level of the event */
  severity: "info" | "warning" | "error" | "critical";
  /** Human-readable description of the event */
  message: string;
  /** Optional additional data associated with the event */
  data?: unknown;
}

/**
 * Paginated collection of dashboard events.
 */
export interface DashboardEvents {
  /** Array of event records */
  events: DashboardEvent[];
  /** Total number of events matching the query (may exceed events.length) */
  total: number;
  /** Whether more events exist beyond the returned page */
  hasMore: boolean;
}

/**
 * Validate and return a DashboardEvent from untrusted input.
 *
 * Checks that all required fields exist with correct types and that
 * `type` and `severity` are within their allowed values.
 *
 * @param data - Raw input to validate
 * @returns The validated DashboardEvent
 * @throws {Error} If any field is missing, has wrong type, or enum value is invalid
 */
export function validateDashboardEvent(data: unknown): DashboardEvent {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("DashboardEvent must be a non-null object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string") {
    throw new Error("DashboardEvent.id must be a string");
  }
  if (typeof obj.timestamp !== "number") {
    throw new Error("DashboardEvent.timestamp must be a number");
  }
  const validTypes = ["anomaly", "threshold", "connection", "subscription", "error"];
  if (!validTypes.includes(obj.type as string)) {
    throw new Error(`DashboardEvent.type must be one of: ${validTypes.join(", ")}`);
  }
  const validSeverities = ["info", "warning", "error", "critical"];
  if (!validSeverities.includes(obj.severity as string)) {
    throw new Error(`DashboardEvent.severity must be one of: ${validSeverities.join(", ")}`);
  }
  if (typeof obj.message !== "string") {
    throw new Error("DashboardEvent.message must be a string");
  }

  const event: DashboardEvent = {
    id: obj.id as string,
    timestamp: obj.timestamp as number,
    type: obj.type as DashboardEvent["type"],
    severity: obj.severity as DashboardEvent["severity"],
    message: obj.message as string,
  };
  if (obj.data !== undefined) {
    event.data = obj.data;
  }
  return event;
}

// ── Metric Curve Data Schema ─────────────────────────────────────────────────

/**
 * A single timestamped data point on a metric curve.
 */
export interface MetricPoint {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Metric value at this point */
  value: number;
}

/**
 * A named metric curve with time-series data and optional bounds.
 */
export interface MetricCurve {
  /** Metric name (e.g. 'cpu_usage', 'memory_bytes') */
  metric: string;
  /** Ordered array of data points (ascending by timestamp) */
  points: MetricPoint[];
  /** Optional unit label (e.g. '%', 'MB', 'ms') */
  unit?: string;
  /** Optional minimum bound for display axis */
  min?: number;
  /** Optional maximum bound for display axis */
  max?: number;
}

/**
 * Collection of metric curves with a time range for the dashboard view.
 */
export interface DashboardMetrics {
  /** Array of metric curves to display */
  curves: MetricCurve[];
  /** Time window for the dashboard view */
  timeRange: { start: number; end: number };
}

/**
 * Validate and return a MetricCurve from untrusted input.
 *
 * Checks that `metric` is a string, `points` is an array, and each
 * point has numeric `timestamp` and `value` fields.
 *
 * @param data - Raw input to validate
 * @returns The validated MetricCurve
 * @throws {Error} If any field is missing, has wrong type, or points contain invalid entries
 */
export function validateMetricCurve(data: unknown): MetricCurve {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("MetricCurve must be a non-null object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.metric !== "string") {
    throw new Error("MetricCurve.metric must be a string");
  }
  if (!Array.isArray(obj.points)) {
    throw new Error("MetricCurve.points must be an array");
  }

  // Validate each point
  for (let i = 0; i < obj.points.length; i++) {
    const point = obj.points[i];
    if (point == null || typeof point !== "object") {
      throw new Error(`MetricCurve.points[${i}] must be a non-null object`);
    }
    const pt = point as Record<string, unknown>;
    if (typeof pt.timestamp !== "number") {
      throw new Error(`MetricCurve.points[${i}].timestamp must be a number`);
    }
    if (typeof pt.value !== "number") {
      throw new Error(`MetricCurve.points[${i}].value must be a number`);
    }
  }

  const curve: MetricCurve = {
    metric: obj.metric as string,
    points: obj.points as MetricPoint[],
  };
  if (obj.unit !== undefined) {
    curve.unit = obj.unit as string;
  }
  if (obj.min !== undefined) {
    curve.min = obj.min as number;
  }
  if (obj.max !== undefined) {
    curve.max = obj.max as number;
  }
  return curve;
}

// ── Alert List Schema ────────────────────────────────────────────────────────

/**
 * A dashboard alert triggered by a metric exceeding a threshold.
 */
export interface DashboardAlert {
  /** Unique alert identifier */
  id: string;
  /** Unix timestamp in milliseconds when the alert was triggered */
  timestamp: number;
  /** The metric that triggered the alert */
  metric: string;
  /** The actual value that exceeded the threshold */
  value: number;
  /** The threshold value that was exceeded */
  threshold: number;
  /** Severity level assigned to this alert */
  severity: "low" | "medium" | "high" | "critical";
  /** Human-readable description of the alert */
  message: string;
  /** Whether a user has acknowledged this alert */
  acknowledged: boolean;
}

/**
 * Paginated collection of dashboard alerts with unacknowledged count.
 */
export interface DashboardAlerts {
  /** Array of alert records */
  alerts: DashboardAlert[];
  /** Number of alerts that have not been acknowledged */
  unacknowledgedCount: number;
}

/**
 * Validate and return a DashboardAlert from untrusted input.
 *
 * Checks that all required fields exist with correct types and that
 * `severity` is one of the four allowed values.
 *
 * @param data - Raw input to validate
 * @returns The validated DashboardAlert
 * @throws {Error} If any field is missing, has wrong type, or severity is invalid
 */
export function validateDashboardAlert(data: unknown): DashboardAlert {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("DashboardAlert must be a non-null object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string") {
    throw new Error("DashboardAlert.id must be a string");
  }
  if (typeof obj.timestamp !== "number") {
    throw new Error("DashboardAlert.timestamp must be a number");
  }
  if (typeof obj.metric !== "string") {
    throw new Error("DashboardAlert.metric must be a string");
  }
  if (typeof obj.value !== "number") {
    throw new Error("DashboardAlert.value must be a number");
  }
  if (typeof obj.threshold !== "number") {
    throw new Error("DashboardAlert.threshold must be a number");
  }
  const validSeverities = ["low", "medium", "high", "critical"];
  if (!validSeverities.includes(obj.severity as string)) {
    throw new Error(`DashboardAlert.severity must be one of: ${validSeverities.join(", ")}`);
  }
  if (typeof obj.message !== "string") {
    throw new Error("DashboardAlert.message must be a string");
  }
  if (typeof obj.acknowledged !== "boolean") {
    throw new Error("DashboardAlert.acknowledged must be a boolean");
  }

  return {
    id: obj.id as string,
    timestamp: obj.timestamp as number,
    metric: obj.metric as string,
    value: obj.value as number,
    threshold: obj.threshold as number,
    severity: obj.severity as DashboardAlert["severity"],
    message: obj.message as string,
    acknowledged: obj.acknowledged as boolean,
  };
}

// ── Model Output Schema ──────────────────────────────────────────────────────

/**
 * A single inference output from a machine learning model.
 */
export interface ModelOutput {
  /** Unix timestamp in milliseconds when the inference completed */
  timestamp: number;
  /** Identifier of the model that produced this output */
  modelId: string;
  /** The input data fed to the model */
  input: unknown;
  /** The output data produced by the model */
  output: unknown;
  /** Optional confidence score (0-1 range, higher = more confident) */
  confidence?: number;
  /** Inference latency in milliseconds */
  latencyMs: number;
}

/**
 * Paginated collection of model outputs.
 */
export interface DashboardModelOutputs {
  /** Array of model output records */
  outputs: ModelOutput[];
  /** Total number of outputs matching the query */
  total: number;
}

/**
 * Validate and return a ModelOutput from untrusted input.
 *
 * Checks that all required fields exist with correct types. The `confidence`
 * field is optional but must be a number when present.
 *
 * @param data - Raw input to validate
 * @returns The validated ModelOutput
 * @throws {Error} If any field is missing or has wrong type
 */
export function validateModelOutput(data: unknown): ModelOutput {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("ModelOutput must be a non-null object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.timestamp !== "number") {
    throw new Error("ModelOutput.timestamp must be a number");
  }
  if (typeof obj.modelId !== "string") {
    throw new Error("ModelOutput.modelId must be a string");
  }
  if (obj.input === undefined) {
    throw new Error("ModelOutput.input is required");
  }
  if (obj.output === undefined) {
    throw new Error("ModelOutput.output is required");
  }
  if (typeof obj.latencyMs !== "number") {
    throw new Error("ModelOutput.latencyMs must be a number");
  }
  if (obj.confidence !== undefined && typeof obj.confidence !== "number") {
    throw new Error("ModelOutput.confidence must be a number when provided");
  }

  const result: ModelOutput = {
    timestamp: obj.timestamp as number,
    modelId: obj.modelId as string,
    input: obj.input,
    output: obj.output,
    latencyMs: obj.latencyMs as number,
  };
  if (obj.confidence !== undefined) {
    result.confidence = obj.confidence as number;
  }
  return result;
}
