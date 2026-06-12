# Direction A: Real Database Data Replacement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock data with real database queries across all tools, ensuring every simulation uses real-world input when available.

**Architecture:** API proxy routes (Edge Runtime) → Database clients (fetchWithFallback) → Tool integration (DataSourceBadge). 3 phases: foundation → tool wiring → validation.

**Tech Stack:** TypeScript, Next.js Edge Runtime, existing database client layer

---

## Phase A1: Database Client Hardening

### Task A1.1: Add retry logic to fetchWithFallback

**Files:**
- Modify: `src/services/database/fetchWithFallback.ts`
- Test: `__tests__/database/fetchWithFallback.test.ts`

- [ ] **Step 1: Write failing test for retry**

```typescript
it('retries on transient failure then succeeds', async () => {
  let attempts = 0;
  const result = await fetchWithFallback(
    async () => {
      attempts++;
      if (attempts < 2) throw new Error('transient');
      return { value: 42 };
    },
    { value: 0 },
    'retry-test',
    { retries: 2, retryDelayMs: 10 }
  );
  expect(result.data).toEqual({ value: 42 });
  expect(result.source).toBe('live');
  expect(attempts).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/database/fetchWithFallback.test.ts --verbose`
Expected: FAIL — no retries option

- [ ] **Step 3: Add retry options to fetchWithFallback**

```typescript
export interface FallbackOptions {
  retries?: number;
  retryDelayMs?: number;
}

export async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  label: string,
  options?: FallbackOptions,
): Promise<FallbackResult<T>> {
  const maxAttempts = (options?.retries ?? 0) + 1;
  const delay = options?.retryDelayMs ?? 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fetcher();
      return { data, source: 'live' };
    } catch (e) {
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[${label}] API unavailable after ${maxAttempts} attempts, using mock: ${msg}`);
      return { data: mockData, source: 'mock', error: msg };
    }
  }
  // Unreachable but TypeScript needs it
  return { data: mockData, source: 'mock', error: 'unreachable' };
}
```

- [ ] **Step 4: Run all tests**

Run: `npx jest __tests__/database/ --verbose`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/services/database/fetchWithFallback.ts __tests__/database/fetchWithFallback.test.ts
git commit -m "feat(db): add retry logic to fetchWithFallback"
```

---

### Task A1.2: Add request timeout to all database clients

**Files:**
- Modify: `src/services/database/keggClient.ts`
- Modify: `src/services/database/biggClient.ts`
- Modify: `src/services/database/brendaClient.ts`
- Modify: `src/services/database/uniprotClient.ts`
- Modify: `src/services/database/pubchemClient.ts`

- [ ] **Step 1: Add AbortSignal.timeout to all fetch calls**

In each client, wrap fetch calls with timeout:

```typescript
// Before:
const res = await fetch(url);

// After:
const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
```

- [ ] **Step 2: Run tests**

Run: `npx jest --passWithNoTests -- database`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/services/database/
git commit -m "feat(db): add 10s timeout to all database client fetch calls"
```

---

### Task A1.3: Create database health check endpoint

**Files:**
- Create: `app/api/health/databases/route.ts`

- [ ] **Step 1: Create health check route**

```typescript
// app/api/health/databases/route.ts
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

  const allLive = statuses.every(s => s.status === 'live');

  return Response.json(
    { status: allLive ? 'all_live' : 'degraded', databases: statuses },
    { headers: { 'Cache-Control': 'public, max-age=60' } }
  );
}
```

- [ ] **Step 2: Test manually**

Run: `curl http://localhost:3000/api/health/databases`
Expected: JSON with status for each database

- [ ] **Step 3: Commit**

```bash
git add app/api/health/databases/route.ts
git commit -m "feat(db): add database health check endpoint"
```

---

## Phase A2: Tool Data Source Integration

### Task A2.1: FBASim — load real BiGG model reactions

**Files:**
- Modify: `src/components/tools/FBASimPage.tsx`
- Modify: `src/services/fbaEngine.ts` (if needed)

- [ ] **Step 1: Read current FBASimPage to understand model loading**

The page already has a BiGG model selector (added in Phase 1). Now we need to actually LOAD the model data when a real model is selected.

- [ ] **Step 2: Add model data loading from BiGG**

When user selects a model from the dropdown, fetch its reactions from `/api/bigg?type=reaction&id=<modelId>` and convert them to the FBA solver's input format.

- [ ] **Step 3: Wire loaded model into FBA solver**

Pass the loaded reactions as the `model` parameter to the FBA solver instead of the hardcoded mock model.

- [ ] **Step 4: Show model stats**

Display: reaction count, metabolite count, gene count from the loaded model.

- [ ] **Step 5: Run tests**

Run: `npx jest --passWithNoTests -- fba`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add src/components/tools/FBASimPage.tsx
git commit -m "feat(fbasim): load real BiGG model reactions into FBA solver"
```

---

### Task A2.2: PATHD — use KEGG pathway data for route synthesis

**Files:**
- Modify: `src/components/tools/PathDPage.tsx`

- [ ] **Step 1: Wire KEGG search results into pathway visualization**

When KEGG returns live pathway data, use the reaction list to build the pathway graph instead of the hardcoded Artemisinin demo pathway.

- [ ] **Step 2: Show pathway metadata from KEGG**

Display: pathway name, organism, reaction count, compound count from KEGG response.

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/PathDPage.tsx
git commit -m "feat(pathd): use real KEGG pathway data for route synthesis"
```

---

### Task A2.3: CatDes — use BRENDA Km/Kcat in binding model

**Files:**
- Modify: `src/components/tools/CatalystDesignerPage.tsx`

- [ ] **Step 1: Wire BRENDA kinetics into enzyme parameters**

When BRENDA returns real Km/Kcat for an EC number, use those values in the binding affinity calculation instead of the hardcoded defaults.

- [ ] **Step 2: Show BRENDA vs default comparison**

Display a comparison panel showing BRENDA values vs current model values.

- [ ] **Step 3: Commit**

```bash
git add src/components/tools/CatalystDesignerPage.tsx
git commit -m "feat(catdes): use BRENDA Km/Kcat in binding affinity model"
```

---

### Task A2.4: CellFree — use BRENDA constants in ODE model

**Files:**
- Modify: `src/components/tools/CellFreePage.tsx`
- Modify: `src/services/CellFreeEngine.ts`

- [ ] **Step 1: Add BRENDA constant injection to CellFree engine**

Add an optional parameter to `runFullCFSPipeline` that accepts BRENDA-sourced Km/Kcat values, overriding the defaults.

- [ ] **Step 2: Wire BRENDA lookup results into engine call**

When user searches BRENDA in the Fitting tab and gets real values, pass them to the pipeline.

- [ ] **Step 3: Show provenance indicator**

Display which constants came from BRENDA vs defaults.

- [ ] **Step 4: Commit**

```bash
git add src/components/tools/CellFreePage.tsx src/services/CellFreeEngine.ts
git commit -m "feat(cellfree): inject BRENDA constants into ODE model"
```

---

## Phase A3: Validation & Documentation

### Task A3.1: Update demo-status-table with database integration status

**Files:**
- Modify: `proof-package/demo-status-table.md`

- [ ] **Step 1: Update table entries**

For each tool that now uses real database data, update the "Current status" column from "demo" to "partial" and note the database integration.

- [ ] **Step 2: Commit**

```bash
git add proof-package/demo-status-table.md
git commit -m "docs: update demo-status-table with database integration status"
```

---

### Task A3.2: Update toolAssumptions with database fallback boundaries

**Files:**
- Modify: `src/config/toolAssumptions.ts`

- [ ] **Step 1: Add fallback boundary assumptions**

For each tool, add an assumption that clearly states: "When database is unavailable, tool falls back to demo data. Results are valid only when sourced from live database."

- [ ] **Step 2: Commit**

```bash
git add src/config/toolAssumptions.ts
git commit -m "feat(db): add database fallback boundary assumptions"
```

---

### Task A3.3: Full integration test

**Files:**
- Create: `__tests__/database/fullIntegration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
describe('Database integration full stack', () => {
  it('all clients have consistent FallbackResult shape', async () => {
    const clients = [
      { fn: () => require('../../src/services/database/keggClient').searchKEGGPathway('test'), name: 'KEGG' },
      { fn: () => require('../../src/services/database/biggClient').listBiGGModels(), name: 'BiGG' },
      { fn: () => require('../../src/services/database/brendaClient').getBRENDAKinetics('2.7.1.1'), name: 'BRENDA' },
      { fn: () => require('../../src/services/database/uniprotClient').searchUniProt('P00044'), name: 'UniProt' },
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
});
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add __tests__/database/fullIntegration.test.ts
git commit -m "test(db): add full database integration test"
```
