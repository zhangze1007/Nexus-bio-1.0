/** @jest-environment node */
import type { WorkbenchToolPayloadMap } from '../src/store/workbenchPayloads';
import type { WorkbenchCanonicalState } from '../src/store/workbenchTypes';
import type { ProvenanceEntry } from '../src/types/assumptions';
import {
  evaluateWorkbenchPayloadAdmission,
  inferAdmissionInputFromPayload,
} from '../src/services/workbenchPayloadAdmission';
import { sanitizeWorkbenchState } from '../src/store/workbenchValidation';

type StoreModule = typeof import('../src/store/workbenchStore');

function withFreshStore<T>(fn: (mod: StoreModule) => T): T {
  let result: T;
  jest.isolateModules(() => {
    const mod = require('../src/store/workbenchStore') as StoreModule;
    mod.__resetWorkflowActorForTests();
    result = fn(mod);
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return result!;
}

function setTarget(useStore: StoreModule['useWorkbenchStore'], target: string): void {
  useStore.setState((state) => ({
    ...state,
    project: {
      id: 'project-test',
      title: target,
      summary: '',
      targetProduct: target,
      status: 'draft',
      isDemo: false,
      createdAt: 1,
      updatedAt: 1,
    },
  }));
}

const CETHX_PAYLOAD: WorkbenchToolPayloadMap['cethx'] = {
  validity: 'demo',
  toolId: 'cethx',
  targetProduct: 'limonene',
  pathway: 'glycolysis',
  tempC: 30,
  pH: 7,
  result: {
    atpYield: 0,
    nadhYield: 0,
    gibbsFreeEnergy: -10,
    entropyProduction: 0,
    efficiency: 50,
    limitingStep: null,
  },
  updatedAt: 2,
};

describe('workbench payload admission', () => {
  it('defaults to the payload surface and observe mode', () => {
    const admission = evaluateWorkbenchPayloadAdmission({
      toolId: 'cethx',
      payload: CETHX_PAYLOAD,
      validityTier: 'demo',
    });

    expect(admission.mode).toBe('observe');
    expect(admission.shouldWritePayload).toBe(true);
    expect(admission.decision.status).toBe('demoOnly');
    expect(admission.decision.allowedSurfaces).toEqual(['payload']);
  });

  it('allows blocked decisions to write in observe mode', () => {
    const admission = evaluateWorkbenchPayloadAdmission({
      toolId: 'not-a-tool',
      payload: {},
      validityTier: 'partial',
      mode: 'observe',
    });

    expect(admission.decision).toMatchObject({
      status: 'blocked',
      blockCode: 'MISSING_POLICY',
    });
    expect(admission.shouldWritePayload).toBe(true);
  });

  it('blocks blocked decisions in enforce mode', () => {
    const admission = evaluateWorkbenchPayloadAdmission({
      toolId: 'not-a-tool',
      payload: {},
      validityTier: 'partial',
      mode: 'enforce',
    });

    expect(admission.decision.status).toBe('blocked');
    expect(admission.shouldWritePayload).toBe(false);
  });

  it('blocks gated decisions in enforce mode', () => {
    const admission = evaluateWorkbenchPayloadAdmission({
      toolId: 'pathd',
      payload: {},
      validityTier: 'partial',
      requiresHumanGate: true,
      humanGateStatus: 'pending',
      mode: 'enforce',
    });

    expect(admission.decision.status).toBe('gated');
    expect(admission.shouldWritePayload).toBe(false);
  });

  it('allows ok and demo-only payload decisions in enforce mode', () => {
    const okAdmission = evaluateWorkbenchPayloadAdmission({
      toolId: 'pathd',
      payload: {},
      validityTier: 'partial',
      mode: 'enforce',
    });
    const demoAdmission = evaluateWorkbenchPayloadAdmission({
      toolId: 'cethx',
      payload: {},
      validityTier: 'demo',
      mode: 'enforce',
    });

    expect(okAdmission.decision.status).toBe('ok');
    expect(okAdmission.shouldWritePayload).toBe(true);
    expect(demoAdmission.decision.status).toBe('demoOnly');
    expect(demoAdmission.shouldWritePayload).toBe(true);
  });

  it('infers existing metadata without inventing provenance, evidence, or assumption ids', () => {
    const inferred = inferAdmissionInputFromPayload({
      toolId: 'pathd',
      payload: { validity: 'partial' },
      fallbackValidityTier: 'real',
    });

    expect(inferred.validityTier).toBe('partial');
    expect(inferred.provenanceIds).toEqual([]);
    expect(inferred.evidenceIds).toEqual([]);
    expect(inferred.assumptionIds).toEqual([]);
  });

  it('uses fallback validity for legacy or missing metadata without crashing', () => {
    const inferred = inferAdmissionInputFromPayload({
      toolId: 'cellfree',
      payload: null,
      fallbackValidityTier: 'demo',
    });

    expect(inferred.validityTier).toBe('demo');
    expect(inferred.isDraft).toBe(false);
    expect(inferred.provenanceIds).toEqual([]);
    expect(inferred.evidenceIds).toEqual([]);
    expect(inferred.assumptionIds).toEqual([]);
  });

  it('extracts ids only from existing run provenance metadata', () => {
    const provenance: ProvenanceEntry = {
      toolId: 'pathd',
      timestamp: 123,
      inputAssumptions: ['input-a'],
      outputAssumptions: ['output-b'],
      evidence: [
        { id: 'evidence-1', source: 'computation', reference: 'local', confidence: 'medium' },
      ],
      validityTier: 'partial',
      upstreamProvenance: [],
    };

    const inferred = inferAdmissionInputFromPayload({
      toolId: 'pathd',
      payload: { runProvenance: provenance },
    });

    expect(inferred.validityTier).toBe('partial');
    expect(inferred.provenanceIds).toEqual(['pathd:123']);
    expect(inferred.evidenceIds).toEqual(['evidence-1']);
    expect(inferred.assumptionIds).toEqual(['input-a', 'output-b']);
  });

  it('records a payload GateDecision in the store without blocking observe-mode writes', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      setTarget(useWorkbenchStore, 'limonene');
      useWorkbenchStore.getState().setToolPayload('cethx', CETHX_PAYLOAD);

      const state = useWorkbenchStore.getState();
      expect(state.toolPayloads.cethx).toMatchObject({ toolId: 'cethx' });
      expect(state.payloadAdmissionDecisionsByToolId.cethx).toMatchObject({
        status: 'demoOnly',
        allowedSurfaces: ['payload'],
      });
    });
  });

  it('defaults missing persisted admission decisions to an empty record', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      const raw = JSON.parse(JSON.stringify(useWorkbenchStore.getState())) as Record<string, unknown>;
      delete raw.payloadAdmissionDecisionsByToolId;

      const sanitized = sanitizeWorkbenchState(raw) as WorkbenchCanonicalState;
      expect(sanitized.payloadAdmissionDecisionsByToolId).toEqual({});
    });
  });

  it('drops malformed persisted GateDecision records', () => {
    withFreshStore(({ useWorkbenchStore }) => {
      const raw = {
        ...JSON.parse(JSON.stringify(useWorkbenchStore.getState())),
        payloadAdmissionDecisionsByToolId: {
          pathd: { status: 'ok' },
        },
      } as Record<string, unknown>;

      const sanitized = sanitizeWorkbenchState(raw) as WorkbenchCanonicalState;
      expect(sanitized.payloadAdmissionDecisionsByToolId).toEqual({});
    });
  });
});
