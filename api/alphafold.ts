export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  };

  const url = new URL(req.url);
  const uniprotId = url.searchParams.get('id');

  if (!uniprotId) {
    return new Response('Missing id parameter', { status: 400, headers });
  }

  // Sanitize — only allow valid UniProt ID format
  if (!/^[A-Z0-9]{6,10}$/i.test(uniprotId)) {
    return new Response('Invalid UniProt ID', { status: 400, headers });
  }

  try {
    const afUrl = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
    const res = await fetch(afUrl);

    if (!res.ok) {
      return new Response(`AlphaFold structure not found for ${uniprotId}`, {
        status: 404, headers,
      });
    }

    const pdbData = await res.text();
    return new Response(pdbData, { status: 200, headers });
  } catch (err: any) {
    return new Response(`Fetch error: ${err.message}`, { status: 500, headers });
  }
}
