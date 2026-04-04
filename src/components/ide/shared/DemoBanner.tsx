'use client';
import { T } from '../tokens';
import { useDisplayMode } from './DisplayModeToggle';

/**
 * DemoBanner — shows a subtle banner when the user is in Demo mode.
 * Renders nothing in Research mode.
 *
 * Usage:
 *   <DemoBanner context="Artemisinin biosynthesis (Ro et al. 2006)" />
 */

interface DemoBannerProps {
  context?: string;
}

export default function DemoBanner({ context }: DemoBannerProps) {
  const [displayMode] = useDisplayMode();

  if (displayMode !== 'demo') return null;

  return (
    <div
      role="status"
      style={{
        padding: '8px 16px',
        background: 'rgba(147,203,82,0.06)',
        border: '1px solid rgba(147,203,82,0.18)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: T.SANS,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: T.MONO,
          fontSize: '9px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '999px',
          background: 'rgba(147,203,82,0.12)',
          border: '1px solid rgba(147,203,82,0.25)',
          color: 'rgba(147,203,82,0.95)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        Demo
      </span>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
        {context
          ? `Pre-configured for ${context}. Switch to Research mode for custom parameters.`
          : 'Viewing with pre-loaded demonstration data. Switch to Research mode for custom parameters.'}
      </span>
    </div>
  );
}
