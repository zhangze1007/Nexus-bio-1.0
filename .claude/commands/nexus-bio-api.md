---
name: nexus-bio-api
description: Scaffold a new Nexus-Bio API route with correct runtime, error handling, and CORS
---

# /nexus-bio-api

Generate a new API route following the established patterns.

## Parameters
- `RouteName` (required): Name of the route (e.g., `kegg`, `uniprot`)
- `Runtime` (optional): `edge` or `node` (default: `edge`)

## Steps

1. Read existing API routes to understand patterns:
   - `app/api/analyze/route.ts` — Edge Runtime pattern with CORS
   - `app/api/fba/route.ts` — Node.js Runtime pattern
2. Create `app/api/${RouteName}/route.ts` with:
   - Correct `export const runtime` declaration
   - CORS handling via `getCorsHeaders()` and `handleOptions()`
   - Error responses using `errorResponse()` from `src/utils/apiErrors.ts`
   - Input validation
   - Rate limiting (if user-facing)
3. Add route to `CLAUDE.md` project tree and API routes table
4. Run `npx tsc --noEmit` to verify

## Output
The new API route file + CLAUDE.md updates.
