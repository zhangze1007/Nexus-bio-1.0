# Real Database Integration — Design Spec

**Date:** 2026-06-12
**Status:** Approved

---

## Problem

Most Nexus-Bio tools use mock/simulated data. Algorithms are real, but inputs are not from literature databases. This limits scientific credibility — users can't trace results to real organisms, real enzymes, or real metabolic models.

## Solution

Integrate 5 external databases via API proxy routes (Edge Runtime), with real-first + mock-fallback strategy. Phased rollout: KEGG+BiGG → BRENDA+UniProt → PubChem+AlphaFold.

## Architecture

```
Tool Pages (14)
    │ useDatabaseQuery hook (SWR-like)
    ▼
Database Client Layer (src/services/database/)
    │ fetch()
    ▼
API Proxy Routes (app/api/, Edge Runtime)
    │
    ▼
External Database APIs
```

## Databases

| Database | URL | Tools Served | Phase |
|----------|-----|-------------|-------|
| KEGG | rest.kegg.jp | PATHD, CETHX | 1 |
| BiGG Models | bigg.ucsd.edu/api | FBASim | 1 |
| BRENDA | brenda-enzymes.org | CatDes, CellFree | 2 |
| UniProt | rest.uniprot.org | CatDes, ProEvol | 2 |
| PubChem | pubchem.ncbi.nlm.nih.gov | CETHX, NodePanel | 3 |
| AlphaFold | ebi.ac.uk | CatDes, NodePanel | 3 |

## API Route Design

Each route: `GET /api/<db>?type=<resource>&id=<id>`

- Edge Runtime (low latency, CDN)
- Cache-Control headers (24h for KEGG/BiGG, 1h for BRENDA)
- Error handling with structured JSON responses

## Fallback Strategy

```typescript
async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  mockData: T,
  label: string
): Promise<{ data: T; source: 'live' | 'mock'; error?: string }>
```

- API available → use live data, show "Live" badge
- API unavailable → fallback to mock, show "Demo" badge with warning
- User can manually toggle between live/mock

## UI Changes

- Each tool shows data source indicator: 🟢 Live / 🟡 Demo
- Database selector dropdown when multiple sources available
- Loading skeleton during API fetch
- Error banner with retry button on API failure

## Success Criteria

- [ ] KEGG pathway lookup works for PATHD
- [ ] BiGG model loading works for FBASim (E. coli iML1515)
- [ ] BRENDA kinetics lookup works for CatDes/CellFree
- [ ] Mock fallback works when API is down
- [ ] All existing tests still pass
- [ ] No hardcoded API keys in source
