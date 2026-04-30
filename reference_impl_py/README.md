# Python Trust-Runtime Reference Implementation

This directory contains a local Python stdlib implementation of the Nexus-Bio trust-runtime protocol. It is a second implementation of the gate-decision semantics, not a rewrite of any biology model.

## Scope

- Core trust-runtime objects: validity tiers, claim surfaces, gate statuses, decisions, and claim-surface policies.
- Benchmark loading for `benchmarks/trust-runtime-cases/*.json`.
- Expected-label loading for `benchmarks/expected_labels.csv`.
- Policy evaluation from `reference_impl_py/policies/claim_surface_policies.json`.
- Consistency comparison against expected labels and TypeScript `runtime-gating` rows in `reports/public-benchmark/raw-results.json`.

## Non-Scope

- No FBA, CETHX, MultiO, CellFree, protein design, or other scientific model is reimplemented.
- No production TypeScript runtime behavior is changed.
- No external, third-party, scientific, or wet-lab validation is claimed.

## Commands

From the repository root:

```bash
npm run reference:py:validate
npm run reference:py:run
npm run reference:py:compare
```

The direct Python entrypoint is:

```bash
python3 reference_impl_py/run_reference_benchmark.py compare
```

Reports are written to:

- `reports/second-implementation-decisions.json`
- `reports/second-implementation-consistency.json`
- `reports/second-implementation-consistency.md`

The policy snapshot is intentionally copied and local. Run the consistency report when TypeScript policies change so drift is visible instead of hidden.
