# Portfolio Summary

## Project Name

Nexus-Bio 1.0

## One-Sentence Description

Nexus-Bio is an assumption-gated synthetic biology learning workbench that connects pathway, simulation, and DBTL-style tool outputs while exposing validity tiers, assumptions, and provenance at runtime.

## Motivation

Many AI-assisted scientific interfaces make outputs look equally trustworthy even when the underlying methods are very different. I wanted to build a system that visibly distinguishes stronger computational paths from demo or heuristic paths, so users can learn from results without over-claiming scientific certainty.

## Architecture

The platform uses Next.js/React with multiple tool pages, shared contracts, and runtime state stores. Trust logic is represented through:
- validity tiers per tool,
- assumption registries with severity,
- provenance snapshots (`runProvenance`),
- runtime gating decisions for downstream handoff,
- workflow contracts and a state machine that track execution status.

## What I Implemented

- Multi-tool synthetic biology workflow UI and tool integration surface.
- Runtime trust boundary logic (gating by validity/provenance/assumptions).
- Provenance write paths in key tool outputs.
- Contract-driven workflow control and state progression.
- Transparent documentation of method limitations for demo-tier tools.

## Scientific Honesty Mechanism

Nexus-Bio explicitly encodes uncertainty and method limitations in runtime objects, then uses those objects to control downstream propagation. Instead of hiding uncertainty, it labels and gates it.

## Current Limitations

- The platform is **not research-grade end to end**.
- There is **no wet-lab validation** in this repository.
- Some tools remain **demo-tier** with blocking assumptions.
- Some outputs rely on **heuristic or simplified models**.
- LLM-assisted evidence synthesis still requires human validation and domain review.

## Next Steps

- Add public benchmark artifacts and reproducible evaluation reports.
- Expand provenance coverage and contract tests across all tools.
- Improve calibration between tool captions, assumptions, and implementation details.
- Add stronger dataset-level validation pathways for SCSPATIAL and multi-omics workflows.
