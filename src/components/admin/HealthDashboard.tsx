"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { THEME } from "../../theme";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ServiceStatus = "healthy" | "degraded" | "down";

export interface HealthCheckResult {
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  lastChecked: string;
  detail?: string;
}

export interface HealthResponse {
  ok: boolean;
  status: ServiceStatus;
  timestamp: string;
  checks: HealthCheckResult[];
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REFRESH_INTERVAL_MS = 30_000;

const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: THEME.SUCCESS_HIGH,
  degraded: THEME.RISK_MEDIUM,
  down: THEME.RISK_HIGH,
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
};

const SERVICE_ICONS: Record<string, string> = {
  Database: "DB",
  Groq: "GQ",
  Gemini: "GM",
  Redis: "RD",
  "R2 Storage": "R2",
  WebSocket: "WS",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatLatency(ms: number): string {
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HealthDashboard() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json: HealthResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch health data");
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  // Initial fetch + 30 s interval
  useEffect(() => {
    fetchHealth();
    intervalRef.current = setInterval(fetchHealth, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHealth]);

  /* ── Render helpers ──────────────────────────────────────────────── */

  function renderStatusDot(status: ServiceStatus) {
    const color = STATUS_COLORS[status];
    return (
      <span
        data-testid={`status-dot-${status}`}
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}80`,
          flexShrink: 0,
        }}
      />
    );
  }

  function renderCheckCard(check: HealthCheckResult) {
    const accentColor = STATUS_COLORS[check.status];
    const initials = SERVICE_ICONS[check.name] ?? check.name.slice(0, 2).toUpperCase();

    return (
      <div
        key={check.name}
        data-testid={`check-card-${check.name.replace(/\s+/g, "-").toLowerCase()}`}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: THEME.SP_MD,
          padding: THEME.SP_MD,
          background: THEME.PANEL_SURFACE,
          borderRadius: THEME.R_MD,
          border: `1px solid ${accentColor}30`,
          transition: "border-color 0.2s ease",
        }}
      >
        {/* Avatar / icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: THEME.R_SM,
            background: `${accentColor}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
            fontWeight: 700,
            color: accentColor,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: THEME.SP_SM,
              marginBottom: THEME.SP_XS,
            }}
          >
            {renderStatusDot(check.status)}
            <span
              style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_MD,
                fontWeight: 600,
                color: THEME.VALUE,
              }}
            >
              {check.name}
            </span>
            <span
              data-testid={`status-label-${check.status}`}
              style={{
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: accentColor,
                background: `${accentColor}15`,
                padding: "2px 8px",
                borderRadius: 999,
                marginLeft: "auto",
              }}
            >
              {STATUS_LABELS[check.status]}
            </span>
          </div>

          {/* Metrics row */}
          <div
            style={{
              display: "flex",
              gap: THEME.SP_LG,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.LABEL,
            }}
          >
            <span>
              Latency:{" "}
              <span style={{ color: THEME.VALUE }}>{formatLatency(check.latencyMs)}</span>
            </span>
            <span>
              Checked:{" "}
              <span style={{ color: THEME.VALUE }}>{formatTimestamp(check.lastChecked)}</span>
            </span>
          </div>

          {/* Detail / error */}
          {check.detail && (
            <div
              data-testid="check-detail"
              style={{
                marginTop: THEME.SP_XS,
                fontFamily: THEME.MONO,
                fontSize: THEME.FS_XS,
                color: THEME.DIM,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {check.detail}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Loading state ───────────────────────────────────────────────── */

  if (loading && !data) {
    return (
      <div
        data-testid="health-loading"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_MD,
          color: THEME.LABEL,
        }}
      >
        Loading health status...
      </div>
    );
  }

  /* ── Error state ─────────────────────────────────────────────────── */

  if (error && !data) {
    return (
      <div
        data-testid="health-error"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          gap: THEME.SP_SM,
          fontFamily: THEME.SANS,
          color: THEME.RISK_HIGH,
        }}
      >
        <span style={{ fontSize: THEME.FS_LG, fontWeight: 600 }}>Health check failed</span>
        <span style={{ fontSize: THEME.FS_SM, color: THEME.DIM }}>{error}</span>
        <button
          data-testid="retry-button"
          onClick={fetchHealth}
          style={{
            marginTop: THEME.SP_SM,
            padding: `${THEME.SP_XS}px ${THEME.SP_MD}px`,
            background: `${THEME.RISK_HIGH}20`,
            color: THEME.RISK_HIGH,
            border: `1px solid ${THEME.RISK_HIGH}40`,
            borderRadius: THEME.R_SM,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  /* ── Main dashboard ──────────────────────────────────────────────── */

  const overallColor = STATUS_COLORS[data.status];

  return (
    <div
      data-testid="health-dashboard"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: THEME.SP_LG,
        padding: THEME.SP_LG,
        fontFamily: THEME.SANS,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: THEME.SP_SM,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: THEME.SP_SM }}>
          <h2
            style={{
              margin: 0,
              fontFamily: THEME.BRAND,
              fontSize: THEME.FS_XL,
              fontWeight: 700,
              color: THEME.INK,
            }}
          >
            System Health
          </h2>
          <span
            data-testid="overall-status-badge"
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              fontWeight: 600,
              color: overallColor,
              background: `${overallColor}15`,
              padding: "3px 10px",
              borderRadius: 999,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {STATUS_LABELS[data.status]}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: THEME.SP_SM,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.DIM,
          }}
        >
          {lastRefresh && <span>Last refresh: {lastRefresh.toLocaleTimeString()}</span>}
          <button
            data-testid="manual-refresh"
            onClick={fetchHealth}
            disabled={loading}
            style={{
              padding: `${THEME.SP_XS}px ${THEME.SP_SM}px`,
              background: THEME.INPUT_BG,
              color: THEME.LABEL,
              border: `1px solid ${THEME.BORDER}`,
              borderRadius: THEME.R_SM,
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Auto-refresh notice */}
      <div
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color: THEME.DIM,
        }}
      >
        Auto-refreshes every {REFRESH_INTERVAL_MS / 1000}s
      </div>

      {/* Check cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: THEME.SP_MD,
        }}
      >
        {data.checks.map(renderCheckCard)}
      </div>

      {/* Stale error banner — shows error from latest fetch while keeping previous data */}
      {error && data && (
        <div
          data-testid="stale-error"
          style={{
            padding: `${THEME.SP_SM}px ${THEME.SP_MD}px`,
            background: `${THEME.RISK_HIGH}10`,
            border: `1px solid ${THEME.RISK_HIGH}30`,
            borderRadius: THEME.R_SM,
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.RISK_HIGH,
          }}
        >
          Refresh failed: {error} — showing cached data
        </div>
      )}
    </div>
  );
}
