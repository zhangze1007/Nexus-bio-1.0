/**
 * Biosafety Assessment Engine
 *
 * Screens DNA/protein sequences against known biosafety databases
 * and produces structured risk assessments.
 *
 * Reference: WHO Laboratory Biosafety Manual (2020)
 * Reference: NIH Guidelines for Research Involving Recombinant DNA (2019)
 * Reference: VFDB: http://www.mgc.ac.cn/VFs/
 *
 * @scientific_provenance
 *   ALGORITHM: Sequence similarity screening + rule-based risk scoring
 *   KNOWN_LIMITATIONS:
 *     - Uses keyword matching, not BLAST alignment
 *     - No 3D structure-based toxicity prediction
 *     - No ML-based virulence factor detection
 */

import { assessSequenceRisk, SEQUENCE_RISK_RULES } from "../../core/safety/riskModel";
import type { BiosafetyInput, BiosafetyOutput, ContainmentStrategy, SequenceMatch } from "./types";

// ── Virulence Factor Database (simulated) ──────────────────────────────────

/**
 * Known virulence factor patterns.
 * In production, this would be loaded from VFDB.
 * Reference: Chen et al. (2005) Nucleic Acids Res 33:D328
 */
const VIRULENCE_PATTERNS: Array<{ name: string; pattern: string; category: string; risk: number }> = [
  { name: "hlyA (hemolysin)", pattern: "ATGAATAAAAGAAATTTTGTT", category: "toxin", risk: 0.9 },
  { name: "invA (invasion)", pattern: "ATGTCGACGATCAATATG", category: "invasion", risk: 0.7 },
  { name: "spa (protein A)", pattern: "ATGGCGCAACACGATGAAGC", category: "immune_evasion", risk: 0.6 },
  { name: "mecA (PBP2a)", pattern: "ATGAAAATATATTATATTAAT", category: "resistance", risk: 0.8 },
  { name: "blaTEM (TEM-1)", pattern: "ATGAGTATTCAACATTTCCGT", category: "resistance", risk: 0.7 },
  { name: "cat (chloramphenicol)", pattern: "ATGTTACGCAGCAGCAACGA", category: "resistance", risk: 0.6 },
  { name: "tetA (tetracycline)", pattern: "ATGAAATCTAACAATGCGCTC", category: "resistance", risk: 0.6 },
  { name: "ndm-1 (carbapenemase)", pattern: "ATGGAATTGCCCAATATTATG", category: "resistance", risk: 0.9 },
  { name: "toxA (exotoxin A)", pattern: "ATGATAACTAAACGAGTACGC", category: "toxin", risk: 0.9 },
  { name: "stx1 (Shiga toxin 1)", pattern: "ATGAAAAAAACTATCTTAGAG", category: "toxin", risk: 0.95 },
];

/**
 * Known select agent sequences (simplified).
 * Reference: CDC Select Agents and Toxins List
 */
const SELECT_AGENT_PATTERNS: Array<{ name: string; pattern: string; risk: number }> = [
  { name: "Bacillus anthracis (anthrax)", pattern: "ATGAAAAAAATTAATATTTTCA", risk: 1.0 },
  { name: "Yersinia pestis (plague)", pattern: "ATGAAAAAATTTATTTCTATTA", risk: 1.0 },
  { name: "Variola major (smallpox)", pattern: "ATGAAAACTATTTATAACACCA", risk: 1.0 },
  { name: "Francisella tularensis", pattern: "ATGAAAAAGATTTTATTTCTTT", risk: 1.0 },
];

// ── Sequence Screening ─────────────────────────────────────────────────────

/**
 * Screen a DNA sequence against known dangerous sequences.
 * Uses k-mer matching (not full BLAST — too slow for real-time).
 */
function screenSequence(sequence: string): {
  virulenceMatches: SequenceMatch[];
  selectAgentMatches: SequenceMatch[];
  resistanceMatches: SequenceMatch[];
} {
  const seq = sequence.toUpperCase();
  const virulenceMatches: SequenceMatch[] = [];
  const selectAgentMatches: SequenceMatch[] = [];
  const resistanceMatches: SequenceMatch[] = [];

  // Screen against virulence factors
  for (const vf of VIRULENCE_PATTERNS) {
    const pattern = vf.pattern.toUpperCase();
    // Check for substring match or high similarity
    if (seq.includes(pattern) || sequenceSimilarity(seq, pattern) > 0.8) {
      const match: SequenceMatch = {
        source: "VFDB",
        matchName: vf.name,
        score: sequenceSimilarity(seq, pattern),
        queryRegion: [seq.indexOf(pattern), seq.indexOf(pattern) + pattern.length],
        dbRegion: [0, pattern.length],
        significance: 1e-10,
        comment: `Virulence factor: ${vf.category}`,
      };
      virulenceMatches.push(match);
    }
  }

  // Screen against select agents
  for (const sa of SELECT_AGENT_PATTERNS) {
    const pattern = sa.pattern.toUpperCase();
    if (seq.includes(pattern) || sequenceSimilarity(seq, pattern) > 0.8) {
      selectAgentMatches.push({
        source: "CDC Select Agents",
        matchName: sa.name,
        score: sequenceSimilarity(seq, pattern),
        queryRegion: [seq.indexOf(pattern), seq.indexOf(pattern) + pattern.length],
        dbRegion: [0, pattern.length],
        significance: 0,
        comment: "Select agent — blocked by safety policy",
      });
    }
  }

  // Screen against antibiotic resistance genes
  for (const vf of VIRULENCE_PATTERNS) {
    if (vf.category === "resistance") {
      const pattern = vf.pattern.toUpperCase();
      if (seq.includes(pattern) || sequenceSimilarity(seq, pattern) > 0.7) {
        resistanceMatches.push({
          source: "CARD",
          matchName: vf.name,
          score: sequenceSimilarity(seq, pattern),
          queryRegion: [seq.indexOf(pattern), seq.indexOf(pattern) + pattern.length],
          dbRegion: [0, pattern.length],
          significance: 1e-5,
          comment: "Antibiotic resistance gene",
        });
      }
    }
  }

  return { virulenceMatches, selectAgentMatches, resistanceMatches };
}

/**
 * Simple sequence similarity (k-mer based Jaccard index).
 */
function sequenceSimilarity(seq1: string, seq2: string): number {
  const k = 6;
  const kmers1 = new Set<string>();
  const kmers2 = new Set<string>();

  for (let i = 0; i <= seq1.length - k; i++) kmers1.add(seq1.substring(i, i + k));
  for (let i = 0; i <= seq2.length - k; i++) kmers2.add(seq2.substring(i, i + k));

  const intersection = new Set([...kmers1].filter((x) => kmers2.has(x)));
  const union = new Set([...kmers1, ...kmers2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// ── Containment Strategy ───────────────────────────────────────────────────

/**
 * Design containment strategies based on risk level and host.
 */
function designContainment(riskLevel: string, host: string, purpose: string): ContainmentStrategy[] {
  const strategies: ContainmentStrategy[] = [];

  // Always recommend auxotrophic strains for production
  if (purpose === "production" || purpose === "environmental") {
    strategies.push({
      type: "auxotrophic",
      description: "Use auxotrophic host strain requiring exogenous amino acid supply",
      confidence: 0.9,
      reference: "Caliando & Voigt (2015) Nat Commun 6:6413",
    });
  }

  // Inducible kill switch for environmental release
  if (purpose === "environmental") {
    strategies.push({
      type: "inducible_survival",
      description: "Add inducible kill switch activated by environmental signals",
      confidence: 0.85,
      reference: "Caliando & Voigt (2015) Nat Commun 6:6413",
    });
  }

  // Compartmentalization for high-risk
  if (riskLevel === "high" || riskLevel === "elevated") {
    strategies.push({
      type: "compartmentalization",
      description: "Use physical containment (BSL-2 or higher) and restrict organism mobility",
      confidence: 0.95,
      reference: "WHO Laboratory Biosafety Manual (2020)",
    });
  }

  // Research-only mode
  if (riskLevel === "high" || riskLevel === "blocked") {
    strategies.push({
      type: "research_only",
      description: "Restrict to research use only — no production or environmental release",
      confidence: 1.0,
      reference: "NIH Guidelines for Research Involving Recombinant DNA (2019)",
    });
  }

  // Safe host recommendation
  if (host === "human") {
    strategies.push({
      type: "safe_host",
      description: "Consider using non-pathogenic E. coli K-12 or S. cerevisiae instead of human cells",
      confidence: 0.8,
      reference: "Gasser et al. (2008) Biotechnol J 3:849",
    });
  }

  return strategies;
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Assess biosafety of a DNA/protein construct.
 *
 * Pipeline:
 *   1. Screen sequence against virulence factor database
 *   2. Screen against select agent database
 *   3. Screen against antibiotic resistance database
 *   4. Compute risk score
 *   5. Design containment strategies
 *   6. Produce structured risk assessment
 */
export function assessBiosafety(input: BiosafetyInput): BiosafetyOutput {
  const { dnaSequence, host, purpose, mode, riskTolerance = 0.5 } = input;

  // 1. Screen sequence
  const { virulenceMatches, selectAgentMatches, resistanceMatches } = screenSequence(dnaSequence);

  // 2. Compute match scores
  const selectAgentScore = selectAgentMatches.length > 0 ? Math.max(...selectAgentMatches.map((m) => m.score)) : 0;
  const virulenceScore = virulenceMatches.length > 0 ? Math.max(...virulenceMatches.map((m) => m.score)) : 0;
  const resistanceScore = resistanceMatches.length > 0 ? Math.max(...resistanceMatches.map((m) => m.score)) : 0;

  // 3. Assess risk
  const risk = assessSequenceRisk(dnaSequence, host, purpose, {
    virulence: virulenceScore,
    toxin: virulenceMatches.filter((m) => m.comment?.includes("toxin")).length > 0 ? virulenceScore : 0,
    selectAgent: selectAgentScore,
  });

  // 4. Design containment
  const containment = designContainment(risk.level, host, purpose);

  // 5. Combine all matches
  const allMatches = [...selectAgentMatches, ...virulenceMatches, ...resistanceMatches];

  // 6. Evidence
  const evidence = allMatches.map((m) => ({
    source: m.source,
    type: "database" as const,
    title: m.matchName,
    url: m.source === "VFDB" ? "http://www.mgc.ac.cn/VFs/" : undefined,
  }));

  // 7. Design notes
  const designNotes: string[] = [
    `Screened ${dnaSequence.length} bp against ${VIRULENCE_PATTERNS.length} virulence patterns`,
    `Risk level: ${risk.level} (score=${risk.score.toFixed(2)})`,
    `Matches: ${virulenceMatches.length} virulence, ${selectAgentMatches.length} select agent, ${resistanceMatches.length} resistance`,
    `Containment strategies: ${containment.length} recommended`,
  ];

  if (selectAgentMatches.length > 0) {
    designNotes.push("⚠ SELECT AGENT MATCH — construct blocked by safety policy");
  }

  return {
    risk: {
      level: risk.level,
      score: risk.score,
      reason: risk.reason,
      triggerRule: risk.triggerRule,
    },
    matches: allMatches,
    containment,
    canProceed: risk.canProceed,
    requiresHumanReview: risk.requiresHumanReview,
    evidence,
    designNotes,
  };
}
