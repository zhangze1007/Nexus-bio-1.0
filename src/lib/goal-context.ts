import type { InputType } from "./smart-parser";

export interface WorkflowStep {
  id: string;
  label: string;
  route: string;
}

export interface GoalContext {
  goal: string;
  inputType: InputType;
  chain: WorkflowStep[];
  currentStepIndex: number;
  startedAt: string;
}

// Workflow chains — adapted to actual Nexus-Bio routes
export const WORKFLOW_CHAINS: Record<InputType, WorkflowStep[]> = {
  MOLECULE: [
    { id: "pathd", label: "Pathway Discovery", route: "/tools/pathd" },
    { id: "fbasim", label: "FBA Simulation", route: "/tools/fbasim" },
    { id: "catdes", label: "Enzyme Design", route: "/tools/catdes" },
    { id: "genmim", label: "CRISPR Strategy", route: "/tools/genmim" },
  ],
  STRAIN: [
    { id: "fbasim", label: "FBA Simulation", route: "/tools/fbasim" },
    { id: "genmim", label: "Strain Design", route: "/tools/genmim" },
    { id: "gecair", label: "Genetic Circuit", route: "/tools/gecair" },
  ],
  METRIC: [
    { id: "fbasim", label: "FBA Simulation", route: "/tools/fbasim" },
    { id: "genmim", label: "Strain Design", route: "/tools/genmim" },
    { id: "dyncon", label: "Bioprocess Control", route: "/tools/dyncon" },
  ],
  DOI: [
    { id: "analyze", label: "Paper Analysis", route: "/analyze" },
    { id: "pathd", label: "Pathway Extraction", route: "/tools/pathd" },
  ],
  FREEFORM: [{ id: "analyze", label: "Axon AI Analysis", route: "/analyze" }],
};

const STORAGE_KEY = "nexusbio_goal_context";

export function saveGoalContext(ctx: GoalContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {}
}

export function loadGoalContext(): GoalContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoalContext) : null;
  } catch {
    return null;
  }
}

export function advanceToStep(index: number): void {
  const ctx = loadGoalContext();
  if (!ctx) return;
  ctx.currentStepIndex = index;
  saveGoalContext(ctx);
}

export function clearGoalContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function findStepIndex(ctx: GoalContext, stepId: string): number {
  return ctx.chain.findIndex((step) => step.id === stepId);
}

export function buildGoalContext(goal: string, inputType: InputType): GoalContext {
  return {
    goal,
    inputType,
    chain: WORKFLOW_CHAINS[inputType] ?? WORKFLOW_CHAINS.FREEFORM,
    currentStepIndex: 0,
    startedAt: new Date().toISOString(),
  };
}
