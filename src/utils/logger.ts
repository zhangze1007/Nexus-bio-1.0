/**
 * Structured JSON logger for Nexus-Bio API routes.
 *
 * Replaces raw console.* calls with structured, machine-parseable log entries.
 * Each entry includes: timestamp, level, message, request ID (when available),
 * and arbitrary context fields.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.info('FBA solved', { requestId, species: 'ecoli', iterations: 42 });
 *   logger.error('Provider failed', { requestId, provider: 'groq', error: err.message });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.debug(formatted);
      }
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
};

/**
 * Extract the request ID from a Request object's headers.
 * The middleware sets X-Request-Id on every API request.
 */
export function getRequestId(headers: Headers): string {
  return headers.get("x-request-id") || `local_${Date.now().toString(36)}`;
}
