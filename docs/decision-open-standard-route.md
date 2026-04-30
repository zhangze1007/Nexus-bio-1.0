# Decision: Open Standard Route

## Decision

P3 Step 22 selects the **Moonshot route: IETF/RFC-style open standard draft**.

The output is `spec/SITR-draft-v1.md`, named Scientific Inference Trust Runtime (SITR) Draft v1. It is a serious open protocol proposal, not a claim that Nexus-Bio is already a standard.

## Routes Considered

### Moonshot: IETF/RFC-style open standard

This route frames the trust runtime as a portable protocol with terminology, required objects, gate semantics, policy language, conformance levels, security considerations, limitations, and change control.

Selected because the repository already has enough support material to make a reviewable draft: protocol specs, Policy DSL v1, PROV-DM mapping, SBOL-aligned mapping, proof package, benchmark replay, second implementation comparison, and external review workflow documents.

### Generalist: GitHub open draft

This route would publish a lighter GitHub-first draft for scientific AI workflow tools. It remains viable if the RFC-style draft becomes too heavy or if reviewers prefer a simpler contribution path.

Deferred because the RFC-style document can still live in GitHub while giving implementers a clearer conformance target.

### Niche: Nexus-only conformance spec

This route would keep the trust runtime as an internal Nexus-Bio spec.

Rejected for Step 22 because the task is explicitly to make the protocol understandable and implementable without Nexus-Bio. This remains the rollback route if cross-implementation review proves premature.

## What Adoption Would Mean

Adoption would mean another implementation can parse SITR objects, evaluate claim-surface policy, preserve provenance-linked gate decisions, run the benchmark corpus, and explain conformance level without using Nexus-Bio internals.

Adoption would not mean scientific correctness, wet-lab validation, regulatory readiness, official standards status, safety certification, full SBOL compliance, or completed external validation.

## Rollback Condition

Rollback to the Niche route if reviewers find that the object model, policy semantics, proof package, or second implementation are not stable enough for a portable draft.

Rollback would remove or archive the open-standard positioning while preserving the internal trust-runtime docs and tests.

## Current Non-Claims

- SITR Draft v1 is not an official standard.
- It has not been externally ratified.
- No external validation is claimed.
- No wet-lab validation is claimed.
- No scientific model correctness guarantee is claimed.
- No safety certification or regulatory approval is claimed.
- No user adoption is claimed.
- No full SBOL compliance is claimed.
