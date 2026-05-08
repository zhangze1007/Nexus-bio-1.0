'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface ToolTabPanelProps {
  tabId: string;
  activeId: string;
  children: React.ReactNode;
}

export default function ToolTabPanel({ tabId, activeId, children }: ToolTabPanelProps) {
  const isActive = tabId === activeId;

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={tabId}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
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
