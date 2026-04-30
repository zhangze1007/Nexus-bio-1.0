# External Review Log

This note explains how to record completed external review submissions without storing private personal data or inventing outcomes.

## Recording A Completed Review

1. Copy `reports/external-review/reviewer-responses.template.json`.
2. Change `status` to `completed-review`.
3. Use an anonymous `reviewerLabel`, such as `reviewer-001`.
4. Fill `reviewedAt`, `proofPackageCommit`, case responses, adversarial attempts, and summary fields.
5. Store the completed file under a review-specific path agreed by the project, for example `reports/external-review/submissions/reviewer-001.json`.

Do not commit real reviewer data unless the reviewer consented to the exact shared content.

## Anonymization

Use labels that cannot identify a person. Do not store names, institutions, email addresses, employer names, location, or private notes unrelated to the trust-runtime review.

## Summarizing Disagreements

Use `reports/external-review/disagreement-cases.json` to collect reviewed disagreement candidates. Include case IDs, reviewer status, runtime status, reason, and suggested action only after a real review occurs.

## Benchmark Candidate Flow

Disagreement cases may become benchmark candidates after maintainers decide they represent a reproducible trust-runtime issue. Additions should preserve original reviewer concern while removing personal data.

## What Not To Record

- Private personal data.
- Fake reviewer identities.
- Fake pilot results.
- Claims of validation without reviewer consent and recorded evidence.
- Institution or affiliation claims unless explicitly approved and necessary.
