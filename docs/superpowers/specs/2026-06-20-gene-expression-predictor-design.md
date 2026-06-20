# Gene Expression Predictor — Design Spec

**Date:** 2026-06-20
**Scope:** AI-driven gene expression prediction from DNA sequence
**Standard:** PhD-level synthetic biology + ML, 100% real algorithms

---

## Executive Summary

Predict relative protein expression level (0-1 normalized) from a complete gene construct: promoter + RBS + CDS + terminator. Uses a "main model + explanation head" architecture where the main model predicts expression, and the explanation head decomposes contributions and identifies bottlenecks.

Absolute mg/L prediction requires experimental calibration data and is deferred to a separate calibration layer.

## Architecture

```
Input: DNA sequence (promoter + RBS + CDS + terminator + host organism)
         │
    ┌────┴────┐
    │ MODULE 1 │ Input Standardization
    └────┬────┘
         │
    ┌────┴────┐
    │ MODULE 2 │ Feature Extraction
    ├─────────┤
    │ 2a. Promoter features (PWM + UP element + spacer)
    │ 2b. RBS features (Salis 5-term thermodynamic model)
    │ 2c. CDS features (CAI + mRNA structure + rare codons)
    │ 2d. Terminator features (NN thermodynamic stability)
    │ 2e. ESM-2 embeddings (protein property representation)
    └────┬────┘
         │
    ┌────┴────┐
    │ MODULE 3 │ Host-Specific Encoding
    ├─────────┤
    │ tRNA copy numbers, sigma factors, RNase profile
    └────┬────┘
         │
    ┌────┴────┐
    │ MODULE 4 │ Main Predictor
    ├─────────┤
    │ Gradient-boosted ensemble (literature-parameter weighted)
    │ Inputs: all features from Module 2+3
    │ Output: relative expression (0-1)
    └────┬────┘
         │
    ┌────┴────┐
    │ MODULE 5 │ Explanation Head
    ├─────────┤
    │ 5a. Contribution decomposition (SHAP-like)
    │ 5b. Bottleneck determination (transcription/translation/folding/degradation)
    │ 5c. Optimization suggestions
    └─────────┘
```

## Module Specifications

### Module 1: Input Standardization

**Input:** Raw DNA sequence + host organism
**Output:** Structured construct with labeled regions

- Parse DNA sequence into components (promoter, RBS, CDS, terminator)
- Detect boundaries using consensus sequences (-35/-10 for promoter, SD for RBS, ATG for CDS start, stop codon for CDS end, poly-T for terminator)
- Validate: check for frameshifts, internal stop codons, forbidden restriction sites
- Output: `{ promoter: string, rbs: string, cds: string, terminator: string, host: HostOrganism }`

### Module 2: Feature Extraction

**2a. Promoter Features (from regulatoryDesignEngine)**
- PWM score (consensus -35/-10 matching)
- UP element detection (AT-rich upstream)
- Spacer length penalty
- GC content
- **Reference:** de Mey 2007, Brewster 2012

**2b. RBS Features (from regulatoryDesignEngine — Salis 2009)**
- ΔG_mRNA (NN folding energy)
- ΔG_spacing (SD-AUG distance)
- ΔG_standby (alternative binding sites)
- ΔG_start (AUG context)
- ΔG_antiSD (16S rRNA complementarity)
- **Reference:** Salis 2009

**2c. CDS Features**
- Codon Adaptation Index (CAI) — from codonOptimizer
- tRNA Adaptiveness Index (tAI) — from regulatoryDesignEngine
- Rare codon cluster count (consecutive codons with tAI < 0.1)
- mRNA folding energy at 5' end (first 50 nt)
- GC content of CDS
- Codon usage bias (CU bias)
- **Reference:** Sharp & Li 1987, dos Reis 2004

**2d. Terminator Features (from regulatoryDesignEngine)**
- NN thermodynamic stability (stem-loop + T-tract)
- Termination efficiency (sigmoid of ΔG)
- **Reference:** Lesnik 1995

**2e. ESM-2 Embeddings (from esm2Client)**
- Per-residue embeddings from ESM-2 API
- Pooled representation (mean pooling)
- Derived properties:
  - Predicted solubility (from embedding statistics)
  - Predicted folding burden (from embedding variance)
  - Structural risk score (from embedding entropy)
- **Reference:** Lin 2023
- **Role:** CDS semantic/protein property representation for folding burden, solubility, structural risk — NOT direct expression prediction

### Module 3: Host-Specific Encoding

**Input:** Host organism identifier
**Output:** Host feature vector

- tRNA gene copy numbers (per codon)
- Sigma factor repertoire (σ70, σ32, σ54, etc.)
- RNase profile (RNase E, III, II levels)
- Codon usage table (organism-specific)
- Growth rate (μmax at standard conditions)
- **Reference:** dos Reis 2004, Kanaya 1999

### Module 4: Main Predictor

**Approach:** Gradient-boosted ensemble with literature-parameter weights

**NOT a neural network** — uses interpretable, literature-backed parameters:
- Each feature has a published weight from literature
- Ensemble combines: promoter_score × RBS_score × CDS_score × terminator_score × host_factor
- With interaction terms for known synergies (e.g., RBS-CDS spacing × mRNA folding)

**Key insight:** The multiplicative model is the baseline. The "main model" adds learned corrections:
```
expression = baseline × (1 + correction)
baseline = f_promoter × g_RBS × h_CDS × i_terminator × j_host
correction = Σ(w_i × feature_i) + Σ(w_ij × feature_i × feature_j)
```

**Output:** Relative expression (0-1)

### Module 5: Explanation Head

**5a. Contribution Decomposition**
- Compute marginal contribution of each component
- Report: "Promoter contributes 35%, RBS 25%, CDS 20%, Terminator 10%, Host 10%"
- Use Shapley-like values (exact for ≤5 components)

**5b. Bottleneck Determination**
- Score each stage: transcription, translation initiation, translation elongation, folding, degradation
- Identify the limiting stage: "Translation elongation is the bottleneck (rare codon cluster at positions 45-52)"
- Confidence: based on feature certainty

**5c. Optimization Suggestions**
- Actionable recommendations:
  - "Replace codons 45-52 with preferred synonyms (tAI < 0.1 → 0.8)"
  - "Strengthen RBS: current ΔG = -5.2, target ΔG = -9.5"
  - "Add stabilizing 5' mRNA structure to prevent ribosome sliding"
- Each suggestion includes expected improvement (Δ expression)

## Calibration Layer (Deferred)

Absolute mg/L prediction requires:
1. Reference constructs with known expression in target host
2. Standard curve: relative prediction → absolute measurement
3. Per-host calibration constants

This is a separate module, not part of the core predictor.

## Integration Points

| Existing Engine | Used For |
|----------------|----------|
| `regulatoryDesignEngine.ts` | Promoter scoring, RBS Salis model, terminator NN |
| `codonOptimizer.ts` | CAI, tAI computation |
| `esm2Client.ts` | ESM-2 embeddings for CDS properties |
| `mlMetabolicEngine.ts` | ESM-2 API integration |

## Testing Strategy

1. **Unit tests** — each module independently
2. **Integration tests** — full pipeline with known constructs
3. **Literature benchmarks** — compare predictions to published expression data
4. **Edge cases** — very short/long CDS, no promoter, weak RBS, rare codon clusters

## Success Criteria

- Zero simplified markers
- All algorithms reference published papers
- Prediction correlates with known expression data (R² > 0.5 on literature benchmarks)
- Each component contribution is explainable
- Optimization suggestions are actionable
