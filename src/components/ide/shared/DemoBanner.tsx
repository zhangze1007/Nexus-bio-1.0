'use client';
import Link from 'next/link';
import { T } from '../tokens';
import { SEMANTIC_RGB } from '../../charts/chartTheme';

/**
 * DemoBanner — a static, always-visible status strip that honestly explains
 * why the page is not in Research mode: no Analyze artifact is attached.
 *
 * The banner decouples from the global Demo/Research toggle (which was
 * interaction theatre on these pages — see the honesty pass). It performs
 * three jobs:
 *
 *   1. Names the current state ("Demo data").
 *   2. Explains the gap ("Research mode requires an Analyze artifact").
 *   3. Provides a concrete next action (Go to Analyze).
 *
 * Pages that ship with a preloaded demonstration scenario should mount this
 * component at the top of the page so the framing is visible before the user
 * engages with the tool's controls.
 */

interface DemoBannerProps {
  /** What the demo scenario represents (e.g. "E. coli central metabolism"). */
  context?: string;
}

const PASS_BG        = `rgba(${SEMANTIC_RGB.pass}, 0.06)`;
const PASS_BORDER    = `rgba(${SEMANTIC_RGB.pass}, 0.22)`;
const PASS_PILL_BG   = `rgba(${SEMANTIC_RGB.pass}, 0.14)`;
const PASS_PILL_EDGE = `rgba(${SEMANTIC_RGB.pass}, 0.30)`;
const PASS_PILL_FG   = `rgba(${SEMANTIC_RGB.pass}, 0.95)`;
const CTA_BG         = `rgba(${SEMANTIC_RGB.pass}, 0.12)`;
const CTA_EDGE       = `rgba(${SEMANTIC_RGB.pass}, 0.40)`;
const CTA_FG         = `rgba(${SEMANTIC_RGB.pass}, 0.95)`;

export default function DemoBanner({ context }: DemoBannerProps) {
  return (
    <div
      role="status"
      style={{
        padding: '8px 16px',
        background: PASS_BG,
        border: `1px solid ${PASS_BORDER}`,
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
          background: PASS_PILL_BG,
          border: `1px solid ${PASS_PILL_EDGE}`,
          color: PASS_PILL_FG,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}
      >
        Demo data
      </span>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.72)', flex: 1, minWidth: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 600 }}>
          Research mode requires an Analyze artifact.
        </span>
        {context && (
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>
            {' · Showing: '}
            {context}
          </span>
        )}
      </span>
      <Link
        href="/analyze"
        style={{
          fontFamily: T.MONO,
          fontSize: '10px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '999px',
          background: CTA_BG,
          border: `1px solid ${CTA_EDGE}`,
          color: CTA_FG,
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
