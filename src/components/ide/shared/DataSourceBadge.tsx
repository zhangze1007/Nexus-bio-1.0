import React from 'react';

interface DataSourceBadgeProps {
  source: 'live' | 'mock';
  label?: string;
}

export default function DataSourceBadge({ source, label }: DataSourceBadgeProps) {
  const isLive = source === 'live';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: 'var(--nb-fs-xxs)',
        fontFamily: 'var(--nb-mono)',
        background: isLive ? 'rgba(74, 222, 128, 0.12)' : 'rgba(251, 191, 36, 0.12)',
        color: isLive ? 'rgba(74, 222, 128, 0.9)' : 'rgba(251, 191, 36, 0.9)',
        border: isLive ? '1px solid rgba(74, 222, 128, 0.2)' : '1px solid rgba(251, 191, 36, 0.2)',
      }}
      title={isLive ? 'Data from live database' : 'Using demo/mock data — API unavailable'}
    >
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: isLive ? '#4ade80' : '#fbbf24',
      }} />
      {label ?? (isLive ? 'Live' : 'Demo')}
    </span>
  );
}
