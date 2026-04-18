'use client';
import Link from 'next/link';
import { T } from '../tokens';
import { SEMANTIC_RGB } from '../../charts/chartTheme';

/**
 * DemoBanner — a static, always-visible indicator that the current page is
 * operating on a pre-loaded demonstration scenario rather than a live artifact.
 *
 * Previously this component was coupled to a global Demo/Research toggle, but
 * that toggle was interaction theatre on every tool page except the /tools
 * directory — clicking it simply hid/showed this banner without changing any
 * parameters, data, or simulation state. The coupling has been removed so the
 * banner is an honest label rather than a state indicator.
 *
 * The banner now provides a concrete next action ("Attach an Analyze
 * artifact") so users have a path out of demo mode instead of a dead button.
 */

interface DemoBannerProps {
  context?: string;
}

export default function DemoBanner({ context }: DemoBannerProps) {
  return (
    <div
      role="status"
      style={{
        padding: '8px 16px',
        background: `rgba(${SEMANTIC_RGB.pass}, 0.06)`,
        border: `1px solid rgba(${SEMANTIC_RGB.pass}, 0.22)`,
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: T.SANS,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: T.MONO,
          fontSize: '9px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '999px',
          background: `rgba(${SEMANTIC_RGB.pass}, 0.14)`,
          border: `1px solid rgba(${SEMANTIC_RGB.pass}, 0.3)`,
          color: `rgba(${SEMANTIC_RGB.pass}, 0.95)`,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        Demo scenario
      </span>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', flex: 1, minWidth: 0 }}>
        {context
          ? `Pre-loaded: ${context}. For a live run on your own data, attach an Analyze artifact.`
          : 'This page is running on a pre-loaded demonstration scenario. Attach an Analyze artifact to run against your own data.'}
      </span>
      <Link
        href="/analyze"
        style={{
          fontFamily: T.MONO,
          fontSize: '10px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '999px',
          background: `rgba(${SEMANTIC_RGB.pass}, 0.12)`,
          border: `1px solid rgba(${SEMANTIC_RGB.pass}, 0.4)`,
          color: `rgba(${SEMANTIC_RGB.pass}, 0.95)`,
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        Go to Analyze →
      </Link>
    </div>
  );
}
