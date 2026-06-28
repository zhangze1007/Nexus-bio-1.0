"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Loader2,
  Monitor,
  RefreshCw,
  Shield,
  Smartphone,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { THEME } from "../../theme";

/**
 * SessionManager — Displays active sessions with device info, IP, last-active
 * time, and a current-session badge. Non-current sessions can be revoked.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  lastActive: number;
  createdAt: number;
  isCurrent: boolean;
}

interface SessionManagerProps {
  /** Override the fetch URL (default: /api/auth/sessions) */
  apiBase?: string;
  /** Additional headers sent with every request (e.g. auth tokens) */
  headers?: Record<string, string>;
}

// ── Animation variants ─────────────────────────────────────────────────────

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.25 } },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function deviceIcon(os: string) {
  const lower = os.toLowerCase();
  if (lower.includes("ios") || lower.includes("android")) {
    return <Smartphone size={16} style={{ color: THEME.LILAC }} />;
  }
  return <Monitor size={16} style={{ color: THEME.SKY }} />;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SessionManager({ apiBase = "/api/auth/sessions", headers = {} }: SessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase, { headers });
      if (!res.ok) throw new Error(`Failed to load sessions (${res.status})`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function revokeSession(sessionId: string) {
    setRevoking(sessionId);
    try {
      const res = await fetch(apiBase, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Revoke failed (${res.status})`);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setRevoking(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="session-manager"
      style={{
        fontFamily: THEME.SANS,
        color: THEME.VALUE,
        maxWidth: "640px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: THEME.SP_MD,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: THEME.SP_SM }}>
          <Shield size={18} style={{ color: THEME.MINT }} />
          <h2
            style={{
              fontFamily: THEME.BRAND,
              fontSize: THEME.FS_LG,
              fontWeight: 600,
              color: THEME.INK,
              margin: 0,
            }}
          >
            Active Sessions
          </h2>
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.DIM,
              background: THEME.CHIP_COOL,
              border: `1px solid ${THEME.CHIP_BORDER}`,
              borderRadius: "999px",
              padding: "2px 8px",
            }}
          >
            {sessions.length}
          </span>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          aria-label="Refresh sessions"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "6px 12px",
            borderRadius: THEME.R_SM,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${THEME.BORDER}`,
            color: THEME.LABEL,
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.5 : 1,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLElement).style.borderColor = THEME.BORDER_ACTIVE;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLElement).style.borderColor = THEME.BORDER;
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: THEME.SP_SM,
              padding: `${THEME.SP_SM}px ${THEME.SP_MD}px`,
              marginBottom: THEME.SP_MD,
              borderRadius: THEME.R_SM,
              background: "rgba(232,163,161,0.1)",
              border: `1px solid rgba(232,163,161,0.25)`,
              color: THEME.CORAL,
              fontSize: THEME.FS_SM,
            }}
            data-testid="session-error"
          >
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                color: THEME.CORAL,
                cursor: "pointer",
                padding: "2px",
              }}
              aria-label="Dismiss error"
            >
              <XCircle size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {loading && sessions.length === 0 && (
        <div data-testid="session-loading" style={{ display: "flex", flexDirection: "column", gap: THEME.SP_SM }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: "72px",
                borderRadius: THEME.R_MD,
                background: THEME.PANEL_STRONG,
                border: `1px solid ${THEME.BORDER}`,
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && !error && (
        <div
          data-testid="session-empty"
          style={{
            textAlign: "center",
            padding: `${THEME.SP_XL}px ${THEME.SP_MD}px`,
            color: THEME.DIM,
          }}
        >
          <Globe size={32} style={{ marginBottom: THEME.SP_SM, opacity: 0.4 }} />
          <p style={{ fontSize: THEME.FS_MD, margin: 0 }}>No active sessions found.</p>
        </div>
      )}

      {/* Session list */}
      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="visible"
        style={{ display: "flex", flexDirection: "column", gap: THEME.SP_SM }}
      >
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
              data-testid={`session-card-${session.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: THEME.SP_MD,
                padding: `${THEME.SP_MD}px`,
                borderRadius: THEME.R_MD,
                background: session.isCurrent ? "rgba(191,220,205,0.06)" : THEME.PANEL_STRONG,
                border: `1px solid ${session.isCurrent ? "rgba(191,220,205,0.2)" : THEME.BORDER}`,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = session.isCurrent
                  ? "rgba(191,220,205,0.35)"
                  : THEME.BORDER_ACTIVE;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = session.isCurrent
                  ? "rgba(191,220,205,0.2)"
                  : THEME.BORDER;
              }}
            >
              {/* Device icon */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: THEME.R_SM,
                  background: session.isCurrent ? "rgba(191,220,205,0.12)" : "rgba(255,255,255,0.04)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                {deviceIcon(session.os)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: THEME.SP_SM,
                    marginBottom: "2px",
                  }}
                >
                  <span
                    style={{
                      fontSize: THEME.FS_MD,
                      fontWeight: 600,
                      color: THEME.INK,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {session.device}
                  </span>
                  {session.isCurrent && (
                    <span
                      data-testid="current-badge"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        fontFamily: THEME.MONO,
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: THEME.MINT,
                        background: "rgba(191,220,205,0.12)",
                        border: `1px solid rgba(191,220,205,0.25)`,
                        borderRadius: "999px",
                        padding: "2px 8px",
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle size={9} />
                      Current
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: THEME.SP_SM,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: THEME.FS_XS,
                      color: THEME.DIM,
                    }}
                  >
                    {session.ip}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
                  <span
                    style={{
                      fontFamily: THEME.MONO,
                      fontSize: THEME.FS_XS,
                      color: THEME.DIM,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <Clock size={10} />
                    {relativeTime(session.lastActive)}
                  </span>
                </div>
              </div>

              {/* Revoke button (non-current only) */}
              {!session.isCurrent && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => revokeSession(session.id)}
                  disabled={revoking === session.id}
                  data-testid={`revoke-btn-${session.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 14px",
                    borderRadius: THEME.R_SM,
                    background: "rgba(232,163,161,0.08)",
                    border: `1px solid rgba(232,163,161,0.2)`,
                    color: THEME.CORAL,
                    fontFamily: THEME.SANS,
                    fontSize: THEME.FS_SM,
                    fontWeight: 500,
                    cursor: revoking === session.id ? "default" : "pointer",
                    opacity: revoking === session.id ? 0.6 : 1,
                    transition: "background 0.15s, border-color 0.15s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (revoking !== session.id) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(232,163,161,0.15)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,163,161,0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(232,163,161,0.08)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,163,161,0.2)";
                  }}
                >
                  {revoking === session.id ? (
                    <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <XCircle size={12} />
                  )}
                  Revoke
                </motion.button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Inline keyframes for spin/pulse animations */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  );
}
