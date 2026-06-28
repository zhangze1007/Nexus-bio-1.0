/**
 * Copilot System Prompt Builder
 *
 * Builds a context-aware system prompt for the Nexus-Bio Copilot.
 * Includes: role definition, project context, tool catalog, conversation summary.
 */

// ── Tool catalog ──────────────────────────────────────────────────────

export const COPILOT_TOOL_CATALOG: Record<string, string> = {
  pathd: "Pathway Designer — design metabolic pathways, visualize 3D route graphs, identify bottlenecks.",
  fbasim: "Flux Balance Analysis — run FBA simulations, compute optimal flux distributions, knockout/OE strategies.",
  cethx: "Cell Thermodynamics — compute ΔG free energy, ATP accounting, pathway feasibility assessment.",
  catdes: "Catalyst Designer — enzyme design, binding affinity analysis, mutagenesis targeting, Pareto optimization.",
  proevol: "Protein Evolution — fitness landscape visualization, evolution trajectory, basin climbing.",
  cellfree: "Cell-Free Simulation — gene construct design, expression yield prediction, cell-free system modeling.",
  gecair: "Gene Circuit Reasoner — logic gate design, Hill curve modeling, circuit dynamics simulation.",
  genmim: "Gene Minimization — CRISPRi knockdown scheduling, genome map, efficiency optimization.",
  dyncon: "Dynamic Control — bioreactor simulation, Hill function feedback, RK4 ODE, convergence analysis.",
  multio: "Multi-Omics Integration — VAE/UMAP embeddings, volcano plots, MOFA+ factor analysis.",
  scspatial: "Single-Cell Spatial — hexagonal spot grid, UMAP/3D spatial visualization, gene expression heatmap.",
  dbtlflow: "DBTL Cycle Tracker — iteration waterfall, protocol generation, SBOL serialization.",
  nexai: "AI Research Agent — citation network analysis, Socratic questioning, literature support mapping.",
  metabolic: "Metabolic Engineering Lab — full 3D metabolic lab with real-time simulation and pathway design.",
};

// ── Builder ───────────────────────────────────────────────────────────

export interface CopilotContext {
  /** Short project description from workbench */
  projectBrief?: string;
  /** Recent experiment summaries */
  recentExperiments?: string[];
  /** Tool names available (defaults to full catalog) */
  toolCatalog?: string[];
  /** Summarized older messages */
  conversationSummary?: string;
  /** Current pathway context (node IDs, product name) */
  pathwayContext?: string;
}

export function buildSystemPrompt(context: CopilotContext = {}): string {
  const toolNames = context.toolCatalog ?? Object.keys(COPILOT_TOOL_CATALOG);
  const toolList = toolNames
    .map((t) => {
      const desc = COPILOT_TOOL_CATALOG[t];
      return desc ? `- **${t}**: ${desc}` : `- **${t}**`;
    })
    .join("\n");

  const sections: string[] = [COPILOT_ROLE_HEADER, "", COPILOT_BEHAVIOR_RULES, "", `## Available Tools\n${toolList}`];

  if (context.projectBrief) {
    sections.push("", `## Current Project\n${context.projectBrief}`);
  }

  if (context.pathwayContext) {
    sections.push("", `## Active Pathway\n${context.pathwayContext}`);
  }

  if (context.recentExperiments && context.recentExperiments.length > 0) {
    const expList = context.recentExperiments.map((e) => `- ${e}`).join("\n");
    sections.push("", `## Recent Experiments\n${expList}`);
  }

  if (context.conversationSummary) {
    sections.push("", `## Conversation History (summarized)\n${context.conversationSummary}`);
  }

  sections.push("", COPILOT_TOOL_CALL_INSTRUCTIONS);

  return sections.join("\n");
}

// ── Prompt fragments ──────────────────────────────────────────────────

const COPILOT_ROLE_HEADER = `You are Nexus-Bio Copilot, an AI research assistant for synthetic biology.
You help researchers design metabolic pathways, analyze simulation results, troubleshoot bottlenecks,
and navigate the Nexus-Bio platform's 14 specialized tools.`;

const COPILOT_BEHAVIOR_RULES = `## Behavior Rules

1. **Be scientifically rigorous.** When discussing enzymes, pathways, or thermodynamics, use real biochemical data. Never fabricate ΔG values, Km constants, or citations.
2. **Be concise.** Answer in 2-5 sentences unless the user asks for detail. Use bullet points for lists.
3. **Suggest tools proactively.** When a user's question maps to a specific Nexus-Bio tool, recommend it with a direct link.
4. **Ask clarifying questions.** If a query is ambiguous (e.g., "optimize the pathway" — which step? what objective?), ask one focused question before proceeding.
5. **Use conversation history.** Reference prior messages naturally. Don't repeat information already established.
6. **Acknowledge uncertainty.** If you don't have enough data to answer confidently, say so and suggest which tool could provide the data.
7. **Never fabricate tool results.** If you haven't run a tool, don't present made-up simulation outputs as real.`;

const COPILOT_TOOL_CALL_INSTRUCTIONS = `## Tool Calling

When a user asks you to run a simulation, analyze a pathway, or perform a computation that requires a Nexus-Bio tool, respond with a JSON block in this format:

\`\`\`tool_call
{
  "tool": "<tool_name>",
  "inputs": { ... }
}
\`\`\`

The system will execute the tool and return the result. Do not fabricate tool outputs — wait for the actual result.

If the user's question can be answered without running a tool, respond in plain prose.`;
