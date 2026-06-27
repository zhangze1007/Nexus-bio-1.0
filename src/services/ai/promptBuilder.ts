/**
 * promptBuilder — Structured prompt construction for Nexus-Bio AI services.
 *
 * Provides three prompt builders for different AI interaction modes:
 *   1. buildAnalysisPrompt  — scientific analysis with tool-aware context
 *   2. buildPlanningPrompt  — multi-step planning with tool catalog
 *   3. buildCorrectionPrompt — error recovery with diagnostic context
 *
 * All builders are pure functions: they take typed inputs and return a
 * string. No side effects, no LLM calls, no state mutation.
 *
 * Design notes:
 *   - Output format instructions are always appended so the LLM knows
 *     exactly what shape to return.
 *   - The tool catalog is derived from the canonical TOOL_DEFINITIONS
 *     registry to stay in sync with the platform.
 *   - Scientific rigor obligations mirror the Axon system prompt and
 *     copilot behavior rules already established in the codebase.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Contextual metadata that shapes the analysis prompt. */
export interface AnalysisContext {
  /** Active tool page (e.g. "fbasim", "cethx") — or null for general. */
  activeTool?: string;
  /** Current pathway/product context (e.g. "artemisinin biosynthesis"). */
  pathwayContext?: string;
  /** Recent experiment summaries to ground the response. */
  recentExperiments?: string[];
  /** Workbench project brief. */
  projectBrief?: string;
  /** Conversation history summary for multi-turn continuity. */
  conversationSummary?: string;
  /** Whether the user expects structured JSON output. */
  outputFormat?: "json" | "prose";
}

/** A tool entry available for planning. */
export interface PlanningTool {
  id: string;
  name: string;
  description: string;
  /** What this tool produces (e.g. "flux map", "ΔG cascade"). */
  outputs: string[];
  /** Whether an adapter is currently registered for this tool. */
  available: boolean;
}

/** Diagnostic context for a failed task. */
export interface CorrectionTask {
  /** Tool that was executing when the error occurred. */
  tool: string;
  /** Human-readable task description. */
  label: string;
  /** Original input that was passed to the tool. */
  originalInput: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool catalog (compact descriptions for prompt injection)
// ---------------------------------------------------------------------------

const TOOL_PROMPT_CATALOG: Record<string, string> = {
  pathd: "Pathway Designer — discover and design metabolic routes, 3D visualization, bottleneck identification.",
  "metabolic-eng": "Metabolic Engineering Lab — full 3D metabolic lab with FBA overlays and force-directed layout.",
  catdes: "Catalyst Designer — enzyme design, binding affinity, mutagenesis targeting, Pareto optimization.",
  proevol: "Protein Evolution — fitness landscape, evolution trajectory, variant library, campaign tracking.",
  fbasim: "Flux Balance Analysis — LP-based flux optimization, knockout/OE strategies, shadow prices, carbon efficiency.",
  dyncon: "Dynamic Control — bioreactor simulation, Hill-function feedback, RK4 ODE integration, convergence.",
  cethx: "Cell Thermodynamics — condition-aware ΔG' via Alberty transform, ATP accounting, feasibility assessment.",
  gecair: "Gene Circuit Reasoner — logic gate design, Hill curve modeling, circuit dynamics, phase-space analysis.",
  multio: "Multi-Omics Integration — VAE/UMAP embeddings, volcano plots, MOFA+ factor analysis, perturbation prediction.",
  scspatial: "Single-Cell Spatial — hexagonal spot grid, UMAP spatial viz, cluster analysis, gene expression heatmap.",
  cellfree: "Cell-Free Sandbox — TX-TL simulation, expression yield prediction, resource-aware modeling.",
  dbtlflow: "DBTL Cycle Tracker — iteration waterfall, protocol generation, SBOL export, delta pack management.",
  genmim: "Gene Minimization — CRISPRi knockdown scheduling, genome map, greedy optimization, viability constraints.",
  nexai: "Axon Research Agent — citation network, Socratic questioning, literature support mapping, synthesis export.",
};

// ---------------------------------------------------------------------------
// Shared prompt fragments
// ---------------------------------------------------------------------------

const SYSTEM_IDENTITY = `You are Axon, the predictive design core of Nexus-Bio — a synthetic biology research platform.
Your mission: provide scientifically rigorous, evidence-based analysis. Every quantitative claim must cite an algorithm, database, or literature source.`;

const SCIENTIFIC_RIGOR_RULES = `## Scientific Rigor Obligations

1. Never fabricate ΔG values, Km/Kcat constants, EC numbers, or citations.
2. When exact data is unavailable, provide best-effort estimates based on structural analogs or thermodynamic heuristics — and label them as estimates.
3. Distinguish between simulated/demo data and real/user-uploaded data.
4. For every quantitative claim, include the algorithm or source used (e.g. "BRENDA kinetics", "group contribution ΔG", "LP simplex FBA").
5. If the question falls outside synthetic biology, say so plainly rather than forcing an answer.`;

const TOOL_CALL_INSTRUCTIONS = `## Tool Calling

When a computation requires a Nexus-Bio tool, respond with a JSON block:

\`\`\`tool_call
{ "tool": "<tool_id>", "inputs": { ... } }
\`\`\`

Do not fabricate tool outputs — wait for the actual result. If the question can be answered without running a tool, respond in plain prose.`;

// ---------------------------------------------------------------------------
// buildAnalysisPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a structured prompt for scientific analysis.
 *
 * Assembles: system identity + scientific rigor rules + tool catalog +
 * pathway/project context + the user's input + output format instructions.
 *
 * @param input  The user's raw question or analysis request.
 * @param context  Optional contextual metadata (active tool, pathway, etc.).
 * @returns A complete prompt string ready to send to an LLM.
 */
export function buildAnalysisPrompt(
  input: string,
  context: AnalysisContext = {},
): string {
  const sections: string[] = [SYSTEM_IDENTITY, "", SCIENTIFIC_RIGOR_RULES];

  // Tool catalog — include all or just the active tool
  const catalogLines = buildToolCatalogSection(context.activeTool);
  sections.push("", catalogLines);

  // Context sections
  if (context.pathwayContext) {
    sections.push("", `## Active Pathway\n${context.pathwayContext}`);
  }
  if (context.projectBrief) {
    sections.push("", `## Current Project\n${context.projectBrief}`);
  }
  if (context.recentExperiments && context.recentExperiments.length > 0) {
    const expList = context.recentExperiments.map((e) => `- ${e}`).join("\n");
    sections.push("", `## Recent Experiments\n${expList}`);
  }
  if (context.conversationSummary) {
    sections.push(
      "",
      `## Conversation History\n${context.conversationSummary}`,
    );
  }

  // Tool calling instructions (only when an active tool is specified)
  if (context.activeTool) {
    sections.push("", TOOL_CALL_INSTRUCTIONS);
  }

  // User input
  sections.push("", `## User Request\n${input}`);

  // Output format
  const format = context.outputFormat ?? "prose";
  sections.push("", buildOutputFormatSection(format));

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// buildPlanningPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a structured prompt for multi-step planning.
 *
 * The LLM receives a goal, the list of available tools (with capability
 * descriptions and availability status), and instructions to produce a
 * step-by-step plan as structured JSON.
 *
 * @param goal   Natural-language description of what the user wants to achieve.
 * @param tools  List of tools the planner can choose from.
 * @returns A complete prompt string ready to send to an LLM.
 */
export function buildPlanningPrompt(
  goal: string,
  tools: PlanningTool[],
): string {
  const sections: string[] = [
    SYSTEM_IDENTITY,
    "",
    `You are acting as a multi-step research planner. Given a goal and a catalog of available tools, produce an ordered plan that achieves the goal using the fewest necessary steps.`,
    "",
    "## Planning Rules",
    "",
    "1. Each step must reference exactly one tool from the catalog below.",
    "2. Respect tool dependencies — if step B needs output from step A, declare the dependency.",
    "3. Never propose a step for a tool marked [UNAVAILABLE] — suggest an alternative or note the gap.",
    "4. Cap the plan at 5 steps maximum. If the goal requires more, break it into phases.",
    "5. Each step must have a clear objective and expected output.",
    "6. If the goal is ambiguous, produce a plan for the most likely interpretation and note the assumption.",
  ];

  // Tool catalog
  const toolLines = tools
    .map((t) => {
      const status = t.available ? "" : " [UNAVAILABLE]";
      const outputs = t.outputs.length > 0 ? ` -> ${t.outputs.join(", ")}` : "";
      return `- **${t.id}**${status}: ${t.description}${outputs}`;
    })
    .join("\n");
  sections.push("", `## Available Tools\n${toolLines}`);

  // Goal
  sections.push("", `## Goal\n${goal}`);

  // Output format
  sections.push(
    "",
    `## Required Output Format

Return a JSON object with this structure — no markdown, no prose outside the JSON:

\`\`\`
{
  "plan": [
    {
      "step": 1,
      "tool": "<tool_id>",
      "objective": "What this step accomplishes",
      "inputSummary": "Key inputs needed (reference previous step outputs as step_N.output)",
      "expectedOutput": "What this step produces",
      "dependsOn": []
    }
  ],
  "assumptions": ["Any assumptions made about ambiguous parts of the goal"],
  "warnings": ["Risks, missing tools, or data gaps"]
}
\`\`\``,
  );

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// buildCorrectionPrompt
// ---------------------------------------------------------------------------

/**
 * Builds a structured prompt for error correction and parameter adjustment.
 *
 * Given a failed task, its error, and the parameters that caused the failure,
 * the LLM is asked to diagnose the root cause and suggest corrected parameters.
 *
 * @param task    Description of the failed task.
 * @param error   The error message or diagnostic output.
 * @param params  The original parameters that were used.
 * @returns A complete prompt string ready to send to an LLM.
 */
export function buildCorrectionPrompt(
  task: CorrectionTask,
  error: string,
  params: Record<string, unknown>,
): string {
  const sections: string[] = [
    SYSTEM_IDENTITY,
    "",
    `You are acting as a diagnostic and self-correction agent. A tool execution has failed. Analyze the error, identify the root cause, and suggest corrected parameters for retry.`,
    "",
    "## Correction Rules",
    "",
    "1. Identify the specific failure mode from the error message.",
    "2. Determine whether the error is recoverable (parameter adjustment) or fundamental (tool/data limitation).",
    "3. For recoverable errors: suggest minimal parameter changes that fix the issue.",
    "4. For fundamental errors: explain why the tool cannot succeed and suggest an alternative approach.",
    "5. Never suggest the exact same parameters that already failed.",
    "6. Consider the tool's known constraints (e.g., FBA requires feasible stoichiometry, ΔG assumes standard conditions).",
  ];

  // Tool context
  const toolDesc = TOOL_PROMPT_CATALOG[task.tool] ?? task.tool;
  sections.push("", `## Failed Tool\n- **${task.tool}**: ${toolDesc}`);
  sections.push("", `## Task Description\n${task.label}`);

  // Error details
  sections.push("", `## Error Message\n${error}`);

  // Original parameters
  const paramsJson = JSON.stringify(params, null, 2);
  sections.push("", `## Original Parameters\n\`\`\`json\n${paramsJson}\n\`\`\``);

  // Output format
  sections.push(
    "",
    `## Required Output Format

Return a JSON object — no markdown, no prose outside the JSON:

\`\`\`
{
  "diagnosis": "One-sentence root cause analysis",
  "recoverable": true,
  "suggestedParameters": { ... },
  "parameterChanges": [
    { "field": "paramName", "oldValue": "...", "newValue": "...", "reason": "..." }
  ],
  "alternativeApproach": "If not recoverable, describe an alternative strategy",
  "confidence": 0.0
}
\`\`\`

- "confidence" is your estimated probability (0.0–1.0) that the suggested parameters will succeed.
- "suggestedParameters" should be the complete input object ready for retry.
- "parameterChanges" should list only the fields you changed, with reasons.`,
  );

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds the tool catalog section for prompts.
 * If an active tool is specified, it is highlighted first; remaining tools
 * are listed in the catalog for cross-tool awareness.
 */
function buildToolCatalogSection(activeTool?: string): string {
  if (activeTool) {
    const activeDesc = TOOL_PROMPT_CATALOG[activeTool];
    if (activeDesc) {
      const otherTools = Object.entries(TOOL_PROMPT_CATALOG)
        .filter(([id]) => id !== activeTool)
        .map(([id, desc]) => `- **${id}**: ${desc}`)
        .join("\n");
      return `## Active Tool\n- **${activeTool}**: ${activeDesc}\n\n## Other Available Tools\n${otherTools}`;
    }
  }

  const allTools = Object.entries(TOOL_PROMPT_CATALOG)
    .map(([id, desc]) => `- **${id}**: ${desc}`)
    .join("\n");
  return `## Available Tools\n${allTools}`;
}

/**
 * Builds output format instructions based on the requested format.
 */
function buildOutputFormatSection(format: "json" | "prose"): string {
  if (format === "json") {
    return `## Output Format

Return strict JSON only — no markdown fences, no prose outside the JSON.
Every claim must include an "evidence" or "source" field.
Numeric values must use actual computed numbers, not placeholders.`;
  }

  return `## Output Format

Respond in structured prose:
- Use headers (##) for major sections.
- Use bullet points for lists of findings.
- Include quantitative values with units and uncertainty where applicable.
- Cite algorithms and data sources inline (e.g., "via LP simplex FBA", "BRENDA kinetics").
- End with a "Next Steps" section suggesting specific tools or actions.
- Keep the response focused — aim for 200-500 words unless the question demands more.`;
}
