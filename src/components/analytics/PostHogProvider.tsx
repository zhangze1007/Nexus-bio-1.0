"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * PostHog analytics provider for Nexus-Bio.
 *
 * GDPR-compliant: only initializes when the user has granted consent
 * (checked via `ph_analytics_consent` cookie). When the key is missing
 * or consent is denied, PostHog is never initialised — zero network
 * requests, zero cookies, zero tracking.
 *
 * Performance: posthog-js (~80KB gzipped) is dynamically imported only
 * after consent is confirmed, avoiding unnecessary bundle download.
 */

const CONSENT_COOKIE = "ph_analytics_consent";

function hasAnalyticsConsent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${CONSENT_COOKIE}=true`));
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const providerRef = useRef<React.ComponentType<{ children: ReactNode }> | null>(null);
  const posthogRef = useRef<unknown>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (!hasAnalyticsConsent()) return;

    let cancelled = false;

    import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;

      if (typeof window !== "undefined" && !posthog.__loaded) {
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
          capture_pageview: false,
          capture_pageleave: true,
          autocapture: true,
          respect_dnt: true,
          persistence: "localStorage+cookie",
          loaded: (ph: { opt_out_capturing: () => void }) => {
            if (process.env.NODE_ENV === "development") {
              ph.opt_out_capturing();
            }
            posthogRef.current = posthog;
            // Dynamic import the React provider
            import("posthog-js/react").then(({ PostHogProvider: PHP }) => {
              if (cancelled) return;
              providerRef.current = PHP as unknown as React.ComponentType<{ children: ReactNode }>;
              setReady(true);
            });
          },
        });
      } else if (posthog.__loaded) {
        posthogRef.current = posthog;
        import("posthog-js/react").then(({ PostHogProvider: PHP }) => {
          if (cancelled) return;
          providerRef.current = PHP as unknown as React.ComponentType<{ children: ReactNode }>;
          setReady(true);
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !providerRef.current) return <>{children}</>;

  const Provider = providerRef.current;
  return <Provider>{children}</Provider>;
}
