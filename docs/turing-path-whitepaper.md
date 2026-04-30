# Turing Path Whitepaper

Status: protocol roadmap draft

This document defines the long-term computing/protocol bet for Nexus-Bio: the project should be a birthplace for reusable scientific inference governance, not only a synthetic biology website. It does not claim Turing-level achievement, external adoption, third-party validation, scientific validation, wet-lab validation, safety certification, or full SBOL compliance.

## Abstract

Scientific AI systems increasingly produce outputs that cross boundaries: exploratory payloads become exports, design suggestions become recommendations, and draft analyses become protocol-like handoffs. The core computing problem is not only model accuracy. It is governance of scientific inference as outputs move across claim surfaces.

The proposed abstraction is the Scientific Inference Trust Runtime (SITR), a portable protocol for representing assumptions, evidence, provenance, claim surfaces, gate decisions, and policy rules around scientific workflows.

## Problem

AI scientific outputs can propagate weak assumptions as strong claims. A system can label uncertainty in a panel while still letting the same output move into an export, recommendation, protocol-like object, or external handoff without a runtime gate.

This creates a governance gap:

- weak evidence can look stronger downstream;
- demo-tier outputs can leak into serious decisions;
- provenance can disappear during handoff;
- policy can live in prose instead of executable reviewable rules;
- reviewers can disagree without a structured issue path.

## Proposed Abstraction

SITR treats scientific inference as a governed runtime object. A conforming implementation records what assumptions were active, what evidence was attached, what provenance exists, what claim surface is requested, and what gate decision was produced.

The protocol goal is portability. A future implementation should be able to adopt SITR semantics without using Nexus-Bio UI, routes, stores, or scientific engines.

## Core Objects

SITR Draft v1 is defined in `spec/SITR-draft-v1.md`. Its core concepts include:

- assumptions: declared conditions and limitations a workflow depends on;
- evidence: records of sources, datasets, simulations, user input, or review;
- provenance: traceable activities and upstream dependencies;
- claim surfaces: `payload`, `export`, `recommendation`, `protocol`, and `external-handoff`;
- gate decisions: `ok`, `blocked`, `gated`, and `demoOnly`;
- Policy DSL: reviewable policy rules for claim-surface decisions.

## Reference Implementation

Nexus-Bio is the first reference implementation context for the trust runtime. It demonstrates how synthetic biology workflow surfaces can carry validity tiers, assumptions, provenance, benchmark cases, and gate decisions.

This does not mean Nexus-Bio is a completed standard, a validated scientific platform, or a production safety system.

## Second Implementation

The repository includes a Python reference implementation in `reference_impl_py/` and a consistency report at `reports/second-implementation-consistency.json`.

The second implementation is evidence that the trust-runtime semantics can be evaluated outside the TypeScript runtime. It is not evidence of external adoption or independent validation.

## Benchmark

The public baseline comparison in `reports/public-benchmark/` compares `no-gating`, `badge-only`, and `runtime-gating` modes over the local trust-runtime corpus.

The benchmark measures trust-runtime behavior such as unsafe propagation and benchmark agreement. It does not measure biological accuracy, wet-lab validity, product quality, or scientific correctness.

## Proof Package

The proof package in `proof-package/` collects specs, benchmark assets, reports, examples, provenance artifacts, replay instructions, and limitations in one reviewable bundle.

The package supports local replay and inspection. It does not prove external adoption, wet-lab validation, scientific validation, regulatory readiness, or full SBOL compliance.

## External Review Workflow

The external review workflow is documented in `docs/external-review-protocol.md` with empty templates under `reports/external-review/`.

The workflow is prepared but not completed. It is a path for future reviewers to inspect policy decisions, disagreement cases, bypass metrics, and limitations.

## Cross-Domain Potential

SITR is motivated by synthetic biology, but the governance pattern is broader. Candidate domains include:

- chemistry workflows where generated reaction plans depend on uneven evidence;
- materials workflows where simulation outputs become screening decisions;
- clinical evidence workflows where recommendations must preserve provenance and review status.

Cross-domain use requires domain-specific extensions and evidence rules. It is not claimed as completed.

## Limitations

- SITR does not prove scientific model correctness.
- SITR does not validate biological designs.
- SITR does not provide regulatory approval or safety certification.
- SITR does not replace domain peer review, wet-lab evidence, or clinical review.
- Current materials are draft and local-development oriented.

## Non-Claims

- No Turing-level achievement is claimed.
- No official standardization is claimed.
- No external adoption is claimed.
- No third-party validation is claimed.
- No scientific validation is claimed.
- No wet-lab validation is claimed.
- No safety certification is claimed.
- No full SBOL compliance is claimed.

## Research Agenda

Future work should test whether SITR can:

- support independent implementations with stable conformance reports;
- reduce unsafe propagation without blocking too many valid branches;
- support reviewer disagreement workflows;
- generalize to chemistry, materials, or clinical evidence workflows;
- maintain backward-compatible policy and benchmark evolution.
