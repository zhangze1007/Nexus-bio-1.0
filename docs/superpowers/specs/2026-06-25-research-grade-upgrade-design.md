# Research-Grade Upgrade: 5 Tools on Railway

**Date:** 2026-06-25
**Constraint:** Railway free tier (2 CPU, 512MB RAM)
**Strategy:** Lightweight computation on Railway + external APIs for heavy models

## Tools to Upgrade

### 1. FBASim — Full Genome-Scale Models

**Current:** Auto-loads e_coli_core (simplified BiGG model). Toy 10-reaction network as fallback.

**Target:** Load full iJO1366 (2583 reactions, 1805 metabolites) as the default.

**Approach:**
- The BiGG API client (`biggClient.ts`) already fetches reaction stoichiometry
- The dynamic FBA solver (`solveDynamicFBA`) already builds S matrix from fetched reactions
- The iJO1366 subset (`iJO1366Subset.ts`) has ~83 reactions — need to expand to full model
- HiGHS solver can handle 2583 reactions in ~100MB RAM

**Changes:**
- `src/services/database/biggClient.ts`: Add full iJO1366 model loading (fetch all reactions in batches)
- `src/server/fbaEngine.ts`: Wire `solveDynamicFBA` to use full BiGG model
- `src/components/tools/fbasim/useFBASimState.ts`: Already auto-loads (commit `7742679`)
- Python backend: Add `/fba/solve` endpoint for server-side LP solving (avoids browser memory limits)

**Verification:** Upload iJO1366 model → LP solves → growth rate matches literature (0.87 h⁻¹ for glucose aerobic)

### 2. PathD — KEGG/Rhea API Integration

**Current:** Curated 500+ reaction DB + KEGG fallback (commit `1134be5`).

**Target:** Live KEGG + Rhea API as primary source, curated DB as cache.

**Approach:**
- KEGG REST API (`rest.kegg.jp`) — free, no key, well-documented
- Rhea API (`https://www.rhea-db.org/rest/`) — enzyme-catalyzed reactions
- Already have `/api/kegg` proxy route with EC number support

**Changes:**
- `src/server/pathwayDiscoveryEngine.ts`: Make KEGG lookup primary (not fallback) for reactions not in curated DB
- Add Rhea API client: `src/services/database/rheaClient.ts`
- `app/api/rhea/route.ts`: Next.js proxy for Rhea API
- Update A* search to query KEGG/Rhea when curated DB misses

**Verification:** Search for "artemisinin biosynthesis" → finds real pathway with KEGG reaction IDs

### 3. MultiplexCRISPR — BLAST Off-Target Search

**Current:** GC + homopolymer proxy scoring (commit `57a6501`).

**Target:** Real BLAST-based off-target search against reference genomes.

**Approach:**
- Railway already has NCBI BLAST+ installed + VFDB/CARD databases
- Add E. coli K-12 MG1655 genome FASTA to BLAST databases
- For each guide RNA, run `blastn` against genome with relaxed E-value
- Parse hits to find off-target sites (≤3 mismatches in seed region)

**Changes:**
- `scspatial-backend/blast_service.py`: Add `blast_offtarget()` function
- Download E. coli K-12 genome FASTA at runtime (like VFDB)
- `src/server/multiplexCRISPREngine.ts`: Call Python backend for off-target search
- `app/api/blast/route.ts`: Next.js proxy to Railway BLAST

**Verification:** Guide targeting lacZ → finds known off-targets in E. coli genome

### 4. RNAEngineering — ViennaRNA Integration

**Current:** Nussinov DP from `regulatoryDesignEngine.ts` (commit `f7e4485`).

**Target:** ViennaRNA/RNAfold for production-quality MFE prediction.

**Approach:**
- ViennaRNA is a small C library (~5MB)
- Install on Railway via `apt-get install vienna-rna`
- Call `RNAfold` subprocess from Python backend
- Parse output (dot-bracket notation + ΔG)

**Changes:**
- `scspatial-backend/rna_service.py`: New file — wraps `RNAfold` subprocess
- `scspatial-backend/Dockerfile`: Add `apt-get install vienna-rna`
- `src/modules/rna-engine/rnaEngine.ts`: Add toggle to use Python backend for folding
- `app/api/rna/route.ts`: Next.js proxy to Railway RNAfold

**Verification:** Fold `GGGAAACCC` → ViennaRNA gives ΔG = -3.2 kcal/mol (matches known value)

### 5. InverseFolding — ESM Atlas API

**Current:** Atchley factors + plausible sequence generation (commit `6e63b34`).

**Target:** Real ESM-2 embeddings from Meta's ESM Atlas API.

**Approach:**
- ESM Atlas API (`https://api.esmatlas.com/foldSequence/v1/pdb`) — free, no key
- Already have `/api/esm2` route that calls this API
- Need to fix: return per-residue embeddings instead of PDB structure
- ESM Atlas also supports `computeEssentials` for embeddings

**Changes:**
- `app/api/esm2/route.ts`: Call ESM Atlas `computeEssentials` endpoint for embeddings
- `src/services/esm2Client.ts`: Update `getESM2Embeddings` to use new endpoint
- `src/server/inverseFoldingEngine.ts`: Wire `fetchESM2Embeddings` to use real embeddings
- Python backend: Add `/esm2/embeddings` endpoint as fallback

**Verification:** Send lysozyme sequence → get 1280-dim per-residue embeddings → verify dimensions

## Implementation Order

1. **FBASim** (biggest impact, most tools depend on it)
2. **InverseFolding** (ESM Atlas API, no server changes needed)
3. **RNAEngineering** (ViennaRNA, simple subprocess)
4. **MultiplexCRISPR** (BLAST off-target, needs genome FASTA)
5. **PathD** (KEGG/Rhea, already partially done)

## Verification

Each tool: upload real data → verify output matches known literature values.
