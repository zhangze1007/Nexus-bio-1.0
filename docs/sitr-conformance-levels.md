# SITR Conformance Levels

These levels describe increasing implementation maturity for Scientific Inference Trust Runtime (SITR) Draft v1. They do not certify scientific correctness, wet-lab results, regulatory readiness, safety, adoption, or official standard status.

## Level 0 - Object Parse

Required capabilities:
- Parse core SITR objects: `ToolAssumption`, `Evidence`, `ProvenanceEntry`, `AssumptionViolation`, `WorkflowContract`, `GateDecision`, `ClaimSurfacePolicy`, `ExperimentRecordV1`, and `LearnedDeltaPack`.
- Preserve legal values for `ValidityTier`, `ClaimSurface`, and `GateStatus`.

Required tests:
- Schema or type checks for required fields and legal value sets.
- Negative tests for unsupported tiers, surfaces, statuses, and fabricated evidence placeholders.

Expected artifacts:
- Object schemas or typed models.
- Parse/validation test report.

Non-claims:
- No policy correctness, provenance completeness, benchmark agreement, or scientific validation is implied.

## Level 1 - Policy Evaluation

Required capabilities:
- Evaluate a `GateDecision` from policy, validity tier, claim surface, provenance presence, draft state, and human-gate state.
- Support `ok`, `blocked`, `gated`, and `demoOnly` outcomes.

Required tests:
- Policy DSL validation.
- Gate-decision tests for `payload`, `export`, `recommendation`, `protocol`, and `external-handoff`.
- Default-deny behavior when policy is missing or no rule matches.

Expected artifacts:
- Policy document or equivalent rule representation.
- Policy evaluator test report.

Non-claims:
- No runtime enforcement, proof replay, second implementation agreement, or external review is implied.

## Level 2 - Provenance-Linked Decisions

Required capabilities:
- Include provenance IDs in decisions when stronger claim surfaces depend on upstream activities.
- Block or gate stronger surfaces when provenance is missing or insufficient.
- Preserve evidence IDs and upstream provenance IDs.

Required tests:
- Missing-provenance cases.
- Provenance-linked allow/block/gate cases.
- Tests that downstream surfaces cannot silently drop provenance.

Expected artifacts:
- Provenance records or bundles.
- Gate-decision traces that include provenance references.

Non-claims:
- No full PROV-DM compliance, scientific correctness, or wet-lab validation is implied.

## Level 3 - Benchmark Runner

Required capabilities:
- Run the trust benchmark corpus and report agreement with expected labels.
- Validate benchmark case structure before evaluation.

Required tests:
- Trust benchmark corpus validation.
- Runtime decision comparison against expected labels.
- Regression report for disagreements.

Expected artifacts:
- Benchmark run command or script.
- Machine-readable benchmark report.

Non-claims:
- Benchmark agreement is local development alignment, not scientific validation, external validation, or proof of safety.

## Level 4 - External Review Ready

Required capabilities:
- Provide proof package, replay instructions, review logs or templates, and a conformance report.
- Compare against a second implementation or independent implementation boundary.
- Document limitations and non-claims clearly.

Required tests:
- Proof package integrity check.
- Proof replay.
- Second implementation comparison.
- External review workflow document checks.

Expected artifacts:
- Proof package.
- Replay guide.
- Second implementation consistency report.
- External review protocol, reviewer pack, and review report templates.

Non-claims:
- External review readiness does not mean external review has been completed. It does not imply third-party validation, wet-lab validation, regulatory approval, or adoption.

## Level 5 - Cross-Domain Extension

Required capabilities:
- Define a domain extension without breaking SITR core semantics.
- Preserve core claim surfaces, gate statuses, validity tiers, provenance links, and policy evaluation behavior.
- Document extension-specific objects, assumptions, evidence requirements, and conformance tests.

Required tests:
- Core conformance tests from Levels 0-4.
- Extension-specific parse and policy tests.
- Backward compatibility tests showing core implementations can reject or ignore extension data safely.

Expected artifacts:
- Domain extension proposal.
- Extension schema or type definition.
- Extension conformance report.

Non-claims:
- Cross-domain extension does not imply scientific correctness in the new domain, official standard status, external validation, or safety certification.
