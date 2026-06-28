/**
 * contextManager — Project-aware context assembly for Nexus-Bio AI services.
 *
 * Aggregates data across projects, experiments, knowledge base, tool outputs,
 * and inventory into a single ProjectContext object. Designed to feed the
 * Axon copilot and NEXAI research agent with bounded, relevant context so
 * the LLM has project-specific grounding without bloating the prompt.
 *
 * Rules (non-negotiable):
 *   - Never silently send huge blobs — every field is length-capped.
 *   - Never hallucinate context — if a table is missing or empty, omit it.
 *   - The assembly is deterministic for identical database state.
 *   - All queries degrade gracefully (missing tables return empty results).
 */

import { sqlAll, sqlGet } from "../../server/libsqlDb";

// ── Types ──

/** Brief summary of the project metadata. */
export interface ProjectBrief {
  id: string;
  title: string;
  description: string | null;
  targetProduct: string | null;
  status: string | null;
}

/** A single experiment summary with key metadata. */
export interface ExperimentSummary {
  id: string;
  tool: string;
  status: string | null;
  createdAt: string;
  hasOutput: boolean;
}

/** The currently active or most recent metabolic pathway context. */
export interface ActivePathway {
  title: string;
  source: "target_product" | "decision_log" | "experiment";
  nodes: string[];
  description: string | null;
}

/** Key metrics extracted from a tool's output. */
export interface ToolResultSummary {
  tool: string;
  metrics: string;
  capturedAt: string;
}

/** Aggregate counts of inventory items for the project. */
export interface InventorySummary {
  strains: number;
  plasmids: number;
  primers: number;
  chemicals: number;
}

/** Full project context assembled from the database. */
export interface ProjectContext {
  projectBrief: ProjectBrief | null;
  recentExperiments: ExperimentSummary[];
  activePathway: ActivePathway | null;
  toolResults: ToolResultSummary[];
  inventorySummary: InventorySummary;
}

// ── Constants ──

const MAX_RECENT_EXPERIMENTS = 10;
const MAX_TOOL_RESULTS = 5;
const MAX_METRIC_LENGTH = 120;
const MAX_PATHWAY_NODES = 10;

// ── Public API ──

/**
 * Assemble a full ProjectContext from the database.
 *
 * Queries the projects, experiments, wiki/decision_log, and inventory tables
 * in parallel. Missing tables or empty results degrade gracefully — the
 * corresponding field is set to null/empty rather than throwing.
 *
 * @param projectId  The project ID to build context for.
 * @returns A ProjectContext with all available data for the given project.
 */
export async function buildProjectContext(projectId: string): Promise<ProjectContext> {
  const [projectBrief, recentExperiments, activePathway, toolResults, inventorySummary] = await Promise.all([
    fetchProjectBrief(projectId),
    fetchRecentExperiments(projectId),
    fetchActivePathway(projectId),
    fetchToolResults(projectId),
    fetchInventorySummary(projectId),
  ]);

  return {
    projectBrief,
    recentExperiments,
    activePathway,
    toolResults,
    inventorySummary,
  };
}

/**
 * Produce a compact, human-readable summary of a ProjectContext.
 *
 * Output is length-capped and suitable for injection into LLM prompts as
 * a bounded context block. Each field is included only when non-empty.
 *
 * @param context  A ProjectContext previously built by buildProjectContext.
 * @returns A plain-text summary string (typically 3–10 lines).
 */
export function summarizeContext(context: ProjectContext): string {
  const parts: string[] = [];

  if (context.projectBrief) {
    const title = context.projectBrief.title;
    const target = context.projectBrief.targetProduct;
    parts.push(target ? `Project: ${title} (target: ${target})` : `Project: ${title}`);
  }

  if (context.recentExperiments.length > 0) {
    const tools = new Set(context.recentExperiments.map((e) => e.tool));
    const completed = context.recentExperiments.filter((e) => e.status === "completed").length;
    parts.push(
      `Experiments: ${context.recentExperiments.length} recent (${completed} completed) across ${tools.size} tools`,
    );
  }

  if (context.activePathway) {
    const nodeCount = context.activePathway.nodes.length;
    parts.push(
      `Active pathway: ${context.activePathway.title} (${nodeCount} nodes, source: ${context.activePathway.source})`,
    );
  }

  if (context.toolResults.length > 0) {
    const toolNames = context.toolResults.map((r) => r.tool).join(", ");
    parts.push(`Recent tool outputs: ${toolNames}`);
  }

  const inv = context.inventorySummary;
  const invTotal = inv.strains + inv.plasmids + inv.primers + inv.chemicals;
  if (invTotal > 0) {
    const invParts: string[] = [];
    if (inv.strains > 0) invParts.push(`${inv.strains} strains`);
    if (inv.plasmids > 0) invParts.push(`${inv.plasmids} plasmids`);
    if (inv.primers > 0) invParts.push(`${inv.primers} primers`);
    if (inv.chemicals > 0) invParts.push(`${inv.chemicals} chemicals`);
    parts.push(`Inventory: ${invParts.join(", ")}`);
  }

  return parts.join("\n") || "No project context available";
}

/**
 * Recommend tool IDs based on the current project context.
 *
 * Uses a deterministic rule set:
 *   1. Follows the Nexus-Bio 4-stage research cycle to suggest next tools.
 *   2. Avoids recommending tools already used in recent experiments.
 *   3. Considers active pathway and inventory state for targeted suggestions.
 *   4. Caps output at 5 tool IDs.
 *
 * @param context  A ProjectContext previously built by buildProjectContext.
 * @returns An ordered array of recommended tool IDs (0–5 entries).
 */
export function getRelevantTools(context: ProjectContext): string[] {
  const usedTools = new Set(context.recentExperiments.map((e) => e.tool));
  const recommended: string[] = [];

  // Stage 1: Pathway & Design — always suggest PATHD if not yet used
  if (!usedTools.has("pathd") && !usedTools.has("metabolic-eng")) {
    recommended.push("pathd");
  }

  // Stage 2: Simulation & Optimization — suggest based on what has been done
  if (usedTools.has("pathd") || usedTools.has("metabolic-eng")) {
    if (!usedTools.has("cethx")) {
      recommended.push("cethx");
    }
    if (!usedTools.has("fbasim")) {
      recommended.push("fbasim");
    }
    if (!usedTools.has("catdes")) {
      recommended.push("catdes");
    }
  }

  // Stage 3: Chassis Engineering — suggest after simulation tools
  if (usedTools.has("fbasim") || usedTools.has("cethx")) {
    if (!usedTools.has("genmim")) {
      recommended.push("genmim");
    }
    if (!usedTools.has("gecair")) {
      recommended.push("gecair");
    }
  }

  // Stage 4: DBTL — suggest after chassis or if experiments exist
  if (
    (usedTools.has("genmim") || usedTools.has("gecair") || context.recentExperiments.length > 0) &&
    !usedTools.has("dbtlflow")
  ) {
    recommended.push("dbtlflow");
  }

  // Cross-cutting: suggest multi-omics if enough experiments exist
  if (context.recentExperiments.length >= 3 && !usedTools.has("multio")) {
    recommended.push("multio");
  }

  // Inventory suggestion when project has physical materials
  const inv = context.inventorySummary;
  if ((inv.strains > 0 || inv.plasmids > 0) && !usedTools.has("inventory")) {
    recommended.push("inventory");
  }

  // Remove duplicates (shouldn't happen but defensive) and cap at 5
  const unique = [...new Set(recommended)];
  return unique.slice(0, 5);
}

// ── Internal helpers ──

/**
 * Fetch the project row and map it to a ProjectBrief.
 * Returns null if the project does not exist or the table is missing.
 */
async function fetchProjectBrief(projectId: string): Promise<ProjectBrief | null> {
  try {
    const row = await sqlGet("SELECT id, title, description, target_product, status FROM projects WHERE id = ?", [
      projectId,
    ]);
    if (!row) return null;

    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string) ?? null,
      targetProduct: (row.target_product as string) ?? null,
      status: (row.status as string) ?? null,
    };
  } catch {
    // Table may not exist yet
    return null;
  }
}

/**
 * Fetch recent experiments for the project, ordered by creation date.
 */
async function fetchRecentExperiments(projectId: string): Promise<ExperimentSummary[]> {
  try {
    const rows = await sqlAll(
      `SELECT id, tool, status, output_json, created_at
       FROM experiments
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [projectId, MAX_RECENT_EXPERIMENTS],
    );

    return rows.map((row) => ({
      id: row.id as string,
      tool: row.tool as string,
      status: (row.status as string) ?? null,
      createdAt: (row.created_at as string) ?? "",
      hasOutput: row.output_json != null && (row.output_json as string).length > 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Determine the active pathway context from available data sources.
 *
 * Priority:
 *   1. Most recent decision_log entry with pathway context
 *   2. Most recent PATHD/metabolic-eng experiment with output
 *   3. Project's target_product field as a fallback
 */
async function fetchActivePathway(projectId: string): Promise<ActivePathway | null> {
  // Source 1: decision log
  try {
    const decisionRow = await sqlGet(
      `SELECT title, context, decision, options
       FROM decision_log
       WHERE project_id = ?
       ORDER BY decided_at DESC
       LIMIT 1`,
      [projectId],
    );

    if (decisionRow) {
      const description = [
        decisionRow.context ? `Context: ${truncate(decisionRow.context as string, MAX_METRIC_LENGTH)}` : null,
        decisionRow.decision ? `Decision: ${truncate(decisionRow.decision as string, MAX_METRIC_LENGTH)}` : null,
      ]
        .filter(Boolean)
        .join("; ");

      let nodes: string[] = [];
      if (decisionRow.options) {
        try {
          const parsed = JSON.parse(decisionRow.options as string);
          if (Array.isArray(parsed)) {
            nodes = parsed.slice(0, MAX_PATHWAY_NODES).map(String);
          }
        } catch {
          // Not valid JSON — ignore
        }
      }

      return {
        title: (decisionRow.title as string) ?? "Untitled pathway",
        source: "decision_log",
        nodes,
        description: description || null,
      };
    }
  } catch {
    // decision_log table may not exist
  }

  // Source 2: recent PATHD experiment with output
  try {
    const expRow = await sqlGet(
      `SELECT output_json, created_at
       FROM experiments
       WHERE project_id = ? AND tool IN ('pathd', 'metabolic-eng') AND output_json IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId],
    );

    if (expRow?.output_json) {
      try {
        const output = JSON.parse(expRow.output_json as string);
        const nodes: string[] = [];

        if (Array.isArray(output.nodes)) {
          for (const node of output.nodes) {
            const label = node.label ?? node.id ?? node.name;
            if (label) nodes.push(String(label));
            if (nodes.length >= MAX_PATHWAY_NODES) break;
          }
        }

        return {
          title: output.title ?? output.name ?? "Pathway from experiment",
          source: "experiment",
          nodes,
          description: output.description ? truncate(output.description as string, MAX_METRIC_LENGTH) : null,
        };
      } catch {
        // Invalid JSON in output_json
      }
    }
  } catch {
    // experiments table may not exist
  }

  // Source 3: project target product as fallback
  try {
    const projRow = await sqlGet("SELECT target_product FROM projects WHERE id = ?", [projectId]);
    if (projRow?.target_product) {
      return {
        title: projRow.target_product as string,
        source: "target_product",
        nodes: [],
        description: null,
      };
    }
  } catch {
    // projects table may not exist
  }

  return null;
}

/**
 * Fetch recent tool output summaries for the project.
 * Extracts key metrics from each tool's JSON output to keep context bounded.
 */
async function fetchToolResults(projectId: string): Promise<ToolResultSummary[]> {
  try {
    const rows = await sqlAll(
      `SELECT tool, output_json, created_at
       FROM experiments
       WHERE project_id = ? AND status = 'completed' AND output_json IS NOT NULL
       ORDER BY created_at DESC
       LIMIT ?`,
      [projectId, MAX_TOOL_RESULTS],
    );

    return rows.map((row) => ({
      tool: row.tool as string,
      metrics: extractToolMetrics(row.tool as string, row.output_json as string),
      capturedAt: (row.created_at as string) ?? "",
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch aggregate inventory counts for the project.
 * Each table is queried independently so a missing table doesn't block others.
 */
async function fetchInventorySummary(projectId: string): Promise<InventorySummary> {
  const summary: InventorySummary = { strains: 0, plasmids: 0, primers: 0, chemicals: 0 };

  const queries: Array<{ key: keyof InventorySummary; table: string }> = [
    { key: "strains", table: "inventory_strains" },
    { key: "plasmids", table: "inventory_plasmids" },
    { key: "primers", table: "inventory_primers" },
    { key: "chemicals", table: "inventory_chemicals" },
  ];

  await Promise.all(
    queries.map(async ({ key, table }) => {
      try {
        const rows = await sqlAll(
          `SELECT COUNT(*) as cnt FROM ${table} WHERE project_id = ? AND (archived = 0 OR archived IS NULL)`,
          [projectId],
        );
        summary[key] = (rows[0]?.cnt as number) ?? 0;
      } catch {
        // Table may not exist — leave count at 0
      }
    }),
  );

  return summary;
}

/**
 * Extract key metrics from a tool's JSON output string.
 * Returns a bounded, human-readable string of the most important values.
 */
function extractToolMetrics(tool: string, outputJson: string): string {
  let output: Record<string, unknown>;
  try {
    output = JSON.parse(outputJson);
  } catch {
    return "unparseable output";
  }

  const metrics: string[] = [];

  switch (tool) {
    case "fbasim": {
      if (output.objective != null) metrics.push(`objective=${output.objective}`);
      if (output.growthRate != null) metrics.push(`growth=${output.growthRate}`);
      if (output.fluxes && typeof output.fluxes === "object") {
        const fluxCount = Object.keys(output.fluxes as Record<string, unknown>).length;
        metrics.push(`${fluxCount} fluxes`);
      }
      break;
    }
    case "cethx": {
      if (output.deltaG != null) metrics.push(`ΔG=${output.deltaG}`);
      if (output.feasible != null) metrics.push(`feasible=${output.feasible}`);
      if (output.steps && Array.isArray(output.steps)) {
        metrics.push(`${output.steps.length} steps`);
      }
      break;
    }
    case "pathd":
    case "metabolic-eng": {
      if (output.nodes && Array.isArray(output.nodes)) metrics.push(`${output.nodes.length} nodes`);
      if (output.edges && Array.isArray(output.edges)) metrics.push(`${output.edges.length} edges`);
      break;
    }
    case "catdes": {
      if (output.candidates && Array.isArray(output.candidates)) {
        metrics.push(`${output.candidates.length} candidates`);
      }
      if (output.bindingAffinity != null) metrics.push(`ΔΔG=${output.bindingAffinity}`);
      break;
    }
    case "dyncon": {
      if (output.converged != null) metrics.push(`converged=${output.converged}`);
      if (output.settlingTime != null) metrics.push(`t_settle=${output.settlingTime}`);
      break;
    }
    case "genmim": {
      if (output.targets && Array.isArray(output.targets)) {
        metrics.push(`${output.targets.length} targets`);
      }
      if (output.viability != null) metrics.push(`viability=${output.viability}`);
      break;
    }
    case "proevol": {
      if (output.round != null) metrics.push(`round=${output.round}`);
      if (output.bestFitness != null) metrics.push(`fitness=${output.bestFitness}`);
      break;
    }
    default: {
      // Generic: count top-level keys
      const keys = Object.keys(output);
      if (keys.length > 0) {
        metrics.push(`${keys.length} result fields`);
      }
    }
  }

  if (metrics.length === 0) return "no key metrics";
  return metrics.join(", ");
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 */
function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}
