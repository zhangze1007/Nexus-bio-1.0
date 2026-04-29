# Claim Surface Policy

Step 5 adds a policy definition layer for where Nexus-Bio outputs are consumed. It does not enforce those policies yet.

## What A Claim Surface Is

A claim surface is the place where an output is consumed or interpreted. The same JSON payload can be harmless as an exploratory workbench view and much stronger as an exported file, recommendation, protocol, or handoff outside the system.

The current trust-runtime vocabulary defines these surfaces:

- `payload`: an in-workbench output shown for exploration and inspection.
- `export`: a downloaded or serialized artifact.
- `recommendation`: a next-step or decision-support claim.
- `protocol`: a protocol-like artifact that can imply operational lab action.
- `external-handoff`: an output passed outside Nexus-Bio or into another formal consumer.

## Why Surfaces Have Different Requirements

Payloads are allowed to be visible even when the tool is demo-tier, because learning-oriented or exploratory views should not disappear. Those outputs still need honest tier labels.

Exports and recommendations are stronger claims. They should usually require at least partial validity and provenance, because they can be reused without the surrounding UI context.

Protocols and external handoffs are the strictest surfaces. Demo outputs should not silently become protocol-like artifacts or external claims. These surfaces declare provenance requirements and human-gate requirements for future enforcement.

## Demo Outputs

Demo outputs may be visible on the `payload` surface. They should not silently become formal claims on `protocol` or `external-handoff` surfaces. The catalog encodes that boundary by allowing demo on payloads while excluding demo from formal claim surfaces.

## Files

- `src/domain/claimSurfacePolicy.ts` defines `ClaimSurfacePolicy` and block codes.
- `src/domain/claimSurfaceReasonCatalog.ts` defines human-readable block-code reasons.
- `src/domain/claimSurfacePolicies.ts` defines one policy per known tool and claim surface plus lookup helpers.

## Preparing Step 7

Future Step 7 runtime enforcement can use this catalog as the single source of truth when deciding whether a tool output may be consumed on a specific surface. That future evaluator can combine the policy with output validity, provenance, draft state, and human review state.

## Not Implemented In Step 5

- No runtime enforcement.
- No `evaluateClaimSurfacePolicy`.
- No benchmark runner or benchmark corpus.
- No provenance middleware.
- No UI disabled states.
- No export blocking.
- No protocol blocking.
- No route, store, or workbench behavior changes.
