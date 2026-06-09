'use client';

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Route transition wrapper — provides smooth page enter/exit animations.
 * Uses the same easing as Hero.tsx for consistency.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
