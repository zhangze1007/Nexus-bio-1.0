# External Reviewer Pack

This pack is an entry point for a project-external reviewer who wants to inspect Nexus-Bio trust-runtime behavior. It is about claim-surface safety, not UI praise.

## Start Here

- Proof package: [`proof-package/README.md`](../proof-package/README.md)
- Replication guide: [`proof-package/replication-guide.md`](../proof-package/replication-guide.md)
- Reviewer worksheet: [`docs/reviewer-worksheet.md`](reviewer-worksheet.md)
- Review protocol: [`docs/external-review-protocol.md`](external-review-protocol.md)
- Review log instructions: [`docs/external-review-log.md`](external-review-log.md)
- External review templates: [`reports/external-review/`](../reports/external-review/)

## Evidence To Inspect

- Trust metrics: [`reports/trust-metrics/latest.json`](../reports/trust-metrics/latest.json)
- Public baseline comparison: [`reports/public-benchmark/report.json`](../reports/public-benchmark/report.json)
- Runtime-gating raw rows: [`reports/public-benchmark/raw-results.json`](../reports/public-benchmark/raw-results.json)
- Python second implementation report: [`reports/second-implementation-consistency.json`](../reports/second-implementation-consistency.json)
- Showcase examples: [`examples/showcase/`](../examples/showcase/)

## 30-Minute Review Path

1. Run `npm run proof:replay`.
2. Inspect `reports/trust-metrics/latest.json`.
3. Inspect one safe showcase path and one blocked showcase path.
4. Fill the quick sections of `docs/reviewer-worksheet.md`.
5. Record any disagreement in the response template without using a real name.

## 2-Hour Review Path

1. Run `npm run proof:replay`.
2. Inspect public benchmark modes and runtime-gating raw rows.
3. Review at least 20 sampled cases across safe, blocked, gated, demoOnly, and known-bad categories.
4. Attempt the adversarial bypass tasks in the worksheet.
5. Submit disagreement cases as benchmark candidates if warranted.

## Non-Claims

This workflow has been prepared for external review. It does not report external validation, scientific validation, wet-lab validation, regulatory approval, or completed reviewer results.
