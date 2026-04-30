# Reviewer Calibration Task Design

This document designs a future human review task for the public baseline comparison benchmark. It does not report results, participants, or measured calibration values.

## Purpose

The task would compare whether reviewers make safer claim-surface decisions with:

- no governance
- badge-only governance
- runtime-gating governance

The target question is whether reviewers prevent weak, demo, missing-evidence, or unsafe outputs from becoming stronger downstream scientific claims.

## Task Design

Select a balanced sample from the trust-runtime benchmark corpus, including truthful partial cases, unsafe demo cases, missing provenance cases, human-gated cases, draft-output cases, and known-bad cases.

For each case, show the reviewer one governance mode at a time. Ask whether the output should proceed to the requested claim surface, and ask for a confidence rating. Record time-to-decision from case display to submitted decision.

Use counterbalanced ordering if the task is later run with real participants, so the mode order does not dominate the result.

## Data To Record

Future task rows should include:

```text
reviewerId,caseId,mode,surface,reviewerDecision,expectedStatus,confidence,timeToDecisionMs,notes
```

`reviewerId` should be a pseudonymous study identifier. Do not store unnecessary personal data.

## Metrics

- Reviewer calibration score: agreement with expected safe/unsafe labels.
- Agreement with expected labels: status-level agreement where the task format supports it.
- Time-to-safe-decision: time for decisions that match the expected safe boundary.
- False trust rate: unsafe or known-bad cases allowed by reviewers.
- False block rate: expected `ok` cases rejected by reviewers.

## Limitations

This task has not been run. There are no fake participants, no fake reviewer calibration values, no fake time-to-decision measurements, and no human reviewer study results in Step 17.

Future results would still need to be described as reviewer calibration over a local benchmark task, not wet-lab validation, biological model validation, external validation, or a guarantee of scientific correctness.
