'use client';

import type { WorkflowArtifact } from '../../../domain/workflowArtifact';
import { THEME } from '../../../theme';
export default function ArtifactRouteState({
  title,
  message,
  artifact,
  embedded,
}: {
  title: string;
  message: string;
  artifact: WorkflowArtifact | null;
  embedded: boolean;
}) {
  return (
    <div
      style={{
        minHeight: embedded ? '560px' : '100vh',
        background: 'radial-gradient(circle at top, rgba(207,196,227,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(191,220,205,0.14), transparent 26%), linear-gradient(180deg, #0d0a09 0%, #050505 100%)',
        display: 'grid',
        placeItems: 'center',
        padding: embedded ? '28px' : '40px 24px',
      }}
    >
      <div
        style={{
          width: 'min(760px, 100%)',
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
          boxShadow: '0 28px 64px rgba(0,0,0,0.34)',
          padding: '22px',
          display: 'grid',
          gap: '16px',
        }}
      >
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ fontFamily: THEME.MONO, fontSize: 'var(--nb-fs-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: THEME.LABEL }}>
            Canonical PATHD route
          </div>
          <h2 style={{ margin: 0, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-xl)', lineHeight: 1.1, color: THEME.VALUE }}>
            {title}
          </h2>
          <p style={{ margin: 0, fontFamily: THEME.SANS, fontSize: 'var(--nb-fs-md)', lineHeight: 1.65, color: THEME.LABEL }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
