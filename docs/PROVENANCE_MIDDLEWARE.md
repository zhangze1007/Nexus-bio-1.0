# Provenance Middleware

P1 Step 8A adds a small provenance middleware layer for tool payload writes. The goal is to make provenance capture consistent without changing scientific algorithms, UI behavior, or export/protocol enforcement.

## What It Does

`withProvenance()` and `withProvenanceSync()` wrap a payload-producing function and return:

- the runner output payload
- a protocol-level `ProvenanceEntry`

The middleware records:

- tool id
- activity type
- optional claim surface
- optional actor
- started and completed timestamps
- input assumption ids
- output assumption ids
- evidence ids supplied by the caller
- upstream provenance ids supplied by the caller

It also attaches a workbench-compatible `runProvenance` snapshot to object payloads so existing runtime gating can continue reading the current payload-bus shape.

## Evidence IDs

The middleware does not invent evidence IDs. If the caller supplies no evidence IDs, the provenance entry records an empty evidence list. When IDs are supplied, they are carried through as existing references.

## PROV-DM Relationship

The protocol-level `ProvenanceEntry` corresponds to a bounded PROV activity. Tool payloads remain workflow entities, and upstream provenance references model derivation. This matches the direction in `spec/prov-dm-mapping.md` without introducing a global provenance graph database yet.

## Initial Integrations

Step 8A integrates provenance capture through the central workbench payload writer for:

- `pathd`
- `dyncon`
- `dbtlflow`

Only payloads that lack `runProvenance` are stamped. Existing provenance snapshots are preserved.

## What It Does Not Do Yet

- No Evidence panel redesign
- No homepage UI changes
- No export, protocol, or external-handoff enforcement
- No global provenance graph database
- No automatic evidence verification
- No wet-lab validation claim
- No scientific algorithm changes

## Local Chain Utilities

The middleware also exposes local inspection helpers:

- `collectProvenanceIds(payload)`
- `getProvenanceChainLength(payload)`
- `findMissingUpstreamProvenance(payload)`

These inspect only provenance available inside the payload. They do not query persisted workbench state, a server database, or a global graph.

## Step 8B Direction

Step 8B should extend coverage to at least six key tools total, add safe Evidence panel chain-length and missing-upstream display if appropriate, and later connect provenance snapshots to export/protocol gating. Homepage UI/UX should remain locked.
