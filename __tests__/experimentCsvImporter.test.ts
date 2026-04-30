/** @jest-environment node */
import {
  mapCsvRowsToExperimentRecords,
  parseExperimentCsvTextToRows,
  type ExperimentCsvColumnMapping,
} from '../src/importers/experimentCsvImporter';

const mapping: ExperimentCsvColumnMapping = {
  recordId: 'record_id',
  batchId: 'batch_id',
  sampleId: 'sample_id',
  constructId: 'construct_id',
  assayType: 'assay_type',
  sourceType: 'source_type',
  measurementUnit: 'measurement_unit',
  instrument: 'instrument',
  operator: 'operator',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  timeHours: 'time_hours',
  value: 'value',
  unit: 'unit',
  replicateId: 'replicate_id',
  qcFlags: 'qc_flags',
  notes: 'notes',
};

function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    record_id: 'er-1',
    batch_id: 'batch-a',
    sample_id: 'sample-a',
    construct_id: 'construct-a',
    assay_type: 'product-titer',
    source_type: 'imported-csv',
    measurement_unit: 'mg/L',
    instrument: 'instrument-a',
    operator: 'operator-a',
    started_at: '2026-04-01T10:00:00.000Z',
    completed_at: '2026-04-01T12:00:00.000Z',
    time_hours: '2',
    value: '42',
    unit: 'mg/L',
    replicate_id: 'rep-a',
    qc_flags: 'passed',
    notes: 'typed import test',
    ...overrides,
  };
}

describe('experiment CSV importer', () => {
  it('parses CSV text with quoted cells into explicit row objects', () => {
    const rows = parseExperimentCsvTextToRows([
      'record_id,batch_id,notes',
      'er-1,batch-a,"contains, comma"',
    ].join('\n'));

    expect(rows).toEqual([{ record_id: 'er-1', batch_id: 'batch-a', notes: 'contains, comma' }]);
  });

  it('converts valid explicitly mapped rows into ExperimentRecordV1 records', () => {
    const result = mapCsvRowsToExperimentRecords([row()], mapping);

    expect(result.rejectedRows).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      schemaVersion: 'experiment-record-v1',
      recordId: 'er-1',
      batchId: 'batch-a',
      sampleId: 'sample-a',
      constructId: 'construct-a',
      assayType: 'product-titer',
      sourceType: 'imported-csv',
      measurementUnit: 'mg/L',
      instrument: 'instrument-a',
      operator: 'operator-a',
    });
    expect(result.records[0].timepoints).toEqual([
      { timeHours: 2, value: 42, unit: 'mg/L', replicateId: 'rep-a', qcFlags: ['passed'] },
    ]);
  });

  it('groups repeated rows with matching record metadata into timepoints', () => {
    const result = mapCsvRowsToExperimentRecords([
      row({ time_hours: '0', value: '0', replicate_id: 'rep-0' }),
      row({ time_hours: '4', value: '80', replicate_id: 'rep-4' }),
    ], mapping);

    expect(result.rejectedRows).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].timepoints.map((timepoint) => timepoint.timeHours)).toEqual([0, 4]);
  });

  it('rejects missing unit, assay metadata, operator, and instrument rows', () => {
    const result = mapCsvRowsToExperimentRecords([
      row({ unit: '' }),
      row({ assay_type: '' }),
      row({ operator: '' }),
      row({ instrument: '' }),
    ], mapping);

    expect(result.records).toEqual([]);
    expect(result.rejectedRows).toHaveLength(4);
    expect(result.rejectedRows.map((rejected) => rejected.rowIndex)).toEqual([0, 1, 2, 3]);
    expect(result.rejectedRows.map((rejected) => rejected.reason).join(' '))
      .toContain('unit');
    expect(result.rejectedRows.map((rejected) => rejected.reason).join(' '))
      .toContain('Unsupported assay type');
    expect(result.rejectedRows.map((rejected) => rejected.reason).join(' '))
      .toContain('operator');
    expect(result.rejectedRows.map((rejected) => rejected.reason).join(' '))
      .toContain('instrument');
  });

  it('does not infer fuzzy columns when explicit mapping columns are missing', () => {
    const result = mapCsvRowsToExperimentRecords([
      {
        record: 'er-1',
        batch: 'batch-a',
        sample: 'sample-a',
        construct: 'construct-a',
        assay: 'product-titer',
        unit_guess: 'mg/L',
        instrument_guess: 'instrument-a',
        operator_guess: 'operator-a',
        started: '2026-04-01T10:00:00.000Z',
        time: '1',
        yield: '50',
      },
    ], mapping);

    expect(result.records).toEqual([]);
    expect(result.rejectedRows).toHaveLength(1);
  });

  it('uses generated record ids only when a generator is supplied', () => {
    const mappingWithoutRecordId: ExperimentCsvColumnMapping = {
      ...mapping,
      recordId: undefined,
    };

    const withoutGenerator = mapCsvRowsToExperimentRecords([row()], mappingWithoutRecordId);
    expect(withoutGenerator.records).toEqual([]);
    expect(withoutGenerator.rejectedRows[0].reason).toContain('Missing record id');

    const withGenerator = mapCsvRowsToExperimentRecords([row()], mappingWithoutRecordId, {
      generateRecordId: (raw, rowIndex) => `${raw.batch_id}:${raw.sample_id}:${rowIndex}`,
    });
    expect(withGenerator.rejectedRows).toEqual([]);
    expect(withGenerator.records[0].recordId).toBe('batch-a:sample-a:0');
  });
});
