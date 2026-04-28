# Assumption-Gated Provenance Runtime for AI-Assisted Synthetic Biology Workflows

## Abstract

AI-assisted biology interfaces can make heterogeneous methods appear equally reliable, increasing the risk of over-trust and weak-evidence propagation. This paper drafts a trust runtime architecture, implemented in Nexus-Bio, that combines tool validity tiers, explicit assumption registries, provenance snapshots, and downstream gating decisions. The contribution is not a claim of full research-grade simulation across all modules. Instead, it is a runtime design that keeps uncertainty visible and machine-actionable during multi-tool workflow execution.

## Introduction

Synthetic biology software stacks increasingly combine pathway design, flux simulation, control modeling, and omics analysis in one interface. While this integration improves workflow continuity, it can hide differences in method maturity. Users may unintentionally treat demonstration outputs as equivalent to stronger evidence. We frame this as a trust-boundary problem in computational workflow orchestration.

## Background and Related Work

This draft concerns software architecture patterns rather than a new biological model:
- workflow state machines for staged execution control,
- provenance tracking for run-time traceability,
- contract-based tool interfaces for dependency checking,
- assumption-aware confidence gating for downstream actions.

Formal related-work analysis and citation expansion are pending.

## Problem Statement

Given a multi-tool AI-assisted synthetic biology workbench:
1. How can each tool output expose machine-readable trust state?
2. How can downstream consumers avoid using weak outputs as strong evidence?
3. How can uncertainty remain visible to users across workflow transitions?

## System Design

The current system contains:
- **Validity registry** (`real` / `partial` / `demo`) for each tool.
- **Assumption registry** with severity (`info` / `warning` / `blocking`).
- **Provenance object** (`runProvenance`) attached to payload outputs.
- **Workflow contract registry** describing required artifacts and trust floors.
- **Workflow state machine** for staged progression and loop-back semantics.

This enables explicit trust metadata to travel with payloads, not just raw metrics.

## Runtime Gating Method

The runtime gate evaluates source payload trust before downstream handoff:
- source validity tier,
- target validity requirement,
- provenance presence,
- blocking and warning assumptions.

Implemented behavior includes:
- demo to demo: warn-only chain allowed,
- demo to partial/real: blocked,
- missing provenance: blocked where provenance is required,
- blocking assumptions: prevent escalation into stronger downstream inference contexts.

## Evaluation

Benchmark results are pending.

Current verification is based on:
- unit/integration tests for gating behavior,
- workflow-level checks for payload trust propagation,
- consistency audits against tool validity and assumption registries.

## Case Study

The artemisinin showcase pathway is used as a trust-gated walkthrough case:
- run pathway/design context,
- inspect FBA single vs community trust semantics,
- inspect CETHX and MultiO demo-tier constraints,
- observe provenance snapshots and runtime notices,
- verify that weak outputs do not silently feed stronger inference paths.

This case demonstrates software trust behavior, not wet-lab optimization proof.

## Limitations

- No wet-lab validation in this repository.
- Not all modules are research-grade; several remain demo or partial.
- Some models are deterministic or heuristic simplifications.
- LLM-mediated analysis still requires human scientific validation.
- Public benchmark and ablation reporting are incomplete.

## Future Work

- Add benchmark suite and reproducible trust-runtime metrics.
- Extend provenance coverage to all tool outputs.
- Tighten consistency between implementation, captions, and assumptions.
- Add richer uncertainty quantification where methods support it.
- Publish independent replication package and review protocol.

## Conclusion

Nexus-Bio demonstrates an assumption-gated provenance runtime for AI-assisted synthetic biology workflows. The main contribution is explicit uncertainty handling at runtime boundaries, helping users distinguish what is demonstrative from what is stronger evidence. This design direction supports transparent learning and safer interpretation in integrated scientific software systems.
