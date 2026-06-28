/**
 * Structured JSON logger for Nexus-Bio API routes.
 *
 * Replaces raw console.* calls with structured, machine-parseable log entries.
 * Each entry includes: timestamp, level, message, context, and request ID
 * (when available).
 *
 * Usage (singleton — backward compatible):
 *   import { logger } from '@/utils/logger';
 *   logger.info('FBA solved', { requestId, species: 'ecoli', iterations: 42 });
 *
 * Usage (scoped logger with context):
 *   import { createLogger } from '@/utils/logger';
 *   const log = createLogger('fba-engine');
 *   log.info('Simplex converged', { requestId, iterations: 42 });
 *   log.error('Provider failed', { requestId, provider: 'groq', error: err.message });
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
}

// ─── Internals ──────────────────────────────────────────────────────────────

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function formatDev(entry: LogEntry): string {
  const { timestamp, level, message, context, requestId, ...rest } = entry;
  const prefix = `[${timestamp}] ${level.toUpperCase().padEnd(5)}`;
  const ctx = context ? ` [${context}]` : "";
  const req = requestId ? ` (${requestId})` : "";
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `${prefix}${ctx}${req} ${message}${extra}`;
}

function emit(level: LogLevel, entry: LogEntry): void {
  const formatted = isProduction() ? JSON.stringify(entry) : formatDev(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "debug":
      // Debug is suppressed in production
      if (!isProduction()) {
        console.debug(formatted);
      }
      break;
    default:
      console.log(formatted);
  }
}

function buildEntry(
  level: LogLevel,
  message: string,
  contextLabel: string | undefined,
  extra?: Record<string, unknown>,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (contextLabel) {
    entry.context = contextLabel;
  }

  if (extra) {
    Object.assign(entry, extra);
  }

  return entry;
}

// ─── createLogger (scoped) ──────────────────────────────────────────────────

/**
 * Create a scoped logger that automatically attaches a `context` label
 * to every log entry. Use this for per-module or per-route logging.
 *
 * @param context  A short label identifying the subsystem (e.g. "fba-engine", "analyze-route").
 * @returns A Logger with debug/info/warn/error methods.
 */
export function createLogger(context: string): Logger {
  return {
    debug: (message: string, extra?: Record<string, unknown>) =>
      emit("debug", buildEntry("debug", message, context, extra)),
    info: (message: string, extra?: Record<string, unknown>) =>
      emit("info", buildEntry("info", message, context, extra)),
    warn: (message: string, extra?: Record<string, unknown>) =>
      emit("warn", buildEntry("warn", message, context, extra)),
    error: (message: string, extra?: Record<string, unknown>) =>
      emit("error", buildEntry("error", message, context, extra)),
  };
}

// ─── Singleton (backward compatible) ────────────────────────────────────────

/**
 * Singleton logger — backward compatible with existing imports.
 * No automatic context label.
 */
export const logger: Logger = {
  debug: (message: string, extra?: Record<string, unknown>) =>
    emit("debug", buildEntry("debug", message, undefined, extra)),
  info: (message: string, extra?: Record<string, unknown>) =>
    emit("info", buildEntry("info", message, undefined, extra)),
  warn: (message: string, extra?: Record<string, unknown>) =>
    emit("warn", buildEntry("warn", message, undefined, extra)),
  error: (message: string, extra?: Record<string, unknown>) =>
    emit("error", buildEntry("error", message, undefined, extra)),
};

/**
 * Extract the request ID from a Request object's headers.
 * The middleware sets X-Request-Id on every API request.
 */
export function getRequestId(headers: Headers): string {
  return headers.get("x-request-id") || `local_${Date.now().toString(36)}`;
}
