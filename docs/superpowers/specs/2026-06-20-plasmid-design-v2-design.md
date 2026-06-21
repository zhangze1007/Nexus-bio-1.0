# Plasmid Design Engine v2 — Design Spec

**Date:** 2026-06-20
**Scope:** Data-driven plasmid optimization with expression prediction ranking

## Architecture

Component metadata DB + scoring retrieval → CDS 4-module optimization → Assembly compatibility (junction structure + repeat risk) → Expression predictor ranking → Main + 2 alternatives + failure summary

## Modules

### Module 1: Component Metadata DB + Scoring
- Each component: host adaptation, copy number, strength range, known side effects, assembly compatibility, evidence level
- Weighted scoring: strength × compatibility × evidence

### Module 2: CDS Joint Optimization (4 sub-modules)
- 2a: Codon usage (tAI/CAI)
- 2b: mRNA secondary structure (5' folding energy)
- 2c: GC content balance (30-70%)
- 2d: Restriction site cleanup (BsaI/EcoRI/BamHI)
- Each sub-module reports changes independently

### Module 3: Assembly Compatibility (Complete)
- 3a: Gibson/Golden Gate/restriction ligation
- 3b: Fragment junction secondary structure risk
- 3c: Repeat/homologous recombination risk

### Module 4: Expression Prediction Ranking
- Call geneExpressionPredictor for each candidate
- Rank by: predicted expression × assembly success rate × stability
- Output: main + 2 alternatives + failure summary + change log
