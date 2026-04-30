# Versioning Policy

Status: draft policy

This policy defines versioning expectations for SITR, Policy DSL, benchmark corpus, and conformance reports. It does not claim official standardization, external adoption, third-party validation, scientific validation, wet-lab validation, or full SBOL compliance.

## SITR Draft Versioning

SITR drafts use explicit names such as `SITR Draft v1`. A new draft version is required when legal value sets, required object semantics, gate statuses, claim surfaces, or conformance levels change.

Draft versions may break compatibility, but breaking changes must include migration notes and non-claim review.

## Policy DSL Versioning

Policy DSL versions use schema IDs such as `policy-dsl-v1`. A new version is required when condition fields, operators, effect semantics, priority semantics, or default-decision behavior changes.

Policy documents must declare their schema version and policy ID.

## Benchmark Corpus Versioning

Benchmark corpus versions should be tied to a stable schema, case set, and expected-label file. Expected-label changes require explicit justification and should not be bundled with unrelated docs changes.

Reports should record corpus hash or version when available.

## Conformance Report Versioning

Conformance reports should declare:

- report schema version;
- SITR version;
- Policy DSL version;
- benchmark corpus version;
- implementation name and language;
- conformance level claimed;
- limitations and unsupported features.

## Backwards Compatibility

Stable versions should preserve:

- `ValidityTier` values: `real`, `partial`, `demo`;
- `ClaimSurface` values: `payload`, `export`, `recommendation`, `protocol`, `external-handoff`;
- `GateStatus` values: `ok`, `blocked`, `gated`, `demoOnly`;
- meaning of blocked, gated, and demo-only decisions;
- provenance and evidence traceability.

Breaking changes require a major draft or schema version update.

## Deprecation Rules

Deprecations must:

- name the deprecated field, rule, or object;
- explain the replacement;
- state the compatibility period;
- update tests and conformance docs;
- avoid silently upgrading existing claims.

## Changelog Requirements

Every protocol or policy release should include:

- summary of changed objects or rules;
- compatibility impact;
- migration notes;
- benchmark impact;
- conformance impact;
- non-claims and limitations.
