/**
 * axonDomainClassifier — PR-5 honest domain routing.
 *
 * PR-4 wired the planner + execution trace, but left an open honesty gap:
 * any freeform query — e.g. "Who is Donald Trump?" — would reach the
 * pathway-design prompt and come back as fabricated biosynthesis. This
 * module is the missing gate. It inspects the raw query, returns a
 * deterministic classification with signals, and lets both NEXAI and
 * the /api/analyze route refuse or re-route off-domain input instead
 * of forcing it through the scientific prompt.
 *
 * Classification categories:
 *   • scientific-pathway — clear PATHD/FBASIM/enzyme/thermo intent.
 *   • scientific-adjacent — mentions science/bio concepts without
 *     asking for a pathway (e.g. "explain Michaelis-Menten briefly").
 *   • workbench-ops — asking about saved evidence, current target,
 *     queued tasks, next-step recommendations, etc.
 *   • general-knowledge — plain informational request with no toxic
 *     signals, no science signals (e.g. "what's 2 + 2").
 *   • off-domain — explicit signals that the query is outside
 *     Nexus-Bio's scope (politics, celebrities, sports, weather, …).
 *   • ambiguous — nothing fires strongly.
 *
 * Design rules (non-negotiable):
 *   • Deterministic. No LLM. Tests must be reproducible.
 *   • Conservative. When in doubt, prefer `ambiguous` over forcing a
 *     category — the UI is honest about ambiguity.
 *   • Signals are lower-case, duplicate-free, and surface in the result
 *     so the UI can show *why* we classified the way we did.
 */

export type AxonDomainCategory =
  | 'scientific-pathway'
  | 'scientific-adjacent'
  | 'workbench-ops'
  | 'general-knowledge'
  | 'off-domain'
  | 'ambiguous';

export interface AxonDomainClassification {
  category: AxonDomainCategory;
  /** Short human-readable sentence explaining the decision. */
  reason: string;
  /** Distinct matched tokens that drove the decision. */
  signals: string[];
  /** True iff agentic planner should run. */
  shouldPlan: boolean;
  /** True iff we should call the biosynthesis prompt builder. */
  allowBiosynthesisPrompt: boolean;
  /** True iff we should call the model at all (prose mode allowed). */
  allowProseAnswer: boolean;
}

const SCIENTIFIC_PATHWAY_KEYWORDS = [
  'pathway',
  'biosynthesis',
  'biosynth',
  'metabolic',
  'metabolism',
  'fba',
  'flux balance',
  'flux-balance',
  'knockout',
  'overexpress',
  'gene circuit',
  'enzyme design',
  'bottleneck',
  'thermodynamic',
  'thermodynamics',
  'delta g',
  'δg',
  'mevalonate',
  'acetyl-coa',
  'fpp',
  'amorphadiene',
  'artemisinin',
  'lycopene',
  'terpenoid',
  'isoprenoid',
  'cofactor',
  'titer',
  'yield',
  'carbon efficiency',
  'michaelis',
  'crispr',
  'operon',
  'promoter',
  'plasmid',
  'chassis',
  'genome minim',
  'catalyst',
  'catalytic',
  'protein evolution',
  'de novo design',
  'docking',
  'dbtl',
  'cell-free',
  'ribosome',
];

const SCIENTIFIC_ADJACENT_KEYWORDS = [
  'enzyme',
  'gene',
  'genes',
  'genome',
  'protein',
  'proteins',
  'rna',
  'dna',
  'mrna',
  'atp',
  'nadh',
  'nadph',
  'amino acid',
  'biology',
  'biochemistry',
  'biotechnology',
  'yeast',
  'e. coli',
  'escherichia',
  'bacter',
  'microb',
  'cellular',
  'metabolite',
  'reaction',
  'substrate',
  'oxidation',
  'reduction',
  'kinetic',
  'kinetics',
  'catalysis',
  'omics',
  'transcriptom',
  'proteom',
  'metabolom',
];

/**
 * Workbench-ops signals. These are things a user asks the Axon
 * assistant *about the current workbench state* — which is grounded in
 * real workbench-store data even if the query itself has no scientific
 * keyword.
 */
const WORKBENCH_OPS_KEYWORDS = [
  'workbench',
  'current project',
  'this project',
  'my project',
  'my evidence',
  'saved evidence',
  'evidence bundle',
  'target product',
  'next step',
  'next tool',
  'recommend',
  'recommendation',
  'queue',
  'queued',
  'history',
  'last run',
  'previous run',
  'active plan',
  'current plan',
  'summari',
  'audit',
];

/**
 * Explicit off-domain lexicon. Kept narrow and auditable; the intent is
 * to catch the obvious misroutes ("Who is Donald Trump?") rather than
 * to build a general-purpose content filter. The UI always shows the
 * matched signal so the user knows why we refused to plan.
 */
const OFF_DOMAIN_KEYWORDS = [
  // politics / news personalities
  'donald trump',
  'joe biden',
  'kamala harris',
  'vladimir putin',
  'xi jinping',
  'narendra modi',
  'emmanuel macron',
  'president of',
  'prime minister',
  'election',
  'republican',
  'democrat',
  'politician',
  'congress',
  'senator',
  'parliament',
  // entertainment / sports / celebrity
  'taylor swift',
  'beyonce',
  'kanye',
  'elon musk',
  'kardashian',
  'marvel movie',
  'netflix',
  'hollywood',
  'nba',
  'premier league',
  'world cup',
  'olympics',
  'football score',
  'basketball score',
  // finance / crypto
  'stock price',
  'crypto',
  'bitcoin',
  'ethereum',
  'nasdaq',
  's&p 500',
  'dow jones',
  // weather / travel / cooking
  'weather in',
  'forecast for',
  'recipe for',
  'how to cook',
  'flight to',
  'hotel in',
  // legal / medical personal advice
  'legal advice',
  'medical diagnosis',
  'should i sue',
  'is it legal',
  // trivia-shaped biographical probes (covers "who is <person>")
];

/**
 * Biographical probe detector — "who is X?" / "tell me about X" where X
 * is clearly a person / thing unrelated to synthetic biology. We detect
 * the *shape*, then verify X is not a known scientific concept. This is
 * the pattern that most often escaped the PR-4 gate.
 */
const BIOGRAPHICAL_PROBE = /\b(who is|who's|tell me about|what do you know about)\s+([a-z][a-z .'-]{2,60})/i;

/**
 * Safelist of "about X" phrases where X *is* in-domain even though the
 * probe shape looks biographical. Keeps us from misclassifying
 * "tell me about mevalonate pathway" as off-domain.
 */
const IN_DOMAIN_SUBJECTS = [
  'pathway',
  'biosynthesis',
  'enzyme',
  'metabolite',
  'metabolism',
  'flux',
  'fba',
  'thermodynamics',
  'kinetics',
  'chassis',
  'circuit',
  'docking',
  'protein',
  'genome',
  'operon',
  'promoter',
  'plasmid',
  'yeast',
  'e. coli',
  'mevalonate',
  'artemisinin',
  'lycopene',
  'nadh',
  'atp',
];

function normalise(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchAll(lower: string, list: string[]): string[] {
  const hits = new Set<string>();
  for (const keyword of list) {
    if (lower.includes(keyword)) hits.add(keyword);
  }
  return Array.from(hits);
}

function biographicalProbeCategory(raw: string, lower: string): {
  kind: 'in-domain' | 'off-domain';
  subject: string;
} | null {
  const match = raw.match(BIOGRAPHICAL_PROBE);
  if (!match) return null;
  const subject = match[2].toLowerCase().trim();
  // Is the subject in-domain?
  for (const safe of IN_DOMAIN_SUBJECTS) {
    if (subject.includes(safe)) return { kind: 'in-domain', subject };
  }
  // Is the subject obviously off-domain?
  for (const off of OFF_DOMAIN_KEYWORDS) {
    if (subject.includes(off) || lower.includes(off)) {
      return { kind: 'off-domain', subject };
    }
  }
  // Unknown subject — treat as off-domain probe by default. The failure
  // mode we care about is forcing biography-shaped queries through the
  // biosynthesis prompt; requiring explicit scientific context to
  // re-open the gate is the conservative choice.
  return { kind: 'off-domain', subject };
}

export function classifyAxonDomain(rawQuery: string): AxonDomainClassification {
  const raw = typeof rawQuery === 'string' ? rawQuery : '';
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      category: 'ambiguous',
      reason: 'Empty query',
      signals: [],
      shouldPlan: false,
      allowBiosynthesisPrompt: false,
      allowProseAnswer: false,
    };
  }

  const lower = normalise(trimmed);
  const pathwayHits = matchAll(lower, SCIENTIFIC_PATHWAY_KEYWORDS);
  const adjacentHits = matchAll(lower, SCIENTIFIC_ADJACENT_KEYWORDS);
  const workbenchHits = matchAll(lower, WORKBENCH_OPS_KEYWORDS);
  const offDomainHits = matchAll(lower, OFF_DOMAIN_KEYWORDS);
  const probe = biographicalProbeCategory(trimmed, lower);

  // 1. Explicit off-domain wins over everything unless the same query
  //    also carries strong scientific signal (rare but possible —
  //    e.g. "how does lithium battery chemistry compare to crypto
  //    mining power?"). We prefer off-domain here because mixed
  //    queries are the exact "force into biosynthesis" failure.
  if (offDomainHits.length > 0 && pathwayHits.length === 0) {
    return {
      category: 'off-domain',
      reason: `Matched off-domain signal(s): ${offDomainHits.slice(0, 3).join(', ')}`,
      signals: offDomainHits,
      shouldPlan: false,
      allowBiosynthesisPrompt: false,
      allowProseAnswer: false,
    };
  }

  if (probe && probe.kind === 'off-domain' && pathwayHits.length === 0 && adjacentHits.length === 0) {
    return {
      category: 'off-domain',
      reason: `Biographical probe about "${probe.subject.slice(0, 48)}" — outside Nexus-Bio scope`,
      signals: [`who-is:${probe.subject.slice(0, 40)}`],
      shouldPlan: false,
      allowBiosynthesisPrompt: false,
      allowProseAnswer: false,
    };
  }

  // 2. Scientific pathway — the only category allowed to trigger the
  //    biosynthesis prompt builder.
  if (pathwayHits.length > 0) {
    return {
      category: 'scientific-pathway',
      reason: `Matched pathway/flux signal(s): ${pathwayHits.slice(0, 3).join(', ')}`,
      signals: pathwayHits,
      shouldPlan: true,
      allowBiosynthesisPrompt: true,
      allowProseAnswer: true,
    };
  }

  // 3. Scientific adjacent — model should answer in prose, planner
  //    does not run (no tool is triggered).
  if (adjacentHits.length > 0) {
    return {
      category: 'scientific-adjacent',
      reason: `Matched science-adjacent signal(s): ${adjacentHits.slice(0, 3).join(', ')}`,
      signals: adjacentHits,
      shouldPlan: false,
      allowBiosynthesisPrompt: false,
      allowProseAnswer: true,
    };
  }

  // 4. Workbench-ops — ground the answer in store state; no LLM
  //    scientific prompt; planner does not run.
  if (workbenchHits.length > 0) {
    return {
      category: 'workbench-ops',
      reason: `Matched workbench-ops signal(s): ${workbenchHits.slice(0, 3).join(', ')}`,
      signals: workbenchHits,
      shouldPlan: false,
      allowBiosynthesisPrompt: false,
      allowProseAnswer: true,
    };
  }

  if (probe && probe.kind === 'in-domain') {
    return {
      category: 'scientific-adjacent',
      reason: `"about ${probe.subject.slice(0, 40)}" — in-domain subject`,
      signals: [`about:${probe.subject.slice(0, 40)}`],
      shouldPlan: false,
      allowBiosynthesisPrompt: false,
      allowProseAnswer: true,
    };
  }

  // 5. Nothing fired. Very short generic queries get `general-knowledge`
  //    (no pretence of scientific grounding); longer unclassifiable
  //    queries get `ambiguous` so the UI can ask for clarification.
  const wordCount = lower.split(/\s+/).length;
  if (wordCount <= 4) {
    return {
      category: 'general-knowledge',
      reason: 'Short generic query — no scientific or workbench signal',
      signals: [],
      shouldPlan: false,
      allowBiosynthesisPrompt: false,
      allowProseAnswer: false,
    };
  }

  return {
    category: 'ambiguous',
    reason: 'No explicit scientific, workbench, or off-domain signal detected',
    signals: [],
    shouldPlan: false,
    allowBiosynthesisPrompt: false,
    allowProseAnswer: true,
  };
}

/**
 * Short label for the session viewer / chip. Kept here so every surface
 * renders the same string for the same category.
 */
export function domainCategoryLabel(category: AxonDomainCategory): string {
  switch (category) {
    case 'scientific-pathway': return 'Scientific pathway';
    case 'scientific-adjacent': return 'Scientific adjacent';
    case 'workbench-ops': return 'Workbench query';
    case 'general-knowledge': return 'General query';
    case 'off-domain': return 'Off-domain';
    case 'ambiguous': return 'Ambiguous';
  }
}
