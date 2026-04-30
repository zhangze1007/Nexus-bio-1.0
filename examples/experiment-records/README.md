# ExperimentRecordV1 Examples

These examples demonstrate typed assay-record validation. They are fictional examples and are not wet-lab validation evidence.

- `valid-wet-lab-like.json`: complete metadata with `sourceType: "wet-lab"`, using fictional batch/sample/operator/instrument identifiers.
- `valid-simulated-assay.json`: complete metadata for a simulated assay.
- `rejected-unitless.json`: invalid because record and timepoint units are missing.
- `rejected-missing-timepoints.json`: invalid because no timepoints are present.

CSV import should map rows into this shape before DBTL feedback can consume measurements. Missing unit, instrument, operator, sample, construct, assay type, or timepoint metadata must be rejected.
