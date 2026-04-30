# Nobel Path Study Design

Status: `not-yet-run`

This is a falsifiable study design for future work. It contains no real scientific result, no wet-lab validation, no external validation, and no statistical significance claim.

## Hypothesis

Runtime gating reduces unsafe downstream design decisions in synthetic biology DBTL workflows when evidence quality is uneven.

## Arms

- `no-gating`: outputs propagate without assumption, provenance, or claim-surface gates.
- `badge-only`: outputs display trust labels, but labels do not block or gate downstream decisions.
- `runtime-gating`: assumptions, provenance, validity tiers, claim surfaces, and human gates produce enforceable `GateDecision` outcomes.

## Input Data Needed

- Design proposals: candidate biological branches, interventions, constructs, pathway edits, or protocol-like handoffs.
- Evidence quality labels: evidence completeness, source type, provenance availability, validity tier, and uncertainty status.
- Assay or historical outcomes: wet-lab, historical-dataset, simulated-assay, or reviewed outcome records with source provenance.
- Invalid or unsafe branch labels: predeclared labels for unsupported, invalid, unsafe, irreproducible, or unresolved branches.
- Decision logs: per-arm records showing whether each branch was allowed, blocked, gated, or kept demo-only.

## Metrics

- Invalid experiment branch reduction: reduction in invalid branches allowed by `runtime-gating` relative to baselines.
- Unsafe direction reduction: reduction in unsafe or unsupported downstream directions allowed by `runtime-gating`.
- Decision reproducibility: agreement of gate outcomes across reruns, implementations, or reviewers under the same policy.
- Wasted iteration reduction: reduction in DBTL iterations spent on invalid, unsupported, or irreproducible branches.
- False block rate: proportion of valid branches incorrectly blocked or gated.
- Time-to-safe-decision: elapsed review time to a safe decision if real reviewers exist.

## Minimum Dataset Requirements

A future study requires enough branch-level cases to estimate both unsafe propagation and false blocks. Minimum requirements:

- Each branch has a stable `caseId`, domain, source, and claim surface.
- Each branch has evidence quality labels and provenance status.
- Each branch has a predeclared outcome label created before arm comparison.
- Dataset documentation distinguishes wet-lab, historical-dataset, simulated-assay, and manual-review sources.
- Missing, unresolved, and ambiguous outcomes are preserved rather than silently dropped.

No minimum sample size is claimed here because no dataset has been selected or powered.

## Inclusion And Exclusion Criteria

Include:

- DBTL-like branches with a clear downstream decision point.
- Branches with enough source material to assign evidence quality and provenance status.
- Branches from domains represented in current trust-runtime docs: pathway thermodynamics uncertainty, cell-free parameter uncertainty, multi-omics evidence uncertainty, or community FBA overclaim prevention.

Exclude:

- Branches with invented evidence, unverifiable outcomes, or missing source rights.
- Branches whose outcome label is changed after viewing arm results.
- Branches that require unsupported scientific algorithms or new wet-lab data collection inside this repo.
- Cases where the requested claim surface cannot be mapped to `payload`, `export`, `recommendation`, `protocol`, or `external-handoff`.

## Statistical Plan

Before running the study, preregister:

- Primary endpoint: invalid experiment branch reduction.
- Secondary endpoints: unsafe direction reduction, decision reproducibility, wasted iteration reduction, false block rate, and time-to-safe-decision when reviewers exist.
- Unit of analysis: branch-level decision.
- Comparison: `runtime-gating` versus `no-gating` and `badge-only`.
- Uncertainty reporting: confidence intervals or bootstrap intervals once real data exists.
- Sensitivity analysis: repeat metrics by domain, source type, validity tier, and claim surface.

No p-values, effect sizes, confidence intervals, or statistical significance are reported in this design because the study has not been run.

## Failure Modes

- Gates block valid exploratory branches too often.
- Labels reflect curator bias rather than biological outcome quality.
- Historical outcomes are incomplete, noisy, or not comparable across domains.
- `badge-only` workflows perform as well as runtime gates, weakening the runtime thesis.
- Human reviewers disagree on unsafe branch labels or gate decisions.
- Policy rules overfit the existing trust benchmark corpus.

## Ethics And Safety Considerations

The study should avoid generating actionable wet-lab protocols from demo, partial, or unsupported outputs. Any real partner data must have permission, provenance, and privacy boundaries. Unsafe biological directions should be labeled and analyzed without being converted into procedural instructions.

The study must not claim therapeutic relevance, deployment readiness, regulatory approval, or safety certification from trust-runtime metrics alone.

## Reproducibility Plan

- Publish the dataset manifest when real data exists.
- Preserve raw branch inputs, evidence labels, provenance IDs, and outcome labels.
- Run all three arms from the same frozen input cases.
- Record software version, policy version, benchmark corpus version, and run label.
- Store results in `reports/nobel-path-results.template.json` format after replacing placeholders with real, traceable values.
- Keep limitations and unresolved cases visible in the final report.
