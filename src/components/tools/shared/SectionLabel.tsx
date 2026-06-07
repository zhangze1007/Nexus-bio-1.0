'use client';

import { T } from '../../ide/tokens';
import { PATHD_THEME } from '../../workbench/workbenchTheme';

/**
 * Consistent section label for tool control rails and panels.
 * Renders an uppercase mono label with standardized spacing.
 */
export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: T.SANS,
      fontSize: 'var(--nb-fs-xs)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: PATHD_THEME.label,
      margin: '0 0 10px',
    }}>
      {children}
    </p>
  );
}
