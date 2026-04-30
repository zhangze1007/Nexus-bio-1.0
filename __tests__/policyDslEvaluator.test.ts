/** @jest-environment node */
import fs from 'fs';
import path from 'path';
import type { ClaimSurface } from '../src/protocol/nexusTrustRuntime';
import { evaluatePolicyDsl } from '../src/services/policyDslEvaluator';

const policyPath = path.resolve(__dirname, '..', 'policy', 'trust-policy-v1.json');

function loadPolicy(): unknown {
  return JSON.parse(fs.readFileSync(policyPath, 'utf8')) as unknown;
}

describe('evaluatePolicyDsl', () => {
  it('blocks demo protocol claims', () => {
    const decision = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'cellfree',
      surface: 'protocol',
      validityTier: 'demo',
      provenanceIds: ['prov-1'],
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      blockCode: 'DEMO_OUTPUT_PROTOCOL_BLOCKED',
      blockedSurfaces: ['protocol'],
      overridePath: 'not-allowed',
    });
  });

  it('blocks demo external handoff claims', () => {
    const decision = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'multio',
      surface: 'external-handoff',
      validityTier: 'demo',
      provenanceIds: ['prov-1'],
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      blockCode: 'EXTERNAL_HANDOFF_BLOCKED',
      blockedSurfaces: ['external-handoff'],
      overridePath: 'not-allowed',
    });
  });

  it('blocks missing provenance on formal surfaces', () => {
    const decision = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'pathd',
      surface: 'export',
      validityTier: 'partial',
      provenanceIds: [],
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      blockCode: 'PROVENANCE_REQUIRED',
      blockedSurfaces: ['export'],
      overridePath: 'human-review',
    });
  });

  it('gates pending human review', () => {
    const decision = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'dbtlflow',
      surface: 'protocol',
      validityTier: 'partial',
      provenanceIds: ['prov-1'],
      humanGateStatus: 'pending',
    });

    expect(decision).toMatchObject({
      status: 'gated',
      blockCode: 'HUMAN_GATE_REQUIRED',
      blockedSurfaces: ['protocol'],
      overridePath: 'human-review',
    });
  });

  it('allows valid partial exports with provenance', () => {
    const decision = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'fbasim',
      surface: 'export',
      validityTier: 'partial',
      provenanceIds: ['prov-1'],
    });

    expect(decision).toMatchObject({
      status: 'ok',
      allowedSurfaces: ['export'],
      blockedSurfaces: [],
    });
    expect(decision.blockCode).toBeUndefined();
  });

  it('keeps demo payloads demo-only when otherwise allowed', () => {
    const decision = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'cethx',
      surface: 'payload',
      validityTier: 'demo',
      provenanceIds: ['prov-1'],
    });

    expect(decision).toMatchObject({
      status: 'demoOnly',
      allowedSurfaces: ['payload'],
      blockedSurfaces: [],
    });
    expect(decision.blockCode).toBeUndefined();
  });

  it('blocks unknown tools and unknown surfaces as missing policy', () => {
    const unknownTool = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'not-a-tool',
      surface: 'payload',
      validityTier: 'partial',
    });
    const unknownSurface = evaluatePolicyDsl(loadPolicy(), {
      toolId: 'pathd',
      surface: 'not-a-surface' as ClaimSurface,
      validityTier: 'partial',
      provenanceIds: ['prov-1'],
    });

    expect(unknownTool).toMatchObject({
      status: 'blocked',
      blockCode: 'MISSING_POLICY',
      overridePath: 'not-allowed',
    });
    expect(unknownSurface).toMatchObject({
      status: 'blocked',
      blockCode: 'MISSING_POLICY',
      overridePath: 'not-allowed',
    });
  });

  it('does not mutate evaluation input', () => {
    const input = {
      toolId: 'pathd',
      surface: 'export' as const,
      validityTier: 'partial' as const,
      provenanceIds: ['prov-1'],
      evidenceIds: ['evidence-1'],
      assumptionIds: ['assumption-1'],
    };
    const before = JSON.stringify(input);

    evaluatePolicyDsl(loadPolicy(), input);

    expect(JSON.stringify(input)).toBe(before);
  });
});
