import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface PubChemCompound {
  cid: number;
  name: string;
  formula: string;
  molecularWeight: number;
  iupacName: string;
}

const MOCK_COMPOUNDS: Record<string, PubChemCompound> = {
  glucose: {
    cid: 5793,
    name: 'Glucose',
    formula: 'C6H12O6',
    molecularWeight: 180.16,
    iupacName: '(2R,3S,4R,5R)-2,3,4,5,6-pentahydroxyhexanal',
  },
  pyruvate: {
    cid: 1060,
    name: 'Pyruvic acid',
    formula: 'C3H4O3',
    molecularWeight: 88.06,
    iupacName: '2-oxopropanoic acid',
  },
  atp: {
    cid: 5957,
    name: 'ATP',
    formula: 'C10H16N5O13P3',
    molecularWeight: 507.18,
    iupacName: "[(2R,3S,4R,5R)-5-(6-aminopurin-9-yl)-3,4-dihydroxyoxolan-2-yl]methyl (hydroxy-phosphonooxyphosphoryl) hydrogen phosphate",
  },
  nadh: {
    cid: 5893,
    name: 'NADH',
    formula: 'C21H29N7O14P2',
    molecularWeight: 663.43,
    iupacName: 'NADH',
  },
  artemisinin: {
    cid: 68827,
    name: 'Artemisinin',
    formula: 'C15H22O5',
    molecularWeight: 282.33,
    iupacName: '(3R,5aS,6R,8aS,9R,12S,12aR)-octahydro-3,6,9-trimethyl-3,12-epoxy-12H-pyrano[4,3-j]-1,2-benzodioxepin-10(3H)-one',
  },
};

/**
 * Search PubChem for a compound by name via the /api/pubchem proxy.
 * Returns structured compound data with a fallback to mock data.
 */
export async function searchPubChemCompound(
  name: string,
): Promise<FallbackResult<PubChemCompound>> {
  const mockKey = name.toLowerCase().trim();
  const mockData: PubChemCompound = MOCK_COMPOUNDS[mockKey] ?? {
    cid: 0,
    name: name,
    formula: 'Unknown',
    molecularWeight: 0,
    iupacName: 'Unknown',
  };

  return fetchWithFallback(
    async () => {
      const res = await fetch(
        `/api/pubchem?name=${encodeURIComponent(name)}`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) throw new Error(`PubChem returned ${res.status}`);
      // The proxy returns SDF text; extract CID from the X-PubChem-CID header
      const cidHeader = res.headers.get('X-PubChem-CID');
      const cid = cidHeader ? parseInt(cidHeader, 10) : 0;
      if (!cid) throw new Error('No CID returned from PubChem');

      // Fetch compound properties via the /api/pubchem proxy (never direct browser fetch)
      try {
        const propRes = await fetch(
          `/api/pubchem?cid=${cid}&properties=true`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (propRes.ok) {
          const propData = (await propRes.json()) as {
            PropertyTable?: {
              Properties?: Array<{
                CID: number;
                MolecularFormula?: string;
                MolecularWeight?: number;
                IUPACName?: string;
              }>;
            };
          };
          const props = propData?.PropertyTable?.Properties?.[0];
          if (props) {
            return {
              cid,
              name,
              formula: props.MolecularFormula ?? 'Unknown',
              molecularWeight: props.MolecularWeight ?? 0,
              iupacName: props.IUPACName ?? 'Unknown',
            };
          }
        }
      } catch {
        // Property fetch failed; return basic info from SDF response
      }

      return {
        cid,
        name,
        formula: 'See SDF',
        molecularWeight: 0,
        iupacName: name,
      };
    },
    mockData,
    'PubChem',
  );
}
