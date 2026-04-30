# Proof Package Checks

Run:

```bash
npm run proof:check
```

The check script verifies that `proof-package/manifest.json` is parseable, required proof-package files exist, source references exist, non-claims are explicit, limitations and demo status files are present, and key JSON/CSV reports are parseable.

The check does not validate biological truth, wet-lab outcomes, external reproduction, full SBOL compliance, regulatory readiness, or user-study results.
