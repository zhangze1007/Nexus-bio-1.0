import { searchKEGGPathway, getKEGGCompound } from '../../src/services/database/keggClient';

describe('keggClient', () => {
  it('searchKEGGPathway returns result with source field', async () => {
    const result = await searchKEGGPathway('glycolysis');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
    expect(['live', 'mock']).toContain(result.source);
  });

  it('getKEGGCompound returns result with source field', async () => {
    const result = await getKEGGCompound('C00002');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('source');
  });

  it('falls back to mock when API unavailable', async () => {
    const result = await searchKEGGPathway('nonexistent_pathway');
    expect(result.data).toHaveProperty('id');
    expect(result.data).toHaveProperty('name');
  });
});
