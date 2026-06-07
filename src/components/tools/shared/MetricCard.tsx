'use client';

import type { ReactNode } from 'react';
import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

/**
 * MetricCard — Standardized metric display for all tool pages.
 *
 * Used for KPI displays, simulation results, parameter readouts.
 * Ensures consistent typography, spacing, and visual hierarchy.
 *
 * Sizes:
 *   sm — compact inline metrics
 *   md — standard card metrics
 *   lg — hero-level featured metrics
 */

type MetricSize = 'sm' | 'md' | 'lg';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  size?: MetricSize;
  accent?: string;
  icon?: ReactNode;
}

const SIZE_MAP: Record<MetricSize, {
  padding: string; gap: string;
  valueSize: string; labelSize: string; detailSize: string;
}> = {
  sm: { padding: '8px 10px', gap: '2px', valueSize: T.FS_MD, labelSize: T.FS_XS, detailSize: T.FS_XS },
  md: { padding: '12px 14px', gap: '4px', valueSize: '18px', labelSize: T.FS_XS, detailSize: T.FS_SM },
  lg: { padding: '16px 18px', gap: '6px', valueSize: T.FS_XL, labelSize: T.FS_SM, detailSize: T.FS_SM },
};

export default function MetricCard({
  label,
  value,
  unit,
  detail,
  size = 'md',
  accent,
  icon,
}: MetricCardProps) {
  const s = SIZE_MAP[size];
  const accentColor = accent || T.MINT;

  return (
    <div style={{
      display: 'grid',
      gap: s.gap,
      padding: s.padding,
      borderRadius: T.R_MD,
      border: `1px solid ${PATHD_THEME.sepiaPanelBorder}`,
      background: PATHD_THEME.panelInset,
    }}>
      {/* Label row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        {icon && (
          <span style={{ color: accentColor, display: 'flex', alignItems: 'center' }}>
            {icon}
          </span>
        )}
        <span style={{
          fontFamily: T.MONO,
          fontSize: s.labelSize,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: PATHD_THEME.label,
        }}>
          {label}
        </span>
      </div>

      {/* Value row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
      }}>
        <span style={{
          fontFamily: T.MONO,
          fontSize: s.valueSize,
          fontWeight: 700,
          color: PATHD_THEME.value,
          letterSpacing: '-0.02em',
          fontFeatureSettings: "'tnum' 1",
        }}>
          {value}
        </span>
        {unit && (
          <span style={{
            fontFamily: T.MONO,
            fontSize: s.labelSize,
            color: PATHD_THEME.label,
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Detail */}
      {detail && (
        <span style={{
          fontFamily: T.SANS,
          fontSize: s.detailSize,
          color: PATHD_THEME.paperMuted,
          lineHeight: 1.5,
        }}>
          {detail}
        </span>
      )}
    </div>
  );
}
