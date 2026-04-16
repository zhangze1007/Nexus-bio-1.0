/**
 * axonIntentRouter — narrow intent classification for agentic mode.
 *
 * The router only claims a request as automatable when the natural-language
 * query points unambiguously at PATHD (pathway / bottleneck design) or
 * FBASIM (flux-balance simulation). Every other prompt stays in the
 * existing PR-2a plain-language copilot surface.
 *
 * Design notes:
 *   • Keyword-based by design. An LLM intent classifier is tempting but
 *     would burn model budget on every keystroke and introduce a non-
 *     deterministic routing path we can't reason about in tests. Start
 *     with transparent keyword rules; upgrade when the behaviour demands it.
 *   • No regex voodoo. The routes are kept short and auditable so the
 *     behaviour is inspectable at a glance.
 *   • The router never overrides the user. It produces a *suggestion*;
 *     NEXAIPage is responsible for asking the user to confirm before
 *     actually enqueuing a task. Silent auto-routing would violate the
 *     audit's "automation is phased, not faked" principle.
 */

export type IntentRoute =
  | { kind: 'none'; reason: string }
  | {
      kind: 'pathd';
      targetProduct: string;
      reason: string;
      signals: string[];
    }
  | {
      kind: 'fbasim';
      reason: string;
      signals: string[];
      params: {
        species: 'ecoli' | 'yeast';
        objective: 'biomass' | 'atp' | 'product';
      };
    };

const PATHD_KEYWORDS = [
  'pathway design',
  'design the pathway',
  'design a pathway',
  'biosynthesis pathway',
  'bottleneck design',
  'design bottleneck',
  'design enzyme',
  'de novo design',
  'redesign',
  'metabolic pathway for',
  'pathway for',
];

const FBASIM_KEYWORDS = [
  'flux balance',
  'flux-balance',
  'fba',
  'metabolic simulation',
  'simulate the metabolism',
  'simulate metabolism',
  'community simulation',
  'growth rate simulation',
  'knockout analysis',
];

const PRODUCT_PATTERNS = [
  /(?:pathway|biosynthesis|produce|production|design|route|make)\s+(?:for|of|to)\s+([a-z0-9][a-z0-9\s\-']{2,48}?)(?:[.?!,]|$)/i,
  /\bfor\s+([a-z0-9][a-z0-9\s\-']{2,48})\s+(?:pathway|biosynthesis)\b/i,
];

function lowerTrim(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchedKeywords(lower: string, keywords: string[]): string[] {
  return keywords.filter((kw) => lower.includes(kw));
}

function extractProduct(raw: string): string | null {
  for (const pattern of PRODUCT_PATTERNS) {
    const match = raw.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[.?!,]$/, '');
    }
  }
  return null;
}

export interface IntentContextHint {
  /** Active workbench target product, if any. Used as PATHD fallback. */
  targetProduct?: string;
}

export function routeIntent(query: string, context?: IntentContextHint): IntentRoute {
  const trimmed = query?.trim() ?? '';
  if (!trimmed) return { kind: 'none', reason: 'Empty query' };

  const lower = lowerTrim(trimmed);

  const pathdHits = matchedKeywords(lower, PATHD_KEYWORDS);
  const fbasimHits = matchedKeywords(lower, FBASIM_KEYWORDS);

  // Conflict: both tools mentioned. Stay conservative — don't route.
  if (pathdHits.length > 0 && fbasimHits.length > 0) {
    return {
      kind: 'none',
      reason: 'Query mentions both PATHD and FBASIM scope; keeping it in copilot mode',
    };
  }

  if (pathdHits.length > 0) {
    const product = extractProduct(trimmed) ?? context?.targetProduct ?? '';
    if (!product) {
      return {
        kind: 'none',
        reason: 'PATHD intent detected but no target product present in query or context',
      };
    }
    return {
      kind: 'pathd',
      targetProduct: product,
      reason: `Matched PATHD keyword(s): ${pathdHits.join(', ')}`,
      signals: pathdHits,
    };
  }

  if (fbasimHits.length > 0) {
    const species: 'ecoli' | 'yeast' = lower.includes('yeast') ? 'yeast' : 'ecoli';
    const objective: 'biomass' | 'atp' | 'product' =
      lower.includes('atp') ? 'atp' :
      lower.includes('product') || lower.includes('yield') ? 'product' :
      'biomass';
    return {
      kind: 'fbasim',
      reason: `Matched FBASIM keyword(s): ${fbasimHits.join(', ')}`,
      signals: fbasimHits,
      params: { species, objective },
    };
  }

  return {
    kind: 'none',
    reason: 'No automatable PATHD / FBASIM intent detected',
  };
}
