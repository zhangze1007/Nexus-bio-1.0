export const runtime = 'edge';

const ENDPOINTS = [
  { name: 'KEGG', url: 'https://rest.kegg.jp/get/hsa:7094' },
  { name: 'BiGG', url: 'http://bigg.ucsd.edu/api/v3/models' },
  { name: 'BRENDA', url: 'https://www.brenda-enzymes.org/api/enzyme/2.7.1.1' },
  { name: 'UniProt', url: 'https://rest.uniprot.org/uniprotkb/P00044.json' },
  { name: 'PubChem', url: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/JSON' },
  { name: 'AlphaFold', url: 'https://alphafold.ebi.ac.uk/api/prediction/P00044' },
];

export async function GET() {
  const results = await Promise.allSettled(
    ENDPOINTS.map(async (ep) => {
      try {
        const res = await fetch(ep.url, {
          signal: AbortSignal.timeout(5000),
          method: 'HEAD',
        });
        return { name: ep.name, status: res.ok ? 'live' : 'degraded' };
      } catch {
        return { name: ep.name, status: 'offline' };
      }
    })
  );

  const statuses = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { name: ENDPOINTS[i].name, status: 'offline' }
  );

  const allLive = statuses.every((s) => s.status === 'live');

  return Response.json(
    { status: allLive ? 'all_live' : 'degraded', databases: statuses },
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  );
}
