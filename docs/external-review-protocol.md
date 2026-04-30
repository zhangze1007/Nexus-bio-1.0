# External Review Protocol

## Purpose

This protocol prepares a project-external review of Nexus-Bio trust-runtime behavior. The review asks whether runtime decisions correctly prevent weak evidence, demo outputs, missing provenance, or unsafe claim propagation from becoming stronger downstream scientific claims.

## Scope

The review covers proof-package replay, benchmark cases, expected labels, runtime-gating decisions, public baseline comparison, showcase traces, provenance examples, and adversarial bypass attempts. It does not evaluate UI polish or biological truth.

## Reviewer Eligibility

A reviewer should be outside the project. Helpful backgrounds include computational biology, synthetic biology, scientific software, data governance, provenance, or safety review. Anonymous labels such as `reviewer-001` are sufficient. Real names, institutions, and private personal data are not required.

## What Counts As External Review

- A project-external person follows the reviewer pack or protocol.
- The person records case-level judgments or adversarial attempts.
- The review is stored in a structured response file or equivalent worksheet.
- Any public claim about the review is limited to what the recorded review actually supports.

## What Does Not Count

- Casual UI praise.
- Self-review by project maintainers.
- AI-only review without human accountability.
- Private claims without a recorded worksheet.
- Review data fabricated for a report.

## Review Flow

1. Run `npm run proof:replay`.
2. Inspect proof-package limitations and demo/partial status.
3. Review sampled benchmark cases across `ok`, `blocked`, `gated`, `demoOnly`, and known-bad categories.
4. Inspect safe and blocked showcase traces.
5. Attempt adversarial bypass tasks from `docs/reviewer-worksheet.md`.
6. Record disagreements and suggested benchmark additions.

## Agreement Metrics

Primary agreement compares `reviewerStatus` with `runtimeStatus`. If `runtimeStatus` is blank in a submission, the fallback comparison target is `expectedStatus`. `unsure` responses are counted separately. These metrics are only calculated from provided submissions and are not pilot results unless real review data exists.

## Bypass Metrics

Bypass success rate is the count of adversarial attempts with `bypassSucceeded: true` divided by all recorded adversarial attempts. Empty attempt lists produce a rate of `0`.

## Disagreement Handling

Disagreements should be reviewed as benchmark candidates. A disagreement may mean the reviewer found a policy issue, unclear wording, a missing benchmark case, a domain ambiguity, or a possible expected-label issue requiring future review. Do not change expected labels merely to improve agreement.

## Limitations

This is a pilot workflow. It is not peer review, wet-lab validation, scientific validation, external validation, regulatory approval, safety certification, or evidence of user traction.
