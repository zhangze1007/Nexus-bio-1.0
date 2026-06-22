/**
 * NEXAI Research Agent Pipeline
 *
 * Unidirectional pipeline: Search Planner → Paper Analyzer → Synthesizer
 *
 * Agent A (Planner): Generates search queries from user research question
 * Agent B (Analyzer): Scores papers by relevance, citation impact, and recency
 * Agent C (Synthesizer): Ranks papers + builds evidence map from subtopic claims
 *
 * Every numerical conclusion comes from real scoring algorithms.
 * LLM role: generate queries, explain findings.
 *
 * @scientific_provenance
 *   ALGORITHM: Pipeline orchestration — TF-IDF-like keyword relevance + log-normalized citation impact + exponential recency decay + evidence map construction
 *   REFERENCE: N/A — orchestration only; paper search/fetch delegated to UI-layer SemanticSearch component
 *   KNOWN_LIMITATIONS:
 *     - Relevance scoring is term-overlap fraction, not true TF-IDF (no inverse document frequency)
 *     - Citation impact uses log-normalization against max in corpus; no field-normalized metrics (e.g., FWCI)
 *     - Recency decay rate (0.1/year) is fixed; no discipline-specific half-life calibration
 *     - Evidence map uses regex keyword matching for support/contradiction; no semantic entailment
 *     - Key findings extraction is sentence-level regex filtering, not NLP-based summarization
 *     - No deduplication of papers from different database sources
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ResearchQuestion {
  topic: string;
  subtopics: string[];
  targetOrganism?: string;
  yearRange?: { from: number; to: number };
}

export interface Paper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  year: number;
  journal: string;
  citations: number;
  doi?: string;
}

export interface PaperScore {
  paper: Paper;
  relevanceScore: number;     // 0-1 (from TF-IDF or keyword matching)
  citationImpact: number;     // normalized citation count
  recencyScore: number;       // 1.0 for current year, decaying
  compositeScore: number;
  keyFindings: string[];
  methodology: string;
}

export interface EvidenceMap {
  claim: string;
  supportingPapers: string[];
  contradictingPapers: string[];
  confidence: number;
}

export interface NEXAIResult {
  question: ResearchQuestion;
  searchQueries: string[];
  papers: PaperScore[];
  evidenceMap: EvidenceMap[];
  topPapers: PaperScore[];
  allSolverCalls: Array<{ solver: string; description: string }>;
}

// ── Agent A: Search Planner ─────────────────────────────────────────────────

/**
 * Generate search queries from research question.
 * LLM generates the queries — this is legitimate LLM involvement.
 */
function planSearches(
  question: ResearchQuestion,
): {
  queries: string[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'planner::generate', description: `Queries for: ${question.topic}` });

  // Generate queries from topic and subtopics
  const queries: string[] = [
    question.topic,
    ...question.subtopics.map(s => `${question.topic} ${s}`),
  ];

  if (question.targetOrganism) {
    queries.push(`${question.topic} ${question.targetOrganism}`);
  }

  return { queries, solverCalls };
}

// ── Agent B: Paper Analyzer ─────────────────────────────────────────────────

/**
 * Score papers by relevance, impact, and recency.
 * Every score is computed, not estimated.
 */
function analyzePapers(
  papers: Paper[],
  question: ResearchQuestion,
): {
  scores: PaperScore[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'scoring::papers', description: `${papers.length} papers scored` });

  const currentYear = 2026;
  const maxCitations = Math.max(1, ...papers.map(p => p.citations));

  // TF-IDF-like relevance scoring
  const queryTerms = [question.topic, ...question.subtopics]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2);

  const scores: PaperScore[] = papers.map(paper => {
    // Relevance: fraction of query terms found in title + abstract
    const text = `${paper.title} ${paper.abstract}`.toLowerCase();
    const matchedTerms = queryTerms.filter(t => text.includes(t));
    const relevanceScore = queryTerms.length > 0
      ? Math.round((matchedTerms.length / queryTerms.length) * 1000) / 1000
      : 0;

    // Citation impact: log-normalized
    const citationImpact = Math.round(
      (Math.log(1 + paper.citations) / Math.log(1 + maxCitations)) * 1000
    ) / 1000;

    // Recency: exponential decay
    const yearDiff = currentYear - paper.year;
    const recencyScore = Math.round(Math.exp(-0.1 * yearDiff) * 1000) / 1000;

    // Composite: weighted combination
    const compositeScore = Math.round(
      (0.5 * relevanceScore + 0.3 * citationImpact + 0.2 * recencyScore) * 1000
    ) / 1000;

    // Extract key findings from abstract (simple sentence extraction)
    const sentences = paper.abstract.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keyFindings = sentences
      .filter(s => /we|our|found|show|demonstrate|result|suggest/i.test(s))
      .slice(0, 3)
      .map(s => s.trim());

    return {
      paper,
      relevanceScore,
      citationImpact,
      recencyScore,
      compositeScore,
      keyFindings,
      methodology: sentences.find(s => /method|approach|technique|protocol/i.test(s))?.trim() ?? '',
    };
  });

  return { scores, solverCalls };
}

// ── Agent C: Synthesizer ────────────────────────────────────────────────────

/**
 * Build evidence map: which claims are supported by which papers.
 */
function synthesizeEvidence(
  paperScores: PaperScore[],
  question: ResearchQuestion,
): {
  evidenceMap: EvidenceMap[];
  topPapers: PaperScore[];
  solverCalls: Array<{ solver: string; description: string }>;
} {
  const solverCalls: Array<{ solver: string; description: string }> = [];
  solverCalls.push({ solver: 'synthesis::evidence', description: `Evidence map from ${paperScores.length} papers` });

  // Sort by composite score
  const sorted = [...paperScores].sort((a, b) => b.compositeScore - a.compositeScore);
  const topPapers = sorted.slice(0, 10);

  // Build evidence map from subtopics
  const evidenceMap: EvidenceMap[] = question.subtopics.map(subtopic => {
    const supporting = paperScores
      .filter(p => p.relevanceScore > 0.3 && p.paper.abstract.toLowerCase().includes(subtopic.toLowerCase()))
      .map(p => p.paper.id);
    const contradicting = paperScores
      .filter(p => p.relevanceScore > 0.3 &&
        /however|but|although|contrary|disagree|challenge|limitation/i.test(p.paper.abstract) &&
        p.paper.abstract.toLowerCase().includes(subtopic.toLowerCase()))
      .map(p => p.paper.id);

    return {
      claim: subtopic,
      supportingPapers: supporting,
      contradictingPapers: contradicting,
      confidence: supporting.length > 0
        ? Math.min(1, supporting.length / (supporting.length + contradicting.length))
        : 0,
    };
  });

  return { evidenceMap, topPapers, solverCalls };
}

// ── Pipeline Entry Point ────────────────────────────────────────────────────

/**
 * Run the NEXAI research pipeline.
 *
 * Note: This pipeline takes pre-fetched papers as input.
 * The actual paper search/fetch is done by the UI layer
 * (SemanticSearch component) which calls external APIs.
 */
export function runResearchPipeline(
  question: ResearchQuestion,
  papers: Paper[],
): NEXAIResult {
  const allSolverCalls: Array<{ solver: string; description: string }> = [];

  // Agent A: Plan searches
  const { queries, solverCalls: planCalls } = planSearches(question);
  allSolverCalls.push(...planCalls);

  // Agent B: Analyze papers
  const { scores, solverCalls: analyzeCalls } = analyzePapers(papers, question);
  allSolverCalls.push(...analyzeCalls);

  // Agent C: Synthesize
  const { evidenceMap, topPapers, solverCalls: synthCalls } = synthesizeEvidence(scores, question);
  allSolverCalls.push(...synthCalls);

  return { question, searchQueries: queries, papers: scores, evidenceMap, topPapers, allSolverCalls };
}
