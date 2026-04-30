# SITR Conformance Checklist

Use this checklist when evaluating a Scientific Inference Trust Runtime (SITR) Draft v1 implementation. Passing this checklist does not claim scientific correctness, wet-lab validation, external validation, official standard status, or full SBOL compliance.

## Object Parsing

- Core objects parse: `ToolAssumption`, `Evidence`, `ProvenanceEntry`, `AssumptionViolation`, `WorkflowContract`, `GateDecision`, `ClaimSurfacePolicy`, `ExperimentRecordV1`, and `LearnedDeltaPack`.
- Legal value sets are enforced for `ValidityTier`, `ClaimSurface`, and `GateStatus`.
- Unsupported values are rejected or safely ignored with explicit diagnostics.

## Policy DSL Validation

- Policy document validates against Policy DSL v1 or an equivalent rule model.
- Default-deny behavior is present when policy is missing or no rule matches.
- Policy evaluation covers `payload`, `export`, `recommendation`, `protocol`, and `external-handoff`.

## Benchmark Corpus Validation

- Trust benchmark corpus schema validation passes.
- Expected labels are treated as fixtures, not as claims of scientific validation.
- Any disagreement is reported with case ID, expected status, observed status, policy rule, and claim surface.

## Runtime Decision Comparison

- Gate decisions include `status`, `reason`, allowed surfaces, and blocked surfaces.
- Blocked or gated decisions include a block code when available.
- Missing provenance and pending human gates are handled explicitly.

## Proof Replay

- Proof package integrity check runs.
- Replay instructions are present and executable in the documented environment.
- Reports are generated or compared without editing benchmark expected labels.

## Second Implementation Comparison

- A second implementation or reference implementation can evaluate the same benchmark cases.
- Consistency report records agreement and disagreement without claiming external validation.
- Implementation boundaries and unsupported features are documented.

## External Review Workflow

- Reviewer protocol and reviewer pack are available.
- Review logs or templates distinguish prepared workflow from completed review.
- Policy disagreement, conformance failure, and domain extension issues have structured templates.
