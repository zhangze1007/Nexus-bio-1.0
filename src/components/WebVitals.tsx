'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Web Vitals performance monitoring component.
 *
 * Captures Core Web Vitals (LCP, FID, CLS, TTFB, INP, FCP) via Next.js
 * built-in useReportWebVitals hook. In development, metrics are logged to
 * the console. In production, they are sent to /api/analytics for further
 * processing (Vercel Analytics also captures these automatically).
 */

/** Minimal type matching Next.js internal Metric shape. */
interface WebVitalMetric {
  id: string;
  name: string;
  startTime: number;
  value: number;
  label: 'web-vital' | 'custom';
  attribution?: Record<string, unknown>;
}

const ANALYTICS_ENDPOINT = '/api/analytics';

/** Only send the five CWV fields that matter for RUM. */
const CORE_VITALS = new Set(['LCP', 'FID', 'CLS', 'TTFB', 'INP', 'FCP']);

function reportMetric(metric: WebVitalMetric): void {
  // Only report core web vitals (skip Next.js custom metrics like hydration)
  if (!CORE_VITALS.has(metric.name)) return;

  const body = JSON.stringify({
    metric: metric.name,
    value: metric.value,
    id: metric.id,
    startTime: metric.startTime,
    attribution: metric.attribution,
    // Add context
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: Date.now(),
  });

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(
      `[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}`,
      metric,
    );
  }

  // In production, beacon the data to the analytics endpoint.
  // Use sendBeacon for non-blocking delivery that survives page unload.
  if (process.env.NODE_ENV === 'production' && typeof navigator !== 'undefined') {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
    } else {
      // Fallback to fetch for environments without sendBeacon
      fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // Silently ignore analytics failures — never block the user
      });
    }
  }
}

export default function WebVitals() {
  useReportWebVitals(reportMetric);
  return null;
}
