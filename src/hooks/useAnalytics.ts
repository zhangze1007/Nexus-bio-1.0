'use client';

import { useCallback } from 'react';
import posthog from 'posthog-js';

/**
 * Analytics hook for Nexus-Bio.
 *
 * When PostHog is not initialised (no key, no consent, or SSR), every call
 * is a safe no-op — no errors, no network requests, no side-effects.
 *
 * Usage:
 *   const { track, identify, page } = useAnalytics();
 *   track(EVENTS.FBA_RUN, { model: 'iJO1366', reactions: 83 });
 */

function isReady(): boolean {
  return typeof window !== 'undefined' && !!posthog.__loaded;
}

export function useAnalytics() {
  const track = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      if (!isReady()) return;
      posthog.capture(event, properties);
    },
    [],
  );

  const identify = useCallback(
    (userId: string, properties?: Record<string, unknown>) => {
      if (!isReady()) return;
      posthog.identify(userId, properties);
    },
    [],
  );

  const page = useCallback(
    (name: string, properties?: Record<string, unknown>) => {
      if (!isReady()) return;
      posthog.capture('$pageview', { $current_url: name, ...properties });
    },
    [],
  );

  return { track, identify, page };
}

/**
 * Pre-defined analytics events.
 *
 * Centralising event names prevents typos and makes it easy to search
 * the codebase for every place an event is fired.
 */
export const EVENTS = {
  /** User opened a tool page */
  TOOL_OPENED: 'tool_opened',
  /** User created a new experiment record */
  EXPERIMENT_CREATED: 'experiment_created',
  /** User ran an FBA simulation */
  FBA_RUN: 'fba_run',
  /** User sent a query to the AI assistant */
  AI_QUERY: 'ai_query',
  /** User created a task */
  TASK_CREATED: 'task_created',
  /** User created an inventory item */
  INVENTORY_ITEM_CREATED: 'inventory_item_created',
  /** User generated a share link */
  SHARE_LINK_CREATED: 'share_link_created',
  /** User signed up */
  SIGN_UP: 'sign_up',
  /** User logged in */
  LOGIN: 'login',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
