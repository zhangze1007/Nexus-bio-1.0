"use client";
import { THEME } from "../../theme";

interface LoadingSpinnerProps {
  /** Spinner diameter in pixels. Defaults to 32. */
  size?: number;
  /** Accent color. Defaults to THEME.MINT. */
  color?: string;
  /** Optional label shown below the spinner. */
  label?: string;
  /** Additional CSS properties on the wrapper. */
  style?: React.CSSProperties;
}

/**
 * Animated loading spinner using pure CSS keyframes (no external deps).
 * Renders a circular arc that rotates continuously.
 */
export default function LoadingSpinner({
  size = 32,
  color = THEME.MINT,
  label,
  style,
}: LoadingSpinnerProps) {
  const border = Math.max(2, Math.round(size / 10));

  return (
    <div
      role="status"
      aria-label={label ?? "Loading"}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        ...style,
      }}
    >
      <style>{`
        @keyframes nexus-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${border}px solid rgba(255,255,255,0.08)`,
          borderTopColor: color,
          animation: "nexus-spin 0.8s linear infinite",
          boxSizing: "border-box",
        }}
      />
      {label && (
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            color: THEME.LABEL,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
