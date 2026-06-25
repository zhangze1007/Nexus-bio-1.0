# README Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Update README.md to reflect the current state of Nexus-Bio after the v1.0 session (23+ engines, Smart Entry, performance optimizations, CatDes restructure, etc.)

**Architecture:** Single file update — `README.md` at project root.

## Global Constraints

- Keep the existing 4-stage research cycle diagram (it's still accurate)
- Keep the existing badge format
- Update all numbers to match current reality
- Keep the tone professional and factual
- Don't add marketing fluff

---

### Task 1: Update README.md

**Files:**
- Modify: `README.md`

**Content to update:**

1. **Header badges** — Update test count from `1994_passing` to `3346_passing`

2. **"14 Tools"** → Update to reflect current state. The platform now has:
   - 14 tool pages (unchanged)
   - 37+ compute engines (was ~14)
   - 8 database integrations (was 6)
   - Smart Entry system (new)
   - Goal-driven workflow (new)

3. **Tool list** — Add the new engines integrated into existing pages:
   - CatDes: +Inverse Folding, Biosensor, RNA Engineering, Regulatory Design
   - GenMIM: +Multiplex CRISPR, Biosafety, GEM Reconstruction
   - DynCon: +Digital Twin, Bioprocess Optimization, Bioreactor Analytics
   - MultiO: +Fluxomics, 13C-MFA
   - FBAsim: +Consortium Design, Custom Model
   - PathD: +Pathway Discovery

4. **Database integrations** — Update from 6 to 8:
   - KEGG, BiGG, BRENDA, UniProt, PubChem, AlphaFold
   - + SABIO-RK (enzyme kinetics)
   - + Semantic Scholar (literature)

5. **New sections** to add:
   - **Smart Entry** — Goal-driven routing (molecule/strain/DOI/metric → tool chain)
   - **Performance** — Self-hosted fonts, ONNX dynamic loading, API caching
   - **Scientific Honesty** — @scientific_provenance annotations, validity badges, SABIO-RK integration

6. **Update the "Getting Started"** section if it references outdated commands

**Steps:**
- [ ] Read current README.md
- [ ] Update badge count
- [ ] Update tool/engine counts
- [ ] Add new engine descriptions to existing tool sections
- [ ] Add Smart Entry section
- [ ] Add Database Integrations section (8 sources)
- [ ] Add Scientific Honesty section
- [ ] Run `npx tsc --noEmit` to verify no broken links
- [ ] Commit: `docs: update README to reflect current platform state`
