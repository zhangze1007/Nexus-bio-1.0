'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface FloatingControlRailProps {
  children: React.ReactNode;
  width?: number;
  label?: string;
  defaultCollapsed?: boolean;
}

export default function FloatingControlRail({
  children,
  width = 240,
  label = 'Controls',
  defaultCollapsed = false,
}: FloatingControlRailProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const contentId = 'floating-rail-content';

  return (
    <motion.div
      animate={{ width: collapsed ? 40 : width }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      style={{
        flexShrink: 0,
        borderRight: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.sepiaPanelMuted,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '10px 12px',
          borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          width: '100%',
          color: 'inherit',
          font: 'inherit',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        {!collapsed && (
          <span
            style={{
              fontFamily: T.SANS,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: PATHD_THEME.label,
            }}
          >
            {label}
          </span>
        )}
        {collapsed ? (
          <ChevronRight size={14} color={PATHD_THEME.label} />
        ) : (
          <ChevronLeft size={14} color={PATHD_THEME.label} />
        )}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            id={contentId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
