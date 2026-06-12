describe('Database integration', () => {
  it('all database clients export expected functions', () => {
    const { fetchWithFallback } = require('../../src/services/database/fetchWithFallback');
    const { searchKEGGPathway } = require('../../src/services/database/keggClient');
    const { listBiGGModels } = require('../../src/services/database/biggClient');
    const { getBRENDAKinetics } = require('../../src/services/database/brendaClient');
    const { searchUniProt } = require('../../src/services/database/uniprotClient');
    const { searchPubChemCompound } = require('../../src/services/database/pubchemClient');

    expect(fetchWithFallback).toBeDefined();
    expect(searchKEGGPathway).toBeDefined();
    expect(listBiGGModels).toBeDefined();
    expect(getBRENDAKinetics).toBeDefined();
    expect(searchUniProt).toBeDefined();
    expect(searchPubChemCompound).toBeDefined();
  });

  it('all clients return fallback result shape', async () => {
    const { searchKEGGPathway } = require('../../src/services/database/keggClient');
    const result = await searchKEGGPathway('test');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
    expect(['live', 'mock']).toContain(result.source);
  });

  it('barrel index exports all clients', () => {
    const db = require('../../src/services/database');

    expect(db.fetchWithFallback).toBeDefined();
    expect(db.searchKEGGPathway).toBeDefined();
    expect(db.getKEGGCompound).toBeDefined();
    expect(db.listBiGGModels).toBeDefined();
    expect(db.getBiGGModel).toBeDefined();
    expect(db.getBRENDAKinetics).toBeDefined();
    expect(db.searchUniProt).toBeDefined();
    expect(db.searchPubChemCompound).toBeDefined();
  });

  it('KEGG client returns expected data shape', async () => {
    const { searchKEGGPathway } = require('../../src/services/database/keggClient');
    const result = await searchKEGGPathway('glycolysis');
    expect(result.data).toHaveProperty('id');
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('reactions');
    expect(result.data).toHaveProperty('compounds');
  });

  it('BiGG client returns expected data shape', async () => {
    const { listBiGGModels } = require('../../src/services/database/biggClient');
    const result = await listBiGGModels();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('BRENDA client returns expected data shape', async () => {
    const { getBRENDAKinetics } = require('../../src/services/database/brendaClient');
    const result = await getBRENDAKinetics('2.7.1.1');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
    expect(result.data).toHaveProperty('ecNumber');
    expect(result.data).toHaveProperty('km');
    expect(result.data).toHaveProperty('kcat');
  });

  it('UniProt client returns expected data shape', async () => {
    const { searchUniProt } = require('../../src/services/database/uniprotClient');
    const result = await searchUniProt('P00044');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
    expect(result.data).toHaveProperty('accession');
    expect(result.data).toHaveProperty('sequence');
  });

  it('PubChem client returns expected data shape', async () => {
    const { searchPubChemCompound } = require('../../src/services/database/pubchemClient');
    const result = await searchPubChemCompound('glucose');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
    expect(result.data).toHaveProperty('cid');
    expect(result.data).toHaveProperty('name');
    expect(result.data).toHaveProperty('formula');
  });
});
