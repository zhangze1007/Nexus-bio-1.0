import { searchKEGGPathway } from '../../src/services/database/keggClient';
import { listBiGGModels } from '../../src/services/database/biggClient';
import { getBRENDAKinetics } from '../../src/services/database/brendaClient';
import { searchUniProt } from '../../src/services/database/uniprotClient';
import { searchPubChemCompound } from '../../src/services/database/pubchemClient';

describe('Database integration full stack', () => {
  it('all clients have consistent FallbackResult shape', async () => {
    const clients = [
      { fn: () => searchKEGGPathway('glycolysis'), name: 'KEGG' },
      { fn: () => listBiGGModels(), name: 'BiGG' },
      { fn: () => getBRENDAKinetics('2.7.1.1'), name: 'BRENDA' },
      { fn: () => searchUniProt('P00044'), name: 'UniProt' },
      { fn: () => searchPubChemCompound('glucose'), name: 'PubChem' },
    ];

    for (const client of clients) {
      const result = await client.fn();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('source');
      expect(['live', 'mock']).toContain(result.source);
      if (result.source === 'mock') {
        expect(result).toHaveProperty('error');
      }
    }
  });

  it('KEGG returns pathway structure', async () => {
    const result = await searchKEGGPathway('glycolysis');
    expect(result.data).toHaveProperty('id');
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('reactions');
    expect(result.data).toHaveProperty('compounds');
  });

  it('BiGG returns model list', async () => {
    const result = await listBiGGModels();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('BRENDA returns kinetics structure', async () => {
    const result = await getBRENDAKinetics('2.7.1.1');
    expect(result.data).toHaveProperty('ecNumber');
    expect(result.data).toHaveProperty('km');
    expect(result.data).toHaveProperty('kcat');
  });

  it('UniProt returns protein structure', async () => {
    const result = await searchUniProt('P00044');
    expect(result.data).toHaveProperty('accession');
    expect(result.data).toHaveProperty('sequence');
  });

  it('PubChem returns compound structure', async () => {
    const result = await searchPubChemCompound('glucose');
    expect(result.data).toHaveProperty('cid');
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('formula');
  });
});
