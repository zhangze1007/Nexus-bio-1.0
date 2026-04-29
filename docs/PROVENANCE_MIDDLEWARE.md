# Provenance Middleware

P1 Step 8A adds a small provenance middleware layer for tool payload writes. P1 Step 8B extends that coverage and adds local chain diagnostics. The goal is to make provenance capture more consistent without changing scientific algorithms, product behavior, or export/protocol enforcement.

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

## Step 8B Coverage

Step 8B extends central provenance stamping to:

- `catdes`

Together with Step 8A and existing explicit tool payload provenance, the covered key paths are:

- `pathd` through central payload admission metadata
- `dyncon` through central payload admission metadata
- `dbtlflow` through central payload admission metadata
- `catdes` through central payload admission metadata
- `fbasim` through its existing FBA run provenance payload
- `cellfree` through its existing cell-free run provenance payload

Existing `cethx` and `multio` payload paths also write explicit `runProvenance` snapshots. Step 8B does not re-wrap those tool pages because their payload builders already attach workflow-specific provenance.

Duplicate entries are avoided by checking for an existing `runProvenance` field before central stamping. Payloads with existing provenance are preserved as-is, including older explicit snapshots.

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
- `getProvenanceChainDiagnostics(payload)`

These inspect only provenance available inside the payload. They do not query persisted workbench state, a server database, or a global graph.

`getProvenanceChainDiagnostics()` returns the local provenance IDs, chain length, missing upstream provenance IDs, and a boolean indicating whether any upstream references are missing locally. Missing upstream means an ID is referenced by a local provenance entry but is not present in the same payload's local `runProvenance` chain.

The existing workbench decision trace panel now displays a minimal diagnostic row for run artifacts: provenance present/missing, local chain length, and missing upstream count when applicable. This is informational only and does not gate workflow behavior.

## What The Diagnostics Do Not Prove

The diagnostics do not prove wet-lab validity, scientific validation, external source verification, or full provenance completeness. They are local payload integrity checks only.

## Step 8C Direction

Step 8C should broaden coverage beyond the current key paths, enrich evidence/provenance panel visibility where useful, and later connect provenance snapshots to export/protocol gating. Homepage UI/UX should remain locked.
