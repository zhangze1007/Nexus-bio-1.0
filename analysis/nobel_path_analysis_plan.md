# Nobel Path Analysis Plan

Status: `not-yet-run`

This markdown plan is used instead of a notebook because the repository does not have an established analysis notebook convention. It is a future execution plan only.

## Data Assembly

- Collect branch-level DBTL decision cases from a real public, historical, or partner-provided dataset.
- Assign stable `caseId` values before running comparisons.
- Record source type using the existing `ExperimentRecordV1` vocabulary where applicable: `wet-lab`, `simulated-assay`, `historical-dataset`, `manual-entry`, or `imported-csv`.
- Link evidence IDs, provenance IDs, and learned feedback or delta-pack IDs when available.

## Preprocessing

- Freeze outcome labels before arm comparison.
- Mark unresolved or insufficiently documented branches explicitly.
- Normalize claim surfaces to `payload`, `export`, `recommendation`, `protocol`, or `external-handoff`.
- Preserve missing provenance as a measured condition rather than imputing support.

## Arm Evaluation

- Run `no-gating`, `badge-only`, and `runtime-gating` over the same branch cases.
- Record a decision row for every branch and every arm.
- Keep gate reasons, block codes, allowed surfaces, blocked surfaces, and human-gate status when present.

## Metrics Computation

- Compute invalid branch reduction.
- Compute unsafe direction reduction.
- Compute decision reproducibility.
- Compute wasted iteration reduction.
- Compute false block rate.
- Compute time-to-safe-decision only if real reviewer timing exists.

## Uncertainty Reporting

- Report confidence intervals or bootstrap intervals only after a real dataset exists.
- Stratify by domain, source type, validity tier, and claim surface where the dataset is large enough.
- Keep unresolved cases visible rather than treating them as successes.

## Reporting Boundary

The final report must state whether the study used public historical data, partner data, simulated assay data, or manual review. It must not claim wet-lab validation, scientific validation, statistical significance, external validation, or a real scientific result unless those claims are supported by actual data and review.
