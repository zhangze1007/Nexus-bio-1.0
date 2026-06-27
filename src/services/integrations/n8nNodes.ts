/**
 * n8n Custom Node Definitions for Nexus-Bio.
 *
 * Each node follows the n8n IExecuteFunctions contract at a type level:
 *   - name:        machine-readable identifier
 *   - description: human-readable summary
 *   - inputs:      expected data shape per execution
 *   - outputs:     produced data shape per execution
 *   - execute():   pure async function that maps input to output
 *
 * These definitions can be consumed by an n8n node-code wrapper or
 * registered with the n8n community node registry.
 *
 * Pure TypeScript -- no external runtime dependencies.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Generic n8n node input/output descriptor. */
export interface NodePort {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
}

/** Result returned by every node's execute function. */
export interface NodeExecutionResult<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
}

/** Base contract that all Nexus-Bio n8n nodes implement. */
export interface N8nNodeDefinition {
  name: string;
  displayName: string;
  description: string;
  group: "trigger" | "action" | "analysis";
  inputs: NodePort[];
  outputs: NodePort[];
  execute(input: Record<string, unknown>): Promise<NodeExecutionResult>;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function timedExecution<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; elapsed: number }> {
  const start = performance.now();
  const result = await fn();
  const elapsed = Math.round(performance.now() - start);
  return { result, elapsed };
}

// ---------------------------------------------------------------------------
// 1. NexusBioTrigger
// ---------------------------------------------------------------------------

/**
 * Trigger node -- polls for new Nexus-Bio events matching a filter.
 * In n8n this would be a polling trigger; here we expose the poll logic.
 */
export const NexusBioTrigger: N8nNodeDefinition = {
  name: "nexusBioTrigger",
  displayName: "Nexus-Bio Event Trigger",
  description:
    "Polls the Nexus-Bio event store for new events matching a type filter. " +
    "Returns the latest batch of events since the last poll timestamp.",
  group: "trigger",

  inputs: [
    { name: "eventType", type: "string", description: "Event type to filter on (e.g. experiment.completed)", required: true },
    { name: "since", type: "string", description: "ISO-8601 timestamp to poll from (optional, defaults to last 5 minutes)" },
    { name: "limit", type: "number", description: "Max events to return per poll (default 50)" },
  ],

  outputs: [
    { name: "events", type: "array", description: "Array of matching event objects" },
    { name: "count", type: "number", description: "Number of events returned" },
    { name: "pollTimestamp", type: "string", description: "ISO-8601 timestamp of this poll" },
  ],

  async execute(input) {
    const { result, elapsed } = await timedExecution(async () => {
      const eventType = String(input.eventType || "");
      if (!eventType) throw new Error("eventType is required");

      const limit = typeof input.limit === "number" && input.limit > 0 ? Math.min(input.limit, 500) : 50;
      const since = typeof input.since === "string" && input.since
        ? input.since
        : new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // In a real deployment this queries the event store.
      // Here we return the structured envelope so n8n can wire it.
      return {
        events: [] as Record<string, unknown>[],
        count: 0,
        pollTimestamp: new Date().toISOString(),
        _meta: { eventType, since, limit },
      };
    });

    return { success: true, data: result, executionTimeMs: elapsed };
  },
};

// ---------------------------------------------------------------------------
// 2. NexusBioFBA
// ---------------------------------------------------------------------------

export interface FBANodeInput {
  model: string;
  objective?: string;
  reactions?: Array<{ id: string; lowerBound: number; upperBound: number }>;
  knockouts?: string[];
  overexpressions?: string[];
}

export interface FBANodeOutput {
  objectiveValue: number;
  fluxes: Record<string, number>;
  status: "optimal" | "infeasible" | "unbounded";
  shadowPrices?: Record<string, number>;
  carbonEfficiency?: number;
}

/**
 * Action node -- runs Flux Balance Analysis on a metabolic model.
 */
export const NexusBioFBA: N8nNodeDefinition = {
  name: "nexusBioFBA",
  displayName: "Nexus-Bio FBA Solver",
  description:
    "Runs Flux Balance Analysis on a genome-scale metabolic model. " +
    "Supports knockouts, overexpression strategies, and returns flux distributions.",
  group: "action",

  inputs: [
    { name: "model", type: "string", description: "Model identifier (e.g. 'e_coli_core' or BiGG model id)", required: true },
    { name: "objective", type: "string", description: "Objective reaction id (optional, uses model default)" },
    { name: "reactions", type: "array", description: "Reaction bound overrides" },
    { name: "knockouts", type: "array", description: "Reaction ids to knock out" },
    { name: "overexpressions", type: "array", description: "Reaction ids to overexpress" },
  ],

  outputs: [
    { name: "objectiveValue", type: "number", description: "Optimal objective value" },
    { name: "fluxes", type: "object", description: "Flux distribution map (reaction id -> flux)" },
    { name: "status", type: "string", description: "Solver status: optimal, infeasible, or unbounded" },
    { name: "shadowPrices", type: "object", description: "Dual values for metabolite constraints" },
    { name: "carbonEfficiency", type: "number", description: "Fraction of carbon routed to objective" },
  ],

  async execute(input) {
    const { result, elapsed } = await timedExecution(async () => {
      const model = String(input.model || "");
      if (!model) throw new Error("model is required");

      // Build the FBA request payload.
      // In production this POSTs to /api/fba; here we return the envelope.
      const fbaRequest = {
        model,
        objective: input.objective ? String(input.objective) : undefined,
        reactions: Array.isArray(input.reactions) ? input.reactions : [],
        knockouts: Array.isArray(input.knockouts) ? input.knockouts : [],
        overexpressions: Array.isArray(input.overexpressions) ? input.overexpressions : [],
      };

      // Stub result -- real execution calls the FBA simplex solver.
      return {
        objectiveValue: 0,
        fluxes: {} as Record<string, number>,
        status: "optimal" as const,
        shadowPrices: {} as Record<string, number>,
        carbonEfficiency: 0,
        _request: fbaRequest,
      };
    });

    return { success: true, data: result, executionTimeMs: elapsed };
  },
};

// ---------------------------------------------------------------------------
// 3. NexusBioInventory
// ---------------------------------------------------------------------------

export type InventoryCRUDAction = "create" | "read" | "update" | "delete" | "list";

export interface InventoryNodeInput {
  action: InventoryCRUDAction;
  itemType?: string;
  itemId?: string;
  data?: Record<string, unknown>;
  filters?: Record<string, unknown>;
}

export interface InventoryNodeOutput {
  action: InventoryCRUDAction;
  item?: Record<string, unknown>;
  items?: Record<string, unknown>[];
  success: boolean;
}

/**
 * Action node -- CRUD operations on the Nexus-Bio inventory.
 */
export const NexusBioInventory: N8nNodeDefinition = {
  name: "nexusBioInventory",
  displayName: "Nexus-Bio Inventory CRUD",
  description:
    "Performs create, read, update, delete, or list operations on the " +
    "Nexus-Bio lab inventory (plasmids, strains, chemicals, primers, etc.).",
  group: "action",

  inputs: [
    { name: "action", type: "string", description: "CRUD action: create | read | update | delete | list", required: true },
    { name: "itemType", type: "string", description: "Inventory item type (e.g. PLASMID, STRAIN, CHEMICAL)" },
    { name: "itemId", type: "string", description: "Specific item id (required for read/update/delete)" },
    { name: "data", type: "object", description: "Item payload (required for create/update)" },
    { name: "filters", type: "object", description: "Query filters for list action" },
  ],

  outputs: [
    { name: "action", type: "string", description: "The action that was performed" },
    { name: "item", type: "object", description: "Single item (for read/create/update/delete)" },
    { name: "items", type: "array", description: "Multiple items (for list)" },
    { name: "success", type: "boolean", description: "Whether the operation succeeded" },
  ],

  async execute(input) {
    const { result, elapsed } = await timedExecution(async () => {
      const action = String(input.action || "") as InventoryCRUDAction;
      const validActions: InventoryCRUDAction[] = ["create", "read", "update", "delete", "list"];
      if (!validActions.includes(action)) {
        throw new Error(`action must be one of: ${validActions.join(", ")}`);
      }

      if ((action === "read" || action === "update" || action === "delete") && !input.itemId) {
        throw new Error(`itemId is required for ${action} action`);
      }
      if ((action === "create" || action === "update") && !input.data) {
        throw new Error(`data payload is required for ${action} action`);
      }

      // In production this delegates to the inventory service.
      // Here we return a structured envelope.
      return {
        action,
        item: action !== "list" ? (input.data || { id: input.itemId }) : undefined,
        items: action === "list" ? [] : undefined,
        success: true,
      };
    });

    return { success: true, data: result, executionTimeMs: elapsed };
  },
};

// ---------------------------------------------------------------------------
// 4. NexusBioAnalysis
// ---------------------------------------------------------------------------

export interface AnalysisNodeInput {
  query: string;
  mode?: "analyze" | "search" | "summarize";
  context?: Record<string, unknown>;
  model?: string;
}

export interface AnalysisNodeOutput {
  answer: string;
  citations: string[];
  confidence: number;
  mode: string;
}

/**
 * Action node -- sends a query to the Nexus-Bio AI analysis pipeline.
 */
export const NexusBioAnalysis: N8nNodeDefinition = {
  name: "nexusBioAnalysis",
  displayName: "Nexus-Bio AI Analysis",
  description:
    "Submits a natural-language query to the Nexus-Bio AI pipeline (Groq primary, " +
    "Gemini fallback). Returns an answer with citations and a confidence score.",
  group: "analysis",

  inputs: [
    { name: "query", type: "string", description: "Natural-language analysis query", required: true },
    { name: "mode", type: "string", description: "Analysis mode: analyze | search | summarize (default: analyze)" },
    { name: "context", type: "object", description: "Optional context (pathway data, experiment ids, etc.)" },
    { name: "model", type: "string", description: "Preferred model override (e.g. 'llama-3.3-70b-versatile')" },
  ],

  outputs: [
    { name: "answer", type: "string", description: "AI-generated answer text" },
    { name: "citations", type: "array", description: "Referenced literature / database ids" },
    { name: "confidence", type: "number", description: "Confidence score 0-1" },
    { name: "mode", type: "string", description: "Mode that was used" },
  ],

  async execute(input) {
    const { result, elapsed } = await timedExecution(async () => {
      const query = String(input.query || "");
      if (!query.trim()) throw new Error("query is required and must be non-empty");

      const mode = (["analyze", "search", "summarize"].includes(String(input.mode))
        ? String(input.mode)
        : "analyze") as "analyze" | "search" | "summarize";

      // In production this POSTs to /api/analyze with the Axon system prompt.
      // Here we return the structured envelope.
      return {
        answer: "",
        citations: [] as string[],
        confidence: 0,
        mode,
        _meta: { query, context: input.context, model: input.model },
      };
    });

    return { success: true, data: result, executionTimeMs: elapsed };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All Nexus-Bio n8n node definitions. */
export const NEXUS_BIO_NODES: N8nNodeDefinition[] = [
  NexusBioTrigger,
  NexusBioFBA,
  NexusBioInventory,
  NexusBioAnalysis,
];

/** Lookup a node by its machine name. */
export function getNodeByName(name: string): N8nNodeDefinition | undefined {
  return NEXUS_BIO_NODES.find((node) => node.name === name);
}

/** Return the list of all node names. */
export function listNodeNames(): string[] {
  return NEXUS_BIO_NODES.map((node) => node.name);
}
