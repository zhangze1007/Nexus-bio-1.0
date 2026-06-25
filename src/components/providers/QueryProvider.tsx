"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * React Query provider for Nexus-Bio.
 *
 * Cache configuration:
 *   - staleTime:  5 min  — data considered fresh; no background refetch
 *   - gcTime:    10 min  — unused cache entries garbage-collected after this
 *   - retry:      2      — failed queries/mutations retry twice before erroring
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 2,
          },
          mutations: {
            retry: 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
