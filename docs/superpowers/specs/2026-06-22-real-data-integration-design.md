# Real Data Integration Design Spec

## Goal
Transform Nexus-Bio from a demo-data platform to a real-data platform where users can:
1. See clearly when they're using live vs demo data
2. Upload their own data files
3. Connect to real scientific databases
4. Get protein structure predictions from sequences

## Scope
4 workstreams, executed in order:

### WS1: API Transparency
- Upgrade `fetchWithFallback` to return clear `source: 'live' | 'mock'` metadata
- Add `DataSourceBadge` to ALL tool pages (not just CatDes/PathD)
- When API fails, show "Using demo data — [API name] unavailable" with retry button
- Persist data source state in workbench payload

### WS2: File Upload Expansion
- CatDes: PDB file upload for protein structures
- CETHX: CSV upload for custom thermodynamic data
- GenMIM: CSV upload for gene target lists
- All uploads use existing `DataUpload` component pattern

### WS3: Global DataSourceBadge
- Add `DataSourceBadge` to every tool page header
- Show live/demo status for each data source the tool uses
- Color-coded: green=live, yellow=mixed, gray=demo

### WS4: AlphaFold/ESMFold Integration
- Wire `esmfoldClient.ts` into CatDes for sequence→structure prediction
- Add "Predict Structure" button in 3D Viewer tab
- Show predicted structure in ProteinViewer
- Handle loading/error states

## Constraints
- No breaking changes to existing tool functionality
- All uploads must validate input format before processing
- API failures must never crash the page — always fall back gracefully
- DataSourceBadge must use existing component from `src/components/ide/shared/DataSourceBadge.tsx`
