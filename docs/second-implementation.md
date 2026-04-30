# Second Implementation

Step 19 adds a Python stdlib reference implementation for the trust-runtime protocol. It exists to show that Nexus-Bio gate decisions can be represented and replayed outside the TypeScript application.

## What It Covers

- Core trust-runtime vocabulary: `ValidityTier`, `ClaimSurface`, `GateStatus`, `GateDecision`, and `ClaimSurfacePolicy`.
- Benchmark loading from `benchmarks/trust-runtime-cases/*.json`.
- Expected-label loading from `benchmarks/expected_labels.csv`.
- A copied local claim-surface policy snapshot in `reference_impl_py/policies/claim_surface_policies.json`.
- Consistency comparison against expected labels and TypeScript `runtime-gating` rows from `reports/public-benchmark/raw-results.json`.

## What It Does Not Cover

- It does not reimplement scientific tools.
- It does not evaluate biological model correctness.
- It does not provide wet-lab validation, external validation, third-party validation, or external adoption.
- It does not change production runtime behavior.

## Run It

```bash
npm run reference:py:validate
npm run reference:py:run
npm run reference:py:compare
```

The direct Python command is:

```bash
python3 reference_impl_py/run_reference_benchmark.py compare
```

## Interpret The Report

The JSON report is written to `reports/second-implementation-consistency.json`; the Markdown report is written to `reports/second-implementation-consistency.md`.

`pythonVsExpectedAgreementRate` compares the Python status and block code to the curated expected labels. `pythonVsTypescriptAgreementRate` compares the Python status and block code to TypeScript runtime-gating rows when those rows are present.

If mismatches appear, they should be treated as review input, not hidden. A mismatch may indicate a Python bug, a policy snapshot drift, benchmark ambiguity, TypeScript/runtime mismatch, or an expected-label issue requiring future review.

## Next Steps

This prepares Step 20 external review by making replay easier to inspect, and it prepares Step 21 by making the policy snapshot boundary visible. Automatic policy snapshot generation is deferred.
