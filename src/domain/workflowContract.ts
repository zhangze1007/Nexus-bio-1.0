/**
 * workflowContract — machine-checkable per-tool contract.
 *
 * Pure type layer for the Phase-1 Workflow Control Plane. No runtime,
 * no imports from runtime modules — every consumer (registry, state
 * machine, supervisor, store gate, planner) reads from this single
 * source of truth.
 *
 * Vocabulary:
 *   - golden path: PATHD → FBASim → CatDes → DynCon → CellFree → DBTLflow.
 *   - sidecar: tool whose payload publishes into the workbench but does
 *     NOT advance the golden-path state machine.
 */

export const TOOL_IDS = [
  'pathd',
  'metabolic-eng',
  'fbasim',
  'cethx',
  'catdes',
  'proevol',
  'dyncon',
  'gecair',
  'genmim',
  'cellfree',
  'dbtlflow',
  'multio',
  'scspatial',
  'nexai',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const GOLDEN_PATH_TOOL_IDS = [
  'pathd',
  'fbasim',
  'catdes',
  'dyncon',
  'cellfree',
  'dbtlflow',
] as const satisfies readonly ToolId[];

export type GoldenPathToolId = (typeof GOLDEN_PATH_TOOL_IDS)[number];

export type StageId = 'stage-1' | 'stage-2' | 'stage-3' | 'stage-4';

export type PrimaryIntent =
  | 'design'
  | 'simulate'
  | 'optimize'
  | 'engineer'
  | 'control'
  | 'validate'
  | 'analyze'
  | 'supervise';

export type ValidityFloor = 'real' | 'partial' | 'demo';

export type EvidenceSourceKind = 'literature' | 'analysis' | 'tool' | 'system';

export interface ArtifactRef {
  toolId: ToolId;
  /** Dotted path inside the tool's payload, e.g. `result.topFluxes`. */
  payloadPath: string;
  required: boolean;
  /** One-line reason this artifact is needed. Surfaced in supervisor explanations. */
  rationale: string;
}

export interface EvidenceRequirement {
  minItems: number;
  kinds: EvidenceSourceKind[];
  /** When true and minItems is unmet, the supervisor must mark the step `gated`. */
  gateOnMissing: boolean;
}

export interface ValidityBaseline {
  /** Minimum payload validity required to advance the golden path past this tool. */
  floor: ValidityFloor;
  reason: string;
}

export interface ConfidencePolicy {
  /** Dotted path inside the payload's `result` object that holds confidence (0..1). */
  sourceField: string | null;
  /** Threshold required to advance. `null` means tool has no quantitative confidence. */
  minToAdvance: number | null;
}

export interface UncertaintyPolicy {
  /** Dotted path holding an uncertainty / RMSE / variance metric. */
  sourceField: string | null;
  /** When true, an unbounded / null uncertainty must trigger a human gate. */
  unboundedIsGate: boolean;
}

export type HumanGateTrigger = 'commit' | 'loop-back' | 'external-handoff';

export interface HumanGatePolicy {
  /** Empty array = no gate. */
  requiredFor: HumanGateTrigger[];
  description: string;
}

export interface FailureMode {
  code: string;
  detection: string;
  recovery: string;
}

export interface DemoPolicy {
  /** When false, contract validator refuses demo-seeded payloads as input. */
  allowsDemoSeed: boolean;
  /** When true, this tool blocks the golden path while running on demo data. */
  blockGoldenPath: boolean;
}

export type ToolContractScope =
  | 'workflow'
  | 'sidecar'
  | 'contractOnly'
  | 'demoOnly'
  | 'alias';

export interface ToolContract {
  toolId: ToolId;
  /** Machine-readable execution role; prevents empty contracts from passing silently. */
  contractScope: ToolContractScope;
  stageId: StageId;
  primaryIntent: PrimaryIntent;
  /** Tools whose payloads must exist before this tool can advance the golden path. */
  requiredInputs: ArtifactRef[];
  /** Tools whose payloads are consulted when present but not required. */
  optionalInputs: ArtifactRef[];
  /** Dotted paths this tool publishes into its own payload. */
  outputArtifacts: ArtifactRef[];
  evidenceRequired: EvidenceRequirement;
  validityBaseline: ValidityBaseline;
  confidencePolicy: ConfidencePolicy;
  uncertaintyPolicy: UncertaintyPolicy;
  humanGatePolicy: HumanGatePolicy;
  /** Successor tools recommended to the user after this one is satisfied. */
  nextRecommendedNodes: ToolId[];
  failureModes: FailureMode[];
  demoPolicy: DemoPolicy;
  /** True iff this tool sits on the golden path. */
  isGoldenPath: boolean;
}

/** Numeric ordering of validity for comparisons. */
export const VALIDITY_ORDER: Record<ValidityFloor, number> = {
  demo: 0,
  partial: 1,
  real: 2,
};

export function meetsValidityFloor(actual: ValidityFloor, floor: ValidityFloor): boolean {
  return VALIDITY_ORDER[actual] >= VALIDITY_ORDER[floor];
}

export function isGoldenPathToolId(id: string): id is GoldenPathToolId {
  return (GOLDEN_PATH_TOOL_IDS as readonly string[]).includes(id);
}

export function isToolId(id: string): id is ToolId {
  return (TOOL_IDS as readonly string[]).includes(id);
}
