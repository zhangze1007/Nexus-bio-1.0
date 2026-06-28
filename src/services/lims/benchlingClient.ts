/**
 * Benchling API Client
 *
 * Integrates with Benchling's REST API for sequence management,
 * plate lookups, assay result uploads, and custom entity queries.
 *
 * Benchling API docs: https://docs.benchling.com/reference
 */

import type { LIMSConfig, LIMSExperiment, LIMSSample } from "./types";

export interface BenchlingClientOptions {
  /** Injected fetch function for testability */
  fetchFn?: typeof fetch;
  /** Base URL override (defaults to config.baseUrl) */
  baseUrl?: string;
}

export class BenchlingClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly config: LIMSConfig,
    options?: BenchlingClientOptions,
  ) {
    if (config.type !== "benchling") {
      throw new Error(`BenchlingClient requires config type "benchling", got "${config.type}"`);
    }
    this.baseUrl = options?.baseUrl ?? config.baseUrl;
    this.apiKey = config.credentials.api_key ?? "";
    const defaultFetch = typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined;
    this.fetchFn = options?.fetchFn ?? defaultFetch!;

    if (!this.apiKey) {
      throw new Error("BenchlingClient requires an api_key in credentials");
    }
  }

  /**
   * Build authorization headers for Benchling API requests.
   * Benchling uses HTTP Basic auth with the API key as the password.
   */
  private headers(): Record<string, string> {
    const encoded = Buffer.from(`${this.apiKey}:`).toString("base64");
    return {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Execute an API request and parse the JSON response.
   * Throws on non-2xx responses with a descriptive error.
   */
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchFn(url, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Benchling API ${response.status}: ${response.statusText}${body ? ` — ${body}` : ""}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Search sequences in Benchling by name or annotation.
   */
  async searchSequences(query: string): Promise<LIMSSample[]> {
    const data = await this.request<BenchlingSearchResponse>(
      `/api/v2/dna-sequences?name=${encodeURIComponent(query)}&limit=20`,
    );

    return (data.dnaSequences ?? []).map((seq) => ({
      id: `benchling-${seq.id}`,
      name: seq.name ?? "Unnamed",
      type: "plasmid" as const,
      properties: {
        length: seq.length,
        bases: seq.bases,
        annotations: seq.annotations,
        folderId: seq.folderId,
      },
      externalId: seq.id,
      source: "lims" as const,
    }));
  }

  /**
   * Get a single sequence by Benchling ID.
   */
  async getSequence(id: string): Promise<LIMSSample> {
    const seq = await this.request<BenchlingSequence>(`/api/v2/dna-sequences/${encodeURIComponent(id)}`);

    return {
      id: `benchling-${seq.id}`,
      name: seq.name ?? "Unnamed",
      type: "plasmid",
      properties: {
        length: seq.length,
        bases: seq.bases,
        annotations: seq.annotations,
        folderId: seq.folderId,
      },
      externalId: seq.id,
      source: "lims",
    };
  }

  /**
   * Create a new DNA sequence entry in Benchling.
   * Returns the Benchling-assigned ID.
   */
  async createSequence(sample: LIMSSample): Promise<string> {
    const body = {
      name: sample.name,
      bases: (sample.properties.bases as string) ?? "ATCG",
      folderId: (sample.properties.folderId as string) ?? undefined,
      annotations: (sample.properties.annotations as unknown[]) ?? [],
    };

    const result = await this.request<BenchlingSequence>("/api/v2/dna-sequences", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return result.id;
  }

  /**
   * Search plates by barcode.
   */
  async searchPlates(barcode: string): Promise<LIMSSample[]> {
    const data = await this.request<BenchlingPlateSearchResponse>(
      `/api/v2/plates?barcode=${encodeURIComponent(barcode)}&limit=10`,
    );

    return (data.plates ?? []).map((plate) => ({
      id: `benchling-plate-${plate.id}`,
      name: plate.name ?? `Plate ${plate.barcode}`,
      type: "other" as const,
      properties: {
        barcode: plate.barcode,
        plateType: plate.plateType,
        wellCount: plate.wellCount,
      },
      externalId: plate.id,
      source: "lims" as const,
    }));
  }

  /**
   * Upload assay results as a Benchling run (assay run).
   */
  async uploadAssayResults(experiment: LIMSExperiment): Promise<string> {
    const body = {
      name: experiment.title,
      notes: experiment.description,
      fields: experiment.results,
    };

    const result = await this.request<{ id: string }>("/api/v2/assay-runs", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return result.id;
  }

  /**
   * Get custom entities by type (e.g., strains, cell lines).
   */
  async getCustomEntities(type: string): Promise<LIMSSample[]> {
    const data = await this.request<BenchlingCustomEntitySearchResponse>(
      `/api/v2/custom-entities?schema=${encodeURIComponent(type)}&limit=50`,
    );

    return (data.customEntities ?? []).map((entity) => ({
      id: `benchling-entity-${entity.id}`,
      name: entity.name ?? "Unnamed",
      type: this.classifyEntityType(entity.fields),
      properties: entity.fields ?? {},
      externalId: entity.id,
      source: "lims" as const,
    }));
  }

  /**
   * Classify a Benchling custom entity into a Nexus-Bio sample type.
   */
  private classifyEntityType(fields: Record<string, unknown> | undefined): LIMSSample["type"] {
    const entityKind = String(fields?.type ?? fields?.kind ?? "").toLowerCase();
    if (entityKind.includes("strain") || entityKind.includes("cell")) return "strain";
    if (entityKind.includes("plasmid") || entityKind.includes("vector")) return "plasmid";
    if (entityKind.includes("primer") || entityKind.includes("oligo")) return "primer";
    if (entityKind.includes("chemical") || entityKind.includes("reagent")) return "chemical";
    return "other";
  }
}

// ── Benchling API Response Types ──

interface BenchlingSequence {
  id: string;
  name?: string;
  bases?: string;
  length?: number;
  annotations?: unknown[];
  folderId?: string;
}

interface BenchlingSearchResponse {
  dnaSequences?: BenchlingSequence[];
  nextToken?: string;
}

interface BenchlingPlate {
  id: string;
  name?: string;
  barcode?: string;
  plateType?: string;
  wellCount?: number;
}

interface BenchlingPlateSearchResponse {
  plates?: BenchlingPlate[];
  nextToken?: string;
}

interface BenchlingCustomEntity {
  id: string;
  name?: string;
  fields?: Record<string, unknown>;
}

interface BenchlingCustomEntitySearchResponse {
  customEntities?: BenchlingCustomEntity[];
  nextToken?: string;
}
