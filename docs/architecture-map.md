# Nexus-Bio Architecture Map

**Generated:** 2026-06-20
**Version:** 1.0.0
**Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS

---

## Directory Structure

```
/
├── app/                    # Next.js App Router (API routes + pages)
│   ├── api/                # API endpoints
│   │   ├── analyze/        # AI analysis (Groq/Gemini)
│   │   ├── alphafold/      # AlphaFold EBI proxy
│   │   ├── esmfold/        # ESMFold structure prediction
│   │   ├── esm2/           # ESM-2 embeddings
│   │   ├── fba/            # FBA solver
│   │   ├── kegg/           # KEGG pathway proxy
│   │   ├── pipeline/       # Pipeline dispatch
│   │   ├── pubchem/        # PubChem proxy
│   │   ├── scspatial/      # Spatial data
│   │   └── workbench/      # Project sync
│   ├── tools/              # Tool pages (14 tools)
│   └── page.tsx            # Home page
├── src/
│   ├── components/         # React components
│   │   ├── tools/          # Tool page components (14 tools)
│   │   ├── ide/            # IDE shell (FORBIDDEN: IDShell, IDETopBar, IDESidebar)
│   │   └── workbench/      # Workbench components
│   ├── server/             # Server-side engines (60+ files)
│   ├── services/           # Client-side services
│   ├── store/              # Zustand state management
│   ├── domain/             # Domain types and contracts
│   ├── machines/           # XState machines
│   └── utils/              # Utilities
├── __tests__/              # Test files (120+ files)
└── docs/                   # Documentation
```

## Core Modules

| Module | Path | Responsibility | Modifiable |
|--------|------|----------------|------------|
| Frontend | `app/`, `src/components/` | UI rendering | ✅ |
| Routing | `app/` (Next.js App Router) | Page routing | ✅ (careful) |
| Tool Pages | `src/components/tools/` | 14 tool UIs | ✅ |
| IDE Shell | `src/components/ide/` | Layout shell | ❌ FORBIDDEN |
| Server Engines | `src/server/` | 60+ computation engines | ✅ |
| Services | `src/services/` | Client-side API calls | ✅ |
| Store | `src/store/` | Global state | ✅ (careful) |
| Domain | `src/domain/` | Type contracts | ✅ (careful) |
| Tests | `__tests__/` | 120+ test files | ✅ |
| Config | `package.json`, `tsconfig.json` | Build config | ✅ (careful) |

## CRISPR-Related Modules

| File | Current Function |
|------|-----------------|
| `src/server/grnaDesigner.ts` | gRNA design (Rule Set 2) |
| `src/server/multiplexCRISPREngine.ts` | Multiplex CRISPR strategy |
| `src/components/tools/GenMIMPage.tsx` | Gene minimization UI |
| `src/components/tools/GECAIRPage.tsx` | Gene circuit UI (FORBIDDEN) |

## Protein Structure Modules

| File | Current Function |
|------|-----------------|
| `app/api/alphafold/route.ts` | AlphaFold EBI proxy |
| `app/api/esmfold/route.ts` | ESMFold prediction |
| `app/api/esm2/route.ts` | ESM-2 embeddings |
| `src/server/inverseFoldingEngine.ts` | Inverse folding |
| `src/services/esmfoldClient.ts` | ESMFold client |
| `src/services/esm2Client.ts` | ESM-2 client |
| `src/components/ProteinViewer.tsx` | 3Dmol.js viewer |

## Safety/Risk Logic

| File | Current Function |
|------|-----------------|
| None | No dedicated safety module exists |

## Existing Evidence/Provenance

| File | Current Function |
|------|-----------------|
| `src/services/provenanceMiddleware.ts` | Provenance tracking |
| `src/domain/workflowContract.ts` | Tool contracts |
| `src/services/trustPolicyEngine.ts` | Trust policy |

## Test Infrastructure

| Path | Description |
|------|-------------|
| `__tests__/` | 120+ Jest test files |
| `jest.config.cjs` | Jest configuration |
| `e2e/` | Playwright E2E (placeholder) |

## Documentation

| Path | Description |
|------|-------------|
| `docs/superpowers/specs/` | Design specs |
| `docs/superpowers/plans/` | Implementation plans |
| `CLAUDE.md` | Project context |
