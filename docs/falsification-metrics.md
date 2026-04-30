# Falsification Metrics

P2 Step 15 adds a local trust-runtime metrics report for the benchmark corpus. The report is a machine-readable view of claim-surface decisions from the existing policy evaluator. It is designed to show both successful progression and successful refusal.

## Metrics

Block Rate is the fraction of benchmark cases where `evaluateClaimSurfacePolicy()` returned `blocked`.

False Block Rate is the fraction of expected-`ok` cases where the runtime returned `blocked`.

Missing Provenance Rate is the fraction of cases where missing provenance was present in the benchmark input, risk tags, expected result, or actual evaluator block code.

Unsafe Export Prevention Rate is the fraction of unsafe formal-surface cases that did not become `ok`. Formal surfaces are `export`, `recommendation`, `protocol`, and `external-handoff`.

Demo Leakage Rate is the fraction of demo-tier formal-surface cases that reached `ok`.

Known-Bad Coverage Rate is the fraction of required known-bad regression risk tags represented by cases marked `knownBad: true`.

## Outcome Classes

Successful progression means a case expected to be `ok` remained `ok` after runtime evaluation.

Successful blocking means an unsafe formal-surface case was prevented from becoming `ok`.

False block means a case expected to be `ok` was blocked by the evaluator.

Leakage means a case that should not become a stronger claim reached `ok`.

## What The Report Does Not Prove

The report is local trust-runtime benchmark output. It does not validate wet-lab outcomes, guarantee scientific model correctness, make a third-party benchmark claim, certify regulatory or safety readiness, or measure user traction.

The report does not run FBA, CETHX thermodynamics, TX-TL equations, protein scoring, codon optimization, or multi-omics algorithms. It measures trust-runtime policy behavior over a static corpus.

## Regeneration

Run:

```bash
npm run benchmark:trust:validate
npm run benchmark:trust:evaluate
npm run benchmark:trust:report
```

The report generator reads:

- `benchmarks/trust-runtime-cases/*.json`
- `benchmarks/expected_labels.csv`
- `src/services/trustPolicyEngine.ts`

It writes:

- `reports/trust-metrics/latest.json`
- `reports/trust-metrics/history.json`

`history.json` is local-dev regression history keyed by `runLabel` and corpus hash. It is not release history.

## Next Steps

Step 16 can use this dashboard as a narrow showcase surface without changing the metrics semantics. Step 17 adds a local baseline comparison protocol in `docs/public-benchmark-methods.md` and writes reproducible comparison artifacts to `reports/public-benchmark/`.
