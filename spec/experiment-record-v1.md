# ExperimentRecordV1

`ExperimentRecordV1` defines the minimum typed record for wet-lab-like, simulated, historical, manual, or imported assay results in Nexus-Bio.

The schema exists so DBTL learning does not depend on arbitrary CSV column names, unit-less values, or metadata-less rows. It does not prove wet-lab validation. It only makes assay records traceable and checkable before they influence feedback.

## Required Fields

| Field | Meaning |
|---|---|
| `schemaVersion` | Must be `experiment-record-v1`. |
| `recordId` | Stable record identifier. |
| `batchId` | Batch or run grouping. |
| `sampleId` | Measured sample identifier. |
| `constructId` | Construct, strain, or design identifier. |
| `assayType` | One supported assay type. |
| `sourceType` | How the record entered Nexus-Bio. |
| `measurementUnit` | Canonical unit for the record. |
| `instrument` | Instrument, method, or source system name. |
| `operator` | Source actor or responsible operator identifier. |
| `startedAt` | ISO-like date string for assay start. |
| `timepoints` | One or more values with time, value, and unit. |
| `qcFlags` | Record-level QC flags. |

Optional fields are `completedAt`, `sourceFileId`, `provenanceIds`, `notes`, and timepoint-level `qcFlags` / `replicateId`.

## Assay Types

- `fluorescence`
- `absorbance`
- `product-titer`
- `growth-rate`
- `protein-expression`
- `cell-free-expression`
- `enzyme-activity`
- `stability`
- `other`

## Source Types

- `wet-lab`
- `simulated-assay`
- `historical-dataset`
- `manual-entry`
- `imported-csv`

## QC Flags

- `passed`: record is usable under the current metadata checks.
- `missing-unit`: unit metadata is missing.
- `missing-timepoint`: timepoint data is missing.
- `instrument-missing`: instrument or method metadata is missing.
- `operator-missing`: source actor metadata is missing.
- `outlier`: value needs outlier review.
- `failed-control`: assay control failed.
- `manual-review-required`: record should be gated for human review.

## CSV Mapping Requirements

CSV import requires explicit column mapping. Nexus-Bio must not guess scientific meaning from fuzzy column names. The DBTL upload path expects rows that can map to batch, sample, construct, assay type, measurement unit, instrument, operator, started time, timepoint hour, value, and unit.

Rows missing unit, assay type, sample/construct context, instrument, operator, or timepoint values are rejected before they can influence DBTL feedback.

## Valid Wet-Lab-Like Example

See `examples/experiment-records/valid-wet-lab-like.json`. The identifiers are fictional examples and are not evidence of real validation.

## Valid Simulated Assay Example

See `examples/experiment-records/valid-simulated-assay.json`. The source type is explicitly `simulated-assay`.

## Rejected Examples

- `examples/experiment-records/rejected-unitless.json`: missing measurement unit and timepoint unit.
- `examples/experiment-records/rejected-missing-timepoints.json`: no timepoints.

## Boundary

`ExperimentRecordV1` does not claim:

- wet-lab validation;
- scientific validation;
- calibrated assay performance;
- real operator or instrument provenance unless provided by the user/source;
- automatic DBTL parameter updates.

Step 14 will decide how typed experiment records become learned deltas. Step 13 only creates typed records, validation, import mapping, examples, and source references.
