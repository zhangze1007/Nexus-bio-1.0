'use client';

import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ToolTabPanelProps {
  tabId: string;
  activeId: string;
  /** Must match the instanceId used by the corresponding ToolTabBar */
  tabInstanceId?: string;
  children: React.ReactNode;
}

export default function ToolTabPanel({ tabId, activeId, tabInstanceId, children }: ToolTabPanelProps) {
  const isActive = tabId === activeId;
  const fallbackId = useId();
  const idPrefix = tabInstanceId ?? fallbackId;

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={tabId}
          role="tabpanel"
          id={`${idPrefix}-panel-${tabId}`}
          aria-labelledby={`${idPrefix}-tab-${tabId}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
