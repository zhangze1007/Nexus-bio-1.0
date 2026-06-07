'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Client-side wrapper for Auth.js SessionProvider.
 * Must be a client component since SessionProvider uses React context.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
