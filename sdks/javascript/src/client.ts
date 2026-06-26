/**
 * Nexus-Bio JavaScript/TypeScript SDK client.
 *
 * @example
 * ```ts
 * import { NexusBioClient } from 'nexus-bio';
 *
 * const client = new NexusBioClient({ apiKey: 'your-key' });
 * const result = await client.analyze('Design an artemisinin pathway');
 * console.log(result.candidates?.[0]?.content?.parts?.[0]?.text);
 * ```
 */

import type {
  AnalyzeRequest,
  AnalyzeResponse,
  FBARequest,
  FBAResponse,
  HealthStatus,
  InventoryListResponse,
  NexusBioClientOptions,
  ProjectSummary,
} from './types';

const DEFAULT_BASE_URL = 'https://nexus-bio-1-0.vercel.app';
const DEFAULT_TIMEOUT = 30_000;

/**
 * Custom error class for Nexus-Bio API errors.
 */
export class NexusBioError extends Error {
  public readonly statusCode: number;
  public readonly responseBody?: unknown;

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message);
    this.name = 'NexusBioError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * Client for the Nexus-Bio REST API.
 */
export class NexusBioClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: NexusBioClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
  }

  // ── Public API methods ───────────────────────────────────────────────────

  /**
   * Send a research query to the AI assistant.
   */
  async analyze(
    prompt: string,
    context?: Record<string, unknown>,
    options?: { history?: AnalyzeRequest['history']; searchQuery?: string },
  ): Promise<AnalyzeResponse> {
    const payload: AnalyzeRequest = { prompt };
    if (context !== undefined) payload.context = context;
    if (options?.history !== undefined) payload.history = options.history;
    if (options?.searchQuery !== undefined) payload.searchQuery = options.searchQuery;
    return this.post<AnalyzeResponse>('/api/analyze', payload);
  }

  /**
   * List all workbench projects.
   */
  async listProjects(): Promise<ProjectSummary[]> {
    const raw = await this.get<ProjectSummary[] | ProjectSummary>('/api/workbench');
    return Array.isArray(raw) ? raw : [raw];
  }

  /**
   * Run a Flux Balance Analysis simulation.
   */
  async runFBA(params: {
    objective?: 'biomass' | 'product' | 'atp';
    species?: 'ecoli' | 'yeast';
    mode?: 'single' | 'community';
    action?: 'fba' | 'fva' | 'pfba' | 'knockout' | 'fseof' | 'optknock';
    glucoseUptake?: number;
    oxygenUptake?: number;
    knockouts?: string[];
    alpha?: number;
    model?: Record<string, unknown>;
  } = {}): Promise<FBAResponse> {
    const payload: FBARequest = {
      mode: params.mode || 'single',
      species: params.species || 'ecoli',
      objective: params.objective || 'biomass',
      action: params.action || 'fba',
      glucoseUptake: params.glucoseUptake ?? 10,
      oxygenUptake: params.oxygenUptake ?? 12,
      knockouts: params.knockouts || [],
      alpha: params.alpha ?? 0.5,
    };
    if (params.model !== undefined) payload.model = params.model;
    return this.post<FBAResponse>('/api/fba', payload);
  }

  /**
   * List inventory items of a given type.
   */
  async listInventory(
    type: string,
    options?: { projectId?: string; search?: string; limit?: number; offset?: number },
  ): Promise<InventoryListResponse> {
    const params = new URLSearchParams();
    if (options?.projectId) params.set('projectId', options.projectId);
    if (options?.search) params.set('search', options.search);
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    const qs = params.toString();
    const path = `/api/inventory/${type}${qs ? `?${qs}` : ''}`;
    return this.get<InventoryListResponse>(path);
  }

  /**
   * Create a new inventory item.
   */
  async createInventoryItem(type: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>(`/api/inventory/${type}`, data);
  }

  /**
   * Check API health.
   */
  async health(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/api/health');
  }

  /**
   * Fetch AlphaFold protein structure for a UniProt ID.
   */
  async analyzeProtein(uniprotId: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(`/api/alphafold?id=${encodeURIComponent(uniprotId)}`);
  }

  /**
   * Look up a PubChem molecule by name or CID.
   */
  async lookupMolecule(options: { name?: string; cid?: number }): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (options.name) params.set('name', options.name);
    if (options.cid !== undefined) params.set('cid', String(options.cid));
    return this.get<Record<string, unknown>>(`/api/pubchem?${params.toString()}`);
  }

  /**
   * Search the KEGG pathway database.
   */
  async searchKEGG(query: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(`/api/kegg?q=${encodeURIComponent(query)}`);
  }

  // ── Internal HTTP helpers ────────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
        },
        signal: controller.signal,
      });
      return this.handleResponse<T>(response);
    } finally {
      clearTimeout(timer);
    }
  }

  private async post<T>(path: string, data: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      return this.handleResponse<T>(response);
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      return (await response.json()) as T;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = { error: await response.text().catch(() => `HTTP ${response.status}`) };
    }

    const message =
      (body as Record<string, unknown>)?.error ??
      (body as Record<string, unknown>)?.message ??
      `HTTP ${response.status}`;

    throw new NexusBioError(String(message), response.status, body);
  }
}
