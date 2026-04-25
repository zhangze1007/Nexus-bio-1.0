/**
 * workflowStateMachine — golden-path FSM for the Workflow Control Plane.
 *
 * States mirror the declared golden path PATHD → FBASim → CatDes → DynCon
 * → CellFree → DBTLflow. Sidecar updates emit `SIDECAR_UPDATE` and never
 * move the main state. Guards consult ToolContract.validityBaseline AND
 * confidencePolicy.minToAdvance — a guard failure refuses the transition;
 * the supervisor surfaces it as `status: 'gated'` to the UI.
 *
 * The machine is side-effect-free: it does not call adapters, it does not
 * write to the workbench store. Phase-2 wiring (a thin actor inside the
 * provider) is responsible for keeping the store and the machine in sync.
 */
import { setup, assign, createActor, type Actor } from 'xstate';
import {
  GOLDEN_PATH_TOOL_IDS,
  meetsValidityFloor,
  type GoldenPathToolId,
  type ToolId,
  type ValidityFloor,
} from '../domain/workflowContract';
import { getToolContract } from './workflowRegistry';

export type WorkflowStateValue =
  | 'idle'
  | 'targetSet'
  | 'pathdReady'
  | 'fbasimReady'
  | 'catdesReady'
  | 'dynconReady'
  | 'cellfreeReady'
  | 'dbtlCommitted';

export interface WorkflowToolStatus {
  validity: ValidityFloor | null;
  confidence: number | null;
  uncertainty?: number | null;
  hasRequiredOutputs: boolean;
  missingOutputPaths?: string[];
  isSimulated?: boolean;
}

export interface WorkflowEvidence {
  ids: string[];
}

export interface WorkflowContext {
  targetProduct: string | null;
  toolStatus: Partial<Record<ToolId, WorkflowToolStatus>>;
  iteration: number;
  evidence: WorkflowEvidence;
  lastSidecarToolId: ToolId | null;
}

export type WorkflowEvent =
  | { type: 'SET_TARGET'; targetProduct: string }
  | { type: 'CLEAR_TARGET' }
  | { type: 'PATHD_DONE'; status: WorkflowToolStatus }
  | { type: 'FBASIM_DONE'; status: WorkflowToolStatus }
  | { type: 'CATDES_DONE'; status: WorkflowToolStatus }
  | { type: 'DYNCON_DONE'; status: WorkflowToolStatus }
  | { type: 'CELLFREE_DONE'; status: WorkflowToolStatus }
  | { type: 'DBTL_COMMITTED'; status: WorkflowToolStatus }
  | { type: 'LOOP_BACK' }
  | { type: 'SIDECAR_UPDATE'; toolId: ToolId; status: WorkflowToolStatus }
  | { type: 'EVIDENCE_ADDED'; ids: string[] };

export const GOLDEN_PATH_DONE_EVENT: Record<GoldenPathToolId, string> = {
  pathd: 'PATHD_DONE',
  fbasim: 'FBASIM_DONE',
  catdes: 'CATDES_DONE',
  dyncon: 'DYNCON_DONE',
  cellfree: 'CELLFREE_DONE',
  dbtlflow: 'DBTL_COMMITTED',
};

export function meetsContract(
  toolId: GoldenPathToolId,
  status: WorkflowToolStatus,
): boolean {
  if (!status.hasRequiredOutputs) return false;
  if (status.isSimulated) return false;
  const contract = getToolContract(toolId);
  if (!status.validity) return false;
  if (!meetsValidityFloor(status.validity, contract.validityBaseline.floor)) return false;
  const conf = contract.confidencePolicy;
  if (conf.minToAdvance !== null) {
    if (status.confidence === null) return false;
    if (status.confidence < conf.minToAdvance) return false;
  }
  if (contract.uncertaintyPolicy.unboundedIsGate && status.uncertainty == null) return false;
  return true;
}

const initialContext: WorkflowContext = {
  targetProduct: null,
  toolStatus: {},
  iteration: 0,
  evidence: { ids: [] },
  lastSidecarToolId: null,
};

type DoneEventOf<T extends WorkflowEvent['type']> = Extract<WorkflowEvent, { type: T }>;

export const workflowMachine = setup({
  types: {} as {
    context: WorkflowContext;
    events: WorkflowEvent;
  },
  guards: {
    canAdvancePathd: ({ event }) =>
      event.type === 'PATHD_DONE' && meetsContract('pathd', (event as DoneEventOf<'PATHD_DONE'>).status),
    canAdvanceFbasim: ({ event }) =>
      event.type === 'FBASIM_DONE' && meetsContract('fbasim', (event as DoneEventOf<'FBASIM_DONE'>).status),
    canAdvanceCatdes: ({ event }) =>
      event.type === 'CATDES_DONE' && meetsContract('catdes', (event as DoneEventOf<'CATDES_DONE'>).status),
    canAdvanceDyncon: ({ event }) =>
      event.type === 'DYNCON_DONE' && meetsContract('dyncon', (event as DoneEventOf<'DYNCON_DONE'>).status),
    canAdvanceCellfree: ({ event }) =>
      event.type === 'CELLFREE_DONE' && meetsContract('cellfree', (event as DoneEventOf<'CELLFREE_DONE'>).status),
    canAdvanceDbtl: ({ event }) =>
      event.type === 'DBTL_COMMITTED' && meetsContract('dbtlflow', (event as DoneEventOf<'DBTL_COMMITTED'>).status),
  },
  actions: {
    setTarget: assign({
      targetProduct: ({ event }) =>
        event.type === 'SET_TARGET' ? event.targetProduct : null,
    }),
    clearAll: assign(() => initialContext),
    recordPathd: assign({
      toolStatus: ({ context, event }) =>
        event.type === 'PATHD_DONE'
          ? { ...context.toolStatus, pathd: event.status }
          : context.toolStatus,
    }),
    recordFbasim: assign({
      toolStatus: ({ context, event }) =>
        event.type === 'FBASIM_DONE'
          ? { ...context.toolStatus, fbasim: event.status }
          : context.toolStatus,
    }),
    recordCatdes: assign({
      toolStatus: ({ context, event }) =>
        event.type === 'CATDES_DONE'
          ? { ...context.toolStatus, catdes: event.status }
          : context.toolStatus,
    }),
    recordDyncon: assign({
      toolStatus: ({ context, event }) =>
        event.type === 'DYNCON_DONE'
          ? { ...context.toolStatus, dyncon: event.status }
          : context.toolStatus,
    }),
    recordCellfree: assign({
      toolStatus: ({ context, event }) =>
        event.type === 'CELLFREE_DONE'
          ? { ...context.toolStatus, cellfree: event.status }
          : context.toolStatus,
    }),
    recordDbtl: assign({
      toolStatus: ({ context, event }) =>
        event.type === 'DBTL_COMMITTED'
          ? { ...context.toolStatus, dbtlflow: event.status }
          : context.toolStatus,
    }),
    applySidecar: assign({
      toolStatus: ({ context, event }) =>
        event.type === 'SIDECAR_UPDATE'
          ? { ...context.toolStatus, [event.toolId]: event.status }
          : context.toolStatus,
      lastSidecarToolId: ({ context, event }) =>
        event.type === 'SIDECAR_UPDATE' ? event.toolId : context.lastSidecarToolId,
    }),
    appendEvidence: assign({
      evidence: ({ context, event }) =>
        event.type === 'EVIDENCE_ADDED'
          ? { ids: Array.from(new Set([...context.evidence.ids, ...event.ids])) }
          : context.evidence,
    }),
    bumpIteration: assign({
      toolStatus: () => ({}),
      iteration: ({ context }) => context.iteration + 1,
      lastSidecarToolId: () => null,
    }),
  },
}).createMachine({
  id: 'workflowControlPlane',
  initial: 'idle',
  context: () => ({
    targetProduct: null,
    toolStatus: {},
    iteration: 0,
    evidence: { ids: [] },
    lastSidecarToolId: null,
  }),
  on: {
    SIDECAR_UPDATE: { actions: 'applySidecar' },
    EVIDENCE_ADDED: { actions: 'appendEvidence' },
  },
  states: {
    idle: {
      on: {
        SET_TARGET: { target: 'targetSet', actions: 'setTarget' },
      },
    },
    targetSet: {
      on: {
        PATHD_DONE: {
          target: 'pathdReady',
          guard: 'canAdvancePathd',
          actions: 'recordPathd',
        },
        CLEAR_TARGET: { target: 'idle', actions: 'clearAll' },
      },
    },
    pathdReady: {
      on: {
        FBASIM_DONE: {
          target: 'fbasimReady',
          guard: 'canAdvanceFbasim',
          actions: 'recordFbasim',
        },
      },
    },
    fbasimReady: {
      on: {
        CATDES_DONE: {
          target: 'catdesReady',
          guard: 'canAdvanceCatdes',
          actions: 'recordCatdes',
        },
      },
    },
    catdesReady: {
      on: {
        DYNCON_DONE: {
          target: 'dynconReady',
          guard: 'canAdvanceDyncon',
          actions: 'recordDyncon',
        },
      },
    },
    dynconReady: {
      on: {
        CELLFREE_DONE: {
          target: 'cellfreeReady',
          guard: 'canAdvanceCellfree',
          actions: 'recordCellfree',
        },
      },
    },
    cellfreeReady: {
      on: {
        DBTL_COMMITTED: {
          target: 'dbtlCommitted',
          guard: 'canAdvanceDbtl',
          actions: 'recordDbtl',
        },
      },
    },
    dbtlCommitted: {
      on: {
        LOOP_BACK: { target: 'targetSet', actions: 'bumpIteration' },
      },
    },
  },
});

export type WorkflowActor = Actor<typeof workflowMachine>;

export function createWorkflowActor(): WorkflowActor {
  return createActor(workflowMachine);
}

export function describeWorkflowState(value: WorkflowStateValue): string {
  switch (value) {
    case 'idle': return 'No target product set.';
    case 'targetSet': return 'Target set; awaiting PATHD pathway design.';
    case 'pathdReady': return 'PATHD complete; awaiting FBASim flux analysis.';
    case 'fbasimReady': return 'FBASim complete; awaiting CatDes catalyst optimization.';
    case 'catdesReady': return 'CatDes complete; awaiting DynCon controller tuning.';
    case 'dynconReady': return 'DynCon complete; awaiting CellFree validation.';
    case 'cellfreeReady': return 'CellFree complete; awaiting DBTLflow Learn commit.';
    case 'dbtlCommitted': return 'DBTL Learn committed; ready to LOOP_BACK or finalize.';
    default: return value satisfies never;
  }
}

export const ALL_GOLDEN_PATH_DONE_EVENTS = GOLDEN_PATH_TOOL_IDS.map(
  (id) => GOLDEN_PATH_DONE_EVENT[id],
);
