/**
 * LIMS Integration Types
 *
 * Core interfaces for Laboratory Information Management System integration.
 * Supports Benchling, LabArchives, RSpace, and generic REST adapters.
 */

// ── Configuration ──

export interface LIMSConfig {
  id: string;
  name: string;
  type: "benchling" | "labarchives" | "rspace" | "generic";
  baseUrl: string;
  authType: "api_key" | "oauth2" | "basic";
  credentials: Record<string, string>;
  syncDirection: "push" | "pull" | "bidirectional";
  lastSyncAt?: string;
}

// ── Sample / Entity ──

export interface LIMSSample {
  id: string;
  name: string;
  type: "strain" | "plasmid" | "primer" | "chemical" | "other";
  properties: Record<string, unknown>;
  externalId?: string; // ID in the LIMS
  source: "nexus-bio" | "lims";
}

// ── Experiment ──

export interface LIMSExperiment {
  id: string;
  title: string;
  description: string;
  protocol?: string;
  results: Record<string, unknown>;
  externalId?: string;
  signedBy?: string;
  signedAt?: string;
}

// ── ELN (Electronic Lab Notebook) ──

export interface ELNAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
}

export interface ELNSignature {
  userId: string;
  userName: string;
  signedAt: string;
  meaning: "authored" | "reviewed" | "approved" | string;
  contentHash: string;
}

export interface ELNEntry {
  id: string;
  projectId: string;
  title: string;
  content: string; // Rich text (Tiptap JSON or markdown)
  attachments: ELNAttachment[];
  signatures: ELNSignature[];
  createdAt: string;
  updatedAt: string;
}

// ── Generic Adapter ──

export interface FieldMapping {
  nexusField: string;
  limsField: string;
  transform?: "direct" | "json" | "date" | "custom";
}

export interface SyncResult {
  direction: "push" | "pull" | "bidirectional";
  entityType: string;
  pushed: number;
  pulled: number;
  updated: number;
  errors: Array<{ entityId: string; error: string }>;
  syncedAt: string;
}

// ── Sync Audit ──

export interface LIMSSyncAuditEntry {
  id: string;
  configId: string;
  direction: string;
  entityType: string;
  timestamp: string;
  pushed: number;
  pulled: number;
  errors: number;
  duration: number;
}

// ── API Response Wrappers ──

export interface LIMSConnectionStatus {
  configId: string;
  connected: boolean;
  lastSyncAt?: string;
  error?: string;
}
