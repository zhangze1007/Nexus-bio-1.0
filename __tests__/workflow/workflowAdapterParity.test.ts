/** @jest-environment node */
/**
 * Phase-2B.1 — R1 parity guard.
 *
 * The workflow control plane previously hardcoded "pathd | fbasim" in
 * `workbenchStore.buildWorkflowControlSnapshot` next to a separate
 * adapter registry list. This test fails CI if the two ever drift.
 */
import {
  DEFAULT_AXON_ADAPTERS,
  isAxonToolSupported,
} from '../../src/services/axonAdapterRegistry';
import { TOOL_IDS } from '../../src/domain/workflowContract';
import type { AxonTool } from '../../src/services/AxonOrchestrator';

describe('workflowAdapterParity — isAxonToolSupported is the single source', () => {
  it('returns true for every tool registered in DEFAULT_AXON_ADAPTERS', () => {
    for (const reg of DEFAULT_AXON_ADAPTERS) {
      expect(isAxonToolSupported(reg.tool)).toBe(true);
    }
  });

  it('returns false for every other ToolId not in DEFAULT_AXON_ADAPTERS', () => {
    const supported = new Set(DEFAULT_AXON_ADAPTERS.map((r) => r.tool));
    for (const id of TOOL_IDS) {
      const expected = supported.has(id as AxonTool);
      expect(isAxonToolSupported(id as AxonTool)).toBe(expected);
    }
  });

  it('rejects tool ids not in TOOL_IDS', () => {
    expect(isAxonToolSupported('not-a-tool' as AxonTool)).toBe(false);
  });

  it('catches drift: hardcoded coverage matches registry coverage exactly', () => {
    // If a future PR adds a new adapter to DEFAULT_AXON_ADAPTERS, this
    // assertion verifies that isAxonToolSupported reflects it without
    // any other code change. If a future PR forgets to add a contract
    // for the new adapter's tool id, the existing parity test in
    // workflowContract.test.ts will fail.
    const supportedFromHelper = TOOL_IDS.filter((id) => isAxonToolSupported(id as AxonTool));
    const supportedFromRegistry = DEFAULT_AXON_ADAPTERS.map((r) => r.tool).sort();
    expect([...supportedFromHelper].sort()).toEqual(supportedFromRegistry);
  });
});
