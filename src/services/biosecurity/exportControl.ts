/**
 * Export Control Screening Module (R-32)
 *
 * Provides basic screening of target molecules against known controlled
 * substance lists for biosecurity compliance.
 *
 * This is a FIRST-LINE screening tool only. It does NOT replace expert
 * review or legal counsel. False positives should be expected.
 *
 * Lists screened:
 * - Australia Group Chemical Weapons Precursors
 * - US EAR Commerce Control List (biological agents)
 * - EU Dual-Use Regulation (Annex I, Category 1)
 *
 * @license MIT
 * @disclaimer This tool is for research screening only. Not legal advice.
 */

// ── Controlled Substance Patterns ──────────────────────────────────────

interface ControlledPattern {
  name: string;
  list: string;
  category: string;
  smilesPattern?: string;
  namePatterns: string[];
  casNumbers?: string[];
}

/**
 * Known controlled substances and their identifiers.
 * This is a SUBSET for demonstration — production systems should use
 * the full Australia Group, EAR, and EU lists.
 */
const CONTROLLED_PATTERNS: ControlledPattern[] = [
  // Chemical Weapons Convention Schedule 1
  {
    name: "Sarin (GB)",
    list: "CWC Schedule 1",
    category: "Nerve Agent",
    namePatterns: ["sarin", "gb", "methylphosphonofluoridic acid"],
    casNumbers: ["107-44-8"],
  },
  {
    name: "VX",
    list: "CWC Schedule 1",
    category: "Nerve Agent",
    namePatterns: ["vx", "ethyl ({2-[bis(propan-2-yl)amino]ethyl}sulfanyl)(methyl)phosphinate"],
    casNumbers: ["50782-69-9"],
  },
  {
    name: "Novichok",
    list: "CWC Schedule 1",
    category: "Nerve Agent",
    namePatterns: ["novichok", "a-230", "a-232", "a-234"],
  },
  // Biological agents (US EAR)
  {
    name: "Bacillus anthracis",
    list: "US EAR",
    category: "Biological Agent",
    namePatterns: ["bacillus anthracis", "anthrax"],
  },
  {
    name: "Yersinia pestis",
    list: "US EAR",
    category: "Biological Agent",
    namePatterns: ["yersinia pestis", "plague"],
  },
  {
    name: "Clostridium botulinum",
    list: "US EAR",
    category: "Biological Agent",
    namePatterns: ["clostridium botulinum", "botulinum toxin", "botox"],
  },
];

// ── Screening Result Types ─────────────────────────────────────────────

export interface ScreeningResult {
  screened: boolean;
  matches: ScreeningMatch[];
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  recommendation: string;
  disclaimer: string;
}

export interface ScreeningMatch {
  pattern: ControlledPattern;
  matchType: "name" | "cas" | "smiles";
  matchValue: string;
  confidence: number;
}

// ── Screening Functions ────────────────────────────────────────────────

/**
 * Screen a molecule name against controlled substance lists.
 */
export function screenMoleculeName(name: string): ScreeningResult {
  const normalizedName = name.toLowerCase().trim();
  const matches: ScreeningMatch[] = [];

  for (const pattern of CONTROLLED_PATTERNS) {
    for (const namePattern of pattern.namePatterns) {
      if (normalizedName.includes(namePattern) || namePattern.includes(normalizedName)) {
        matches.push({
          pattern,
          matchType: "name",
          matchValue: namePattern,
          confidence: normalizedName === namePattern ? 1.0 : 0.7,
        });
      }
    }
  }

  return buildResult(matches);
}

/**
 * Screen a CAS number against controlled substance lists.
 */
export function screenCASNumber(cas: string): ScreeningResult {
  const matches: ScreeningMatch[] = [];

  for (const pattern of CONTROLLED_PATTERNS) {
    if (pattern.casNumbers?.includes(cas)) {
      matches.push({
        pattern,
        matchType: "cas",
        matchValue: cas,
        confidence: 1.0,
      });
    }
  }

  return buildResult(matches);
}

/**
 * Screen a SMILES string against controlled substance patterns.
 * Note: SMILES-based screening is limited — structural analogs may not be caught.
 */
export function screenSMILES(smiles: string): ScreeningResult {
  // Basic SMILES screening — check for known functional group patterns
  const matches: ScreeningMatch[] = [];
  const normalized = smiles.toLowerCase();

  // Phosphonofluoridate pattern (nerve agents)
  if (normalized.includes("p(f)(=") || normalized.includes("p(=o)(f)")) {
    matches.push({
      pattern: {
        name: "Phosphonofluoridate",
        list: "CWC Schedule 1",
        category: "Nerve Agent Precursor",
        namePatterns: [],
      },
      matchType: "smiles",
      matchValue: "Phosphonofluoridate pattern",
      confidence: 0.6,
    });
  }

  return buildResult(matches);
}

// ── Helper ─────────────────────────────────────────────────────────────

function buildResult(matches: ScreeningMatch[]): ScreeningResult {
  if (matches.length === 0) {
    return {
      screened: true,
      matches: [],
      riskLevel: "none",
      recommendation: "No controlled substance matches found.",
      disclaimer: DISCLAIMER,
    };
  }

  const maxConfidence = Math.max(...matches.map((m) => m.confidence));
  const riskLevel =
    maxConfidence >= 0.9 ? "critical" : maxConfidence >= 0.7 ? "high" : maxConfidence >= 0.5 ? "medium" : "low";

  return {
    screened: true,
    matches,
    riskLevel,
    recommendation:
      riskLevel === "critical" || riskLevel === "high"
        ? "STOP: This molecule matches a controlled substance. Do not proceed without expert review and legal counsel."
        : "WARNING: Potential match found. Proceed with caution and consult institutional biosafety committee.",
    disclaimer: DISCLAIMER,
  };
}

const DISCLAIMER = `This screening tool is for research purposes only. It does NOT constitute legal advice.
Matches are based on limited pattern matching and may produce false positives or miss analogs.
Always consult your institutional biosafety committee and legal counsel before working with
potentially controlled substances. Compliance with local, national, and international regulations
is the responsibility of the researcher and their institution.`;
