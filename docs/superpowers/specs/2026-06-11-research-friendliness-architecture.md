# Research-Friendliness Architecture Upgrade — Design Spec

**Date:** 2026-06-11
**Author:** Claude Code (with user approval)
**Status:** Approved

## Problem Statement

Nexus-Bio is currently a good **teaching and concept exploration tool**, but not yet a **research tool**. A synthetic biology researcher, PhD student, or industry consultant would not use it for actual research decisions because:

1. **Data layer**: Tools use simulated data, not real databases or user data
2. **Calculation layer**: Algorithms are black boxes without citations, assumptions, or uncertainty
3. **Output layer**: Results can't be exported in standard formats, can't be reproduced

## Core Principle

**Each tool must be functionally complete and independently usable. The AI agent (Axon) is an enhancement layer, not a patch layer.**

We do NOT rely on the AI agent to fill functional gaps. Every tool must work correctly on its own before we optimize the AI integration.

## Target User

Individual researcher working independently with Nexus-Bio + Axon AI to:
- Analyze metabolic pathways
- Simulate flux balance
- Design enzymes
- Run thermodynamic analysis
- Integrate multi-omics data
- Export results for publication or further analysis

## Architecture: 4 Phases

### Phase 1: Data Layer (Priority)

**Goal:** Every tool can use real data, not just simulated data.

**1.1 User Data Upload**
- Each tool gets an "Upload Data" button
- Support CSV/TSV format
- Data validation with error messages
- Preview before loading
- Store in workbench project

Per-tool upload requirements:
| Tool | Upload Format | Content |
|------|--------------|---------|
| FBASim | CSV | Reaction IDs, flux values, bounds |
| MultiO | CSV/TSV | Gene expression matrix (genes × samples) |
| ScSpatial | CSV | Spatial coordinates + gene expression |
| CellFree | CSV | Construct sequences + parameters |
| ProEvol | CSV | Variant library (already supported) |
| CETHX | CSV | Reaction ΔG values |
| CATDES | CSV/FASTA | Protein sequences |
| GenMIM | CSV | Gene list + efficiency scores |
| DynCon | CSV | Time-series data |
| DBTLflow | CSV | Iteration records (already supported) |

**1.2 Real Database Connections**
- KEGG: Metabolic pathways and compounds (existing /api/kegg route, enhance it)
- BiGG: Genome-scale metabolic models
- BRENDA: Enzyme kinetic parameters
- PubChem: Compound structures (existing /api/pubchem route)
- AlphaFold: Protein structures (existing /api/alphafold route)

Each tool should show data source:
```
┌─────────────────────────────────┐
│ Data Source: KEGG (hsa00010)    │
│ Last updated: 2024-01-15        │
│ [Refresh] [View in KEGG]        │
└─────────────────────────────────┘
```

**1.3 Data Provenance**
- Tag every data point with its source
- Distinguish: User upload / Database / Simulation
- Show provenance badge on results

### Phase 2: Calculation Layer

**Goal:** Algorithms are transparent, results are verifiable.

**2.1 Algorithm Transparency**
- Each tool shows: algorithm name, version, key assumptions
- "Method Details" expandable panel with:
  - Mathematical formulation
  - Key assumptions and limitations
  - Literature citation (DOI link)
  - Implementation notes

Example for FBASim:
```
Algorithm: Flux Balance Analysis (FBA)
Method: Linear programming (simplex solver)
Objective: Maximize biomass growth
Assumptions:
  - Steady-state metabolism
  - Mass balance constraints
  - Capacity bounds from BiGG model
Citation: Orth et al., Nat Biotechnol 28(3):245-8, 2010
DOI: 10.1038/nbt.1614
```

**2.2 Uncertainty Analysis**
- Results show confidence intervals where applicable
- Sensitivity analysis: how result changes when key parameters vary ±10%
- Monte Carlo simulation option (configurable N iterations)
- Display: value ± uncertainty

**2.3 Result Validation**
- Compare results against known datasets
- Show validation status: ✓ Validated / ⚠ Partial / ✗ Not validated
- "Validate this result" button to run against reference data

### Phase 3: Output Layer

**Goal:** Results can be exported, cited, and reproduced.

**3.1 Standard Format Export**
| Format | Use Case | Tools |
|--------|----------|-------|
| SBML | Metabolic models | FBASim, CETHX, PathD |
| SBOL | Genetic designs | DBTLflow, GECAIR, CatDes |
| CSV | Raw data | All tools |
| JSON | Structured data | All tools |
| PNG/SVG | Figures | All tools |
| PDF | Reports | All tools |

**3.2 Experiment Report**
- Auto-generated report containing:
  - Tool name and version
  - Input parameters
  - Results with uncertainty
  - Method description with citation
  - Data sources
  - Timestamp
- Export as PDF or HTML
- Shareable link (local only, no server needed)

**3.3 Parameter Snapshots**
- Save current parameter configuration
- Load saved configurations
- Share configuration as JSON file
- Compare two configurations side-by-side

### Phase 4: AI Agent Optimization (After Phase 1-3)

**Goal:** Axon AI enhances the complete tools, doesn't fill gaps.

**4.1 Data-Aware Analysis**
- Axon can access uploaded data and database results
- Axon explains data quality and limitations
- Axon suggests data cleaning steps

**4.2 Algorithm Explanation**
- Axon explains why a specific algorithm was used
- Axon interprets uncertainty and confidence intervals
- Axon suggests alternative approaches

**4.3 Report Generation**
- Axon helps write methods sections for papers
- Axon generates figure captions
- Axon formats citations

**4.4 Next-Step Suggestions**
- Axon analyzes results and suggests follow-up experiments
- Axon identifies unexpected patterns
- Axon recommends parameter ranges to explore

## Implementation Order

1. Phase 1.1: User data upload (all tools)
2. Phase 1.2: KEGG/BiGG integration (FBASim, PathD first)
3. Phase 2.1: Algorithm transparency panels
4. Phase 3.1: CSV/JSON export (all tools)
5. Phase 2.2: Uncertainty analysis
6. Phase 3.2: Experiment reports
7. Phase 3.3: Parameter snapshots
8. Phase 1.3: Data provenance badges
9. Phase 2.3: Result validation
10. Phase 4: AI agent optimization

## Success Criteria

- [ ] All 14 tools support CSV data upload
- [ ] FBASim connects to BiGG models
- [ ] PathD connects to KEGG pathways
- [ ] All tools show algorithm name, citation, assumptions
- [ ] All tools support CSV/JSON export
- [ ] All tools show data source provenance
- [ ] Experiment reports can be generated
- [ ] Parameter snapshots can be saved/loaded
- [ ] Results show confidence intervals where applicable
- [ ] Axon AI can access and explain all tool results
