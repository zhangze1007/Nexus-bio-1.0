# Nexus-Bio Trust Runtime Proof Package

This package lets reviewers verify Nexus-Bio trust-runtime behavior without relying on verbal explanation. It is a local development proof bundle for the claim that Nexus-Bio makes weak evidence, demo outputs, missing provenance, and unsafe propagation visible and checkable.

## What Is Included

- Trust-runtime protocol specs in `specs/`
- Benchmark cases, expected labels, and schema in `benchmark/`
- Step 15 trust metrics, Step 17 public baseline comparison, and Step 19 second-implementation consistency reports in `reports/`
- Step 16 showcase examples in `examples/`
- Step 20 external review workflow references in `manifest.json`
- SBOL/PROV-linked provenance examples in `provenance/`
- Limitations and tool status documentation in `limitations.md` and `demo-status-table.md`
- Replay instructions in `replay.md` and `replication-guide.md`
- Integrity check notes in `checks/`

## What This Package Proves

- The benchmark corpus and expected labels are present and inspectable.
- Runtime trust decisions can be replayed locally from repo-root commands.
- Unsafe propagation cases can be inspected through raw and summary reports.
- The Python reference implementation can compare its trust-runtime decisions with expected labels and TypeScript runtime-gating rows.
- Tool validity tiers and limitations are visible in the same folder as the evidence.
- Provenance and showcase examples can be inspected alongside the benchmark reports.
- The external review workflow is prepared with worksheet, protocol, and empty templates.

## What This Package Does Not Prove

- No wet-lab validation is claimed.
- No scientific model validation is claimed.
- No external validation is claimed.
- No independent third-party validation is claimed.
- No regulatory approval or production-grade safety certification is claimed.
- No full SBOL compliance is claimed unless validated separately.
- No statistical significance or completed human reviewer study is claimed.
- No completed external reviewer pilot is claimed.
- No user traction is claimed.

## Quickstart

From the repository root:

```bash
npm install
npm run proof:check
npm run proof:replay
```

Inspect:

- `proof-package/manifest.json`
- `proof-package/reports/trust-metrics-latest.json`
- `proof-package/reports/public-benchmark-report.json`
- `proof-package/reports/public-benchmark-summary.csv`
- `proof-package/reports/second-implementation-consistency.json`
- `docs/reviewer-pack.md`
- `reports/external-review/README.md`
- `proof-package/limitations.md`
- `proof-package/demo-status-table.md`

The replay command refreshes benchmark reports from canonical repo-root scripts and then reruns package integrity checks.
