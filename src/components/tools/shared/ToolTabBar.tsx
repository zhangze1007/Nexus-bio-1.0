'use client';

import { useId, useRef, useCallback, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { THEME } from '../../../theme';
export interface ToolTab {
  id: string;
  label: string;
  accent?: string;
}

interface ToolTabBarProps {
  tabs: ToolTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** Shared ID prefix for ARIA linkage with ToolTabPanel. Auto-generated if omitted. */
  instanceId?: string;
}

export default function ToolTabBar({ tabs, activeId, onChange, instanceId: instanceIdProp }: ToolTabBarProps) {
  const autoId = useId();
  const instanceId = instanceIdProp ?? autoId;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      onChange(tabs[nextIndex].id);
      tabRefs.current[nextIndex]?.focus();
    },
    [tabs, activeId, onChange],
  );

  return (
    <div
      role="tablist"
      aria-label="Tool sections"
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        gap: '2px',
        padding: '0 16px',
        borderBottom: `1px solid ${THEME.BORDER}`,
        background: THEME.PANEL_MUTED,
      }}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeId;
        const accent = tab.accent ?? THEME.SKY;
        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            id={`${instanceId}-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`${instanceId}-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: THEME.SANS,
              fontSize: 'var(--nb-fs-sm)',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? accent : THEME.LABEL,
              borderRadius: '6px 6px 0 0',
              transition: 'color 0.2s ease, background 0.15s ease',
              outline: '2px solid rgba(175,195,214,0.5)',
              outlineOffset: '2px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.color = THEME.VALUE;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = THEME.LABEL;
              }
            }}
            onFocus={(e) => {
              if (e.target === e.currentTarget) {
                e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}55`;
              }
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId={`tool-tab-indicator-${instanceId}`}
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
