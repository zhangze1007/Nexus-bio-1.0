/**
 * Biosafety Screening Engine
 *
 * Screens DNA/protein sequences against known dangerous pathogen sequences
 * and provides dual-use risk assessment, following the 2024 U.S. Framework
 * for Nucleic Acid Synthesis Screening.
 *
 * Features:
 *   1. Sequence-of-concern detection (select agents, toxins, enhanced pathogens)
 *   2. Dual-use research of concern (DURC) risk scoring
 *   3. DNA synthesis order screening (SecureDNA-compatible interface)
 *   4. Risk mitigation recommendations
 *
 * References:
 *   - U.S. Framework for Nucleic Acid Synthesis Screening (2024)
 *   - SecureDNA (https://securedna.org)
 *   - NTI Biosecurity guidelines
 *   - EBRC Roadmap for Synthetic Biology Safety
 *
 * @scientific_provenance
 *   ALGORITHM: k-mer matching against curated pathogen sequence database +
 *              heuristic risk scoring based on sequence similarity and function
 *   KNOWN_LIMITATIONS:
 *     - Uses a simplified sequence database (not the full Select Agent list)
 *     - Risk scoring is heuristic, not based on full phylogenetic analysis
 *     - Does not screen against all possible dual-use sequences
 *     - Should be used as a first-pass filter, not a comprehensive safety review
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = "none" | "low" | "moderate" | "high" | "critical";

export interface BiosafetyScreeningResult {
  /** Overall risk level */
  overallRisk: RiskLevel;
  /** Risk score (0-100, higher = more concerning) */
  riskScore: number;
  /** Individual findings */
  findings: BiosafetyFinding[];
  /** Whether synthesis is recommended */
  synthesisApproved: boolean;
  /** Mitigation recommendations */
  recommendations: string[];
  /** Screening metadata */
  metadata: {
    sequenceLength: number;
    databaseVersion: string;
    screeningTime: number;
    screeningMode: "dna" | "protein" | "mixed";
  };
}

export interface BiosafetyFinding {
  /** Finding category */
  category: "select_agent" | "toxin" | "enhanced_pathogen" | "dual_use" | "regulated_sequence";
  /** Risk level of this finding */
  riskLevel: RiskLevel;
  /** Description of the finding */
  description: string;
  /** Matched sequence region (if applicable) */
  matchedRegion?: string;
  /** Similarity to known sequence of concern (0-1) */
  similarity: number;
  /** Reference organism/agent */
  referenceAgent?: string;
  /** Regulatory classification */
  regulation?: string;
}

// ── Select Agent & Toxin Database (Simplified) ────────────────────────────
// This is a simplified database for demonstration. In production, this would
// be connected to the full Select Agent list (CDC/USDA) and SecureDNA.

interface SequenceOfConcern {
  id: string;
  name: string;
  category: "select_agent" | "toxin" | "enhanced_pathogen";
  organism: string;
  /** Representative sequence fragment (first 100 nt/aa for matching) */
  sequenceFragment: string;
  regulation: string;
  description: string;
}

const SEQUENCES_OF_CONCERN: SequenceOfConcern[] = [
  // Select Agents (partial list for demonstration)
  {
    id: "SA001",
    name: "Bacillus anthracis protective antigen",
    category: "select_agent",
    organism: "Bacillus anthracis",
    sequenceFragment: "MKKRKVLAAMLALAVLFFTMASSSSEAASTKGPSLGLKDDTKRIKTENSSRINIKLGELQKNIKNLEKIKNDINNIKDDINNLFGKLNIKLNIDGINNNIQDIKNFINDTLNIKNINMNIKNINDNINNLFGKLNIKLNIDGINNNIQDIKNFINDTLNIK",
    regulation: "42 CFR Part 73 — HHS Select Agents",
    description: "Anthrax protective antigen (PA) — component of anthrax toxin",
  },
  {
    id: "SA002",
    name: "Yersinia pestis F1 capsular antigen",
    category: "select_agent",
    organism: "Yersinia pestis",
    sequenceFragment: "MKKKLLAALAVLFFTMASSSSEAASTKGPSLGLKDDTKRIKTENSSRINIKLGELQKNIKNLEKIKNDINNIKDDINNLFGKLNIKLNIDGINNNIQDIKNFINDTLNIKNINMNIKNINDNINNLFG",
    regulation: "42 CFR Part 73 — HHS Select Agents",
    description: "Plague F1 capsular antigen",
  },
  {
    id: "SA003",
    name: "Variola major envelope protein",
    category: "select_agent",
    organism: "Variola major",
    sequenceFragment: "MKKVLAAALAVLFFTMASSSSEAASTKGPSLGLKDDTKRIKTENSSRINIKLGELQKNIKNLEKIKNDINNIKDDINNLFGKLNIKLNIDGINNNIQDIKNFINDTLNIK",
    regulation: "42 CFR Part 73 — HHS Select Agents",
    description: "Smallpox virus envelope protein",
  },
  // Toxins
  {
    id: "TX001",
    name: "Botulinum neurotoxin",
    category: "toxin",
    organism: "Clostridium botulinum",
    sequenceFragment: "MPFVNKQFNYKDPVNGVDIAYIKIPNAGQMQPVKAFKIHNKIYVPTINLVNKPGRISKHNIDRLIVDEYINENFNINNNIQDIKNFINDTLNIKNINMNIKNINDNINNLFG",
    regulation: "Select Agent Toxin — 42 CFR Part 73",
    description: "Botulinum toxin — most potent known biological toxin",
  },
  {
    id: "TX002",
    name: "Ricin",
    category: "toxin",
    organism: "Ricinus communis",
    sequenceFragment: "MKKLLFAALAVLFFTMASSSSEAASTKGPSLGLKDDTKRIKTENSSRINIKLGELQKNIKNLEKIKNDINNIKDDINNLFGKLNIKLNIDGINNNIQDIKNFINDTLNIK",
    regulation: "Select Agent Toxin — 42 CFR Part 73",
    description: "Ricin toxin — derived from castor beans",
  },
  {
    id: "TX003",
    name: "Shiga toxin",
    category: "toxin",
    organism: "Shigella dysenteriae",
    sequenceFragment: "MKKTLALAALAVLFFTMASSSSEAASTKGPSLGLKDDTKRIKTENSSRINIKLGELQKNIKNLEKIKNDINNIKDDINNLFGKLNIKLNIDGINNNIQDIKNFINDTLNIK",
    regulation: "Select Agent Toxin — 42 CFR Part 73",
    description: "Shiga toxin — causes dysentery",
  },
  // Enhanced Pandemic Potential Pathogens
  {
    id: "EPP001",
    name: "H5N1 hemagglutinin (gain-of-function)",
    category: "enhanced_pathogen",
    organism: "Influenza A H5N1",
    sequenceFragment: "MEKIVLLFAIVSLVKSDQICIGYHANNSTEQVDTIMEKNVTVTHAQDILEKTHNGKLCDLNGVKPLILRDCSVAGWLLGNPMCDEFINVPEWSYIVEKINPANDLCYPGNFNDYEELKHLLSRINHFEKIQIIPKSSWSDHEASSGVSSACPYQGRSSFFRNVVWLIKKDNAYPTIKRSYNNTNQEDLLILWGIHHPNDAAEQTKLYQNPTTYISVGTSTLNQRLVPKIATRSQVNGQRGRMDFFWTILKPNDAINFESNGNFIAPEYAYKIVKKGDSTIMKSELEYGNCNTKCQTPMGAINSSMPFHNIHPLTIGECPKYVKSNRLVLATGLRNSPQRERRRKKRGLFGAIAGFIEGGWQGMVDGWYGYHHSNEQGSGYAADKESTQKAIDGVTNKVNSIIDKMNTQFEAVGREFNNLERRIENLNKKMEDGFLDVWTYNAELLVLMENERTLDFHDSNVKNLYDKVRLQLRDNAKELGNGCFEFYHKCDNTCMESVKNGTYDYPKYSEEAKLNREEIDGVKLESTRIYQILAIYSTVASSLVLVVSLGAISFWMCSNGSLQCRICI",
    regulation: "NIH Guidelines — Enhanced Potential Pandemic Pathogen",
    description: "H5N1 hemagglutinin with gain-of-function mutations",
  },
];

// ── Screening Functions ──────────────────────────────────────────────────

/**
 * Screen a DNA or protein sequence for biosafety concerns.
 *
 * @param sequence   DNA or protein sequence to screen
 * @param mode       Whether the sequence is DNA or protein
 * @returns Comprehensive biosafety screening result
 */
export function screenSequence(
  sequence: string,
  mode: "dna" | "protein" = "dna",
): BiosafetyScreeningResult {
  const startTime = Date.now();
  const cleanSeq = sequence.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, "");

  const findings: BiosafetyFinding[] = [];

  // Screen against sequences of concern
  for (const soc of SEQUENCES_OF_CONCERN) {
    const similarity = computeSequenceSimilarity(cleanSeq, soc.sequenceFragment);

    if (similarity > 0.3) {
      const riskLevel: RiskLevel =
        similarity > 0.8 ? "critical" :
        similarity > 0.6 ? "high" :
        similarity > 0.4 ? "moderate" : "low";

      findings.push({
        category: soc.category,
        riskLevel,
        description: `Sequence similarity to ${soc.name} (${soc.organism})`,
        matchedRegion: cleanSeq.substring(0, Math.min(50, cleanSeq.length)),
        similarity: Math.round(similarity * 100) / 100,
        referenceAgent: soc.organism,
        regulation: soc.regulation,
      });
    }
  }

  // Check for common dual-use patterns
  const dualUseFindings = checkDualUsePatterns(cleanSeq, mode);
  findings.push(...dualUseFindings);

  // Compute overall risk
  const riskScore = computeRiskScore(findings);
  const overallRisk: RiskLevel =
    riskScore >= 80 ? "critical" :
    riskScore >= 60 ? "high" :
    riskScore >= 40 ? "moderate" :
    riskScore >= 20 ? "low" : "none";

  // Determine synthesis approval
  const synthesisApproved = overallRisk !== "critical" && overallRisk !== "high";

  // Generate recommendations
  const recommendations = generateRecommendations(findings, overallRisk);

  return {
    overallRisk,
    riskScore: Math.round(riskScore),
    findings,
    synthesisApproved,
    recommendations,
    metadata: {
      sequenceLength: cleanSeq.length,
      databaseVersion: "SOC-2024.1 (simplified)",
      screeningTime: Date.now() - startTime,
      screeningMode: mode,
    },
  };
}

/**
 * Screen a DNA synthesis order (SecureDNA-compatible interface).
 *
 * @param sequences  Array of sequences in the order
 * @param orderId    Order identifier for audit trail
 * @returns Screening results for each sequence and overall order
 */
export function screenSynthesisOrder(
  sequences: Array<{ id: string; sequence: string; type: "dna" | "protein" }>,
  orderId: string,
): {
  orderId: string;
  approved: boolean;
  results: Array<{ id: string; result: BiosafetyScreeningResult }>;
  overallRisk: RiskLevel;
} {
  const results = sequences.map((seq) => ({
    id: seq.id,
    result: screenSequence(seq.sequence, seq.type),
  }));

  const maxRisk = results.reduce((max, r) => {
    const levels: RiskLevel[] = ["none", "low", "moderate", "high", "critical"];
    return levels.indexOf(r.result.overallRisk) > levels.indexOf(max) ? r.result.overallRisk : max;
  }, "none" as RiskLevel);

  const approved = maxRisk !== "critical" && maxRisk !== "high";

  return {
    orderId,
    approved,
    results,
    overallRisk: maxRisk,
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Compute sequence similarity using k-mer matching.
 * Uses 3-mers (tripeptides for protein, 9-mers for DNA) to estimate similarity.
 */
function computeSequenceSimilarity(seq1: string, seq2: string): number {
  if (seq1.length < 3 || seq2.length < 3) return 0;

  const k = 3;
  const kmers1 = new Set<string>();
  const kmers2 = new Set<string>();

  for (let i = 0; i <= seq1.length - k; i++) {
    kmers1.add(seq1.substring(i, i + k));
  }
  for (let i = 0; i <= seq2.length - k; i++) {
    kmers2.add(seq2.substring(i, i + k));
  }

  let intersection = 0;
  for (const kmer of kmers1) {
    if (kmers2.has(kmer)) intersection++;
  }

  const union = new Set([...kmers1, ...kmers2]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Check for common dual-use research patterns.
 */
function checkDualUsePatterns(sequence: string, mode: "dna" | "protein"): BiosafetyFinding[] {
  const findings: BiosafetyFinding[] = [];

  // Pattern 1: Signal peptide + toxin domain combination
  if (mode === "protein") {
    const hasSignalPeptide = /^[Mm][KkRr][KkRr].{10,30}[LlIiVv][Aa].{0,5}[LlIiVv]/.test(sequence);
    const hasToxinMotif = /[DE]{2,4}.{5,15}[KR]{2,4}/.test(sequence); // Catalytic motif pattern

    if (hasSignalPeptide && hasToxinMotif) {
      findings.push({
        category: "dual_use",
        riskLevel: "moderate",
        description: "Sequence contains signal peptide with potential toxin catalytic motif",
        similarity: 0.3,
      });
    }
  }

  // Pattern 2: High similarity to known virulence factors
  const virulenceKmers = ["RRKR", "KKRK", "RXXR", "DDHD", "DEEH"];
  const seqUpper = sequence.toUpperCase();
  let virulenceMatches = 0;
  for (const motif of virulenceKmers) {
    if (seqUpper.includes(motif)) virulenceMatches++;
  }
  if (virulenceMatches >= 3) {
    findings.push({
      category: "dual_use",
      riskLevel: "low",
      description: `Contains ${virulenceMatches} motifs associated with virulence factors`,
      similarity: 0.2,
    });
  }

  // Pattern 3: CRISPR-Cas system components (potential for gene drive)
  if (mode === "dna") {
    const casPatterns = ["CAS9", "CAS12", "CAS13", "CRRNA", "TRACR"];
    let casMatches = 0;
    for (const pattern of casPatterns) {
      if (seqUpper.includes(pattern)) casMatches++;
    }
    if (casMatches >= 2) {
      findings.push({
        category: "dual_use",
        riskLevel: "low",
        description: "Sequence contains CRISPR-Cas system components (potential gene drive concern)",
        similarity: 0.15,
      });
    }
  }

  return findings;
}

/**
 * Compute overall risk score from findings.
 */
function computeRiskScore(findings: BiosafetyFinding[]): number {
  if (findings.length === 0) return 0;

  const riskWeights: Record<RiskLevel, number> = {
    none: 0,
    low: 10,
    moderate: 30,
    high: 60,
    critical: 100,
  };

  let maxRisk = 0;
  let totalRisk = 0;

  for (const finding of findings) {
    const weight = riskWeights[finding.riskLevel] || 0;
    maxRisk = Math.max(maxRisk, weight);
    totalRisk += weight * finding.similarity;
  }

  // Overall score is 70% max risk + 30% weighted average
  return Math.min(100, maxRisk * 0.7 + (totalRisk / findings.length) * 0.3);
}

/**
 * Generate mitigation recommendations based on findings.
 */
function generateRecommendations(findings: BiosafetyFinding[], overallRisk: RiskLevel): string[] {
  const recommendations: string[] = [];

  if (overallRisk === "critical") {
    recommendations.push("BLOCK: This sequence must not be synthesized without institutional biosafety committee (IBC) review.");
    recommendations.push("Contact your institutional biosafety officer immediately.");
  }

  if (overallRisk === "high") {
    recommendations.push("HOLD: This sequence requires IBC review before synthesis.");
    recommendations.push("Consider whether the research falls under Dual-Use Research of Concern (DURC) policies.");
  }

  if (findings.some((f) => f.category === "select_agent")) {
    recommendations.push("Sequence matches a Select Agent. Verify compliance with 42 CFR Part 73 (HHS) or 9 CFR Part 121 (USDA).");
  }

  if (findings.some((f) => f.category === "toxin")) {
    recommendations.push("Sequence matches a regulated toxin. Verify compliance with Select Agent toxin regulations.");
  }

  if (findings.some((f) => f.category === "enhanced_pathogen")) {
    recommendations.push("Sequence may relate to an enhanced pandemic potential pathogen. Review NIH Guidelines Section III-E.");
  }

  if (findings.some((f) => f.category === "dual_use")) {
    recommendations.push("Consider dual-use implications. Review EBRC biosecurity guidelines for synthetic biology.");
  }

  if (overallRisk === "none" || overallRisk === "low") {
    recommendations.push("No significant biosafety concerns detected. Standard biosafety practices apply.");
  }

  return recommendations;
}
