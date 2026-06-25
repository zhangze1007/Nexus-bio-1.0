/**
 * Biological Risk Assessment Model
 *
 * Defines unified risk levels for all biological outputs in Nexus-Bio.
 * Every result must carry a risk assessment before entering the UI.
 *
 * Reference: WHO Laboratory Biosafety Manual (2020)
 * Reference: NIH Guidelines for Research Involving Recombinant DNA (2019)
 */

export type RiskLevel = "low" | "moderate" | "elevated" | "high" | "blocked";

export interface RiskAssessment {
  /** Risk level */
  level: RiskLevel;
  /** Numerical risk score (0-1) */
  score: number;
  /** Human-readable risk reason */
  reason: string;
  /** Rule that triggered this assessment */
  triggerRule: string;
  /** Recommended action */
  recommendedAction: string;
  /** Whether this result can proceed to next stage */
  canProceed: boolean;
  /** Whether human review is required */
  requiresHumanReview: boolean;
}

/**
 * Risk rules for biological sequences.
 */
export const SEQUENCE_RISK_RULES = {
  VIRULENCE_FACTOR: {
    id: "VF_MATCH",
    description: "Sequence similarity to known virulence factor",
    baseLevel: "high" as RiskLevel,
  },
  TOXIN_GENE: {
    id: "TOXIN_MATCH",
    description: "Sequence encodes known toxin",
    baseLevel: "blocked" as RiskLevel,
  },
  ANTIBIOTIC_RESISTANCE: {
    id: "ABR_MATCH",
    description: "Antibiotic resistance gene detected",
    baseLevel: "elevated" as RiskLevel,
  },
  SELECT_AGENT: {
    id: "SELECT_AGENT",
    description: "Sequence matches select agent pathogen",
    baseLevel: "blocked" as RiskLevel,
  },
  MODERATE_RISK: {
    id: "MODERATE_RISK",
    description: "Sequence has moderate biosafety concerns",
    baseLevel: "moderate" as RiskLevel,
  },
  LOW_RISK: {
    id: "LOW_RISK",
    description: "No significant biosafety concerns detected",
    baseLevel: "low" as RiskLevel,
  },
} as const;

/**
 * Assess risk level for a biological sequence.
 */
export function assessSequenceRisk(
  sequence: string,
  host: string,
  purpose: "research" | "production" | "therapy" | "environmental",
  matchScores?: { virulence: number; toxin: number; selectAgent: number },
): RiskAssessment {
  const scores = matchScores || { virulence: 0, toxin: 0, selectAgent: 0 };

  // Check select agent (highest priority)
  if (scores.selectAgent > 0.8) {
    return {
      level: "blocked",
      score: 1.0,
      reason: "Sequence matches select agent pathogen — blocked by safety policy",
      triggerRule: SEQUENCE_RISK_RULES.SELECT_AGENT.id,
      recommendedAction: "This sequence cannot be processed. Contact biosafety officer.",
      canProceed: false,
      requiresHumanReview: true,
    };
  }

  // Check toxin
  if (scores.toxin > 0.7) {
    return {
      level: "blocked",
      score: 0.95,
      reason: "Sequence similarity to known toxin gene",
      triggerRule: SEQUENCE_RISK_RULES.TOXIN_GENE.id,
      recommendedAction: "This sequence cannot be processed without institutional review.",
      canProceed: false,
      requiresHumanReview: true,
    };
  }

  // Check virulence
  if (scores.virulence > 0.6) {
    const level = purpose === "therapy" || purpose === "environmental" ? "high" : "elevated";
    return {
      level,
      score: scores.virulence,
      reason: "Sequence similarity to known virulence factor",
      triggerRule: SEQUENCE_RISK_RULES.VIRULENCE_FACTOR.id,
      recommendedAction: "Requires institutional biosafety committee review.",
      canProceed: level !== "high",
      requiresHumanReview: true,
    };
  }

  // Moderate risk
  if (scores.virulence > 0.3 || scores.toxin > 0.3) {
    return {
      level: "moderate",
      score: Math.max(scores.virulence, scores.toxin),
      reason: "Sequence has moderate biosafety concerns",
      triggerRule: SEQUENCE_RISK_RULES.MODERATE_RISK.id,
      recommendedAction: "Review biosafety considerations before proceeding.",
      canProceed: true,
      requiresHumanReview: false,
    };
  }

  // Low risk
  return {
    level: "low",
    score: Math.max(scores.virulence, scores.toxin, scores.selectAgent),
    reason: "No significant biosafety concerns detected",
    triggerRule: SEQUENCE_RISK_RULES.LOW_RISK.id,
    recommendedAction: "No additional safety measures required.",
    canProceed: true,
    requiresHumanReview: false,
  };
}

/**
 * Get display color for risk level.
 */
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "#4ade80"; // green
    case "moderate":
      return "#fbbf24"; // yellow
    case "elevated":
      return "#fb923c"; // orange
    case "high":
      return "#f87171"; // red
    case "blocked":
      return "#dc2626"; // dark red
  }
}

/**
 * Get display label for risk level.
 */
export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case "low":
      return "Low Risk";
    case "moderate":
      return "Moderate Risk";
    case "elevated":
      return "Elevated Risk";
    case "high":
      return "High Risk";
    case "blocked":
      return "Blocked";
  }
}
