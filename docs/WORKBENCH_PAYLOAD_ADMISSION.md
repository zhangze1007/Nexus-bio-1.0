# Workbench Payload Admission

P1 Step 7B connects the pure trust policy engine to the central workbench payload write path in observe mode.

Payload admission is the runtime adapter that turns a canonical tool payload write into a claim-surface decision for the `payload` surface. It calls `evaluateClaimSurfacePolicy()` with the tool id, inferred validity tier, draft flag, and any existing provenance, evidence, assumption, or human-gate metadata already present on the payload.

## Observe Mode

The product path currently uses observe mode.

In observe mode, payload writes are not blocked by the claim-surface engine. The adapter still records the returned `GateDecision`, but existing workbench behavior remains governed by the pre-existing workflow contract and runtime gating code.

This lets Nexus-Bio collect one canonical trust decision for payload admission without silently changing tool flows.

## Enforce Mode

The adapter also defines enforce mode for future Step 7 work.

In enforce mode, payload writes are allowed only when the decision status is `ok` or `demoOnly`. Decisions with `blocked` or `gated` status return `shouldWritePayload: false`. Step 7B does not enable enforce mode in product code.

## Recorded Decision

The latest payload admission decision is recorded in workbench canonical state:

```ts
payloadAdmissionDecisionsByToolId: Record<string, GateDecision>
```

Persisted workbench state remains backward-compatible. Older state snapshots that do not contain this field sanitize and hydrate with an empty record.

## Product Behavior Boundary

Step 7B intentionally does not add:

- UI disabled states
- route guards
- export blocking
- protocol blocking
- recommendation blocking
- external handoff blocking
- provenance middleware
- replacement of existing workflow contract or runtime gating logic

## Step 7C Direction

Step 7C should deliberately decide where enforcement begins. That later work should display or consume `GateDecision` objects directly, consolidate older scattered gating rules, and wire export, protocol, recommendation, and external-handoff surfaces without changing homepage UI/UX.
