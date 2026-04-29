/** @jest-environment node */
import { CLAIM_SURFACES, type ClaimSurface } from '../src/protocol/nexusTrustRuntime';
import { TOOL_DEFINITIONS } from '../src/components/tools/shared/toolRegistry';
import {
  CLAIM_SURFACE_POLICIES,
  getClaimSurfacePolicy,
  listClaimSurfacePoliciesForTool,
} from '../src/domain/claimSurfacePolicies';
import {
  CLAIM_SURFACE_BLOCK_CODES,
  type ClaimSurfaceBlockCode,
} from '../src/domain/claimSurfacePolicy';
import { CLAIM_SURFACE_REASON_CATALOG } from '../src/domain/claimSurfaceReasonCatalog';

const knownToolIds = TOOL_DEFINITIONS.map((tool) => tool.id);

describe('claim surface policy catalog', () => {
  it('covers every known tool for every claim surface', () => {
    for (const toolId of knownToolIds) {
      const surfaces = listClaimSurfacePoliciesForTool(toolId).map((policy) => policy.surface);
      expect([...surfaces].sort()).toEqual([...CLAIM_SURFACES].sort());
    }
  });

  it('only contains policies for known registry tools', () => {
    const known = new Set(knownToolIds);
    for (const policy of CLAIM_SURFACE_POLICIES) {
      expect(known.has(policy.toolId)).toBe(true);
    }
  });

  it('does not allow demo-tier protocol policies', () => {
    for (const policy of CLAIM_SURFACE_POLICIES.filter((item) => item.surface === 'protocol')) {
      expect(policy.allowedTiers).not.toContain('demo');
      expect(policy.blockCode).toBe('DEMO_OUTPUT_PROTOCOL_BLOCKED');
    }
  });

  it('does not allow demo-tier external-handoff policies', () => {
    for (const policy of CLAIM_SURFACE_POLICIES.filter((item) => item.surface === 'external-handoff')) {
      expect(policy.allowedTiers).not.toContain('demo');
      expect(policy.blockCode).toBe('EXTERNAL_HANDOFF_BLOCKED');
    }
  });

  it('requires provenance for protocol policies', () => {
    for (const policy of CLAIM_SURFACE_POLICIES.filter((item) => item.surface === 'protocol')) {
      expect(policy.requiresProvenance).toBe(true);
    }
  });

  it('requires provenance for external-handoff policies', () => {
    for (const policy of CLAIM_SURFACE_POLICIES.filter((item) => item.surface === 'external-handoff')) {
      expect(policy.requiresProvenance).toBe(true);
    }
  });

  it('returns the expected lookup policy for known tool and surface', () => {
    const policy = getClaimSurfacePolicy('pathd', 'export');

    expect(policy).toMatchObject({
      policyId: 'claim-surface:pathd:export:v1',
      toolId: 'pathd',
      surface: 'export',
      allowedTiers: ['real', 'partial'],
      requiresProvenance: true,
      denyIfDraft: true,
      blockCode: 'DRAFT_OUTPUT_NOT_EXPORTABLE',
    });
  });

  it('returns undefined for unknown tool or unknown surface', () => {
    expect(getClaimSurfacePolicy('not-a-tool', 'payload')).toBeUndefined();
    expect(getClaimSurfacePolicy('pathd', 'not-a-surface' as ClaimSurface)).toBeUndefined();
  });

  it('has a reason catalog entry for every block code', () => {
    for (const blockCode of CLAIM_SURFACE_BLOCK_CODES) {
      const reason = CLAIM_SURFACE_REASON_CATALOG[blockCode as ClaimSurfaceBlockCode];
      expect(reason.blockCode).toBe(blockCode);
      expect(reason.title.length).toBeGreaterThan(0);
      expect(reason.explanation.length).toBeGreaterThan(0);
      expect(reason.suggestedAction.length).toBeGreaterThan(0);
    }
  });
});
