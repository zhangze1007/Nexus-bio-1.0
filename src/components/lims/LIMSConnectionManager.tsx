"use client";

/**
 * LIMSConnectionManager — UI for managing LIMS integrations.
 *
 * Displays configured connections, sync status, last sync time,
 * and an "add new connection" form supporting Benchling and generic
 * REST adapters. Uses types from src/services/lims/types.ts.
 */

import React, { useCallback, useMemo, useState } from "react";
import { THEME } from "../../theme";
import type { LIMSConfig, LIMSConnectionStatus } from "../../services/lims/types";

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

type LIMSType = LIMSConfig["type"];
type AuthType = LIMSConfig["authType"];
type SyncDirection = LIMSConfig["syncDirection"];

export interface LIMSConnectionManagerProps {
  /** Pre-loaded connections from the server or parent state. */
  connections: LIMSConfig[];
  /** Live connection statuses keyed by config id. */
  statuses?: Record<string, LIMSConnectionStatus>;
  /** Called when the user submits a new connection. */
  onAdd?: (config: Omit<LIMSConfig, "id">) => void;
  /** Called when the user requests removal. */
  onRemove?: (id: string) => void;
  /** Called when the user requests an immediate sync. */
  onSync?: (id: string) => void;
  /** Read-only mode hides destructive actions. */
  readOnly?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LIMS_TYPE_OPTIONS: { value: LIMSType; label: string }[] = [
  { value: "benchling", label: "Benchling" },
  { value: "labarchives", label: "LabArchives" },
  { value: "rspace", label: "RSpace" },
  { value: "generic", label: "Generic REST" },
];

const AUTH_TYPE_OPTIONS: { value: AuthType; label: string }[] = [
  { value: "api_key", label: "API Key" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "basic", label: "Basic Auth" },
];

const SYNC_DIR_OPTIONS: { value: SyncDirection; label: string }[] = [
  { value: "push", label: "Push to LIMS" },
  { value: "pull", label: "Pull from LIMS" },
  { value: "bidirectional", label: "Bidirectional" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso?: string): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function limsTypeBadgeColor(type: LIMSType): string {
  switch (type) {
    case "benchling":
      return THEME.SKY;
    case "labarchives":
      return THEME.MINT;
    case "rspace":
      return THEME.LILAC;
    case "generic":
      return THEME.APRICOT;
  }
}

/* ----------------------------------------------------------------── */
/*  StatusIndicator                                                    */
/* ----------------------------------------------------------------── */

function StatusIndicator({ connected, error }: { connected: boolean; error?: string }) {
  const color = connected ? THEME.MINT : THEME.CORAL;
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "6px" }}
      title={error ?? (connected ? "Connected" : "Disconnected")}
      data-testid="status-indicator"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: connected ? `0 0 6px ${color}` : "none",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------── */
/*  ConnectionRow                                                      */
/* ----------------------------------------------------------------── */

function ConnectionRow({
  config,
  status,
  onRemove,
  onSync,
  readOnly,
}: {
  config: LIMSConfig;
  status?: LIMSConnectionStatus;
  onRemove?: (id: string) => void;
  onSync?: (id: string) => void;
  readOnly?: boolean;
}) {
  const connected = status?.connected ?? false;

  return (
    <div
      data-testid={`connection-row-${config.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        background: THEME.PANEL_SURFACE,
        border: `1px solid ${THEME.BORDER}`,
        borderRadius: THEME.R_MD,
        flexWrap: "wrap",
      }}
    >
      {/* Type badge */}
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "3px 8px",
          borderRadius: THEME.R_SM,
          background: `${limsTypeBadgeColor(config.type)}20`,
          border: `1px solid ${limsTypeBadgeColor(config.type)}40`,
          color: limsTypeBadgeColor(config.type),
          flexShrink: 0,
        }}
      >
        {config.type}
      </span>

      {/* Name + URL */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_MD,
            fontWeight: 600,
            color: THEME.VALUE,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {config.name}
        </div>
        <div
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_XS,
            color: THEME.LABEL,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {config.baseUrl}
        </div>
      </div>

      {/* Auth type */}
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color: THEME.LABEL,
          padding: "2px 6px",
          borderRadius: THEME.R_SM,
          background: THEME.PANEL_INSET,
          flexShrink: 0,
        }}
      >
        {config.authType}
      </span>

      {/* Sync direction */}
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color: THEME.LABEL,
          padding: "2px 6px",
          borderRadius: THEME.R_SM,
          background: THEME.PANEL_INSET,
          flexShrink: 0,
        }}
      >
        {config.syncDirection}
      </span>

      {/* Status */}
      <StatusIndicator connected={connected} error={status?.error} />

      {/* Last sync */}
      <span
        style={{
          fontFamily: THEME.MONO,
          fontSize: THEME.FS_XS,
          color: THEME.DIM,
          flexShrink: 0,
        }}
        data-testid={`last-sync-${config.id}`}
      >
        {relativeTime(config.lastSyncAt ?? status?.lastSyncAt)}
      </span>

      {/* Actions */}
      {!readOnly && (
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {onSync && (
            <button
              type="button"
              onClick={() => onSync(config.id)}
              data-testid={`sync-btn-${config.id}`}
              style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_XS,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: THEME.R_SM,
                border: `1px solid ${THEME.BORDER}`,
                background: "rgba(175,195,214,0.12)",
                color: THEME.SKY,
                cursor: "pointer",
              }}
            >
              Sync
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(config.id)}
              data-testid={`remove-btn-${config.id}`}
              style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_XS,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: THEME.R_SM,
                border: `1px solid ${THEME.BORDER}`,
                background: "rgba(232,163,161,0.10)",
                color: THEME.CORAL,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AddConnectionForm                                                  */
/* ------------------------------------------------------------------ */

interface FormState {
  name: string;
  type: LIMSType;
  baseUrl: string;
  authType: AuthType;
  syncDirection: SyncDirection;
  apiKey: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  type: "benchling",
  baseUrl: "",
  authType: "api_key",
  syncDirection: "bidirectional",
  apiKey: "",
};

function AddConnectionForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (config: Omit<LIMSConfig, "id">) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.baseUrl.trim()) next.baseUrl = "Base URL is required";
    else if (!/^https?:\/\/.+/.test(form.baseUrl)) next.baseUrl = "Must be a valid URL";
    if (!form.apiKey.trim()) next.apiKey = "API key is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      onSubmit({
        name: form.name.trim(),
        type: form.type,
        baseUrl: form.baseUrl.trim(),
        authType: form.authType,
        credentials: { api_key: form.apiKey.trim() },
        syncDirection: form.syncDirection,
      });
      setForm(INITIAL_FORM);
    },
    [form, onSubmit, validate],
  );

  const inputStyle: React.CSSProperties = {
    fontFamily: THEME.MONO,
    fontSize: THEME.FS_SM,
    color: THEME.VALUE,
    background: THEME.INPUT_BG,
    border: `1px solid ${THEME.INPUT_BORDER}`,
    borderRadius: THEME.R_SM,
    padding: "8px 10px",
    width: "100%",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: THEME.SANS,
    fontSize: THEME.FS_XS,
    fontWeight: 600,
    color: THEME.LABEL,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: "4px",
    display: "block",
  };

  const errorStyle: React.CSSProperties = {
    fontFamily: THEME.SANS,
    fontSize: THEME.FS_XS,
    color: THEME.CORAL,
    marginTop: "3px",
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="add-connection-form"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        padding: "16px",
        background: THEME.PANEL_SURFACE,
        border: `1px solid ${THEME.BORDER}`,
        borderRadius: THEME.R_MD,
      }}
    >
      <div
        style={{
          fontFamily: THEME.SANS,
          fontSize: THEME.FS_LG,
          fontWeight: 700,
          color: THEME.VALUE,
        }}
      >
        Add LIMS Connection
      </div>

      {/* Name */}
      <div>
        <label htmlFor="lims-name" style={labelStyle}>
          Connection Name
        </label>
        <input
          id="lims-name"
          type="text"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="e.g. Production Benchling"
          style={inputStyle}
          data-testid="input-name"
        />
        {errors.name && <p style={errorStyle}>{errors.name}</p>}
      </div>

      {/* Type */}
      <div>
        <label htmlFor="lims-type" style={labelStyle}>
          LIMS Type
        </label>
        <select
          id="lims-type"
          value={form.type}
          onChange={(e) => setField("type", e.target.value as LIMSType)}
          style={{ ...inputStyle, cursor: "pointer" }}
          data-testid="input-type"
        >
          {LIMS_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Base URL */}
      <div>
        <label htmlFor="lims-url" style={labelStyle}>
          Base URL
        </label>
        <input
          id="lims-url"
          type="url"
          value={form.baseUrl}
          onChange={(e) => setField("baseUrl", e.target.value)}
          placeholder="https://your-org.benchling.com"
          style={inputStyle}
          data-testid="input-url"
        />
        {errors.baseUrl && <p style={errorStyle}>{errors.baseUrl}</p>}
      </div>

      {/* Auth Type */}
      <div>
        <label htmlFor="lims-auth" style={labelStyle}>
          Auth Type
        </label>
        <select
          id="lims-auth"
          value={form.authType}
          onChange={(e) => setField("authType", e.target.value as AuthType)}
          style={{ ...inputStyle, cursor: "pointer" }}
          data-testid="input-auth"
        >
          {AUTH_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div>
        <label htmlFor="lims-key" style={labelStyle}>
          API Key
        </label>
        <input
          id="lims-key"
          type="password"
          value={form.apiKey}
          onChange={(e) => setField("apiKey", e.target.value)}
          placeholder="sk-..."
          style={inputStyle}
          data-testid="input-api-key"
        />
        {errors.apiKey && <p style={errorStyle}>{errors.apiKey}</p>}
      </div>

      {/* Sync Direction */}
      <div>
        <label htmlFor="lims-sync" style={labelStyle}>
          Sync Direction
        </label>
        <select
          id="lims-sync"
          value={form.syncDirection}
          onChange={(e) => setField("syncDirection", e.target.value as SyncDirection)}
          style={{ ...inputStyle, cursor: "pointer" }}
          data-testid="input-sync-direction"
        >
          {SYNC_DIR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: THEME.R_SM,
            border: `1px solid ${THEME.BORDER}`,
            background: "transparent",
            color: THEME.LABEL,
            cursor: "pointer",
          }}
          data-testid="cancel-btn"
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: THEME.R_SM,
            border: `1px solid rgba(191,220,205,0.40)`,
            background: "rgba(191,220,205,0.15)",
            color: THEME.MINT,
            cursor: "pointer",
          }}
          data-testid="submit-btn"
        >
          Add Connection
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  LIMSConnectionManager (main export)                                */
/* ------------------------------------------------------------------ */

export default function LIMSConnectionManager({
  connections,
  statuses = {},
  onAdd,
  onRemove,
  onSync,
  readOnly = false,
}: LIMSConnectionManagerProps) {
  const [showForm, setShowForm] = useState(false);

  const handleAdd = useCallback(
    (config: Omit<LIMSConfig, "id">) => {
      onAdd?.(config);
      setShowForm(false);
    },
    [onAdd],
  );

  const connectedCount = useMemo(
    () => connections.filter((c) => statuses[c.id]?.connected).length,
    [connections, statuses],
  );

  return (
    <div
      data-testid="lims-connection-manager"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: THEME.SANS,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_LG,
              fontWeight: 700,
              color: THEME.VALUE,
              margin: 0,
            }}
          >
            LIMS Connections
          </h2>
          <p
            style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              color: THEME.LABEL,
              margin: "2px 0 0",
            }}
          >
            {connectedCount} of {connections.length} connected
          </p>
        </div>

        {!readOnly && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: THEME.R_SM,
              border: `1px solid rgba(191,220,205,0.40)`,
              background: "rgba(191,220,205,0.15)",
              color: THEME.MINT,
              cursor: "pointer",
            }}
            data-testid="add-connection-btn"
          >
            + Add Connection
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && <AddConnectionForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />}

      {/* Empty state */}
      {connections.length === 0 && !showForm && (
        <div
          data-testid="empty-state"
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: THEME.PANEL_SURFACE,
            border: `1px dashed ${THEME.BORDER}`,
            borderRadius: THEME.R_MD,
          }}
        >
          <p style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_MD, color: THEME.LABEL, margin: 0 }}>
            No LIMS connections configured.
          </p>
          {!readOnly && (
            <p style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.DIM, margin: "4px 0 0" }}>
              Add a connection to start syncing data with your lab systems.
            </p>
          )}
        </div>
      )}

      {/* Connection list */}
      {connections.map((config) => (
        <ConnectionRow
          key={config.id}
          config={config}
          status={statuses[config.id]}
          onRemove={onRemove}
          onSync={onSync}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
