# Public Benchmark Reports

This directory stores local baseline comparison benchmark artifacts for P2 Step 17.

Generate or refresh the report with:

```bash
npm run benchmark:public
```

Files:

- `raw-results.csv`: per-case, per-mode comparison rows.
- `raw-results.json`: machine-readable per-case, per-mode comparison rows.
- `summary.csv`: per-mode comparison metrics.
- `summary.json`: machine-readable per-mode comparison metrics.
- `report.json`: run metadata, paths, and limitations.

The benchmark compares `no-gating`, `badge-only`, and `runtime-gating` modes over the existing trust-runtime corpus. It measures whether weak, demo, missing-evidence, or unsafe cases become stronger downstream claim-surface decisions.

These files are local development benchmark artifacts. They do not contain release certification, wet-lab evidence, scientific model validation, external validation, statistical significance, human reviewer study results, or user traction metrics.
