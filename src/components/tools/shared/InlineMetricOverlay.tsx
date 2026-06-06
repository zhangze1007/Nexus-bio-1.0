'use client';

import { motion } from 'framer-motion';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

interface MetricItem {
  label: string;
  value: string;
  accent?: string;
}

interface InlineMetricOverlayProps {
  metrics: MetricItem[];
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  'top-right': { top: '12px', right: '12px' },
  'bottom-right': { bottom: '12px', right: '12px' },
  'top-left': { top: '12px', left: '12px' },
  'bottom-left': { bottom: '12px', left: '12px' },
};

export default function InlineMetricOverlay({
  metrics,
  position = 'top-right',
}: InlineMetricOverlayProps) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Key metrics"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        ...POSITION_STYLES[position],
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 12px',
        borderRadius: '12px',
        background: 'rgba(16, 19, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      {metrics.map((metric) => (
        <div key={metric.label} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: T.MONO,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: PATHD_THEME.label,
              minWidth: '60px',
            }}
          >
            {metric.label}
          </span>
          <span
            style={{
              fontFamily: T.MONO,
              fontSize: '12px',
              fontWeight: 600,
              color: metric.accent ?? PATHD_THEME.value,
            }}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
