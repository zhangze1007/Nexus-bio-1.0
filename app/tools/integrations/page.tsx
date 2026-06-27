"use client";

/**
 * Integration Settings Page — /tools/integrations
 *
 * Central hub for managing LIMS connections, webhook subscriptions,
 * and n8n automation triggers. Uses ToolShell layout.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import LIMSConnectionManager from "../../../src/components/lims/LIMSConnectionManager";
import ToolShell from "../../../src/components/tools/shared/ToolShell";
import { THEME } from "../../../src/theme";
import type {
  LIMSConfig,
  LIMSConnectionStatus,
} from "../../../src/services/lims/types";
import type {
  Webhook,
  WebhookEventType,
} from "../../../src/services/webhooks/types";

/* ------------------------------------------------------------------ */
/*  Demo seed data (removed once real persistence is wired)            */
/* ------------------------------------------------------------------ */

const SEED_CONNECTIONS: LIMSConfig[] = [
  {
    id: "conn-1",
    name: "Production Benchling",
    type: "benchling",
    baseUrl: "https://acme-lab.benchling.com",
    authType: "api_key",
    credentials: {},
    syncDirection: "bidirectional",
    lastSyncAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    id: "conn-2",
    name: "LabArchives Archive",
    type: "labarchives",
    baseUrl: "https://www.labarchives.com",
    authType: "basic",
    credentials: {},
    syncDirection: "pull",
    lastSyncAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

const SEED_WEBHOOKS: Webhook[] = [
  {
    id: "wh-1",
    orgId: "org-demo",
    url: "https://hooks.example.com/nexus-bio",
    events: ["experiment.complete", "milestone.reached"],
    secret: "whsec_demo",
    active: true,
    createdAt: new Date(Date.now() - 604_800_000).toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div>
        <h3
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_MD,
            fontWeight: 700,
            color: THEME.VALUE,
            margin: 0,
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontFamily: THEME.SANS,
              fontSize: THEME.FS_SM,
              color: THEME.LABEL,
              margin: "2px 0 0",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WebhookList (inline sub-component)                                 */
/* ------------------------------------------------------------------ */

function WebhookList({
  webhooks,
  onRemove,
}: {
  webhooks: Webhook[];
  onRemove?: (id: string) => void;
}) {
  if (webhooks.length === 0) {
    return (
      <div
        data-testid="webhook-empty"
        style={{
          padding: "20px 16px",
          textAlign: "center",
          background: THEME.PANEL_SURFACE,
          border: `1px dashed ${THEME.BORDER}`,
          borderRadius: THEME.R_MD,
        }}
      >
        <p style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.LABEL, margin: 0 }}>
          No webhooks registered. Webhooks fire on experiment, milestone, task, and inventory events.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} data-testid="webhook-list">
      {webhooks.map((wh) => (
        <div
          key={wh.id}
          data-testid={`webhook-row-${wh.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            background: THEME.PANEL_SURFACE,
            border: `1px solid ${THEME.BORDER}`,
            borderRadius: THEME.R_MD,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: wh.active ? THEME.MINT : THEME.DIM,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_SM,
              color: THEME.VALUE,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {wh.url}
          </span>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {wh.events.map((ev) => (
              <span
                key={ev}
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  padding: "2px 6px",
                  borderRadius: THEME.R_SM,
                  background: "rgba(207,196,227,0.14)",
                  border: `1px solid rgba(207,196,227,0.28)`,
                  color: THEME.LILAC,
                }}
              >
                {ev}
              </span>
            ))}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(wh.id)}
              data-testid={`webhook-remove-${wh.id}`}
              style={{
                fontFamily: THEME.SANS,
                fontSize: THEME.FS_XS,
                fontWeight: 600,
                padding: "4px 8px",
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
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  N8NTriggerPanel (inline sub-component)                             */
/* ------------------------------------------------------------------ */

const N8N_EVENT_OPTIONS: { value: WebhookEventType; label: string }[] = [
  { value: "experiment.complete", label: "Experiment Complete" },
  { value: "milestone.reached", label: "Milestone Reached" },
  { value: "task.assigned", label: "Task Assigned" },
  { value: "inventory.alert", label: "Inventory Alert" },
];

function N8NTriggerPanel() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([]);
  const [saved, setSaved] = useState(false);

  const toggleEvent = useCallback((ev: WebhookEventType) => {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!webhookUrl.trim() || selectedEvents.length === 0) return;
    // In production this would POST to /api/webhooks
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [webhookUrl, selectedEvents]);

  return (
    <div
      data-testid="n8n-trigger-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        background: THEME.PANEL_SURFACE,
        border: `1px solid ${THEME.BORDER}`,
        borderRadius: THEME.R_MD,
      }}
    >
      <p style={{ fontFamily: THEME.SANS, fontSize: THEME.FS_SM, color: THEME.LABEL, margin: 0 }}>
        Connect n8n (or any workflow automation tool) via webhook URL. Select which Nexus-Bio events should trigger
        the workflow.
      </p>

      <div>
        <label
          htmlFor="n8n-url"
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_XS,
            fontWeight: 600,
            color: THEME.LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            display: "block",
            marginBottom: "4px",
          }}
        >
          n8n Webhook URL
        </label>
        <input
          id="n8n-url"
          type="url"
          value={webhookUrl}
          onChange={(e) => {
            setWebhookUrl(e.target.value);
            setSaved(false);
          }}
          placeholder="https://your-n8n.example.com/webhook/..."
          style={{
            fontFamily: THEME.MONO,
            fontSize: THEME.FS_SM,
            color: THEME.VALUE,
            background: THEME.INPUT_BG,
            border: `1px solid ${THEME.INPUT_BORDER}`,
            borderRadius: THEME.R_SM,
            padding: "8px 10px",
            width: "100%",
            outline: "none",
          }}
          data-testid="n8n-url-input"
        />
      </div>

      <div>
        <span
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_XS,
            fontWeight: 600,
            color: THEME.LABEL,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            display: "block",
            marginBottom: "6px",
          }}
        >
          Trigger Events
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {N8N_EVENT_OPTIONS.map((opt) => {
            const selected = selectedEvents.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleEvent(opt.value)}
                data-testid={`n8n-event-${opt.value}`}
                style={{
                  fontFamily: THEME.MONO,
                  fontSize: THEME.FS_XS,
                  padding: "5px 10px",
                  borderRadius: THEME.R_SM,
                  border: `1px solid ${selected ? "rgba(191,220,205,0.45)" : THEME.BORDER}`,
                  background: selected ? "rgba(191,220,205,0.15)" : "transparent",
                  color: selected ? THEME.MINT : THEME.LABEL,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!webhookUrl.trim() || selectedEvents.length === 0}
          style={{
            fontFamily: THEME.SANS,
            fontSize: THEME.FS_SM,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: THEME.R_SM,
            border: `1px solid rgba(191,220,205,0.40)`,
            background:
              !webhookUrl.trim() || selectedEvents.length === 0
                ? "rgba(255,255,255,0.04)"
                : "rgba(191,220,205,0.15)",
            color:
              !webhookUrl.trim() || selectedEvents.length === 0
                ? THEME.DIM
                : THEME.MINT,
            cursor:
              !webhookUrl.trim() || selectedEvents.length === 0
                ? "not-allowed"
                : "pointer",
          }}
          data-testid="n8n-save-btn"
        >
          Save Trigger
        </button>
        {saved && (
          <span
            style={{
              fontFamily: THEME.MONO,
              fontSize: THEME.FS_XS,
              color: THEME.MINT,
            }}
            data-testid="n8n-saved-msg"
          >
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  // ── LIMS state ──
  const [connections, setConnections] = useState<LIMSConfig[]>(SEED_CONNECTIONS);
  const [statuses, setStatuses] = useState<Record<string, LIMSConnectionStatus>>(() => {
    const map: Record<string, LIMSConnectionStatus> = {};
    for (const c of SEED_CONNECTIONS) {
      map[c.id] = {
        configId: c.id,
        connected: true,
        lastSyncAt: c.lastSyncAt,
      };
    }
    return map;
  });

  // ── Webhook state ──
  const [webhooks, setWebhooks] = useState<Webhook[]>(SEED_WEBHOOKS);

  // ── LIMS handlers ──
  const handleAddConnection = useCallback((cfg: Omit<LIMSConfig, "id">) => {
    const id = `conn-${Date.now()}`;
    const newConn: LIMSConfig = { ...cfg, id };
    setConnections((prev) => [...prev, newConn]);
    setStatuses((prev) => ({
      ...prev,
      [id]: { configId: id, connected: false },
    }));
  }, []);

  const handleRemoveConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleSync = useCallback(
    (id: string) => {
      // Simulate sync: mark connected + update timestamp
      setStatuses((prev) => ({
        ...prev,
        [id]: {
          configId: id,
          connected: true,
          lastSyncAt: new Date().toISOString(),
        },
      }));
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, lastSyncAt: new Date().toISOString() } : c,
        ),
      );
    },
    [],
  );

  // ── Webhook handlers ──
  const handleRemoveWebhook = useCallback((id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return (
    <ToolShell
      moduleId="integrations"
      title="Integrations"
      description="Manage LIMS connections, webhooks, and automation triggers"
      grid="'content'"
      columns="1fr"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          maxWidth: 840,
          width: "100%",
        }}
      >
        {/* LIMS Connections */}
        <Section
          title="LIMS Connections"
          description="Connect to Benchling, LabArchives, RSpace, or any generic REST API"
        >
          <LIMSConnectionManager
            connections={connections}
            statuses={statuses}
            onAdd={handleAddConnection}
            onRemove={handleRemoveConnection}
            onSync={handleSync}
          />
        </Section>

        {/* Webhooks */}
        <Section
          title="Webhooks"
          description="Register HTTP endpoints that receive event payloads from Nexus-Bio"
        >
          <WebhookList webhooks={webhooks} onRemove={handleRemoveWebhook} />
        </Section>

        {/* n8n Triggers */}
        <Section
          title="n8n Automation Triggers"
          description="Wire Nexus-Bio events into n8n workflows for cross-tool automation"
        >
          <N8NTriggerPanel />
        </Section>
      </div>
    </ToolShell>
  );
}
