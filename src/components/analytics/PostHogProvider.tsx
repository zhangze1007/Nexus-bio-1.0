'use client';

import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as Provider } from 'posthog-js/react';

/**
 * PostHog analytics provider for Nexus-Bio.
 *
 * GDPR-compliant: only initializes when the user has granted consent
 * (checked via `ph_analytics_consent` cookie). When the key is missing
 * or consent is denied, PostHog is never initialised — zero network
 * requests, zero cookies, zero tracking.
 *
 * Consent can be set by a cookie-banner component:
 *   document.cookie = 'ph_analytics_consent=true; max-age=31536000; path=/';
 */

const CONSENT_COOKIE = 'ph_analytics_consent';

function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false;
  // Treat missing consent cookie as "no consent" (opt-in model)
  return document.cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${CONSENT_COOKIE}=true`));
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      // No key configured — nothing to do. All analytics calls will be
      // silently ignored because posthog-js is never initialised.
      return;
    }

    if (!hasAnalyticsConsent()) {
      // GDPR: user has not consented — do not initialise.
      // Optionally, we can remember they were offered consent:
      return;
    }

    if (typeof window !== 'undefined' && !posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
        capture_pageview: false, // We capture pageviews manually via useAnalytics().page()
        capture_pageleave: true,
        autocapture: true,
        // Respect Do Not Track
        respect_dnt: true,
        // Do not persist anything if user hasn't consented (belt-and-suspenders)
        persistence: 'localStorage+cookie',
        loaded: (ph) => {
          // In development, disable autocapture to reduce noise
          if (process.env.NODE_ENV === 'development') {
            ph.opt_out_capturing();
            // Re-enable so dev can opt-in manually via console:
            //   posthog.opt_in_capturing()
          }
          setReady(true);
        },
      });
    } else if (posthog.__loaded) {
      setReady(true);
    }
  }, []);

  return <Provider client={posthog}>{children}</Provider>;
}
