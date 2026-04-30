# Scientific Inference Trust Runtime (SITR) Draft v1

## Status of This Draft

This document is a draft open protocol proposal. It is not an official standard, has not been externally ratified, and is not a safety certification.

SITR Draft v1 is derived from the Nexus-Bio trust-runtime work, but an implementation does not need to use Nexus-Bio. The draft defines portable terminology, objects, gate semantics, policy hooks, conformance expectations, and review channels for scientific inference workflows.

No external validation is claimed for this draft. No wet-lab validation, regulatory approval, scientific model correctness guarantee, user adoption, or full SBOL compliance is claimed.

## Abstract

Scientific AI and computational biology tools often produce outputs that move across contexts: internal payloads, exports, recommendations, protocol-like instructions, and external handoffs. The trust problem is not only whether a model or algorithm is accurate. It is whether downstream claims preserve assumptions, evidence, provenance, validity tier, and review status.

SITR defines a runtime layer for assumption-gated scientific inference. It describes how tools declare assumptions, attach evidence and provenance, evaluate claim surfaces, and produce explicit gate decisions before a result is treated as stronger than its support allows.

## Motivation

Scientific workflow systems can fail by letting weak evidence, demo models, missing provenance, or draft outputs appear stronger than they are. These failures are especially risky when an internal visualization becomes an export, recommendation, protocol-like handoff, or input to another tool.

SITR exists to make the boundary visible and machine-checkable. The protocol does not certify scientific truth. It records the trust context around a scientific inference and requires explicit gates when a downstream claim surface would exceed that context.

## Terminology

- `Scientific inference`: A derived scientific output, interpretation, prediction, design suggestion, or procedural context produced from data, models, literature, user input, simulation, or manual review.
- `Assumption`: A condition a tool depends on or introduces, including known limitations and validity tier.
- `Evidence`: A record describing where an assumption, value, or decision came from.
- `ProvenanceEntry`: A record of a tool run, import, export, human gate, or review activity and its upstream dependencies.
- `ClaimSurface`: The downstream context in which an output is used: `payload`, `export`, `recommendation`, `protocol`, or `external-handoff`.
- `ValidityTier`: The declared support tier for an output or assumption: `real`, `partial`, or `demo`.
- `GateDecision`: The result of evaluating a claim surface against policy, assumptions, provenance, and review state.
- `Policy`: A reviewable rule set that maps runtime context to a `GateDecision`.
- `HumanGate`: A required human review step before an output can cross a stronger claim surface.
- `ExternalHandoff`: Transfer of a scientific output outside the originating runtime, including downstream tools, collaborators, or lab-facing systems.

## Required Objects

SITR implementations SHOULD follow the portable object definitions in `spec/nexus-trust-runtime-v0.md`. A conforming implementation MAY use different storage or programming language types, but the object semantics and legal value sets MUST remain equivalent.

Required objects:

- `ToolAssumption`: Stable assumption ID, tool ID, human-readable statement, validity tier, status, known limitations, and evidence IDs.
- `Evidence`: Stable evidence ID, evidence type, title, optional source metadata, optional verified DOI, URL, and notes.
- `ProvenanceEntry`: Stable provenance ID, tool or actor, activity type, timestamps, input and output assumptions, evidence IDs, upstream provenance IDs, and optional actor.
- `AssumptionViolation`: Stable violation ID, affected assumption, detection time, severity, message, and affected claim surfaces.
- `WorkflowContract`: Rule describing what one tool may pass to another tool or surface, including required validity tier, provenance, and human gate.
- `GateDecision`: Status, optional block code, reason, allowed surfaces, blocked surfaces, and optional override path.
- `ClaimSurfacePolicy`: Reviewable policy binding tools, validity tiers, provenance requirements, human-gate requirements, and claim surfaces to gate outcomes.
- `ExperimentRecordV1`: Experimental or simulated assay record as defined in `spec/experiment-record-v1.md`.
- `LearnedDeltaPack`: Reviewed feedback package as defined in `spec/learned-delta-pack-v1.md`.

Implementations MUST NOT add validity tiers, gate statuses, or claim surfaces that silently change core semantics. Domain extensions are allowed only when core meanings stay intact.

## Claim Surfaces

SITR defines five claim surfaces:

- `payload`: Internal runtime payloads and workbench state.
- `export`: Downloaded, serialized, or shared outputs.
- `recommendation`: Suggested intervention, design choice, or next action.
- `protocol`: Protocol-like instructions or procedural handoff.
- `external-handoff`: Transfer outside the originating runtime.

Policy MUST evaluate the requested surface, not only the producing tool. A demo-tier payload can remain visible internally while being blocked from protocol or external-handoff use.

## Gate Semantics

Gate statuses are:

- `ok`: The requested surface is allowed.
- `blocked`: One or more requested surfaces are refused.
- `gated`: A human gate or explicit review step is required before the surface can be allowed.
- `demoOnly`: The output may remain in demo-only contexts but must not support stronger claims.

Gate decisions MUST include a human-readable reason. Blocked or gated outcomes SHOULD include a machine-readable `blockCode`. Decisions SHOULD list allowed and blocked surfaces so downstream systems do not infer permission from a boolean alone.

## Policy Language

SITR Draft v1 references `spec/policy-dsl-v1.md` as the current reviewable policy language. The committed policy fixture is `policy/trust-policy-v1.json`, and the TypeScript evaluator is `src/services/policyDslEvaluator.ts`.

Policy DSL v1 is intentionally small: no arbitrary JavaScript expressions, no `eval`, no function calls, and no dynamic code execution. Rules are priority ordered, and the first matching rule wins. A default-deny decision is expected when no policy can justify the requested surface.

Other policy languages MAY be used by independent implementations if they preserve the same gate semantics, legal value sets, and conformance evidence.

## Provenance

SITR provenance is aligned with `spec/prov-dm-mapping.md`. A `ProvenanceEntry` maps to a PROV activity-like record, evidence maps to entity-like context, and actors can represent people or systems.

This draft does not claim full PROV-DM compliance. The goal is portable provenance semantics: a decision should be explainable by its inputs, upstream provenance, evidence IDs, and gate activity.

## Biological Design Artifacts

Biological design artifacts SHOULD use the SBOL-aligned mapping in `spec/sbol-3-mapping.md` when they represent constructs, pathways, or protocol-like objects. The mapping keeps artifact IDs, provenance links, and trust metadata visible.

This draft says SBOL-aligned, not fully SBOL-compliant. Full SBOL compliance requires separate validation by appropriate SBOL tooling and is not claimed here.

## Conformance

SITR conformance levels are defined in `docs/sitr-conformance-levels.md`.

At minimum, a conforming implementation MUST parse the core objects and preserve legal values for `ValidityTier`, `ClaimSurface`, and `GateStatus`. Higher levels add policy evaluation, provenance-linked decisions, benchmark replay, proof packaging, external review readiness, and cross-domain extension discipline.

Reference materials include:

- `proof-package/README.md` and `proof-package/manifest.json` for portable proof-package structure.
- `proof-package/replay.md` for replay expectations.
- `reference_impl_py/README.md` for the Python reference implementation.
- `reports/second-implementation-consistency.json` for second implementation comparison output.
- `docs/second-implementation.md` for the second implementation boundary.
- `docs/external-review-protocol.md`, `docs/reviewer-pack.md`, and `reports/external-review/` for review workflow preparation.

## Security and Misuse Considerations

SITR is vulnerable to misuse if implementers treat trust metadata as a badge instead of a gate. Known risks include:

- Demo leakage: demo-tier or draft outputs crossing into recommendations, protocols, or external handoffs.
- Missing provenance: outputs accepted without traceable upstream activities or evidence.
- Badge-only failure: UI labels exist, but runtime decisions do not enforce or record boundaries.
- Policy bypass: exports or integrations skip the same gate semantics used by internal payloads.
- Fake evidence: fabricated DOI values, placeholder citations, or unverifiable sources presented as support.
- Fake validation claims: claims of wet-lab validation, external validation, scientific validation, safety certification, user adoption, or full SBOL compliance without actual evidence.

Implementations SHOULD default to blocked or gated decisions when provenance, evidence, policy, or validity metadata is missing for stronger claim surfaces.

## Limitations

SITR Draft v1 does not prove that a scientific model is correct. It does not certify wet-lab outcomes, regulatory readiness, safety, or adoption. It does not upgrade demo or partial tools into real scientific evidence.

The draft is a protocol proposal for trust-runtime governance. It is not an official standard, not externally ratified, and not a substitute for domain validation, peer review, experimental evidence, or regulatory review.

## Examples

The examples below are illustrative gate decisions. They are not benchmark results.

`ok`:

```json
{
  "status": "ok",
  "reason": "The output has provenance and remains an internal payload.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": []
}
```

`blocked`:

```json
{
  "status": "blocked",
  "blockCode": "DEMO_TO_PROTOCOL",
  "reason": "Demo-tier output cannot be used for protocol-like handoff.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": ["protocol", "external-handoff"],
  "overridePath": "not-allowed"
}
```

`gated`:

```json
{
  "status": "gated",
  "blockCode": "HUMAN_GATE_REQUIRED",
  "reason": "A recommendation requires human review before export.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": ["recommendation", "export"],
  "overridePath": "human-review"
}
```

`demoOnly`:

```json
{
  "status": "demoOnly",
  "reason": "The result may remain visible in demo-only workflow contexts.",
  "allowedSurfaces": ["payload"],
  "blockedSurfaces": ["recommendation", "protocol", "external-handoff"]
}
```

Additional examples and replay materials are available in `proof-package/examples/` and `benchmarks/trust-runtime-cases/`.

## Change Control

SITR changes SHOULD be proposed through reviewable issues and pull requests. This repository provides three issue templates:

- `.github/ISSUE_TEMPLATE/policy-disagreement.yml` for disputed gate outcomes.
- `.github/ISSUE_TEMPLATE/conformance-failure.yml` for implementation failures against this draft.
- `.github/ISSUE_TEMPLATE/domain-extension.yml` for new domain objects, surfaces, or mappings that preserve core semantics.

Changes MUST keep limitations visible and MUST NOT add claims of official standard status, external ratification, wet-lab validation, scientific validation, safety certification, user adoption, or full SBOL compliance without evidence.
