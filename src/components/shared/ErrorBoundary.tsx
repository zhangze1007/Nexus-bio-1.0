"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { THEME } from "../../theme";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. If omitted, renders a built-in recovery panel. */
  fallback?: ReactNode;
  /** Called when an error is caught. Useful for logging/reporting. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in its subtree and shows a recovery UI instead of
 * crashing the entire page.  Wrap at tool-page level (ToolShell) and at
 * IDE-shell level (ToolsLayoutShell) so a single bad chart or malformed
 * API response cannot take down the whole workbench.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
            gap: "14px",
            padding: "32px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "999px",
              border: `1px solid ${THEME.CORAL}44`,
              background: `${THEME.CORAL}15`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <span style={{ fontFamily: THEME.MONO, fontSize: "14px", color: THEME.CORAL }}>!</span>
          </div>

          <p
            style={{
              fontFamily: THEME.SANS,
              fontSize: "14px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.88)",
              margin: 0,
              textAlign: "center",
            }}
          >
            Something went wrong
          </p>
          <p
            style={{
              fontFamily: THEME.SANS,
              fontSize: "12px",
              color: "rgba(255,255,255,0.45)",
              margin: 0,
              textAlign: "center",
              lineHeight: 1.6,
              maxWidth: "44ch",
            }}
          >
            A component in this view encountered an unexpected error. You can retry the operation or navigate away.
          </p>

          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: "4px",
              padding: "6px 16px",
              borderRadius: "6px",
              border: `1px solid rgba(255,255,255,0.1)`,
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.7)",
              fontFamily: THEME.SANS,
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
