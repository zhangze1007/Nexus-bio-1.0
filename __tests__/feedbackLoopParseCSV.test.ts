/** @jest-environment node */

import { parseCSVData } from '../src/utils/feedback-loop';

describe('parseCSVData', () => {
  it('returns empty array for non-string input', () => {
    expect(parseCSVData(null as any)).toEqual([]);
    expect(parseCSVData(undefined as any)).toEqual([]);
    expect(parseCSVData(42 as any)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCSVData('')).toEqual([]);
    expect(parseCSVData('   ')).toEqual([]);
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCSVData('yield_mg_l,biomass_od600\n')).toEqual([]);
  });

  it('throws when yield column is missing', () => {
    expect(() => parseCSVData('biomass_od600,substrate\n1.0,2.0')).toThrow('missing a yield column');
  });

  it('parses basic CSV with yield column', () => {
    const csv = 'yield_mg_l\n100\n200\n300';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0].yield_mg_L).toBe(100);
    expect(rows[1].yield_mg_L).toBe(200);
    expect(rows[2].yield_mg_L).toBe(300);
  });

  it('parses CSV with all columns', () => {
    const csv = 'sample_id,strain,condition,yield_mg_l,biomass_od600,substrate_consumed_mm,timestamp\nS1,EColi,glucose,150,0.8,5.5,2024-01-01';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].sample_id).toBe('S1');
    expect(rows[0].strain).toBe('EColi');
    expect(rows[0].condition).toBe('glucose');
    expect(rows[0].yield_mg_L).toBe(150);
    expect(rows[0].biomass_OD600).toBe(0.8);
    expect(rows[0].substrate_consumed_mM).toBe(5.5);
    expect(rows[0].timestamp).toBe('2024-01-01');
  });

  it('handles quoted fields with commas', () => {
    const csv = 'yield_mg_l,strain\n"100","E. coli, K12"';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].strain).toBe('E. coli, K12');
  });

  it('handles escaped quotes in fields', () => {
    const csv = 'yield_mg_l,strain\n100,"strain ""special"""';
    const rows = parseCSVData(csv);
    expect(rows[0].strain).toBe('strain "special"');
  });

  it('strips UTF-8 BOM', () => {
    const csv = '﻿yield_mg_l\n100';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].yield_mg_L).toBe(100);
  });

  it('handles CRLF line endings', () => {
    const csv = 'yield_mg_l\r\n100\r\n200';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('handles CR line endings', () => {
    const csv = 'yield_mg_l\r100\r200';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('skips rows with missing yield', () => {
    const csv = 'yield_mg_l\n100\n\n200\n';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('treats NaN yield as missing', () => {
    const csv = 'yield_mg_l\n100\nNaN\n200';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('treats NA yield as missing', () => {
    const csv = 'yield_mg_l\n100\nNA\n200';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('treats na (lowercase) yield as missing', () => {
    const csv = 'yield_mg_l\n100\nna\n200';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('treats non-numeric yield as missing', () => {
    const csv = 'yield_mg_l\n100\nabc\n200';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('treats Infinity as missing', () => {
    const csv = 'yield_mg_l\n100\nInfinity\n200';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('uses default sample_id when column missing', () => {
    const csv = 'yield_mg_l\n100\n200';
    const rows = parseCSVData(csv);
    expect(rows[0].sample_id).toBe('S1');
    expect(rows[1].sample_id).toBe('S2');
  });

  it('uses default strain when column missing', () => {
    const csv = 'yield_mg_l\n100';
    const rows = parseCSVData(csv);
    expect(rows[0].strain).toBe('unknown');
  });

  it('uses default condition when column missing', () => {
    const csv = 'yield_mg_l\n100';
    const rows = parseCSVData(csv);
    expect(rows[0].condition).toBe('default');
  });

  it('defaults biomass to 0 when column missing', () => {
    const csv = 'yield_mg_l\n100';
    const rows = parseCSVData(csv);
    expect(rows[0].biomass_OD600).toBe(0);
  });

  it('defaults substrate to 0 when column missing', () => {
    const csv = 'yield_mg_l\n100';
    const rows = parseCSVData(csv);
    expect(rows[0].substrate_consumed_mM).toBe(0);
  });

  it('treats NaN biomass as 0', () => {
    const csv = 'yield_mg_l,biomass_od600\n100,NaN';
    const rows = parseCSVData(csv);
    expect(rows[0].biomass_OD600).toBe(0);
  });

  it('treats NaN substrate as 0', () => {
    const csv = 'yield_mg_l,substrate_consumed_mm\n100,NaN';
    const rows = parseCSVData(csv);
    expect(rows[0].substrate_consumed_mM).toBe(0);
  });

  it('accepts "yield" as column alias', () => {
    const csv = 'yield\n100';
    const rows = parseCSVData(csv);
    expect(rows[0].yield_mg_L).toBe(100);
  });

  it('accepts "titer_mg_l" as column alias', () => {
    const csv = 'titer_mg_l\n100';
    const rows = parseCSVData(csv);
    expect(rows[0].yield_mg_L).toBe(100);
  });

  it('accepts "titer" as column alias', () => {
    const csv = 'titer\n100';
    const rows = parseCSVData(csv);
    expect(rows[0].yield_mg_L).toBe(100);
  });

  it('accepts "biomass" as column alias', () => {
    const csv = 'yield_mg_l,biomass\n100,0.5';
    const rows = parseCSVData(csv);
    expect(rows[0].biomass_OD600).toBe(0.5);
  });

  it('accepts "od600" as column alias', () => {
    const csv = 'yield_mg_l,od600\n100,0.5';
    const rows = parseCSVData(csv);
    expect(rows[0].biomass_OD600).toBe(0.5);
  });

  it('accepts "od_600" as column alias', () => {
    const csv = 'yield_mg_l,od_600\n100,0.5';
    const rows = parseCSVData(csv);
    expect(rows[0].biomass_OD600).toBe(0.5);
  });

  it('accepts "substrate" as column alias', () => {
    const csv = 'yield_mg_l,substrate\n100,5.0';
    const rows = parseCSVData(csv);
    expect(rows[0].substrate_consumed_mM).toBe(5.0);
  });

  it('accepts "glucose_consumed" as column alias', () => {
    const csv = 'yield_mg_l,glucose_consumed\n100,5.0';
    const rows = parseCSVData(csv);
    expect(rows[0].substrate_consumed_mM).toBe(5.0);
  });

  it('accepts "glucose_mm" as column alias', () => {
    const csv = 'yield_mg_l,glucose_mm\n100,5.0';
    const rows = parseCSVData(csv);
    expect(rows[0].substrate_consumed_mM).toBe(5.0);
  });

  it('handles negative yield values', () => {
    const csv = 'yield_mg_l\n-100';
    const rows = parseCSVData(csv);
    expect(rows[0].yield_mg_L).toBe(-100);
  });

  it('handles zero yield', () => {
    const csv = 'yield_mg_l\n0';
    const rows = parseCSVData(csv);
    expect(rows[0].yield_mg_L).toBe(0);
  });

  it('handles whitespace in fields', () => {
    const csv = 'yield_mg_l, strain \n 100 , EColi ';
    const rows = parseCSVData(csv);
    expect(rows[0].yield_mg_L).toBe(100);
    expect(rows[0].strain).toBe('EColi');
  });

  it('handles trailing commas', () => {
    const csv = 'yield_mg_l,strain,\n100,EColi,';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].yield_mg_L).toBe(100);
  });

  it('normalizes header whitespace and case', () => {
    const csv = 'Yield MG L\n100';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(1);
  });

  it('handles empty lines in data', () => {
    const csv = 'yield_mg_l\n100\n\n\n200\n\n';
    const rows = parseCSVData(csv);
    expect(rows).toHaveLength(2);
  });

  it('handles large dataset', () => {
    const header = 'yield_mg_l,biomass_od600\n';
    const dataRows = Array.from({ length: 1000 }, (_, i) => `${i * 10},${(i * 0.1).toFixed(1)}`).join('\n');
    const rows = parseCSVData(header + dataRows);
    expect(rows).toHaveLength(1000);
    expect(rows[999].yield_mg_L).toBe(9990);
  });
});
