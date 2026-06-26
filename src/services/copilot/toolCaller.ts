/**
 * Tool Caller — routes Copilot tool calls to the appropriate Nexus-Bio service.
 *
 * Each tool maps to an HTTP endpoint (internal API route) or a direct
 * service call. The caller is intentionally simple: it does NOT use the
 * full DAG executor because Copilot tool calls are single-step, not DAGs.
 *
 * For multi-step plans, the Copilot should emit multiple sequential tool calls.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ToolCallRequest {
  tool: string;
  inputs: Record<string, unknown>;
  conversationId: string;
}

export interface ToolCallResult {
  id: string;
  tool: string;
  inputs: Record<string, unknown>;
  status: "completed" | "failed";
  result?: unknown;
  error?: string;
  durationMs: number;
}

// ── Tool route map ────────────────────────────────────────────────────

/**
 * Map of tool names to their internal API endpoints.
 * All endpoints are POST-only.
 */
const TOOL_ROUTES: Record<string, string> = {
  fbasim: "/api/fba",
  // Other tools use the analyze endpoint with tool-specific prompts
  pathd: "/api/analyze",
  cethx: "/api/analyze",
  catdes: "/api/analyze",
  proevol: "/api/analyze",
  cellfree: "/api/analyze",
  gecair: "/api/analyze",
  genmim: "/api/analyze",
  dyncon: "/api/analyze",
  multio: "/api/analyze",
  scspatial: "/api/scspatial/query",
  dbtlflow: "/api/analyze",
  nexai: "/api/analyze",
  metabolic: "/api/analyze",
};

// ── Executor ──────────────────────────────────────────────────────────

function generateId(): string {
  return `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Execute a single tool call.
 *
 * For FBA and ScSpatial, calls the dedicated endpoint directly.
 * For all other tools, wraps the request as an analyze call with
 * the tool name as context.
 */
export async function executeToolCall(
  request: ToolCallRequest,
): Promise<ToolCallResult> {
  const id = generateId();
  const startTime = Date.now();
  const route = TOOL_ROUTES[request.tool];

  if (!route) {
    return {
      id,
      tool: request.tool,
      inputs: request.inputs,
      status: "failed",
      error: `Unknown tool: ${request.tool}. Available tools: ${Object.keys(TOOL_ROUTES).join(", ")}`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const body = buildRequestBody(request);
    const res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      return {
        id,
        tool: request.tool,
        inputs: request.inputs,
        status: "failed",
        error: `Tool returned ${res.status}: ${errorText}`,
        durationMs: Date.now() - startTime,
      };
    }

    const result = await res.json();
    return {
      id,
      tool: request.tool,
      inputs: request.inputs,
      status: "completed",
      result,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      id,
      tool: request.tool,
      inputs: request.inputs,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function buildRequestBody(
  request: ToolCallRequest,
): Record<string, unknown> {
  const { tool, inputs } = request;

  // FBA has its own request format
  if (tool === "fbasim") {
    return inputs;
  }

  // ScSpatial query has its own format
  if (tool === "scspatial") {
    return inputs;
  }

  // All other tools go through the analyze endpoint with tool context
  const toolDesc =
    `You are executing the "${tool}" tool. ` +
    `User request: ${JSON.stringify(inputs)}. ` +
    `Return a structured analysis appropriate for the ${tool} tool.`;

  return {
    searchQuery: toolDesc,
  };
}

/**
 * Extract a tool_call JSON block from LLM response text.
 * Returns null if no tool call is found.
 */
export function extractToolCall(
  text: string,
): { tool: string; inputs: Record<string, unknown> } | null {
  const match = text.match(/```tool_call\s*\n([\s\S]*?)\n```/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.tool === "string" &&
      typeof parsed.inputs === "object"
    ) {
      return { tool: parsed.tool, inputs: parsed.inputs };
    }
  } catch {
    // Not valid JSON — ignore
  }
  return null;
}
