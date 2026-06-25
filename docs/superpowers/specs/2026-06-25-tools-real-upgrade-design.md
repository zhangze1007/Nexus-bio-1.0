# Tools REAL Upgrade Design

**Date:** 2026-06-25
**Goal:** Upgrade all 14 Nexus-Bio tools from "partial/demo" to "real" (production-ready for enterprise/scientific research)

## Current State

| Level | Tools |
|-------|-------|
| REAL (3) | ScSpatial, NEXAI, DigitalTwin |
| PARTIAL (11) | FBASim, CETHX, CatDes, ProEvol, GenMIM, GECAIR, DynCon, CellFree, DBTLflow, InverseFolding, MultiplexCRISPR, PathwayDiscovery, MFA13C, GemReconstruct, RNAEngineering, PathD, MetabolicEng, MultiO, BioSafety |

## REAL Standard

A tool is REAL when:
1. Algorithm matches its scientific name (verified)
2. Uses real databases/models (not toy/mock)
3. Accepts user experimental data for calibration
4. Uses real ML models (not heuristics)

## Batch 1: Quick Fixes (1-2 days)

### 1.1 BioSafety — Add CARD Database
- **File:** `scspatial-backend/blast_service.py`
- **Change:** Add `ensure_card_database()` function (~50 lines)
- **CARD URL:** `https://card.mcmaster.ca/latest/data`
- **Note:** CARD protein homolog model needs `blastx` (translated search), not just `blastn`

### 1.2 MFA13C — Fix Caption
- **File:** `src/config/toolValidity.ts`
- **Change:** Update caption — already uses Levenberg-Marquardt, not grid search

### 1.3 DBTLflow — Wire Real Engine to UI
- **File:** `src/components/tools/DBTLflowPage.tsx`
- **Change:** Connect `useDBTLState()` to `closedLoopDBTLEngine.ts` (GP + Bayesian optimization already implemented)
- **Also:** Switch from Gauss-Jordan to Cholesky (already in `gaussianProcess.ts`)

### 1.4 ProEvol — Remove Fitness Noise
- **File:** `src/services/esm2Client.ts` line 98
- **Change:** Remove `Math.random() * 0.4 + 0.8` multiplier from `computeFitnessLandscape()`

### 1.5 InverseFolding — Add ESM-2 Toggle
- **Files:** `src/components/tools/ProEvolPage.tsx` or `src/components/tools/proevol/`
- **Change:** Add "Use ESM-2" checkbox that passes `useESM2: true` to `runInverseFolding()`

## Batch 2: Database + Python Integration (3-5 days)

### 2.1 MultiO — Connect MOFA+ Backend
- **File:** `src/components/tools/MultiOPage.tsx`
- **Change:** Add `useMOFA` toggle; when enabled, send data to `/mofa` endpoint on Railway
- **MOFA+ endpoint:** Already deployed at `https://scspatial-backend-production.up.railway.app/mofa`

### 2.2 FBASim — Connect BiGG Genome-Scale Models
- **File:** `src/server/fbaEngine.ts`
- **Change:** Wire `solveDynamicFBA()` to use full BiGG model stoichiometry (not just the 10-reaction toy network)
- **BiGG API:** Already has `biggClient.ts` — need to load full model and build S matrix

### 2.3 PathwayDiscovery — Add Mass Conservation
- **File:** `src/server/pathwayDiscoveryEngine.ts`
- **Change:** Add molecular weight calculation + atom balance checks
- **Data source:** KEGG compound API for molecular formulas

### 2.4 GemReconstruct — Live KEGG API
- **File:** `src/server/gemReconstructionEngine.ts`
- **Change:** Replace static `EC_REACTION_MAP` with KEGG REST API lookups
- **KEGG API:** `https://rest.kegg.jp/` (free, no key)

### 2.5 MultiplexCRISPR — Real CFD Matrix
- **File:** `src/data/cfdPenaltyMatrix.ts`
- **Change:** Replace uniform 0.893 values with real Doench 2016 Supplementary Table 1 (12 types × 20 positions = 240 values)

## Batch 3: Major Architecture (1-2 weeks)

### 3.1 PathD — Real Retrosynthesis
- **Options:** KEGG/Rhea API, ASKCOS API, or RetroPath2.0
- **Recommended:** KEGG/Rhea API (free, no key) + existing A* search

### 3.2 GECAIR — iGEM Registry
- **Options:** iGEM Registry API (`synapse.igem.org`)
- **Change:** Replace hand-curated parts with registry data

### 3.3 RNAEngineering — ViennaRNA Integration
- **Options:** ViennaRNA subprocess, NUPACK Python, or TypeScript Zuker DP
- **Recommended:** ViennaRNA via Python backend (already have Railway)

### 3.4 MultiplexCRISPR — Cas-OFFinder
- **Options:** Cas-OFFinder subprocess + genome FASTA, or CHOPCHOP API
- **Recommended:** CHOPCHOP API (no local genome storage needed)

## Execution Order

1. Batch 1 (all 5 tasks in parallel via subagents)
2. Batch 2 (all 5 tasks in parallel via subagents)
3. Batch 3 (sequential — each requires architecture decisions)

## Verification

- Each batch: `npx tsc --noEmit` + `npm test` + `npm run build`
- Each tool: manual verification that the REAL label is justified
- Final: update all captions in `toolValidity.ts`
