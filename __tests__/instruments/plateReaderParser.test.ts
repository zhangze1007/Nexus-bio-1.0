/**
 * Plate Reader Parser Tests
 *
 * Tests for BMG, Tecan, and Molecular Devices CSV/XML parsers.
 * Each test uses realistic sample data representing actual instrument exports.
 */

import {
  parsePlateReaderData,
  parseBmgCsv,
  parseTecanCsv,
  parseMolecularDevicesCsv,
  parsePlateReaderXml,
  parseNumeric,
  normalizeWellId,
} from '../../src/services/instruments/plateReaderParser';

// ─── Sample Data ─────────────────────────────────────────────────

/** Minimal BMG CLARIOstar 96-well absorbance export. */
const BMG_CSV_96 = [
  'Instrument:\tCLARIOstar',
  'Date:\t2025-03-15 14:30:00',
  'Plate Format:\t96',
  'Measurement:\tAbsorbance 450 nm',
  '',
  '\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\t12',
  'A\t0.123\t0.456\t0.789\t0.012\t0.345\t0.678\t0.901\t0.234\t0.567\t0.890\t0.111\t0.222',
  'B\t0.111\t0.222\t0.333\t0.444\t0.555\t0.666\t0.777\t0.888\t0.999\t0.100\t0.200\t0.300',
  'C\t0.100\t0.200\t0.300\t0.400\t0.500\t0.600\t0.700\t0.800\t0.900\t1.000\t1.100\t1.200',
  'D\t0.050\t0.150\t0.250\t0.350\t0.450\t0.550\t0.650\t0.750\t0.850\t0.950\t1.050\t1.150',
  'E\t0.001\t0.002\t0.003\t0.004\t0.005\t0.006\t0.007\t0.008\t0.009\t0.010\t0.011\t0.012',
  'F\t0.999\t0.888\t0.777\t0.666\t0.555\t0.444\t0.333\t0.222\t0.111\t0.000\t0.001\t0.002',
  'G\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500\t0.500',
  'H\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000\t0.000',
].join('\n');

/** BMG 384-well plate with fluorescence units. */
const BMG_CSV_384 = [
  'Instrument:\tPHERAstar',
  'Date:\t2025-06-01 09:00:00',
  'Measurement:\tFluorescence (RFU)',
  '',
  '\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\t12\t13\t14\t15\t16\t17\t18\t19\t20\t21\t22\t23\t24',
  'A\t100\t200\t300\t400\t500\t600\t700\t800\t900\t1000\t1100\t1200\t1300\t1400\t1500\t1600\t1700\t1800\t1900\t2000\t2100\t2200\t2300\t2400',
  'B\t2400\t2300\t2200\t2100\t2000\t1900\t1800\t1700\t1600\t1500\t1400\t1300\t1200\t1100\t1000\t900\t800\t700\t600\t500\t400\t300\t200\t100',
  'C\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500\t500',
  'D\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0',
  'E\t123\t456\t789\t012\t345\t678\t901\t234\t567\t890\t111\t222\t333\t444\t555\t666\t777\t888\t999\t100\t200\t300\t400\t500',
  'F\t500\t400\t300\t200\t100\t999\t888\t777\t666\t555\t444\t333\t222\t111\t890\t567\t234\t901\t678\t345\t012\t789\t456\t123',
  'G\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250\t250',
  'H\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000\t1000',
  'I\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750\t750',
  'J\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625\t625',
  'K\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375\t375',
  'L\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875\t875',
  'M\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125\t125',
  'N\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937\t937',
  'O\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62\t62',
  'P\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468\t468',
].join('\n');

/** Tecan columnar format export. */
const TECAN_COLUMNAR = [
  'Date: 2025-04-20',
  'Instrument: Infinite M200',
  '',
  'Well,OD 600nm',
  'A1,0.123',
  'A2,0.456',
  'A3,0.789',
  'B1,0.100',
  'B2,0.200',
  'B3,0.300',
  'C1,0.500',
  'C2,0.500',
  'C3,0.500',
  'H12,0.001',
].join('\n');

/** Tecan grid format export. */
const TECAN_GRID = [
  'Date: 2025-04-20',
  'Instrument: Safire2',
  'Description: Absorbance measurement',
  '',
  'Well\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\t12',
  'A\t0.1\t0.2\t0.3\t0.4\t0.5\t0.6\t0.7\t0.8\t0.9\t1.0\t1.1\t1.2',
  'B\t1.2\t1.1\t1.0\t0.9\t0.8\t0.7\t0.6\t0.5\t0.4\t0.3\t0.2\t0.1',
  'C\t0.5\t0.5\t0.5\t0.5\t0.5\t0.5\t0.5\t0.5\t0.5\t0.5\t0.5\t0.5',
  'D\t0.0\t0.0\t0.0\t0.0\t0.0\t0.0\t0.0\t0.0\t0.0\t0.0\t0.0\t0.0',
  'E\t0.3\t0.6\t0.9\t1.2\t1.5\t1.8\t2.1\t2.4\t2.7\t3.0\t3.3\t3.6',
  'F\t3.6\t3.3\t3.0\t2.7\t2.4\t2.1\t1.8\t1.5\t1.2\t0.9\t0.6\t0.3',
  'G\t0.25\t0.25\t0.25\t0.25\t0.25\t0.25\t0.25\t0.25\t0.25\t0.25\t0.25\t0.25',
  'H\t0.75\t0.75\t0.75\t0.75\t0.75\t0.75\t0.75\t0.75\t0.75\t0.75\t0.75\t0.75',
].join('\n');

/** Molecular Devices section-based format. */
const MD_CSV = [
  '[Plate]',
  'Plate ID=MyPlate_2025',
  'Format=96',
  'Instrument=SpectraMax i3x',
  '[Settings]',
  'Wavelength=450',
  'Temperature=37',
  'User=lab_tech_01',
  '[Results]',
  'Well\tValue (OD)',
  'A1\t0.123',
  'A2\t0.456',
  'A3\t0.789',
  'A4\t0.012',
  'B1\t0.100',
  'B2\t0.200',
  'B3\t0.300',
  'B4\t0.400',
  'C1\t0.500',
  'C2\t0.500',
  'C3\t0.500',
  'C4\t0.500',
].join('\n');

/** Molecular Devices XML format. */
const MD_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<PlateData>',
  '  <Plate>96</Plate>',
  '  <Instrument>SpectraMax i3x</Instrument>',
  '  <Date>2025-05-10</Date>',
  '  <Wavelength>450</Wavelength>',
  '  <Unit>OD</Unit>',
  '  <Wells>',
  '    <Well id="A1"><Value>0.123</Value></Well>',
  '    <Well id="A2"><Value>0.456</Value></Well>',
  '    <Well id="A3"><Value>0.789</Value></Well>',
  '    <Well id="B1"><Value>0.100</Value></Well>',
  '    <Well id="B2"><Value>0.200</Value></Well>',
  '    <Well id="B3"><Value>0.300</Value></Well>',
  '    <Well id="H12"><Value>0.001</Value></Well>',
  '  </Wells>',
  '</PlateData>',
].join('\n');

/** CSV with special values that should become NaN. */
const BMG_WITH_SPECIAL_VALUES = [
  'Instrument:\tCLARIOstar',
  'Measurement:\tAbsorbance (OD)',
  '',
  '\t1\t2\t3\t4',
  'A\t0.500\t---\tOVRFLW\t0.100',
  'B\tN/A\t-\t0.300\t0.400',
  'C\t1,234.567\t0.800\t0.900\t1.000',
  'D\t0.000\t0.001\t0.002\t0.003',
].join('\n');

/** Minimal CSV with just a grid (no metadata). */
const MINIMAL_GRID = [
  'Well\t1\t2\t3',
  'A\t1.0\t2.0\t3.0',
  'B\t4.0\t5.0\t6.0',
].join('\n');

// ─── Tests ───────────────────────────────────────────────────────

describe('parseNumeric', () => {
  it('parses standard decimal numbers', () => {
    expect(parseNumeric('0.123')).toBe(0.123);
    expect(parseNumeric('1.0')).toBe(1.0);
    expect(parseNumeric('42')).toBe(42);
  });

  it('parses scientific notation', () => {
    expect(parseNumeric('1.5e3')).toBe(1500);
    expect(parseNumeric('2.5E-4')).toBe(0.00025);
  });

  it('handles thousands separators', () => {
    expect(parseNumeric('1,234.567')).toBe(1234.567);
    expect(parseNumeric('12,345.00')).toBe(12345);
  });

  it('returns NaN for special plate reader flags', () => {
    expect(parseNumeric('---')).toBeNaN();
    expect(parseNumeric('OVRFLW')).toBeNaN();
    expect(parseNumeric('N/A')).toBeNaN();
    expect(parseNumeric('-')).toBeNaN();
    expect(parseNumeric('')).toBeNaN();
  });

  it('trims whitespace', () => {
    expect(parseNumeric('  0.500  ')).toBe(0.5);
  });
});

describe('normalizeWellId', () => {
  it('normalizes lowercase to uppercase', () => {
    expect(normalizeWellId('a1')).toBe('A01');
    expect(normalizeWellId('b12')).toBe('B12');
  });

  it('zero-pads single digit columns', () => {
    expect(normalizeWellId('A1')).toBe('A01');
    expect(normalizeWellId('H9')).toBe('H09');
  });

  it('preserves double digit columns', () => {
    expect(normalizeWellId('A10')).toBe('A10');
    expect(normalizeWellId('P24')).toBe('P24');
  });

  it('returns null for invalid well IDs', () => {
    expect(normalizeWellId('Z1')).toBeNull();
    expect(normalizeWellId('A0')).toBeNull();
    expect(normalizeWellId('A25')).toBeNull();
    expect(normalizeWellId('')).toBeNull();
    expect(normalizeWellId('1A')).toBeNull();
  });
});

describe('parseBmgCsv', () => {
  it('parses a 96-well BMG CSV with metadata', () => {
    const result = parseBmgCsv(BMG_CSV_96);
    expect(result.plateFormat).toBe(96);
    expect(result.metadata['Instrument']).toBe('CLARIOstar');
    expect(result.metadata['Date']).toBe('2025-03-15 14:30:00');
    expect(result.metadata['Measurement']).toBe('Absorbance 450 nm');
  });

  it('extracts well values from BMG 96-well grid', () => {
    const result = parseBmgCsv(BMG_CSV_96);
    expect(result.wells['A01']).toEqual({ value: 0.123, unit: 'nm' });
    expect(result.wells['A02']).toEqual({ value: 0.456, unit: 'nm' });
    expect(result.wells['H12']).toEqual({ value: 0.0, unit: 'nm' });
    expect(Object.keys(result.wells).length).toBe(96);
  });

  it('detects 384-well plate format', () => {
    const result = parseBmgCsv(BMG_CSV_384);
    expect(result.plateFormat).toBe(384);
    expect(Object.keys(result.wells).length).toBe(384);
    expect(result.wells['P24']).toBeDefined();
  });

  it('detects unit from metadata', () => {
    const result = parseBmgCsv(BMG_CSV_384);
    expect(result.wells['A01'].unit).toBe('RFU');
  });
});

describe('parseTecanCsv', () => {
  it('parses Tecan columnar format', () => {
    const result = parseTecanCsv(TECAN_COLUMNAR);
    expect(result.metadata['Date']).toBe('2025-04-20');
    expect(result.metadata['Instrument']).toBe('Infinite M200');
    expect(result.wells['A01']).toEqual({ value: 0.123, unit: 'OD' });
    expect(result.wells['A02']).toEqual({ value: 0.456, unit: 'OD' });
    expect(result.wells['H12']).toEqual({ value: 0.001, unit: 'OD' });
  });

  it('parses Tecan grid format', () => {
    const result = parseTecanCsv(TECAN_GRID);
    expect(result.plateFormat).toBe(96);
    expect(result.wells['A01']).toEqual({ value: 0.1, unit: '' });
    expect(result.wells['B06']).toEqual({ value: 0.7, unit: '' });
    expect(Object.keys(result.wells).length).toBe(96);
  });
});

describe('parseMolecularDevicesCsv', () => {
  it('parses section-based Molecular Devices format', () => {
    const result = parseMolecularDevicesCsv(MD_CSV);
    expect(result.metadata['Plate ID']).toBe('MyPlate_2025');
    expect(result.metadata['Instrument']).toBe('SpectraMax i3x');
    expect(result.metadata['Wavelength']).toBe('450');
    expect(result.metadata['User']).toBe('lab_tech_01');
  });

  it('extracts well values from Molecular Devices results section', () => {
    const result = parseMolecularDevicesCsv(MD_CSV);
    expect(result.wells['A01']).toEqual({ value: 0.123, unit: 'OD' });
    expect(result.wells['A02']).toEqual({ value: 0.456, unit: 'OD' });
    expect(result.wells['C04']).toEqual({ value: 0.5, unit: 'OD' });
  });
});

describe('parsePlateReaderXml', () => {
  it('parses Molecular Devices XML format', () => {
    const result = parsePlateReaderXml(MD_XML);
    expect(result.plateFormat).toBe(96);
    expect(result.metadata['Instrument']).toBe('SpectraMax i3x');
    expect(result.metadata['Date']).toBe('2025-05-10');
    expect(result.metadata['Wavelength']).toBe('450');
  });

  it('extracts well values from XML', () => {
    const result = parsePlateReaderXml(MD_XML);
    expect(result.wells['A01']).toEqual({ value: 0.123, unit: 'OD' });
    expect(result.wells['A02']).toEqual({ value: 0.456, unit: 'OD' });
    expect(result.wells['B03']).toEqual({ value: 0.3, unit: 'OD' });
    expect(result.wells['H12']).toEqual({ value: 0.001, unit: 'OD' });
  });

  it('detects 384 from XML plate tag', () => {
    const xml384 = MD_XML.replace('<Plate>96</Plate>', '<Plate>384</Plate>');
    const result = parsePlateReaderXml(xml384);
    expect(result.plateFormat).toBe(384);
  });
});

describe('parsePlateReaderData (auto-detect)', () => {
  it('auto-detects BMG format', () => {
    const result = parsePlateReaderData(BMG_CSV_96);
    expect(result.plateFormat).toBe(96);
    expect(Object.keys(result.wells).length).toBe(96);
  });

  it('auto-detects Tecan columnar format', () => {
    const result = parsePlateReaderData(TECAN_COLUMNAR);
    expect(result.wells['A01']).toBeDefined();
    expect(result.wells['H12']).toBeDefined();
  });

  it('auto-detects Molecular Devices format', () => {
    const result = parsePlateReaderData(MD_CSV);
    expect(result.metadata['Instrument']).toBe('SpectraMax i3x');
  });

  it('auto-detects XML format', () => {
    const result = parsePlateReaderData(MD_XML);
    expect(result.plateFormat).toBe(96);
    expect(result.wells['A01']).toEqual({ value: 0.123, unit: 'OD' });
  });

  it('handles vendor override', () => {
    const result = parsePlateReaderData(BMG_CSV_96, 'bmg');
    expect(result.plateFormat).toBe(96);
  });
});

describe('special values and edge cases', () => {
  it('handles special plate reader flag values as NaN', () => {
    const result = parseBmgCsv(BMG_WITH_SPECIAL_VALUES);
    expect(result.wells['A01']).toEqual({ value: 0.5, unit: 'OD' });
    expect(result.wells['A02'].value).toBeNaN();
    expect(result.wells['A03'].value).toBeNaN(); // OVRFLW
    expect(result.wells['B01'].value).toBeNaN(); // N/A
    expect(result.wells['B02'].value).toBeNaN(); // -
  });

  it('handles thousands separators in values', () => {
    const result = parseBmgCsv(BMG_WITH_SPECIAL_VALUES);
    expect(result.wells['C01']).toEqual({ value: 1234.567, unit: 'OD' });
  });

  it('parses minimal grid with no metadata', () => {
    const result = parsePlateReaderData(MINIMAL_GRID);
    expect(result.plateFormat).toBe(96);
    expect(result.wells['A01']).toEqual({ value: 1.0, unit: '' });
    expect(result.wells['B03']).toEqual({ value: 6.0, unit: '' });
  });
});
