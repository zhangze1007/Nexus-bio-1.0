'use client';
import { THEME } from '../../../theme';

/**
 * Consistent section label for tool control rails and panels.
 * Renders an uppercase mono label with standardized spacing.
 */
export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: THEME.SANS,
      fontSize: 'var(--nb-fs-xs)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: THEME.LABEL,
      margin: '0 0 10px',
    }}>
      {children}
    </p>
  );
}
