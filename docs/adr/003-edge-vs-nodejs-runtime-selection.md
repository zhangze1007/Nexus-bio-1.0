# ADR-003: Edge Runtime vs Node.js Runtime Selection

## Status

Accepted

## Context

Next.js 15 supports two API route runtimes:
- **Edge Runtime**: Lightweight, fast cold start (~50ms), limited Node.js API access
- **Node.js Runtime**: Full Node.js access, slower cold start (~250ms), required for native modules

Each API route must choose one runtime. The wrong choice causes either build failures (native module in Edge) or unnecessary latency (Node.js for simple proxy).

## Decision

| Route | Runtime | Reason |
|-------|---------|--------|
| `analyze/route.ts` | Edge | Proxy to Groq/Gemini — only needs `fetch()`, benefits from fast cold start |
| `alphafold/route.ts` | Edge | Proxy to EBI AlphaFold — only needs `fetch()` |
| `pubchem/route.ts` | Edge | Proxy to PubChem REST API — only needs `fetch()` |
| `kegg/route.ts` | Edge | Proxy to KEGG REST API — only needs `fetch()` |
| `fba/route.ts` | Node.js | Runs LP simplex solver — requires `fbaEngine.ts` with heavy computation |
| `workbench/route.ts` | Node.js | Uses `better-sqlite3` — native module, cannot run in Edge |
| `scspatial/ingest/route.ts` | Node.js | File processing, Python sidecar integration |
| `scspatial/query/route.ts` | Node.js | Database queries |
| `health/route.ts` | Edge | Simple status check — benefits from fast cold start |

## Consequences

**Positive:**
- Proxy routes have ~50ms cold start (Edge)
- Heavy computation routes have full Node.js access
- Clear, auditable rule: "if it needs native modules or heavy computation → Node.js; otherwise → Edge"

**Negative:**
- Two runtime environments to reason about
- Edge Runtime has some API limitations (no `fs`, no `Buffer`, limited `crypto`)
- Need to be careful when adding dependencies to Edge routes

**Rule of thumb:**
> If the route only uses `fetch()`, `Response`, `Headers`, and basic JS → Edge.
> If it needs `fs`, `Buffer`, native modules, or heavy computation → Node.js.
