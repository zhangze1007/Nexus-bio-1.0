'use client';

import { motion } from 'framer-motion';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

export interface ToolTab {
  id: string;
  label: string;
  accent?: string;
}

interface ToolTabBarProps {
  tabs: ToolTab[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function ToolTabBar({ tabs, activeId, onChange }: ToolTabBarProps) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '2px',
        padding: '0 16px',
        borderBottom: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
        background: PATHD_THEME.sepiaPanelMuted,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const accent = tab.accent ?? PATHD_THEME.sky;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: T.SANS,
              fontSize: '12px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? accent : PATHD_THEME.label,
              transition: 'color 0.2s ease',
            }}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="tool-tab-indicator"
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: accent,
                  borderRadius: '2px 2px 0 0',
                }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
