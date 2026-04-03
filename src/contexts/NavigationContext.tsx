'use client';
/**
 * NavigationContext — Unified back-navigation for all Nexus-Bio pages.
 *
 * Rule:
 *   • If current path is /tools/*  → back goes to /tools
 *   • If current path is /tools    → back goes to /
 *   • Otherwise                    → back goes to /
 *
 * All "back" buttons MUST use `handleBack()` from this context
 * instead of hardcoding `<Link href="/">`.
 */

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface NavigationContextValue {
  /** Navigate to the correct parent route based on current pathname. */
  handleBack: () => void;
  /** The resolved back-navigation target path. */
  backHref: string;
}

const NavigationContext = createContext<NavigationContextValue>({
  handleBack: () => {},
  backHref: '/',
});

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const backHref = resolveBackHref(pathname);

  const handleBack = useCallback(() => {
    router.push(backHref);
  }, [router, backHref]);

  return (
    <NavigationContext.Provider value={{ handleBack, backHref }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}

/**
 * Determine the correct "back" target based on the current pathname.
 *
 * /tools/cethx        → /tools
 * /tools/metabolic-eng → /tools
 * /tools               → /
 * /analyze             → /
 * /                    → /
 */
function resolveBackHref(pathname: string): string {
  if (!pathname) return '/';
  const segments = pathname.split('/').filter(Boolean);

  // /tools/[toolId] → /tools
  if (segments[0] === 'tools' && segments.length >= 2) {
    return '/tools';
  }

  // Everything else → /
  return '/';
}
