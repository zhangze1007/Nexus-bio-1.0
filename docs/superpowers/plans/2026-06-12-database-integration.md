# Real Database Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate real scientific databases (KEGG, BiGG, BRENDA, UniProt, PubChem) into Nexus-Bio tools via API proxy routes with mock fallback.

**Architecture:** API proxy pattern (Edge Runtime) for each database. Client-side `fetchWithFallback` utility. Phased rollout: Phase 1 (KEGG+BiGG), Phase 2 (BRENDA+UniProt), Phase 3 (PubChem+AlphaFold enhancement).

**Tech Stack:** TypeScript, Next.js Edge Runtime, SWR-like caching, existing tool engines

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/services/database/keggClient.ts` | **Create** | KEGG API client with fallback |
| `src/services/database/biggClient.ts` | **Create** | BiGG Models API client with fallback |
| `src/services/database/brendaClient.ts` | **Create** | BRENDA API client with fallback |
| `src/services/database/uniprotClient.ts` | **Create** | UniProt API client with fallback |
| `src/services/database/fetchWithFallback.ts` | **Create** | Shared fallback utility |
| `src/services/database/index.ts` | **Create** | Re-exports all clients |
| `app/api/kegg/route.ts` | **Create** | KEGG proxy route (Edge Runtime) |
| `app/api/bigg/route.ts` | **Create** | BiGG proxy route (Edge Runtime) |
| `app/api/brenda/route.ts` | **Create** | BRENDA proxy route (Edge Runtime) |
| `app/api/uniprot/route.ts` | **Create** | UniProt proxy route (Edge Runtime) |
| `src/components/tools/PathDPage.tsx` | Modify | Add KEGG pathway search |
| `src/components/tools/FBASimPage.tsx` | Modify | Add BiGG model selector |
| `src/components/tools/CATDESPage.tsx` | Modify | Add BRENDA/UniProt lookup |
| `src/components/tools/CellFreePage.tsx` | Modify | Add BRENDA constant lookup |
| `src/components/ide/shared/DataSourceBadge.tsx` | **Create** | Live/Demo indicator component |
| `__tests__/database/keggClient.test.ts` | **Create** | KEGG client tests |
| `__tests__/database/biggClient.test.ts` | **Create** | BiGG client tests |
| `__tests__/database/fetchWithFallback.test.ts` | **Create** | Fallback utility tests |

---

# Phase 1: KEGG + BiGG

### Task 1: Create fetchWithFallback Utility

**Files:**
- Create: `src/services/database/fetchWithFallback.ts`
- Test: `__tests__/database/fetchWithFallback.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/database/fetchWithFallback.test.ts
import { fetchWithFallback } from '@/services/database/fetchWithFallback';

describe('fetchWithFallback', () => {
  it('returns live data when fetcher succeeds', async () => {
    const result = await fetchWithFallback(
      async () => ({ value: 42 }),
      { value: 0 },
      'test'
    );
    expect(result.data).toEqual({ value: 42 });
    expect(result.source).toBe('live');
    expect(result.error).toBeUndefined();
  });

  it('returns mock data when fetcher fails', async () => {
    const result = await fetchWithFallback(
      async () => { throw new Error('network error'); },
      { value: 0 },
      'test'
    );
    expect(result.data).toEqual({ value: 0 });
    expect(result.source).toBe('mock');
    expect(result.error).toContain('network error');
  });

  it('returns live data even if it equals mock data', async () => {
    const result = await fetchWithFallback(
      async () => ({ value: 0 }),
      { value: 0 },
      'test'
    );
    expect(result.source).toBe('live');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/database/fetchWithFallback.test.ts --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement fetchWithFallback**

```typescript
// src/services/database/fetchWithFallback.ts
export interface FallbackResult<T> {
  data: T;
  source: 'live' | 'mock';
  error?: string;
}

/**
 * Try a live fetcher; on failure, fall back to mock data.
 * Logs a warning when falling back so users know they're seeing demo data.
 */
export async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  label: string,
): Promise<FallbackResult<T>> {
  try {
    const data = await fetcher();
    return { data, source: 'live' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[${label}] API unavailable, using mock data: ${msg}`);
    return { data: mockData, source: 'mock', error: msg };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/database/fetchWithFallback.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/database/fetchWithFallback.ts __tests__/database/fetchWithFallback.test.ts
git commit -m "feat(db): add fetchWithFallback utility for database client layer"
```

---

### Task 2: Create KEGG API Proxy Route

**Files:**
- Create: `app/api/kegg/route.ts`
- Test: Manual verification via browser

- [ ] **Step 1: Create the KEGG proxy route**

```typescript
// app/api/kegg/route.ts
export const runtime = 'edge';

const KEGG_BASE = 'https://rest.kegg.jp';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // pathway | compound | reaction | gene
  const id = searchParams.get('id');

  if (!type || !id) {
    return Response.json(
      { error: 'Missing required params: type, id' },
      { status: 400 }
    );
  }

  // Map type to KEGG REST endpoint
  const endpointMap: Record<string, string> = {
    pathway: `link/pathway/${id}`,
    compound: `find/compound/${id}`,
    reaction: `find/reaction/${id}`,
    gene: `find/genes/${id}`,
    pathway_detail: `get/${id}`,
    compound_detail: `get/${id}`,
  };

  const endpoint = endpointMap[type];
  if (!endpoint) {
    return Response.json(
      { error: `Unknown type: ${type}. Supported: ${Object.keys(endpointMap).join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${KEGG_BASE}/${endpoint}`, {
      headers: { 'Accept': 'text/plain' },
    });

    if (!res.ok) {
      return Response.json(
        { error: `KEGG API returned ${res.status}` },
        { status: res.status }
      );
    }

    const text = await res.text();

    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400', // 24h cache
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return Response.json(
      { error: `KEGG API unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Test the route manually**

Run: Start dev server `npm run dev`, then:
```bash
curl "http://localhost:3000/api/kegg?type=pathway_detail&id=hsa00010"
```
Expected: KEGG pathway data for glycolysis (text format)

- [ ] **Step 3: Commit**

```bash
git add app/api/kegg/route.ts
git commit -m "feat(db): add KEGG API proxy route (Edge Runtime)"
```

---

### Task 3: Create KEGG Client with Fallback

**Files:**
- Create: `src/services/database/keggClient.ts`
- Test: `__tests__/database/keggClient.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/database/keggClient.test.ts
import { searchKEGGPathway, getKEGGCompound } from '@/services/database/keggClient';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/database/keggClient.test.ts --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement KEGG client**

```typescript
// src/services/database/keggClient.ts
import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface KEGGPathwayResult {
  id: string;
  name: string;
  reactions: string[];
  compounds: string[];
}

export interface KEGGCompoundResult {
  id: string;
  name: string;
  formula: string;
  molWeight: number;
}

// Mock data for fallback
const MOCK_PATHWAYS: Record<string, KEGGPathwayResult> = {
  glycolysis: {
    id: 'map00010',
    name: 'Glycolysis / Gluconeogenesis',
    reactions: ['R00200', 'R00658', 'R01015', 'R01061'],
    compounds: ['C00022', 'C00024', 'C00033', 'C00074'],
  },
  tca: {
    id: 'map00020',
    name: 'Citrate cycle (TCA cycle)',
    reactions: ['R00351', 'R00709', 'R01325', 'R01900'],
    compounds: ['C00024', 'C00036', 'C00042', 'C00122'],
  },
  mevalonate: {
    id: 'map00900',
    name: 'Terpenoid backbone biosynthesis',
    reactions: ['R02872', 'R02873', 'R02874', 'R05688'],
    compounds: ['C00083', 'C00129', 'C00235', 'C00448'],
  },
};

/**
 * Search KEGG for a pathway by name.
 * Returns pathway ID, name, reactions, and compounds.
 */
export async function searchKEGGPathway(
  query: string,
): Promise<FallbackResult<KEGGPathwayResult>> {
  // Check mock data first for common pathways
  const mockKey = query.toLowerCase();
  const mockData = MOCK_PATHWAYS[mockKey] ?? MOCK_PATHWAYS.glycolysis;

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/kegg?type=pathway_detail&id=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`KEGG returned ${res.status}`);
      const text = await res.text();
      // Parse KEGG flat file format
      const lines = text.split('\n');
      const name = lines.find(l => l.startsWith('NAME'))?.replace('NAME', '').trim() ?? query;
      const reactions = lines.filter(l => l.startsWith('REACTION')).map(l => l.replace('REACTION', '').trim()).filter(Boolean);
      const compounds = lines.filter(l => l.startsWith('COMPOUND')).map(l => l.replace('COMPOUND', '').trim()).filter(Boolean);
      return { id: query, name, reactions, compounds };
    },
    mockData,
    'KEGG',
  );
}

/**
 * Get compound info from KEGG by compound ID (e.g., C00002 for ATP).
 */
export async function getKEGGCompound(
  compoundId: string,
): Promise<FallbackResult<KEGGCompoundResult>> {
  const mockData: KEGGCompoundResult = {
    id: compoundId,
    name: 'Unknown compound',
    formula: '',
    molWeight: 0,
  };

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/kegg?type=compound_detail&id=${compoundId}`);
      if (!res.ok) throw new Error(`KEGG returned ${res.status}`);
      const text = await res.text();
      const lines = text.split('\n');
      const name = lines.find(l => l.startsWith('NAME'))?.replace('NAME', '').trim() ?? compoundId;
      const formula = lines.find(l => l.startsWith('FORMULA'))?.replace('FORMULA', '').trim() ?? '';
      const molWeight = parseFloat(lines.find(l => l.startsWith('MOL_WEIGHT'))?.replace('MOL_WEIGHT', '').trim() ?? '0');
      return { id: compoundId, name, formula, molWeight };
    },
    mockData,
    'KEGG',
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/database/keggClient.test.ts --verbose`
Expected: PASS (falls back to mock in test environment)

- [ ] **Step 5: Commit**

```bash
git add src/services/database/keggClient.ts __tests__/database/keggClient.test.ts
git commit -m "feat(db): add KEGG client with pathway and compound queries"
```

---

### Task 4: Create BiGG API Proxy Route

**Files:**
- Create: `app/api/bigg/route.ts`

- [ ] **Step 1: Create the BiGG proxy route**

```typescript
// app/api/bigg/route.ts
export const runtime = 'edge';

const BIGG_BASE = 'http://bigg.ucsd.edu/api/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // models | model | reaction | metabolite
  const id = searchParams.get('id');

  if (!type) {
    return Response.json({ error: 'Missing param: type' }, { status: 400 });
  }

  const endpointMap: Record<string, string> = {
    models: 'models',
    model: `models/${id}`,
    reaction: `models/${id}/reactions`,
    metabolite: `models/${id}/metabolites`,
  };

  const endpoint = endpointMap[type];
  if (!endpoint) {
    return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }

  try {
    const res = await fetch(`${BIGG_BASE}/${endpoint}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return Response.json({ error: `BiGG returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return Response.json(
      { error: `BiGG unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Test the route manually**

Run: Start dev server, then:
```bash
curl "http://localhost:3000/api/bigg?type=models"
```
Expected: JSON list of BiGG models

- [ ] **Step 3: Commit**

```bash
git add app/api/bigg/route.ts
git commit -m "feat(db): add BiGG Models API proxy route (Edge Runtime)"
```

---

### Task 5: Create BiGG Client with Fallback

**Files:**
- Create: `src/services/database/biggClient.ts`

- [ ] **Step 1: Implement BiGG client**

```typescript
// src/services/database/biggClient.ts
import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface BiGGModel {
  bigg_id: string;
  organism: string;
  reaction_count: number;
  metabolite_count: number;
  gene_count: number;
}

export interface BiGGReaction {
  bigg_id: string;
  name: string;
  metabolites: { bigg_id: string; name: string; stoichiometry: number; compartment: string }[];
}

// Mock E. coli model for fallback
const MOCK_ECOLI_MODEL: BiGGModel = {
  bigg_id: 'e_coli_core',
  organism: 'Escherichia coli str. K-12 substr. MG1655',
  reaction_count: 95,
  metabolite_count: 72,
  gene_count: 137,
};

/**
 * List available BiGG models.
 */
export async function listBiGGModels(): Promise<FallbackResult<BiGGModel[]>> {
  return fetchWithFallback(
    async () => {
      const res = await fetch('/api/bigg?type=models');
      if (!res.ok) throw new Error(`BiGG returned ${res.status}`);
      const data = await res.json();
      return data.results ?? [];
    },
    [MOCK_ECOLI_MODEL],
    'BiGG',
  );
}

/**
 * Get a specific BiGG model by ID (e.g., 'e_coli_core' or 'iML1515').
 */
export async function getBiGGModel(
  modelId: string,
): Promise<FallbackResult<BiGGModel>> {
  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/bigg?type=model&id=${modelId}`);
      if (!res.ok) throw new Error(`BiGG returned ${res.status}`);
      return res.json();
    },
    MOCK_ECOLI_MODEL,
    'BiGG',
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database/biggClient.ts
git commit -m "feat(db): add BiGG client with model listing and fallback"
```

---

### Task 6: Create DataSourceBadge Component

**Files:**
- Create: `src/components/ide/shared/DataSourceBadge.tsx`

- [ ] **Step 1: Implement DataSourceBadge**

```typescript
// src/components/ide/shared/DataSourceBadge.tsx
import React from 'react';

interface DataSourceBadgeProps {
  source: 'live' | 'mock';
  label?: string;
}

/**
 * Small badge indicating whether data is from a live database or mock/demo.
 * Shows green "Live" or amber "Demo" with optional tooltip.
 */
export default function DataSourceBadge({ source, label }: DataSourceBadgeProps) {
  const isLive = source === 'live';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: 'var(--nb-fs-xxs)',
        fontFamily: 'var(--nb-mono)',
        background: isLive
          ? 'rgba(74, 222, 128, 0.12)'
          : 'rgba(251, 191, 36, 0.12)',
        color: isLive
          ? 'rgba(74, 222, 128, 0.9)'
          : 'rgba(251, 191, 36, 0.9)',
        border: isLive
          ? '1px solid rgba(74, 222, 128, 0.2)'
          : '1px solid rgba(251, 191, 36, 0.2)',
      }}
      title={isLive ? 'Data from live database' : 'Using demo/mock data — API unavailable'}
    >
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: isLive ? '#4ade80' : '#fbbf24',
      }} />
      {label ?? (isLive ? 'Live' : 'Demo')}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ide/shared/DataSourceBadge.tsx
git commit -m "feat(db): add DataSourceBadge component (Live/Demo indicator)"
```

---

### Task 7: Integrate KEGG into PATHD

**Files:**
- Modify: `src/components/tools/PathDPage.tsx`
- Modify: `src/components/tools/MetabolicEngPage.tsx` (if PATHD wraps it)

- [ ] **Step 1: Add KEGG pathway search to PATHD**

In the PATHD tool page, add a search input that queries KEGG for pathways:

```typescript
import { searchKEGGPathway } from '@/services/database/keggClient';
import DataSourceBadge from '../ide/shared/DataSourceBadge';

// In the component:
const [keggResult, setKeggResult] = useState<FallbackResult<KEGGPathwayResult> | null>(null);

const handleKEGGSearch = async (query: string) => {
  const result = await searchKEGGPathway(query);
  setKeggResult(result);
};

// In the JSX, add a search bar above the pathway visualization:
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
  <input
    type="text"
    placeholder="Search KEGG pathway (e.g., glycolysis, tca, mevalonate)"
    onKeyDown={(e) => e.key === 'Enter' && handleKEGGSearch(e.currentTarget.value)}
    style={{ /* dark theme input styles */ }}
  />
  {keggResult && <DataSourceBadge source={keggResult.source} />}
</div>
```

- [ ] **Step 2: Use KEGG data to populate pathway when available**

When `keggResult.source === 'live'`, use the KEGG reactions/compounds to build the pathway graph instead of mock data.

- [ ] **Step 3: Run tests**

Run: `npx jest --passWithNoTests -- pathd`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/PathDPage.tsx
git commit -m "feat(pathd): add KEGG pathway search with live/demo indicator"
```

---

### Task 8: Integrate BiGG into FBASim

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`

- [ ] **Step 1: Add BiGG model selector to FBASim**

```typescript
import { listBiGGModels, type BiGGModel } from '@/services/database/biggClient';
import DataSourceBadge from '../ide/shared/DataSourceBadge';

// In the component:
const [models, setModels] = useState<BiGGModel[]>([]);
const [selectedModel, setSelectedModel] = useState<string>('e_coli_core');
const [modelSource, setModelSource] = useState<'live' | 'mock'>('mock');

useEffect(() => {
  listBiGGModels().then(result => {
    setModels(result.data);
    setModelSource(result.source);
  });
}, []);

// In the JSX, add model selector:
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
    {models.map(m => (
      <option key={m.bigg_id} value={m.bigg_id}>
        {m.bigg_id} — {m.organism} ({m.reaction_count} rxns)
      </option>
    ))}
  </select>
  <DataSourceBadge source={modelSource} />
</div>
```

- [ ] **Step 2: Run tests**

Run: `npx jest --passWithNoTests -- fba`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/FBASimPage.tsx
git commit -m "feat(fbasim): add BiGG model selector with live/demo indicator"
```

---

# Phase 2: BRENDA + UniProt

### Task 9: Create BRENDA API Proxy Route

**Files:**
- Create: `app/api/brenda/route.ts`

- [ ] **Step 1: Create the BRENDA proxy route**

```typescript
// app/api/brenda/route.ts
export const runtime = 'edge';

const BRENDA_BASE = 'https://www.brenda-enzymes.org/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // enzyme | kinetics | organism
  const id = searchParams.get('id');

  if (!type) {
    return Response.json({ error: 'Missing param: type' }, { status: 400 });
  }

  // BRENDA uses EC numbers as identifiers (e.g., "2.7.1.1")
  const endpointMap: Record<string, string> = {
    enzyme: `enzyme/${id}`,
    kinetics: `kinetics/${id}`,
    organism: `organism/${id}`,
  };

  const endpoint = endpointMap[type];
  if (!endpoint) {
    return Response.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }

  try {
    const res = await fetch(`${BRENDA_BASE}/${endpoint}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return Response.json({ error: `BRENDA returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();

    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // 1h cache
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return Response.json(
      { error: `BRENDA unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/brenda/route.ts
git commit -m "feat(db): add BRENDA API proxy route (Edge Runtime)"
```

---

### Task 10: Create BRENDA Client

**Files:**
- Create: `src/services/database/brendaClient.ts`

- [ ] **Step 1: Implement BRENDA client**

```typescript
// src/services/database/brendaClient.ts
import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface BRENDAKinetics {
  ecNumber: string;
  enzymeName: string;
  km: { value: number; unit: string; substrate: string; source: string }[];
  kcat: { value: number; unit: string; substrate: string; source: string }[];
  turnoverNumber: { value: number; unit: string; source: string }[];
}

// Mock kinetics for common enzymes
const MOCK_KINETICS: Record<string, BRENDAKinetics> = {
  '2.7.1.1': {
    ecNumber: '2.7.1.1',
    enzymeName: 'Hexokinase',
    km: [
      { value: 0.1, unit: 'mM', substrate: 'D-glucose', source: 'BRENDA' },
      { value: 1.0, unit: 'mM', substrate: 'ATP', source: 'BRENDA' },
    ],
    kcat: [{ value: 200, unit: '1/s', substrate: 'D-glucose', source: 'BRENDA' }],
    turnoverNumber: [{ value: 200, unit: '1/s', source: 'BRENDA' }],
  },
  '2.7.1.11': {
    ecNumber: '2.7.1.11',
    enzymeName: 'Phosphofructokinase',
    km: [
      { value: 0.1, unit: 'mM', substrate: 'D-fructose 6-phosphate', source: 'BRENDA' },
    ],
    kcat: [{ value: 150, unit: '1/s', substrate: 'F6P', source: 'BRENDA' }],
    turnoverNumber: [{ value: 150, unit: '1/s', source: 'BRENDA' }],
  },
};

/**
 * Query BRENDA for enzyme kinetics by EC number.
 */
export async function getBRENDAKinetics(
  ecNumber: string,
): Promise<FallbackResult<BRENDAKinetics>> {
  const mockData = MOCK_KINETICS[ecNumber] ?? {
    ecNumber,
    enzymeName: 'Unknown enzyme',
    km: [],
    kcat: [],
    turnoverNumber: [],
  };

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/brenda?type=kinetics&id=${ecNumber}`);
      if (!res.ok) throw new Error(`BRENDA returned ${res.status}`);
      return res.json();
    },
    mockData,
    'BRENDA',
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database/brendaClient.ts
git commit -m "feat(db): add BRENDA client with kinetics queries and fallback"
```

---

### Task 11: Create UniProt Client

**Files:**
- Create: `src/services/database/uniprotClient.ts`

- [ ] **Step 1: Implement UniProt client**

```typescript
// src/services/database/uniprotClient.ts
import { fetchWithFallback, type FallbackResult } from './fetchWithFallback';

export interface UniProtEntry {
  accession: string;
  geneName: string;
  organism: string;
  sequence: string;
  length: number;
  function: string;
  goTerms: string[];
}

// Mock entries for common proteins
const MOCK_ENTRIES: Record<string, UniProtEntry> = {
  P00044: {
    accession: 'P00044',
    geneName: 'cytC',
    organism: 'Homo sapiens',
    sequence: 'MGDVEKGKKIFVQKCAQCHTVEKGGKHKTGPNLHGLFGRKTGQAPGFTYTDANKNKGITWKEETLMEYLENPKKYIPGTKMIFAGIKKKTEREDLIAYLKKATNE',
    length: 105,
    function: 'Electron carrier protein involved in the electron transport chain',
    goTerms: ['GO:0009055', 'GO:0005739', 'GO:0006122'],
  },
  P00338: {
    accession: 'P00338',
    geneName: 'LDHA',
    organism: 'Homo sapiens',
    sequence: 'MATLKDQLIYNLLKEEQTPQNKITVVGVGAVGMACAISILMKDLADEVALVDVMEDKLKGEMMDLQHGSLFLRTPKIVSGKDYNVTANSKLVIITAGARQQEGESRLNLVQRNVNIFKFIIPNIVKYSPNCKLLIVTNPVDILTYVAWKISGFPKNRVIGSGCNLDSARFRYLMGERLGVHALSCHGWILGEHGDSSVPIWSGVNYAGVPLPDLVNDSGFDNVPYLLSVNGIYTLGGYTATQSVGQFTRGILGQSLTPPRQLTLTSQILDSIKDPLLQGHQ',
    length: 332,
    function: 'Catalyzes the interconversion of pyruvate and lactate',
    goTerms: ['GO:0004459', 'GO:0005737', 'GO:0006096'],
  },
};

/**
 * Search UniProt for a protein by accession or gene name.
 */
export async function searchUniProt(
  query: string,
): Promise<FallbackResult<UniProtEntry>> {
  const mockData = MOCK_ENTRIES[query.toUpperCase()] ?? {
    accession: query,
    geneName: query,
    organism: 'Unknown',
    sequence: '',
    length: 0,
    function: 'No data available',
    goTerms: [],
  };

  return fetchWithFallback(
    async () => {
      const res = await fetch(`/api/uniprot?type=search&id=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`UniProt returned ${res.status}`);
      return res.json();
    },
    mockData,
    'UniProt',
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database/uniprotClient.ts
git commit -m "feat(db): add UniProt client with protein search and fallback"
```

---

# Phase 3: Integration & Polish

### Task 12: Create Database Index and Re-exports

**Files:**
- Create: `src/services/database/index.ts`

- [ ] **Step 1: Create index file**

```typescript
// src/services/database/index.ts
export { fetchWithFallback, type FallbackResult } from './fetchWithFallback';
export { searchKEGGPathway, getKEGGCompound, type KEGGPathwayResult, type KEGGCompoundResult } from './keggClient';
export { listBiGGModels, getBiGGModel, type BiGGModel, type BiGGReaction } from './biggClient';
export { getBRENDAKinetics, type BRENDAKinetics } from './brendaClient';
export { searchUniProt, type UniProtEntry } from './uniprotClient';
```

- [ ] **Step 2: Commit**

```bash
git add src/services/database/index.ts
git commit -m "feat(db): add database client index re-exports"
```

---

### Task 13: Update toolAssumptions for Database Integration

**Files:**
- Modify: `src/config/toolAssumptions.ts`

- [ ] **Step 1: Add database-related assumptions**

For each tool that uses a database, add an assumption entry:

```typescript
// In the FBA assumptions:
'FBAsim can load real E. coli models from BiGG when available. Falls back to demo model when API is unavailable.',

// In the PATHD assumptions:
'PATHD can query KEGG for real metabolic pathways. Falls back to demo pathway when API is unavailable.',

// In the CatDes assumptions:
'CatDes can query BRENDA for real enzyme kinetics. Falls back to demo values when API is unavailable.',
```

- [ ] **Step 2: Commit**

```bash
git add src/config/toolAssumptions.ts
git commit -m "feat(db): add database integration assumptions to tool config"
```

---

### Task 14: Full Integration Test

**Files:**
- Test: `__tests__/database/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// __tests__/database/integration.test.ts
import { fetchWithFallback } from '@/services/database/fetchWithFallback';

describe('Database integration', () => {
  it('fetchWithFallback handles timeout', async () => {
    const result = await fetchWithFallback(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('timeout');
      },
      { data: 'mock' },
      'timeout-test',
    );
    expect(result.source).toBe('mock');
    expect(result.data).toEqual({ data: 'mock' });
  });

  it('all database clients export expected functions', () => {
    // Verify the index exports
    const db = require('@/services/database/index');
    expect(db.fetchWithFallback).toBeDefined();
    expect(db.searchKEGGPathway).toBeDefined();
    expect(db.listBiGGModels).toBeDefined();
    expect(db.getBRENDAKinetics).toBeDefined();
    expect(db.searchUniProt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx jest --passWithNoTests`
Expected: All tests pass

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Final commit**

```bash
git add __tests__/database/
git commit -m "feat(db): add database integration tests and verify full stack"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — production build succeeds
- [ ] Manual test: PATHD KEGG search returns live data or shows Demo badge
- [ ] Manual test: FBASim model selector shows BiGG models or shows Demo badge
- [ ] Manual test: API down → tools still work with mock data
- [ ] No API keys hardcoded in source
