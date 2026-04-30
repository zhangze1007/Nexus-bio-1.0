# Replication Guide

This guide describes how to replay the local proof package from a fresh clone.

## Environment

Use Node.js with the repository JavaScript dependencies installed:

```bash
npm install
```

No external network call is required for proof replay after dependencies are installed. The replay commands use local benchmark cases, expected labels, policy code, the Python reference implementation, and generated report scripts.

## Replay

From the repository root:

```bash
npm run proof:replay
```

This runs:

1. `npm run benchmark:trust:validate`
2. `npm run benchmark:trust:evaluate`
3. `npm run benchmark:trust:report`
4. `npm run benchmark:public`
5. `npm run reference:py:compare`
6. report refresh into `proof-package/reports/`
7. `npm run proof:check`

If any command fails, replay exits non-zero and leaves the command output visible.

## Inspect The Result

Read:

- `proof-package/reports/trust-metrics-latest.json`
- `proof-package/reports/public-benchmark-report.json`
- `proof-package/reports/public-benchmark-summary.csv`
- `proof-package/reports/second-implementation-consistency.json`
- `proof-package/limitations.md`
- `proof-package/demo-status-table.md`

The reports are local development artifacts. They are not release certification, wet-lab evidence, scientific validation, external validation, or a user study.
