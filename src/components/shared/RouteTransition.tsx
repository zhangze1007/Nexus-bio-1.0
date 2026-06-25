"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Route transition wrapper — provides smooth page enter/exit animations.
 * Uses the same easing as Hero.tsx for consistency.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        style={{ minHeight: "100%", display: "flex", flexDirection: "column", flex: 1 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
