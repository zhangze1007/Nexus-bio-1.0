import type { ProvenanceEntry, Evidence } from '../types/assumptions';
import { TOOL_VALIDITY } from '../components/tools/shared/toolValidity';

export function createProvenanceEntry(args: {
  toolId: string;
  inputAssumptions?: string[];
  outputAssumptions?: string[];
  evidence?: Evidence[];
  upstreamProvenance?: string[];
}): ProvenanceEntry {
  // Read validity tier from TOOL_VALIDITY at call time so the snapshot
  // reflects the current tier. Fall back to 'partial' if unknown.
  const tier = TOOL_VALIDITY[args.toolId]?.level ?? 'partial';
  return {
    toolId: args.toolId,
    timestamp: Date.now(),
    inputAssumptions: args.inputAssumptions ?? [],
    outputAssumptions: args.outputAssumptions ?? [],
    evidence: args.evidence ?? [],
    validityTier: tier,
    upstreamProvenance: args.upstreamProvenance ?? [],
  };
}
