# Policy DSL v1

## Purpose

Policy DSL v1 makes Nexus-Bio claim-surface policy reviewable as data. It is a small JSON language for expressing gate decisions without reading React components, Zustand stores, API routes, or the current TypeScript policy engine.

The current status is a parity layer. `policy/trust-policy-v1.json` can be validated and executed by the DSL evaluator, but production runtime behavior still comes from `evaluateClaimSurfacePolicy`.

## Document Shape

```json
{
  "schemaVersion": "policy-dsl-v1",
  "policyId": "nexus-trust-policy-v1",
  "description": "Reviewable claim-surface policy.",
  "rules": [],
  "defaultDecision": {
    "effect": "block",
    "blockCode": "MISSING_POLICY",
    "reason": "No rule matched; default deny is applied."
  }
}
```

Rules have:

- `ruleId`: stable unique rule identifier.
- `description`: reviewer-facing rule summary.
- `priority`: integer priority; lower numbers run first.
- `when`: an array of conditions. All conditions must match.
- `effect`: `allow`, `block`, `gate`, or `demoOnly`.
- `blockCode`: required for `block` and `gate` rules.
- `reason`: human-readable decision reason.
- `overridePath`: optional `human-review` or `not-allowed`.

## Conditions

Supported fields:

- `toolId`
- `surface`
- `validityTier`
- `isDraft`
- `provenanceIds`
- `evidenceIds`
- `assumptionIds`
- `requiresHumanGate`
- `humanGateStatus`

Supported operators:

- `equals`
- `notEquals`
- `in`
- `notIn`
- `exists`
- `empty`
- `notEmpty`

The DSL has no arbitrary JavaScript expressions, no `eval`, no function calls, and no dynamic code execution.

## Priority Semantics

Rules are sorted by ascending `priority`. The first matching rule wins. This is intentional because claim-surface policy has ordering-sensitive decisions:

1. Missing policy is denied before any other interpretation.
2. Missing or invalid validity tier is denied before draft, provenance, or human-gate checks.
3. Draft blocks happen before tier blocks when the existing runtime does that.
4. Tier blocks happen before missing provenance.
5. Missing provenance happens before human-gate decisions.
6. Human-gate decisions happen before final allow or demo-only outcomes.

If no rule matches, `defaultDecision` returns a blocked `GateDecision`.

## Examples

Demo output cannot become a protocol:

```json
{
  "field": "validityTier",
  "operator": "equals",
  "value": "demo"
}
```

combined with:

```json
{
  "field": "surface",
  "operator": "equals",
  "value": "protocol"
}
```

Missing provenance blocks formal surfaces:

```json
{
  "field": "provenanceIds",
  "operator": "empty"
}
```

Human review gates until approved:

```json
{
  "field": "humanGateStatus",
  "operator": "notEquals",
  "value": "approved"
}
```

## Relationship To TypeScript Runtime

Policy DSL v1 mirrors the current critical behavior of `evaluateClaimSurfacePolicy`:

- missing policy returns `MISSING_POLICY`;
- demo protocol returns `DEMO_OUTPUT_PROTOCOL_BLOCKED`;
- demo external handoff returns `EXTERNAL_HANDOFF_BLOCKED`;
- draft export/protocol returns `DRAFT_OUTPUT_NOT_EXPORTABLE`;
- missing provenance returns `PROVENANCE_REQUIRED`;
- pending human review returns `HUMAN_GATE_REQUIRED`;
- allowed real or partial outputs return `ok`;
- allowed demo payloads return `demoOnly`.

The DSL evaluator does not replace the production runtime yet. It exists for reviewability, conformance tests, and benchmark parity checks.

## Non-Claims

Policy DSL v1 is not a formal open standard, not third-party validated, not scientifically validated, not wet-lab validated, not a safety certification, and not full SBOL compliance. It is an internal machine-checkable policy representation for the Nexus-Bio trust runtime.
