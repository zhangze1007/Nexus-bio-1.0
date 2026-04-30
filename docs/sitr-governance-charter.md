# SITR Governance Charter

Status: draft governance roadmap

This charter describes how Scientific Inference Trust Runtime (SITR) changes should be proposed, reviewed, versioned, and released. It does not claim external adoption, official standardization, third-party validation, scientific validation, wet-lab validation, or safety certification.

## Purpose

The purpose of SITR governance is to keep trust-runtime semantics reviewable, portable, and honest as the protocol evolves. Governance should protect the core meanings of assumptions, evidence, provenance, claim surfaces, gate decisions, policy rules, and conformance levels.

## Roles

- Maintainers: steward protocol text, compatibility boundaries, release notes, and conformance expectations.
- Implementers: build SITR-compatible evaluators, object models, adapters, or reports.
- Reviewers: inspect policy behavior, disagreement cases, proof replay, and non-claim boundaries.
- Domain extension authors: propose domain-specific objects or mappings without breaking core semantics.
- Conformance reporters: submit reproducible conformance reports and benchmark outputs.

## Change Process

1. Proposal: open an issue or pull request describing the problem, affected objects, compatibility impact, and evidence.
2. Discussion: collect maintainer, implementer, reviewer, and domain-extension feedback.
3. Compatibility check: verify legal value sets, policy semantics, benchmark expectations, and proof-package boundaries.
4. Conformance update: update conformance docs, templates, and tests when the change affects implementation behavior.
5. Release: publish the draft, experimental, or stable version with changelog notes and migration guidance.

## Version States

- `draft`: reviewable but not stable; breaking changes are allowed with clear notes.
- `experimental`: implementation experience exists; changes require compatibility review.
- `stable`: semantics are expected to remain backward compatible except for documented deprecations.

## Required Evidence For Rule Changes

Rule changes must include:

- affected policy rule or object;
- motivating case ID or documented scenario;
- expected and observed gate status;
- claim surface involved;
- evidence and provenance status;
- benchmark or conformance impact;
- non-claim check confirming no unsupported validation or adoption claim is introduced.

## Conflict Handling

Policy disagreements should use `.github/ISSUE_TEMPLATE/policy-disagreement.yml`. Conformance failures should use `.github/ISSUE_TEMPLATE/conformance-failure.yml`. Domain extensions should use `.github/ISSUE_TEMPLATE/domain-extension.yml`.

If reviewers disagree, maintainers should preserve the disputed case, document the competing interpretations, and avoid changing benchmark expected labels until the rule boundary is explicit.

## Non-Goals

- Do not turn SITR into a biological accuracy benchmark.
- Do not claim official standards-body status without real process evidence.
- Do not add rule changes that silently upgrade demo or partial outputs.
- Do not use governance docs to imply external adoption, wet-lab validation, or scientific validation.

## No Fake Adoption Policy

Adoption claims require named implementation evidence, repository links or package artifacts, reproducible conformance output, and permission to list the implementation.

Prepared templates, internal reference implementations, local benchmark reports, or reviewer workflows are not adoption. They must not be described as external adoption.
