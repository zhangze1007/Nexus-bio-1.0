/**
 * Minimal data-provenance / evidence-grade vocabulary.
 *
 * Purpose (exploratory slice, 2026-07): attach an honest evidence grade to the
 * *numbers* in the platform — starting with a hand-annotated slice of the
 * e_coli_core FBA model (see benchmarks/reference/fba/e_coli_core.provenance.json
 * and docs/PROVENANCE_SLICE_FINDINGS.md). This file only defines the vocabulary;
 * it deliberately does NOT build a database or an ingestion pipeline.
 *
 * The single most important thing learned while annotating (see the findings doc):
 * provenance is NOT one label per reaction. A reaction carries several facets —
 * its existence, its stoichiometry, its GPR (gene→enzyme link), its bounds, and
 * any specific numeric parameter — each with a *different* grade and a *different*
 * source. `primaryFacet` records which facet the grade is about.
 */

/** Evidence grade for a single datum, strongest → weakest. */
export type ProvenanceLevel =
  /** Directly measured in THIS organism (this strain/species). */
  | "experimental-direct"
  /** Measured in a close homolog/related species and transferred. */
  | "experimental-homolog"
  /** Computationally inferred (GPR from genome annotation, gap-filling, fitting). */
  | "computational-inferred"
  /** A database default or field convention (e.g. generic ATPM, ±1000 reversibility bounds). */
  | "database-default"
  /** Cannot be traced to a real source. */
  | "unknown";

/** Which aspect of a reaction the grade refers to (provenance is per-facet). */
export type ProvenanceFacet =
  | "reaction-existence"
  | "stoichiometry"
  | "gpr" // gene→enzyme→reaction association
  | "bounds" // reversibility / uptake limits
  | "numeric-parameter"; // a specific coefficient/value (ATPM 8.39, biomass GAM, uptake rate)

/** A single literature/source pointer. `null` where it genuinely could not be found. */
export interface SourcePointer {
  /** Immediate database or reconstruction the value was taken from. */
  database: string; // e.g. "BiGG e_coli_core", "iAF1260", "EcoCyc"
  /** Primary literature, if actually locatable. Never fabricate — use null. */
  primaryLiterature: string | null; // e.g. "Feist et al. 2007, Mol Syst Biol 3:121"
  /** How far the trace actually got: to the immediate DB, or to the ultimate measurement. */
  traceDepth: "immediate-database" | "reconstruction-paper" | "ultimate-primary" | "not-traced";
}

export interface ReactionProvenance {
  reactionId: string;
  reactionName: string;
  /** The grade, and which facet it is about (a reaction has several facets). */
  level: ProvenanceLevel;
  primaryFacet: ProvenanceFacet;
  source: SourcePointer;
  /** The annotator's stated reasoning for the grade — required, so grades are auditable. */
  basisForJudgment: string;
  /** Honest note on the facets NOT covered by `level`, and any ambiguity. */
  facetNotes: string;
  /** Annotator confidence in THIS grade (not the datum's correctness). */
  confidence: "high" | "medium" | "low";
  /** Rough wall-clock this row took, for the scalability estimate (process record). */
  minutesSpent: number;
}

export interface ProvenanceSlice {
  model: string;
  modelSource: SourcePointer;
  annotatedBy: string;
  annotatedOn: string; // ISO date
  note: string;
  reactions: ReactionProvenance[];
}

/** Human-readable one-liners for the grades (for UI/badges later; not used to compute anything). */
export const PROVENANCE_LEVEL_LABEL: Record<ProvenanceLevel, string> = {
  "experimental-direct": "Measured in this organism",
  "experimental-homolog": "Measured in a related species",
  "computational-inferred": "Computationally inferred",
  "database-default": "Database default / convention",
  unknown: "Untraceable",
};
