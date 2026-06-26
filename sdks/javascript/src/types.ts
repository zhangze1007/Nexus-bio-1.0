/**
 * TypeScript type definitions for the Nexus-Bio SDK.
 */

// ── Analyze ─────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface AnalyzeRequest {
  prompt: string;
  context?: Record<string, unknown>;
  history?: ConversationTurn[];
  searchQuery?: string;
}

export interface AnalyzeResponseCandidateContent {
  parts: Array<{ text?: string }>;
}

export interface AnalyzeResponseCandidate {
  content: AnalyzeResponseCandidateContent;
}

export interface AnalyzeResponseMeta {
  provider?: string;
  domain?: Record<string, unknown>;
  parseError?: { code: string; message: string };
}

export interface AnalyzeResponse {
  candidates?: AnalyzeResponseCandidate[];
  meta?: AnalyzeResponseMeta;
  error?: string;
}

// ── FBA ──────────────────────────────────────────────────────────────────────

export interface FBASpeciesConfig {
  glucoseUptake?: number;
  oxygenUptake?: number;
  knockouts?: string[];
}

export interface FBARequest {
  mode?: 'single' | 'community';
  species?: 'ecoli' | 'yeast';
  objective?: 'biomass' | 'product' | 'atp';
  action?: 'fba' | 'fva' | 'pfba' | 'knockout' | 'fseof' | 'optknock';
  glucoseUptake?: number;
  oxygenUptake?: number;
  knockouts?: string[];
  alpha?: number;
  ecoli?: FBASpeciesConfig;
  yeast?: FBASpeciesConfig;
  model?: Record<string, unknown>;
}

export interface FBAResponse {
  ok: boolean;
  growthRate?: number;
  fluxes: Record<string, number>;
  shadowPrices?: Record<string, number>;
  objectiveValue?: number;
  status?: string;
  requestId?: string;
  error?: string;
}

// ── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
}

// ── Workbench / Projects ─────────────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name?: string;
  revision?: number;
  updatedAt?: string;
  [key: string]: unknown;
}

// ── Health ───────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: string;
  timestamp?: string;
  version?: string;
}

// ── Client Options ───────────────────────────────────────────────────────────

export interface NexusBioClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}
