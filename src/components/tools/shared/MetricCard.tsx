'use client';

import type { ReactNode } from 'react';
import { THEME } from '../../../theme';
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
  sm: { padding: '8px 10px', gap: '2px', valueSize: THEME.FS_MD, labelSize: THEME.FS_XS, detailSize: THEME.FS_XS },
  md: { padding: '12px 14px', gap: '4px', valueSize: THEME.FS_LG, labelSize: THEME.FS_XS, detailSize: THEME.FS_SM },
  lg: { padding: '16px 18px', gap: '6px', valueSize: THEME.FS_XL, labelSize: THEME.FS_SM, detailSize: THEME.FS_SM },
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
  const accentColor = accent || THEME.MINT;

  return (
    <div style={{
      display: 'grid',
      gap: s.gap,
      padding: s.padding,
      borderRadius: THEME.R_MD,
      border: `1px solid ${THEME.BORDER}`,
      background: THEME.PANEL_INSET,
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
          fontFamily: THEME.MONO,
          fontSize: s.labelSize,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: THEME.LABEL,
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
          fontFamily: THEME.MONO,
          fontSize: s.valueSize,
          fontWeight: 700,
          color: THEME.VALUE,
          letterSpacing: '-0.02em',
          fontFeatureSettings: "'tnum' 1",
        }}>
          {value}
        </span>
        {unit && (
          <span style={{
            fontFamily: THEME.MONO,
            fontSize: s.labelSize,
            color: THEME.LABEL,
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Detail */}
      {detail && (
        <span style={{
          fontFamily: THEME.SANS,
          fontSize: s.detailSize,
          color: THEME.PAPER_MUTED,
          lineHeight: 1.5,
        }}>
          {detail}
        </span>
      )}
    </div>
  );
}
