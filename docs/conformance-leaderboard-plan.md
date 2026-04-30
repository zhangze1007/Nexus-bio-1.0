# Conformance Leaderboard Plan

Status: not-yet-run

This plan defines a future conformance leaderboard for SITR implementations. It does not claim external adoption, third-party validation, scientific validation, wet-lab validation, product quality, or biological accuracy.

## What The Leaderboard Measures

- Conformance pass rate: percentage of required conformance checks passed for a declared level.
- Benchmark agreement: agreement with expected trust-runtime labels for the frozen benchmark corpus.
- Unsafe propagation rate: rate at which weak, demo, missing-evidence, or unsafe cases cross stronger claim surfaces.
- Proof replay success: whether documented replay commands complete and produce expected report shapes.
- Implementation language: language or runtime used by the submitted implementation.

## What The Leaderboard Does Not Measure

- Biological accuracy.
- Scientific validation.
- Product quality.
- Wet-lab validity.
- Regulatory readiness.
- User adoption.
- Full SBOL compliance.

## Required Submission Fields

- `submissionId`
- `implementationName`
- `implementationLanguage`
- `repositoryUrl` or artifact path
- `sitrVersion`
- `policyDslVersion`
- `benchmarkCorpusVersion`
- `conformanceLevelClaimed`
- `conformancePassRate`
- `benchmarkAgreement`
- `unsafePropagationRate`
- `proofReplaySuccess`
- `reportPath`
- `submittedBy`
- `permissionToList`
- `limitations`

## Verification Process

Submissions should be accepted only when:

- source or artifact access is available to reviewers;
- benchmark corpus version is declared;
- proof replay command and environment are documented;
- conformance report is machine-readable;
- limitations and unsupported surfaces are listed;
- no unsupported validation, adoption, or standards claims are included.

## Preventing Fake Submissions

- Do not list anonymous or unverifiable implementations.
- Do not list an implementation without permission.
- Do not treat a fork, draft branch, or local test as adoption unless it has a reproducible report.
- Do not allow submitters to edit expected benchmark labels as part of a submission.
- Preserve rejected or disputed submissions as issue records rather than leaderboard rows.

## Current Status

The leaderboard is a not-yet-run plan. `reports/conformance-leaderboard.template.json` contains no fake adopters, no fake submissions, and no claimed rankings.
