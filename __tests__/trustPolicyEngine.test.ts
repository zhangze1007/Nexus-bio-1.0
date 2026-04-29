/** @jest-environment node */
import type { ClaimSurface } from '../src/protocol/nexusTrustRuntime';
import { evaluateClaimSurfacePolicy } from '../src/services/trustPolicyEngine';

describe('evaluateClaimSurfacePolicy', () => {
  it('blocks missing policies', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'not-a-tool',
      surface: 'payload',
      validityTier: 'partial',
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      blockCode: 'MISSING_POLICY',
      allowedSurfaces: [],
      blockedSurfaces: ['payload'],
      overridePath: 'not-allowed',
    });
  });

  it('blocks missing validity tier with the safest existing tier block code', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'pathd',
      surface: 'export',
      provenanceIds: ['prov-1'],
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockCode).toBe('TIER_NOT_ALLOWED_FOR_SURFACE');
  });

  it('blocks demo protocol claims', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'cellfree',
      surface: 'protocol',
      validityTier: 'demo',
      provenanceIds: ['prov-1'],
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
  });

  it('blocks demo external handoff claims', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'multio',
      surface: 'external-handoff',
      validityTier: 'demo',
      provenanceIds: ['prov-1'],
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
  });

  it('blocks missing provenance when the surface requires it', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'pathd',
      surface: 'export',
      validityTier: 'partial',
      provenanceIds: [],
    });

    expect(decision).toMatchObject({
      status: 'blocked',
      blockCode: 'PROVENANCE_REQUIRED',
      overridePath: 'human-review',
    });
  });

  it('gates pending human review', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'dbtlflow',
      surface: 'protocol',
      validityTier: 'partial',
      provenanceIds: ['prov-1'],
      humanGateStatus: 'pending',
    });

    expect(decision).toMatchObject({
      status: 'gated',
      blockCode: 'HUMAN_GATE_REQUIRED',
      overridePath: 'human-review',
    });
  });

  it('allows approved human review when other requirements pass', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'dbtlflow',
      surface: 'protocol',
      validityTier: 'partial',
      provenanceIds: ['prov-1'],
      humanGateStatus: 'approved',
    });

    expect(decision).toMatchObject({
      status: 'ok',
      allowedSurfaces: ['protocol'],
      blockedSurfaces: [],
    });
    expect(decision.blockCode).toBeUndefined();
  });

  it('allows partial exports with provenance', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'fbasim',
      surface: 'export',
      validityTier: 'partial',
      provenanceIds: ['prov-1'],
    });

    expect(decision.status).toBe('ok');
    expect(decision.allowedSurfaces).toEqual(['export']);
  });

  it('keeps allowed demo payloads demo-only', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'cethx',
      surface: 'payload',
      validityTier: 'demo',
      provenanceIds: ['prov-1'],
    });

    expect(decision.status).toBe('demoOnly');
    expect(decision.allowedSurfaces).toEqual(['payload']);
    expect(decision.blockedSurfaces).toEqual([]);
  });

  it('returns undefined blockCode for allowed real or partial surfaces', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'nexai',
      surface: 'recommendation',
      validityTier: 'real',
      provenanceIds: ['prov-1'],
    });

    expect(decision.status).toBe('ok');
    expect(decision.blockCode).toBeUndefined();
  });

  it('blocks unknown surface lookups as missing policy when forced by a caller', () => {
    const decision = evaluateClaimSurfacePolicy({
      toolId: 'pathd',
      surface: 'not-a-surface' as ClaimSurface,
      validityTier: 'partial',
      provenanceIds: ['prov-1'],
    });

    expect(decision.status).toBe('blocked');
    expect(decision.blockCode).toBe('MISSING_POLICY');
  });
});
