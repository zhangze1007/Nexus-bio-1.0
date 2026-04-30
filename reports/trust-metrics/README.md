# Trust Metrics Reports

This directory stores local trust-runtime benchmark reports generated from the static benchmark corpus and `evaluateClaimSurfacePolicy()`.

Generate or refresh the report with:

```bash
npm run benchmark:trust:report
```

Files:

- `latest.json`: most recent local report.
- `history.json`: local-dev regression history, upserted by run label and corpus hash.

These files do not contain release certification, wet-lab evidence, scientific model validation, third-party benchmark results, or user traction metrics.
