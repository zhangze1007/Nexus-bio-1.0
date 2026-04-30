# Public Baseline Comparison Benchmark Methods

P2 Step 17 compares three trust-governance modes over the existing trust-runtime benchmark corpus:

- `no-gating`: all outputs are allowed through as `ok`.
- `badge-only`: validity, provenance, and assumption labels may be visible, but they do not enforce claim-surface use.
- `runtime-gating`: Nexus-Bio calls the existing `evaluateClaimSurfacePolicy()` runtime policy engine.

The benchmark asks which mode prevents weak, demo, missing-evidence, or unsafe outputs from becoming stronger downstream scientific claims. It does not score which output is more impressive.

## Measurements

- Unsafe propagation: an expected blocked, gated, or demo-only case becomes `ok` on a formal surface.
- False trust: a known-bad or expected unsafe case becomes `ok`.
- False block: an expected `ok` case is blocked.
- Demo leakage: a demo-like case becomes `ok` on a formal surface, or becomes `ok` when its expected status was not `ok`.
- Missing provenance leakage: a missing-provenance case becomes `ok` on a provenance-required formal surface.
- Unsafe export prevention: an unsafe formal-surface case does not become `ok`.
- Known-bad prevention: a known-bad case does not become `ok`.

Formal surfaces are `export`, `recommendation`, `protocol`, and `external-handoff`. The `payload` surface is treated more leniently for unsafe propagation because payload visibility can remain exploratory, but demo leakage is still counted when a demo output was expected to remain non-`ok`.

## Corpus And Labels

The benchmark corpus source is `benchmarks/trust-runtime-cases/*.json`. The current local corpus contains 74 cases in `benchmarks/trust-runtime-cases/p0-step-6-cases.json`.

The expected labels source is `benchmarks/expected_labels.csv`. The public comparison runner validates the CSV answer key against the JSON case metadata before computing results. The benchmark does not modify expected labels.

## Reproduction

Run:

```bash
npm run benchmark:trust:validate
npm run benchmark:trust:evaluate
npm run benchmark:public
```

Outputs are written to:

- `reports/public-benchmark/raw-results.csv`
- `reports/public-benchmark/raw-results.json`
- `reports/public-benchmark/summary.csv`
- `reports/public-benchmark/summary.json`
- `reports/public-benchmark/report.json`

The default run label is `local-dev`. Set `PUBLIC_BENCHMARK_RUN_LABEL` or `PUBLIC_BENCHMARK_GENERATED_AT` only when an explicit reproducible run label or timestamp is needed.

## What This Does Not Measure

This benchmark does not measure wet-lab truth, biological model accuracy, scientific model validation, external validation, safety certification, regulatory readiness, statistical significance, or user traction.

It does not run FBA, thermodynamics, TX-TL equations, protein scoring, codon optimization, or multi-omics algorithms. It measures trust-runtime policy behavior over a static corpus.

## Limitations

The `no-gating` and `badge-only` modes are local baselines, not independent products. They intentionally model allow-through behavior so the comparison can isolate whether enforcement changes downstream claim-surface outcomes.

Reviewer calibration is not measured in Step 17. No human reviewer task has been run, and no participant results are included. `reviewerCalibrationScore` and time-to-safe-decision fields are omitted or null until real reviewer data exists.

## Future Reviewer Calibration

A future human task can compare reviewer decisions under the same three modes. That task should record reviewer decisions, confidence, and time-to-decision without fabricating participants or outcomes. The draft task design is in `docs/reviewer-calibration-task.md`.
