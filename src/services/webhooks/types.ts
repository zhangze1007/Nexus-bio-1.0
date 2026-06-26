/**
 * Webhook System Types
 *
 * Defines the data structures for webhook subscriptions and delivery tracking.
 * Used by the webhook dispatcher and API routes.
 */

/** Supported webhook event types. */
export type WebhookEventType =
  | "experiment.complete"
  | "milestone.reached"
  | "task.assigned"
  | "inventory.alert";

/** All valid event types as a set for validation. */
export const VALID_WEBHOOK_EVENTS: ReadonlySet<string> = new Set<WebhookEventType>([
  "experiment.complete",
  "milestone.reached",
  "task.assigned",
  "inventory.alert",
]);

/** A registered webhook subscription. */
export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  createdAt: string;
}

/** Delivery attempt record for a webhook event. */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: "pending" | "delivered" | "failed";
  responseCode?: number;
  responseBody?: string;
  deliveredAt?: string;
  retryCount: number;
  nextRetryAt?: string;
}

/** Retry schedule: delays in milliseconds for exponential backoff. */
export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000,     // 1 minute
  300_000,    // 5 minutes
  1_800_000,  // 30 minutes
] as const;

/** Maximum number of retry attempts before giving up. */
export const WEBHOOK_MAX_RETRIES = WEBHOOK_RETRY_DELAYS_MS.length;

/** HTTP timeout for webhook delivery attempts (10 seconds). */
export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;
