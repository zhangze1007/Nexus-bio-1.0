"use client";
import { THEME } from "../../theme";

interface EmptyStateProps {
  /** Icon element displayed at the top (e.g. an SVG or emoji). */
  icon?: React.ReactNode;
  /** Primary heading text. */
  title: string;
  /** Secondary description text. */
  description?: string;
  /** Label for the optional action button. */
  actionLabel?: string;
  /** Callback fired when the action button is clicked. */
  onAction?: () => void;
  /** Additional CSS properties on the wrapper. */
  style?: React.CSSProperties;
}

/**
 * Empty-state placeholder shown when a view has no data.
 * Displays an optional icon, title, description, and action button.
 */
export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: "12px",
        textAlign: "center",
        ...style,
      }}
    >
      {icon && (
        <div
          aria-hidden="true"
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "999px",
            border: `1px solid rgba(255,255,255,0.08)`,
            background: "rgba(255,255,255,0.03)",
            display: "grid",
            placeItems: "center",
            fontSize: "20px",
            color: THEME.LABEL,
            marginBottom: "4px",
          }}
        >
          {icon}
        </div>
      )}

      <h3
        style={{
          margin: 0,
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_LG,
          fontWeight: 600,
          color: THEME.VALUE,
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            margin: 0,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.LABEL,
            lineHeight: 1.6,
            maxWidth: "44ch",
          }}
        >
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: "8px",
            padding: "8px 20px",
            borderRadius: THEME.R_MD,
            border: `1px solid ${THEME.BORDER_ACTIVE}`,
            background: "rgba(255,255,255,0.04)",
            color: THEME.VALUE,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.borderColor = THEME.BORDER_ACTIVE;
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
