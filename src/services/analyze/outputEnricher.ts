/**
 * Output enrichment — post-process model responses into Axon-compliant JSON.
 * Extracted from app/api/analyze/route.ts.
 */

import type { JsonRecord } from './types';

type ParseFailureCode = 'EMPTY' | 'NO_OBJECT' | 'INVALID_SYNTAX';

interface ParseOutcome {
  value: JsonRecord | null;
  error?: { code: ParseFailureCode; message: string };
}

export interface EnrichResult {
  text: string;
  parseError?: { code: ParseFailureCode; message: string };
}

function parseJsonFromText(raw: string): ParseOutcome {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { value: null, error: { code: 'EMPTY', message: 'Model returned empty output' } };
  }

  // Strategy 1: direct.
  try {
    return { value: JSON.parse(raw) as JsonRecord };
  } catch { /* fall through */ }

  // Strategy 2: strip markdown fences.
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  if (stripped !== raw) {
    try {
      return { value: JSON.parse(stripped) as JsonRecord };
    } catch { /* fall through */ }
  }

  // Strategy 3: outermost brace slice.
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last <= first) {
    return { value: null, error: { code: 'NO_OBJECT', message: 'Model output contained no JSON object' } };
  }

  try {
    return { value: JSON.parse(raw.slice(first, last + 1)) as JsonRecord };
  } catch {
    return { value: null, error: { code: 'INVALID_SYNTAX', message: 'Model output contained malformed JSON' } };
  }
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace('%', '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function hasDesignFields(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const v = value as JsonRecord;
  return typeof v.active_site_remodeling === 'string'
    && typeof v.thermal_stability_enhancement === 'string'
    && typeof v.substrate_specificity_tuning === 'string';
}

export function enrichAxonOutput(raw: string): EnrichResult {
  const outcome = parseJsonFromText(raw);
  const parsed = outcome.value;
  if (!parsed) {
    // Preserve the raw text so the existing frontend formatter can fall back
    // to plain-text rendering, but tell callers the parse failed.
    return { text: raw, parseError: outcome.error };
  }
  if (!Array.isArray(parsed.nodes)) {
    // Valid JSON but not a pathway shape — pass through unchanged.
    return { text: raw };
  }

  const nodes = parsed.nodes.filter((n): n is JsonRecord => !!n && typeof n === 'object');
  const bottlenecks = nodes
    .filter((node) => String(node.nodeType || '').toLowerCase() === 'enzyme')
    .map((node) => {
      const efficiency = readNumber(node.efficiency_percent)
        ?? readNumber(node.enzyme_efficiency_percent)
        ?? readNumber(node.yield_percent)
        ?? (() => {
          const flux = readNumber(node.flux_efficiency);
          return flux !== null ? flux * 100 : null;
        })();

      return { node, efficiency };
    })
    .filter((x) => x.efficiency !== null && (x.efficiency as number) < 40)
    .map(({ node, efficiency }) => {
      const nodeId = String(node.id || 'unknown_enzyme');
      const enzyme = String(node.label || nodeId);
      const yieldLossPercent = Math.max(0, Math.round(100 - (efficiency as number)));
      return {
        node_id: nodeId,
        enzyme,
        efficiency_percent: Math.round((efficiency as number) * 10) / 10,
        yield_loss_percent: yieldLossPercent,
        evidence: String(node.evidenceSnippet || node.audit_trail || 'Predicted bottleneck from model output'),
      };
    });

  const existingStrategies = Array.isArray(parsed.de_novo_design_strategies)
    ? parsed.de_novo_design_strategies.filter((x): x is JsonRecord => !!x && typeof x === 'object')
    : [];

  const strategyByNode = new Map<string, JsonRecord>();
  for (const strategy of existingStrategies) {
    const nodeId = String(strategy.node_id || '');
    const block = strategy.de_novo_design_strategy;
    if (nodeId && hasDesignFields(block)) {
      strategyByNode.set(nodeId, strategy);
    }
  }

  const filledStrategies = bottlenecks.map((b) => {
    const existing = strategyByNode.get(b.node_id);
    if (existing) return existing;

    return {
      node_id: b.node_id,
      source: 'server_enrichment' as const,
      de_novo_design_strategy: {
        active_site_remodeling: `Repack catalytic pocket for ${b.enzyme} by introducing polarity-matched sidechains around the transition-state contact shell to reduce local activation barriers.`,
        thermal_stability_enhancement: `Engineer a thermostability layer for ${b.enzyme} with loop rigidification and salt-bridge reinforcement to preserve active conformation under production stress.`,
        substrate_specificity_tuning: `Tune substrate selectivity in ${b.enzyme} by reshaping the substrate entry channel to favor desired substrate geometry and suppress competing side reactions.`,
        predicted_impact: `Predicted TRY uplift: +${Math.max(8, Math.round(b.yield_loss_percent * 0.35))}% yield recovery with reduced byproduct flux.`,
      },
    };
  });

  const primary = bottlenecks[0];
  const stepLabel = primary?.enzyme?.includes('amorph')
    ? 'FPP-to-Amorphadiene'
    : (primary ? `${primary.enzyme} reaction` : 'rate-limiting step');
  const yieldLoss = primary?.yield_loss_percent ?? 25;

  parsed.bottleneck_enzymes = bottlenecks;
  parsed.de_novo_design_strategies = filledStrategies;

  // Build context-aware Socratic question
  let question: string;
  let options: string[];
  if (primary) {
    const hasMultiple = bottlenecks.length > 1;
    question = hasMultiple
      ? `I've identified ${bottlenecks.length} bottleneck enzymes, with the most critical being a ${yieldLoss}% yield loss at the ${stepLabel} step. Should we analyze enzyme-substrate docking to redesign the active site, or optimize the flux balance to redistribute carbon flow?`
      : `I've identified a ${yieldLoss}% yield loss at the ${stepLabel} step. Should we analyze the enzyme-substrate docking or optimize the flux balance?`;
    options = ['enzyme_substrate_docking', 'flux_balance_optimization'];
  } else {
    question = 'No critical bottlenecks detected. The pathway appears thermodynamically favorable. Should we explore cofactor optimization or investigate potential downstream processing constraints?';
    options = ['cofactor_optimization', 'dsp_analysis'];
  }

  parsed.axon_interaction = {
    yield_loss_percent: yieldLoss,
    step: stepLabel,
    question,
    options,
    disclosure_phase: 'socratic',
  };

  return { text: JSON.stringify(parsed, null, 2) };
}
