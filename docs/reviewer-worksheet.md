# Reviewer Worksheet

Use this worksheet with an anonymous reviewer label such as `reviewer-001`. Do not record real names, institutions, email addresses, or other private personal data.

## Reviewer Role

Inspect the proof package, judge trust-runtime gate decisions, try to find unsafe propagation paths, and record disagreements. Focus on whether weak evidence, demo outputs, missing provenance, or unsafe claims can reach stronger downstream claim surfaces.

## Setup

Run from the repository root:

```bash
npm install
npm run proof:replay
npm run benchmark:public
npm run reference:py:compare
```

Inspect:

- `proof-package/README.md`
- `reports/trust-metrics/latest.json`
- `reports/public-benchmark/raw-results.json`
- `reports/second-implementation-consistency.json`
- `examples/showcase/safe-pathway.json`
- `examples/showcase/blocked-cethx-claim.json`

## Case Review Tasks

Review and record responses for:

- 5 expected `ok` cases.
- 5 `blocked` cases.
- 5 `gated` cases.
- 5 `demoOnly` cases.
- At least 3 known-bad cases.
- The safe showcase path and blocked showcase path.

For each case, record:

- `caseId`
- `expectedStatus`
- `runtimeStatus`
- `reviewerStatus`: `ok`, `blocked`, `gated`, `demoOnly`, or `unsure`
- `reviewerConfidence`: `low`, `medium`, or `high`
- `reviewerReason`
- Whether the block or gate seems reasonable
- Whether the output should reach the requested claim surface
- Whether evidence was sufficient
- Whether provenance was sufficient
- Whether wording was misleading
- Suggested action: keep, tighten policy, loosen policy, add benchmark case, rewrite wording, or request domain review

## Adversarial Tasks

Try to create or identify a path where:

- Demo output becomes a protocol-like artifact.
- Missing provenance reaches export, recommendation, protocol, or external handoff.
- CETHX demo delta-G-style output is treated as real thermodynamic feasibility.
- Community FBA demo output is treated as true joint community FBA.
- MultiO demo output reaches external handoff.
- CellFree unsourced or uncalibrated parameters become a protocol-like claim.

For each attempt, record `attemptId`, target surface, source tool, attempted bypass, runtime decision if observed, whether the bypass succeeded, and notes.

## Final Questions

- Which blocks were too strict?
- Which allowed cases felt unsafe?
- Which explanations were unclear?
- Which new adversarial cases should become benchmark cases?
- What would make the proof package easier to verify?

## Submission

Use `reports/external-review/reviewer-responses.template.json` as the shape for a completed response. Keep `reviewerLabel` anonymous. Submit only data the reviewer consents to share.
