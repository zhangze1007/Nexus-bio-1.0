# Adoption Roadmap

Status: roadmap draft

This roadmap describes evidence needed before adoption claims can be made. It does not claim external adoption, official standardization, third-party validation, scientific validation, wet-lab validation, or user adoption.

## Phase 0: Nexus-Only Reference

Required evidence:
- SITR draft, policy DSL, benchmark corpus, proof package, and local reports exist in this repository.

Success metric:
- Local proof checks and targeted tests pass.

Failure signal:
- Core semantics cannot be explained without Nexus-Bio UI or runtime code.

Rollback condition:
- Return to a Nexus-only internal spec until portable docs and tests are coherent.

## Phase 1: Second Implementation

Required evidence:
- A second implementation can evaluate the same benchmark cases and produce a consistency report.

Success metric:
- Agreement with expected labels and TypeScript runtime-gating rows is documented.

Failure signal:
- The second implementation needs hidden Nexus-Bio state or undocumented behavior.

Rollback condition:
- Mark conformance beyond Level 1 as deferred until semantics are portable.

## Phase 2: External Reviewer Replay

Required evidence:
- An external reviewer can run proof checks, replay benchmark reports, and file structured disagreements.

Success metric:
- Review steps are reproducible and disagreements are traceable.

Failure signal:
- Reviewers cannot reproduce reports or understand limitations.

Rollback condition:
- Keep external review workflow as prepared-not-completed until replay issues are fixed.

## Phase 3: One External Fork Or Implementation

Required evidence:
- A permitted external fork or implementation publishes a reproducible conformance report.

Success metric:
- The implementation can be listed with permission and verified artifacts.

Failure signal:
- The implementation is private, unverifiable, or lacks permission to list.

Rollback condition:
- Do not list the implementation; record the gap as a blocked adoption claim.

## Phase 4: Cross-Domain Extension

Required evidence:
- A non-synthetic-biology domain extension preserves SITR claim surfaces, gate statuses, validity tiers, and provenance semantics.

Success metric:
- Core conformance tests still pass and extension-specific tests are documented.

Failure signal:
- The extension changes core semantics or hides unsupported claims.

Rollback condition:
- Keep the extension out of the core protocol and document it as experimental.

## Phase 5: Governance Working Group

Required evidence:
- Multiple permitted implementers or reviewers participate in documented governance decisions.

Success metric:
- Rule changes have proposal records, compatibility checks, conformance updates, and release notes.

Failure signal:
- Governance becomes informal, unverifiable, or driven by adoption claims without evidence.

Rollback condition:
- Return to maintainer-led draft governance until real participants and process artifacts exist.
