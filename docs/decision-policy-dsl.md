# Decision: Policy DSL v1

P3 Step 21 adds a JSON-based Policy DSL v1 for claim-surface gating policy.

## Decision

Use JSON for `policy/trust-policy-v1.json`. The repo has no direct YAML parser dependency in `package.json`, and TypeScript already supports JSON module resolution. Avoiding YAML keeps Step 21 dependency-free.

## Why It Exists

The current runtime policy engine is pure and testable, but reviewers still need to read TypeScript to inspect rule order and block reasons. The DSL moves the critical policy rules into data so they can be validated, executed, and compared against the runtime engine.

This makes the following reviewable without UI or route context:

- validity-tier checks;
- claim-surface checks;
- draft output blocks;
- provenance requirements;
- human-gate requirements;
- default-deny behavior.

## What It Can Express

Policy DSL v1 supports simple conjunctions over fixed fields with a fixed operator set. It can express rules like:

- demo outputs are blocked on `protocol`;
- demo outputs are blocked on `external-handoff`;
- formal surfaces require non-empty provenance IDs;
- pending human gates return `gated`;
- approved real or partial outputs return `ok`;
- unmatched cases fall through to default deny.

## What It Cannot Express

The DSL is deliberately small. It cannot run arbitrary code, call services, query stores, evaluate JavaScript expressions, mutate payloads, inspect React state, fetch external data, or change scientific calculations.

It also does not define open-standard conformance levels, public issue workflows, external reviewer signoff, or standards-body process. Those belong to a later Step 22.

## Runtime Boundary

Production behavior remains unchanged. `evaluateClaimSurfacePolicy` is still the current runtime engine used by existing services and tests. The DSL evaluator is a parity and conformance layer for Step 21.

If DSL/runtime parity ever diverges, the mismatch should be reported directly. The TypeScript runtime, claim-surface policy catalog, and benchmark expected labels should not be changed merely to force parity.

## Status

- `policy/trust-policy-v1.json` contains the first JSON policy document.
- `src/services/policyDslValidator.ts` validates the policy shape.
- `src/services/policyDslEvaluator.ts` executes rules by ascending priority, first match wins.
- `src/services/policyDslParity.ts` compares DSL decisions against `evaluateClaimSurfacePolicy`.
- `npm run policy:dsl:validate` validates the JSON policy and checks benchmark parity.

## Non-Claims

This is not a formal standard, not third-party validated, not scientifically validated, not wet-lab validated, not a safety certification, and not full SBOL compliance. It is a local trust-runtime policy representation for review and testing.
