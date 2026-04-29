# Trust Runtime Thesis

## Core Thesis

Nexus-Bio is an assumption-gated scientific inference runtime for synthetic biology workflows.

The project direction is not to make every biological model look equally strong. The direction is to make each tool's assumptions, evidence, provenance, and downstream claim surfaces visible enough that weak or demo outputs cannot silently become strong scientific claims.

## What Nexus-Bio Is

- A synthetic biology workbench organized around staged design, simulation, chassis/control, and DBTL-style analysis.
- A trust runtime that represents tool validity as `real`, `partial`, or `demo`.
- A protocol testbed for making assumptions, evidence, provenance, violations, workflow contracts, gate decisions, and claim surfaces explicit.
- A user-facing environment for inspecting where an output came from, what it depends on, and which downstream uses remain allowed.

## What Nexus-Bio Is Not

- Not a wet-lab validation system.
- Not a replacement for expert review, experimental design review, biosafety review, or regulatory review.
- Not a guarantee that every output is biologically actionable.
- Not a closed-loop DBTL automation system.
- Not a claim that all simulations are high-fidelity implementations of their scientific names.
- Not a claim of full SBOL, PROV-DM, COMBINE, or BioModels compliance.

## Why The Workbench Exists

The workbench exists because synthetic biology workflows are multi-step by nature. A pathway idea may pass through literature extraction, flux analysis, thermodynamics, protein/catalyst design, control logic, cell-free screening, multi-omics, and reporting. Each step can change the trust state of the result.

Without a runtime vocabulary, users can see charts and exports but not the boundary between evidence-backed computation, heuristic inference, and demo-only visualization. Nexus-Bio keeps those boundaries visible by treating trust metadata as part of the workflow, not as a footnote.

## Why Each Major Tool Category Exists

### Pathway Engineering

Pathway tools provide the entry point for target molecules, literature-derived pathway context, molecular/protein inspection, and node-level evidence review. They test whether source assumptions can remain attached to a pathway graph instead of being lost when the graph becomes visual.

### Simulation

Simulation tools test how trust gates behave when mathematical outputs can be meaningful in one mode and illustrative in another. FBA, thermodynamics, dynamic control, and cell-free simulation are useful only when their assumptions are visible alongside the result.

### Genetic Systems

Gene circuit, genome minimization, protein evolution, and catalyst design tools test how design recommendations should be constrained by method maturity. They exist to separate decision support from claims of experimentally proven designs.

### Omics And Screening

Multi-omics and single-cell/spatial tools test data provenance, dataset limits, and interpretation boundaries. They are important because high-dimensional views can look authoritative even when preprocessing, missing fields, or demo transforms limit what can be concluded.

### Research Intelligence

NEXAI and literature-facing tools test evidence handling for LLM-assisted analysis. Their role is to expose citations, uncertainty, and reasoning context while keeping human scientific review in the loop.

### DBTL And Workflow Control

DBTL-style tools test whether a workbench can carry trust state across iterations. They exist to show how a design-build-test-learn narrative can stay honest when some inputs are partial or demo-tier.

## Forbidden Overclaim Phrases

These phrases must not be used as affirmative claims unless the repository later contains the corresponding implementation, validation, and evidence:

- research-grade
- SOTA
- state-of-the-art
- autonomous lab
- autonomous biofoundry
- wet-lab validated
- validated biological design
- AI-discovered sequence
- fully automated DBTL
- true community FBA
- real thermodynamics
- production-ready scientific platform
- fully SBOL-compliant export

Negated or limitation language should still be plain and specific. Prefer "not experimentally validated", "demo-tier", "heuristic", "partial implementation", "SBOL-aligned", or "future SBOL-compatible export" where those descriptions are accurate.

## Honest Limitations

- Some tools are demo-tier and exist to exercise workflow and trust-boundary behavior.
- Some tools are partial implementations with real mathematical pieces and simplified parameters or coupling.
- LLM-assisted pathway and literature outputs require human scientific review.
- No wet-lab validation is included in this repository.
- Benchmark results, ablations, and independent replication artifacts are not included yet.
- Protocol vocabulary in `src/protocol/nexusTrustRuntime.ts` is a foundation and is not wired into product behavior by this document.
- SBOL and PROV-DM mappings are alignment notes, not validator-backed compliance claims.

## Future Work Not Yet Implemented

- Typed DBTL feedback migration across all relevant payloads.
- Claim-surface gate enforcement for exports, recommendations, protocols, and external handoffs.
- Benchmark runners and public reproducibility reports.
- Provenance middleware that automatically attaches trust records to every route and tool run.
- CETHX backend integration with a verified thermodynamics engine.
- Community FBA refactor into an explicitly defined joint community optimization problem.
- MultiO refactor to a validated omics integration method with uncertainty reporting.
- CellFree calibration and validation against documented datasets.
- Validator-backed SBOL export and PROV bundle generation.
