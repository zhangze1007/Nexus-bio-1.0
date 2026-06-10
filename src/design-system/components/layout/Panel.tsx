import React, { useState, useCallback, useMemo } from 'react';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
} from '../../tokens';

// ---------------------------------------------------------------------------
// Constants — glass-morphism panel surfaces
// ---------------------------------------------------------------------------

const PANEL_GRADIENT =
  'linear-gradient(180deg, rgba(31, 37, 44, 0.96) 0%, rgba(22, 27, 32, 0.94) 100%)';

const BORDER = 'rgba(255, 255, 255, 0.08)';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PanelProps {
  /** Panel body content */
  children: React.ReactNode;
  /** Additional CSS class for the outer wrapper */
  className?: string;
  /** Header title */
  title?: string;
  /** Subtitle shown below the title */
  subtitle?: string;
  /** Action elements rendered in the header (e.g. buttons, icons) */
  actions?: React.ReactNode;
  /** When true, the panel body can be collapsed/expanded */
  collapsible?: boolean;
  /** Initial collapsed state (only meaningful when `collapsible` is true) */
  defaultCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Chevron icon for collapse indicator
// ---------------------------------------------------------------------------

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transition: `transform ${transitions.duration.normal} ${transitions.easing.apple}`,
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <path
        d="M3.5 5.25L7 8.75L10.5 5.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

export function Panel({
  children,
  className,
  title,
  subtitle,
  actions,
  collapsible = false,
  defaultCollapsed = false,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    if (!collapsible) return;
    setCollapsed((prev) => !prev);
  }, [collapsible]);

  // ---- Style objects derived from tokens --------------------------------

  const wrapperStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      background: PANEL_GRADIENT,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${BORDER}`,
      borderRadius: borderRadius.xl,
      boxShadow: shadows.sm,
      overflow: 'hidden',
      fontFamily: typography.fontFamily.sans,
    }),
    [],
  );

  const hasHeader = title || subtitle || actions || collapsible;

  const headerStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      padding: `${spacing.md} ${spacing.base}`,
      minHeight: '40px',
      cursor: collapsible ? 'pointer' : 'default',
      userSelect: collapsible ? 'none' : undefined,
      transition: transitions.preset.bg,
    }),
    [collapsible],
  );

  const titleBlockStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      flex: 1,
      minWidth: 0,
    }),
    [],
  );

  const titleStyle: React.CSSProperties = useMemo(
    () => ({
      color: colors.text.primary,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      lineHeight: typography.lineHeight.tight,
      letterSpacing: typography.letterSpacing.tight,
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    [],
  );

  const subtitleStyle: React.CSSProperties = useMemo(
    () => ({
      color: colors.text.tertiary,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.regular,
      lineHeight: typography.lineHeight.normal,
      letterSpacing: typography.letterSpacing.normal,
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    [],
  );

  const actionsStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
      color: colors.text.tertiary,
    }),
    [],
  );

  const collapseToggleStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '24px',
      height: '24px',
      border: 'none',
      background: 'transparent',
      borderRadius: borderRadius.sm,
      color: colors.text.tertiary,
      cursor: 'pointer',
      flexShrink: 0,
      transition: [transitions.preset.color, transitions.preset.bg].join(', '),
    }),
    [],
  );

  const contentOuterStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'grid',
      gridTemplateRows: collapsed ? '0fr' : '1fr',
      transition: `grid-template-rows ${transitions.duration.slow} ${transitions.easing.apple}`,
    }),
    [collapsed],
  );

  const contentInnerStyle: React.CSSProperties = useMemo(
    () => ({
      overflow: 'hidden',
    }),
    [],
  );

  const contentPaddingStyle: React.CSSProperties = useMemo(
    () => ({
      padding: `0 ${spacing.base} ${spacing.base}`,
    }),
    [],
  );

  const headerDividerStyle: React.CSSProperties = useMemo(
    () => ({
      height: '1px',
      background: BORDER,
      margin: 0,
      border: 'none',
    }),
    [],
  );

  // ---- Render ------------------------------------------------------------

  return (
    <div style={wrapperStyle} className={className}>
      {/* Header */}
      {hasHeader && (
        <>
          <div
            style={headerStyle}
            onClick={collapsible ? toggleCollapsed : undefined}
            role={collapsible ? 'button' : undefined}
            aria-expanded={collapsible ? !collapsed : undefined}
            tabIndex={collapsible ? 0 : undefined}
            onKeyDown={
              collapsible
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleCollapsed();
                    }
                  }
                : undefined
            }
          >
            {/* Collapse chevron */}
            {collapsible && (
              <span style={collapseToggleStyle}>
                <ChevronIcon collapsed={collapsed} />
              </span>
            )}

            {/* Title + subtitle */}
            {(title || subtitle) && (
              <div style={titleBlockStyle}>
                {title && <h3 style={titleStyle}>{title}</h3>}
                {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
              </div>
            )}

            {/* Actions slot */}
            {actions && <div style={actionsStyle}>{actions}</div>}
          </div>
          <hr style={headerDividerStyle} />
        </>
      )}

      {/* Collapsible content body */}
      <div style={contentOuterStyle}>
        <div style={contentInnerStyle}>
          <div style={contentPaddingStyle}>{children}</div>
        </div>
      </div>
    </div>
  );
}
