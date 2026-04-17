/** @jest-environment node */
/**
 * axonContext — workbench → copilot context bridge.
 * These tests lock in the bounded, deterministic shape of the prompt
 * augmentation so the overlay and NEXAI share a single contract.
 */
import {
  buildWorkbenchCopilotContext,
  composeCopilotQuery,
  type WorkbenchContextSnapshot,
} from '../src/services/axonContext';

function emptySnapshot(): WorkbenchContextSnapshot {
  return {
    targetProduct: null,
    project: null,
    analyzeArtifact: null,
    evidenceItems: [],
    selectedEvidenceIds: [],
    nextRecommendations: [],
    currentToolId: null,
  };
}

describe('buildWorkbenchCopilotContext', () => {
  it('returns hasContext=false and empty augmentation when the snapshot is empty', () => {
    const ctx = buildWorkbenchCopilotContext(emptySnapshot());
    expect(ctx.hasContext).toBe(false);
    expect(ctx.promptAugmentation).toBe('');
    expect(ctx.summaryOneLine).toBe('No active workbench context');
    expect(ctx.evidenceTotal).toBe(0);
  });

  it('prefers analyzeArtifact.targetProduct over project.targetProduct', () => {
    const snap = emptySnapshot();
    snap.project = { title: 'P', targetProduct: 'project-product' };
    snap.analyzeArtifact = {
      targetProduct: 'analyze-product',
      bottleneckAssumptions: [],
      thermodynamicConcerns: [],
      pathwayCandidates: [],
    };
    const ctx = buildWorkbenchCopilotContext(snap);
    expect(ctx.targetProduct).toBe('analyze-product');
  });

  it('caps evidence titles at 3 and truncates long titles', () => {
    const snap = emptySnapshot();
    const longTitle = 'A'.repeat(200);
    snap.evidenceItems = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      title: i === 0 ? longTitle : `short-${i}`,
      year: '2024',
    }));
    snap.selectedEvidenceIds = ['e0', 'e1'];
    const ctx = buildWorkbenchCopilotContext(snap);
    expect(ctx.evidenceTotal).toBe(10);
    expect(ctx.evidenceSelected).toBe(2);
    // Only 3 bullet titles max
    const bullets = ctx.promptAugmentation.split('\n').filter((l) => l.startsWith('  •'));
    expect(bullets).toHaveLength(3);
    // Long title truncated
    expect(bullets[0].length).toBeLessThan(longTitle.length);
    expect(bullets[0]).toMatch(/…/);
  });

  it('includes bottleneck and thermodynamic concern when present', () => {
    const snap = emptySnapshot();
    snap.analyzeArtifact = {
      targetProduct: 'artemisinin',
      bottleneckAssumptions: [
        { id: 'b1', label: 'Limited mevalonate precursor supply', rationale: 'x' } as any,
      ],
      thermodynamicConcerns: ['ΔG uphill at amorpha-4,11-diene synthase'],
      pathwayCandidates: [],
    };
    const ctx = buildWorkbenchCopilotContext(snap);
    expect(ctx.promptAugmentation).toContain('Top bottleneck: Limited mevalonate precursor supply');
    expect(ctx.promptAugmentation).toContain('Thermodynamic concern: ΔG uphill');
  });

  it('caps queued next-steps at 3', () => {
    const snap = emptySnapshot();
    snap.nextRecommendations = Array.from({ length: 6 }, (_, i) => ({
      toolId: `tool-${i}`,
      reason: 'r',
    }));
    const ctx = buildWorkbenchCopilotContext(snap);
    expect(ctx.nextToolIds).toHaveLength(3);
    expect(ctx.promptAugmentation).toContain('Queued next steps: tool-0, tool-1, tool-2');
  });

  it('is deterministic for identical input', () => {
    const snap = emptySnapshot();
    snap.project = { title: 'P', targetProduct: 'X' };
    snap.evidenceItems = [{ id: 'a', title: 'paper', year: '2024' }];
    const a = buildWorkbenchCopilotContext(snap);
    const b = buildWorkbenchCopilotContext(snap);
    expect(a).toEqual(b);
  });
});

describe('composeCopilotQuery', () => {
  it('returns the raw query when there is no context', () => {
    const ctx = buildWorkbenchCopilotContext(emptySnapshot());
    expect(composeCopilotQuery('hello', ctx)).toBe('hello');
  });

  it('appends the augmentation block when context is present', () => {
    const snap = emptySnapshot();
    snap.project = { title: 'P', targetProduct: 'artemisinin' };
    const ctx = buildWorkbenchCopilotContext(snap);
    const composed = composeCopilotQuery('What next?', ctx);
    expect(composed.startsWith('What next?\n\n')).toBe(true);
    expect(composed).toContain('Target product: artemisinin');
  });

  it('trims the raw query before composing', () => {
    const snap = emptySnapshot();
    snap.project = { title: 'P', targetProduct: 'X' };
    const ctx = buildWorkbenchCopilotContext(snap);
    expect(composeCopilotQuery('   hello   ', ctx).startsWith('hello\n\n')).toBe(true);
  });

  it('returns empty string for empty query regardless of context', () => {
    const snap = emptySnapshot();
    snap.project = { title: 'P', targetProduct: 'X' };
    const ctx = buildWorkbenchCopilotContext(snap);
    expect(composeCopilotQuery('   ', ctx)).toBe('');
  });
});
