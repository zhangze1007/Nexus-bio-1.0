# LearnedDeltaPack V1

`LearnedDeltaPack` is the typed DBTL loop-back record for Nexus-Bio. It separates DBTL feedback text, experiment records, and seed-changing deltas so upstream tools cannot be rewritten from ambiguous prose or unreviewed assay data.

## Required Fields

| Field | Meaning |
|---|---|
| `schemaVersion` | Must be `learned-delta-pack-v1`. |
| `deltaPackId` | Stable identifier for this delta pack. |
| `iteration` | DBTL iteration number that produced the pack. |
| `sourceDbtlRunId` | Source DBTL run or committed iteration id. |
| `sourceExperimentRecordIds` | One or more supporting `ExperimentRecordV1.recordId` values. |
| `sourceProvenanceIds` | Provenance entries for source runs or imports; empty is allowed but warned. |
| `targetToolIds` | Tools the pack may affect after approval. |
| `changedBounds` | Explicit before/after bound deltas keyed by target field. |
| `changedPriors` | Explicit before/after numeric prior deltas keyed by target field. |
| `changedWeights` | Explicit before/after numeric weight deltas keyed by target field. |
| `learnedMetrics` | Typed DBTL metrics supporting interpretation. |
| `classification` | One of `restorative`, `conservative`, `exploratory`, or `aggressive`. |
| `humanGateStatus` | One of `pending`, `approved`, or `rejected`. |
| `createdAt` | Date string for pack creation. |

Optional fields are `createdBy` and `notes`.

## Approval Model

Only `humanGateStatus: "approved"` packs may be applied to seed builders. `pending` packs are typed records waiting for review. `rejected` packs are historical records and must not apply.

The validator accepts pending and rejected packs as valid records, but the application helper refuses to apply them.

## Relationship To Other Records

`DBTLLearnedFeedback` stores typed metrics and legacy audit text. It is not by itself an instruction to change upstream seeds.

`ExperimentRecordV1` stores typed assay observations. A learned delta must reference one or more experiment record ids instead of inventing source rows.

`LearnedDeltaPack` stores the explicit before/after changes that may affect seed builders after review. Natural-language notes are never the source of truth for numeric changes.

## Boundary

`LearnedDeltaPack` does not claim:

- wet-lab validation;
- scientific validation;
- automatic correctness of a parameter change;
- approval by default;
- real assay provenance unless supplied by the source record;
- Step 15 falsification or blocked-propagation display.

Step 15 may add a falsification dashboard. This spec only defines the typed loop-back boundary.
