# Nexus-Bio 1.0 — Synthetic Biology Technology Gap & IP Infringement Audit

**Date:** 2026-06-25
**Auditor:** Claude Code (ultracode mode)
**Scope:** Full codebase (35 critical files, package.json, requirements.txt, 14 tool pages, all API routes)

---

## PART 1: SYNTHETIC BIOLOGY TECHNOLOGY GAP ANALYSIS

### Current Coverage Summary

Nexus-Bio 1.0 covers **14 tools** across the 4-stage synthetic biology research cycle:

| Stage | Tools | Coverage Level |
|-------|-------|---------------|
| Design & Discovery | PathD, NEXAI | Pathway discovery, literature search, KEGG/BiGG/Rhea integration |
| Simulation & Optimization | FBAsim, CETHX, CATDES, ProEvol, CellFree | FBA, thermodynamics, enzyme design, directed evolution, cell-free TX-TL |
| Chassis Engineering | GenMIM, GECAIR, DynCon | CRISPRi knockdown, gene circuits, dynamic control |
| Test & Iterate | DBTLflow, MultiO, ScSpatial | DBTL tracking, multi-omics, spatial transcriptomics |

### CRITICAL GAPS — Technologies Missing Entirely

#### GAP-1: Generative Protein Design (CRITICAL)

**What's missing:** No de novo protein backbone or sequence generation capability.

**State of the art (2024-2026):**
- **RFdiffusion** (Baker Lab, Watson et al. Nature 2023) — diffusion-based de novo protein backbone design. Generates binders, symmetric assemblies, enzyme scaffolds from noise. Open source (MIT).
- **ESM-3** (Meta/EvolutionaryScale, 2024) — multimodal generative protein LM reasoning over sequence + structure + function simultaneously. Generated esmGFP (novel fluorescent protein) de novo. Open source.
- **Chroma** (Generate Biomedicines, 2023) — property-conditioned protein generation (specify fold → get valid sequences). Partially open source.
- **ProGen/ProGen2** (Salesforce) — autoregressive protein LM generating functional enzymes conditioned on function tags.
- **LigandMPNN** (Baker Lab) — extends ProteinMPNN to design sequences for binding pockets with small molecules. Open source (MIT).

**Nexus-Bio status:** ProEvol does round-based directed evolution simulation. CATDES uses BLOSUM62 substitution matrices. The inversefolding entry in the registry is forward-looking. None of these are generative.

**Impact:** This is the #1 gap. De novo protein design has become the standard expectation for any protein engineering platform in 2024-2026.

---

#### GAP-2: AlphaFold3 / Biomolecular Complex Prediction (HIGH)

**What's missing:** Only single-chain PDB retrieval from EBI. No protein-ligand, protein-DNA, protein-protein complex prediction.

**State of the art:**
- **AlphaFold3** (DeepMind, Abramson et al. Nature 2024) — predicts full biomolecular complexes using diffusion-based architecture. Handles protein-ligand, protein-nucleic acid, protein-protein, ion coordination.
- **DiffDock** — diffusion-based molecular docking for small molecules.
- **OpenFold3 / HelixFold3** — community reimplementations.

**Nexus-Bio status:** `/api/alphafold` proxies EBI AlphaFold DB for single-chain PDB retrieval only. No complex prediction, no docking.

**Impact:** Cannot model enzyme-substrate interactions, drug-target binding, or protein-protein interactions — essential for enzyme design and metabolic engineering.

---

#### GAP-3: RNA Engineering Suite (HIGH)

**What's missing:** No mRNA design, codon optimization, circular RNA, self-amplifying RNA, UTR engineering, or RNA vaccine design tools.

**State of the art:**
- **mRNA design optimization** — 5' UTR optimization, codon optimization, N1-methylpseudouridine incorporation, cap analog design, poly(A) tail engineering.
- **Circular RNA (circRNA)** — covalently closed RNA loops with enhanced stability. Orna Therapeutics, Circio advancing therapeutics.
- **Self-amplifying RNA (saRNA)** — ARCT-154 (Arcturus) approved Japan 2023. Lower doses via self-replication.
- **AHEAD** — automated high-throughput RNA design.

**Nexus-Bio status:** rnaEngine.ts has hammerhead ribozymes, siRNA, toehold switches, aptamers. No mRNA/circRNA/saRNA design, no codon optimization, no UTR engineering.

**Impact:** RNA therapeutics and mRNA vaccines are the fastest-growing area of synthetic biology (post-COVID). Missing this entirely is a significant gap.

---

#### GAP-4: CRISPR Editing Design Beyond CRISPRi (HIGH)

**What's missing:** Only CRISPRi knockdown scheduling. No prime editing, base editing, epigenome editing, or PASTE design.

**State of the art:**
- **Prime editing** (PE3, PEmax, Twin Prime, GRAND editing) — precise insertions, deletions, all 12 point mutation types without DSBs. Prime Medicine PM359 in clinical trials 2024.
- **Base editing** (ABE8e, CGBEs, glycosylase base editors) — A→G and C→T conversions without DSBs. First CRISPR therapy (Casgevy) approved late 2023.
- **Epigenome editing** (CRISPRoff/CRISPRon, dCas9-DNMT3A/TET1/p300/KRAB) — heritable gene silencing/activation without DNA changes.
- **PASTE** (Yarnall et al. Nat Biotech 2023) — large DNA cargo insertion (>1 kb) via CRISPR + serine integrases.
- **Perturb-seq / spatial CRISPRi** — CRISPRi/a screening at scale with single-cell readout.

**Nexus-Bio status:** GenMIM does CRISPRi knockdown scheduling only. No pegRNA design, no base editing prediction, no epigenome editing tools.

**Impact:** CRISPRi is foundational but 2015-era. The clinical and research frontier has moved to precision editing.

---

#### GAP-5: DNA Assembly Design (MEDIUM)

**What's missing:** No Gibson/Golden Gate/MoClo assembly design, no codon optimization, no synthesis order generation.

**State of the art:**
- **Enzymatic DNA synthesis** (Ansa, DNA Script, Camena) — template-independent TdT-based synthesis. Benchtop synthesizers.
- **Gibson/Golden Gate/MoClo** — standardized modular cloning for complex constructs.
- Automated multi-part assembly integration with enzymatic synthesis.

**Nexus-Bio status:** DBTLflow generates protocols and exports SBOL. No assembly design algorithms, no codon optimization engine.

---

#### GAP-6: Lab Automation / Biofoundry Integration (MEDIUM)

**What's missing:** No robot-compatible protocol export, no closed-loop automation.

**State of the art:**
- **Opentrons OT-2/Flex** — open-source liquid handling. Protocol-sharing ecosystem.
- **Strateos / Emerald Cloud Lab** — cloud robotic labs accessible via API.
- **Self-driving labs** (Arctoris, Cradle, Recursive) — closed-loop ML-guided experimentation.

**Nexus-Bio status:** DBTLflow is a workflow tracker, not an automation controller. No OT-2 JSON export, no Antha experiment files.

---

#### GAP-7: Biosafety/Biosecurity Screening (MEDIUM)

**What's missing:** No sequence-of-concern detection, no dual-use risk assessment.

**State of the art:**
- **SecureDNA** — open-source DNA synthesis screening against dangerous pathogen sequences.
- **U.S. Framework for Nucleic Acid Synthesis Screening** (2024).
- **NIST Framework for AI & Biosecurity**, EBRC roadmaps, NTI guidelines.

**Nexus-Bio status:** blast_service.py does BLAST against VFDB/CARD for off-target analysis. Trust policy engine covers provenance. But no formal biosafety screening integrated into design workflow.

---

#### GAP-8: Microbiome Engineering / Synthetic Ecology (MEDIUM)

**What's missing:** No dedicated consortia design, cross-feeding network modeling, spatial ecology simulation.

**State of the art:**
- Synthetic microbial consortia design with division of labor, cross-feeding, spatial structuring.
- Agent-based modeling of microbial communities.
- Microbiome therapeutics (Synlogic, Vedanta Biosciences).

**Nexus-Bio status:** FBAsim does community FBA (heuristic, not SteadyCom). No dedicated microbiome design tool.

---

#### GAP-9: Molecular Docking / Structure-Based Drug Design (MEDIUM)

**What's missing:** No docking, no ligand binding prediction, no SBDD pipeline.

**State of the art:**
- **DiffDock** — diffusion-based molecular docking.
- **NVIDIA BioNeMo** — GPU-accelerated biomolecular modeling.
- **Schrödinger** — physics-based + ML SBDD pipeline.

**Nexus-Bio status:** AlphaFold proxy retrieves PDB only. No docking capability.

---

#### GAP-10: Continuous Evolution Platforms (LOW)

**What's missing:** No PACE/OrthoRep modeling, no active learning loop for evolution.

**State of the art:**
- **PACE** (David Liu Lab) — continuous phage-assisted evolution. Hundreds of rounds in days.
- **OrthoRep** (Chang Liu Lab) — orthogonal replication in yeast for continuous mutagenesis.

**Nexus-Bio status:** ProEvol simulates round-based campaigns. No continuous evolution modeling.

---

#### GAP-11: Whole-Cell Modeling / Cell-Level Digital Twins (LOW)

**What's missing:** No whole-cell model integration.

**State of the art:**
- **Covert Lab E. coli WCM** (~1,200 genes) — comprehensive computational model.
- **EU Virtual Human Twin** initiative.

**Nexus-Bio status:** digitaltwin has bioreactor EKF. No cell-level WCM integration.

---

#### GAP-12: Joint Multi-Omics (CITE-seq, SHARE-seq) (LOW)

**What's missing:** No protein+RNA or RNA+ATAC joint analysis from same cell.

**State of the art:**
- **CITE-seq** (RNA + surface protein), **SHARE-seq / 10x Multiome** (RNA + chromatin)
- **MUON, TotalVI, MultiVI, cell2location, SPOTlight**

**Nexus-Bio status:** MultiO covers MOFA+/VAE/UMAP. No CITE-seq or joint RNA+ATAC analysis.

---

#### GAP-13: Biosensor Design (LOW)

**What's missing:** No transcription factor-based biosensor design tool.

**Nexus-Bio status:** DynCon does Hill-function feedback. No biosensor design for metabolite-responsive TFs.

---

### Technology Gap Priority Matrix

| Priority | Gap | Effort to Close | Business Impact |
|----------|-----|----------------|-----------------|
| **P0** | Generative protein design | HIGH (new tool + API) | CRITICAL — table stakes in 2026 |
| **P0** | AlphaFold3 complex prediction | MEDIUM (extend proxy) | HIGH — essential for enzyme eng |
| **P1** | RNA engineering suite | HIGH (new tool) | HIGH — fastest-growing synbio area |
| **P1** | CRISPR editing design | MEDIUM (extend GenMIM) | HIGH — precision editing standard |
| **P2** | DNA assembly design | LOW-MEDIUM | MEDIUM — workflow completeness |
| **P2** | Lab automation bridge | LOW (protocol export) | MEDIUM — industry adoption driver |
| **P2** | Biosafety screening | LOW (integrate SecureDNA) | MEDIUM — regulatory requirement |
| **P2** | Microbiome engineering | MEDIUM (new tool) | MEDIUM — emerging field |
| **P3** | Molecular docking/SBDD | MEDIUM (new tool) | MEDIUM — drug design pipeline |
| **P3** | Continuous evolution | LOW (modeling layer) | LOW — niche but growing |
| **P3** | Whole-cell modeling | HIGH (research-grade) | LOW — academic frontier |
| **P3** | Joint multi-omics | MEDIUM (extend MultiO) | LOW — specialized use case |
| **P3** | Biosensor design | LOW (new module) | LOW — niche application |

---

## PART 2: IP INFRINGEMENT & LICENSING COMPLIANCE AUDIT

### Executive Summary

| Risk Level | Count | Items |
|------------|-------|-------|
| **HIGH** | 2 | Toehold switch patents, KEGG commercial license |
| **MODERATE** | 5 | BRENDA license, ViennaRNA license, copyleft deps (leidenalg/mofapy2), OptKnock (expired), CARD download |
| **LOW** | 8 | BiGG, ESM-2, AlphaFold DB, PubChem, Rhea, ProteinMPNN, HiGHS, standard biochem methods |

**No code-level copyright infringement found.** No third-party source code was copied. All algorithm implementations are original simplified approximations of published methods.

---

### HIGH RISK — Immediate Action Required

#### IP-1: Toehold Switch Patents [HIGH]

- **File:** `src/modules/rna-engine/rnaEngine.ts` (lines 282-317)
- **Patent:** US Patent 10,329,576 and related filings (Green lab / associated institutions)
- **Issue:** Implements toehold switch design referencing Green et al. (2014) Cell 159:925-939. Toehold switches are RNA-based translational regulators covered by patents expiring ~2034.
- **Scope:** The implementation is a simplified design heuristic, not a full biophysical simulation. But the toehold switch concept itself is patent-encumbered.
- **Risk:**
  - Academic/non-commercial: Low practical risk (research exemption).
  - Commercial: **Requires license from patent holder** or alternative design approach.
- **Recommendation:**
  - Add `@patent_notice` annotation to code.
  - Add UI disclaimer: "Toehold switch design — patent-encumbered; for research use only."
  - If commercial: obtain license, or replace with alternative RNA switch (riboregulators, strand displacement).

#### IP-2: KEGG Database — Commercial License Required [HIGH]

- **Files:**
  - `src/server/pathwayDiscoveryEngine.ts` — 500+ hardcoded reactions with KEGG reaction IDs, EC numbers, deltaG values, organism associations
  - `app/api/kegg/route.ts` — live KEGG REST API proxy (4 endpoints)
  - `src/services/database/keggClient.ts` — client library
- **License terms:** KEGG REST API is "public and free for academic use" (comment in kegg/route.ts line 16). **Commercial use requires a paid KEGG license** from Kanehisa Laboratories.
- **Scope:** The 500+ reaction compilation in pathwayDiscoveryEngine.ts constitutes a **derived database** from KEGG. Multiple tools depend on KEGG data: PathD, MetabolicEng, CETHX, FBAsim.
- **Risk:** HIGH for commercial deployment.
- **Recommendation:**
  - Academic: compliant as-is.
  - Commercial: contact Kanehisa Laboratories for license (http://www.kegg.jp/kegg/legal.html). Alternative: migrate to MetaCyc/BiGG (CC-BY-4.0) for reactions, though narrower coverage.
  - Add license notice to all KEGG-using components.

---

### MODERATE RISK — Plan for Resolution

#### IP-3: BRENDA Database [MODERATE]

- **Files:** `src/services/database/brendaClient.ts`, `src/services/database/index.ts`
- **License:** BRENDA (brenda-enzymes.org) — academic free; commercial requires license.
- **Scope:** Used for Km/kcat values in metabolic engineering tools.
- **Recommendation:** Obtain commercial license or migrate to SABIO-RK (free for all uses) or eQuilibrator.

#### IP-4: ViennaRNA [MODERATE]

- **Files:** `src/modules/rna-engine/rnaEngine.ts`, `scspatial-backend/main.py`, `scspatial-backend/requirements.txt`, `scspatial-backend/Dockerfile`
- **License:** Custom academic license (University of Vienna). Free for academic use; commercial requires license.
- **Scope:** Used for RNA secondary structure prediction (Nussinov/MFE folding).
- **Recommendation:** Obtain commercial license, or replace with LinearFold (free) or pure Nussinov implementation.

#### IP-5: Copyleft Dependencies [MODERATE]

- **File:** `scspatial-backend/requirements.txt`
- **Issues:**
  - `leidenalg==0.10.2` — **GPL-3.0** (strong copyleft)
  - `mofapy2>=0.7.0` — **LGPL-3.0** (weak copyleft)
- **Risk analysis:**
  - SaaS deployment (no distribution): GPL copyleft does NOT trigger. **LOW risk.**
  - Distributing Docker image / pip package: GPL-3.0 requires derivative work to be GPL-licensed. LGPL-3.0 requires library to be replaceable.
- **Recommendation:** If ever distributing, replace `leidenalg` with BSD-licensed alternative (e.g., `graspologic`). Add `THIRD_PARTY_LICENSES.md`.

#### IP-6: OptKnock Patent [MODERATE → LOW]

- **File:** `app/api/fba/route.ts`
- **Patent:** US Patent 7,127,379 (UC, filed 2002). 20-year term → **expired 2022**.
- **Status:** Patent expired. Code uses simplified iterative LP, not original bilevel MILP.
- **Risk:** LOW. No active patent.

#### IP-7: CARD Database Download [MODERATE → LOW]

- **File:** `scspatial-backend/blast_service.py`
- **License:** CC-BY-4.0. Download URL may require registration.
- **Risk:** LOW. CC-BY-4.0 permits commercial use with attribution.

---

### LOW RISK — No Action Required

| # | Item | License | Files | Status |
|---|------|---------|-------|--------|
| IP-8 | BiGG | CC-BY-4.0 | biggClient.ts, bigg/route.ts | Fully compliant |
| IP-9 | ESM-2 / ESM Atlas | MIT | esm2Client.ts, esm2/route.ts | Fully compliant |
| IP-10 | AlphaFold DB | CC-BY-4.0 | alphafold/route.ts | Fully compliant |
| IP-11 | PubChem | Public domain (US gov) | pubchem/route.ts | Fully compliant |
| IP-12 | Rhea | Academic free | rheaClient.ts, rhea/route.ts | Compliant (verify commercial) |
| IP-13 | ProteinMPNN concepts | MIT | inverseFoldingEngine.ts | Simplified approximation, not copy |
| IP-14 | HiGHS solver | MIT | fbaEngine.ts, fba/route.ts | Fully compliant |
| IP-15 | Standard biochemistry | Public domain | kinetics.ts, thermodynamics.ts | No IP concern |

---

### Dependency License Audit

#### Node.js (package.json) — ALL PERMISSIVE

| Package | License | Risk |
|---------|---------|------|
| highs | MIT | NONE |
| onnxruntime-web | MIT | NONE |
| pyodide | MPL-2.0 | NONE (SaaS-safe) |
| umap-js | MIT | NONE |
| @sentry/nextjs | BSL-1.1/MIT | NONE |
| @aws-sdk/client-s3 | Apache-2.0 | NONE |
| @libsql/client | MIT | NONE |
| @react-three/fiber | MIT | NONE |
| @react-three/drei | MIT | NONE |
| three | MIT | NONE |
| xstate | MIT | NONE |
| next-auth | ISC | NONE |
| drizzle-orm | Apache-2.0 | NONE |
| @upstash/redis | MIT | NONE |
| framer-motion | MIT | NONE |
| recharts | MIT | NONE |

**No copyleft or problematic licenses in Node.js dependencies.**

#### Python (requirements.txt) — TWO COPIFY

| Package | License | Risk |
|---------|---------|------|
| scanpy | BSD-3 | NONE |
| squidpy | Apache-2.0 | NONE |
| anndata | BSD-3 | NONE |
| mofapy2 | **LGPL-3.0** | LOW (SaaS-safe) |
| mofax | MIT | NONE |
| umap-learn | BSD-3 | NONE |
| biopython | BSD-3 | NONE |
| ViennaRNA | **Custom academic** | MODERATE |
| leidenalg | **GPL-3.0** | LOW (SaaS-safe) |
| scikit-learn | BSD-3 | NONE |
| fastapi | MIT | NONE |

---

### Code-Level Copyright Analysis

**No copied source code found.** All 35 critical files examined:

- No third-party code copied without attribution
- No license headers from other projects present
- No GPL/copyleft code incorporated into Nexus-Bio source
- All algorithm implementations are original simplified approximations
- Academic references and `@scientific_provenance` annotations present throughout

**The codebase is clean from a code-copyright perspective.**

---

### Data Provenance Audit

| Data Source | How Used | License | Risk |
|------------|----------|---------|------|
| KEGG (500+ reactions) | Hardcoded in pathwayDiscoveryEngine | Academic free; commercial license | **HIGH** |
| KEGG REST API | Proxied via kegg/route.ts | Academic free; commercial license | **HIGH** |
| BRENDA (Km/kcat) | Client library | Academic free; commercial license | **MODERATE** |
| BiGG (iJO1366) | FBA stoichiometric data | CC-BY-4.0 | LOW |
| eQuilibrator (ΔG) | Hardcoded | CC-BY | LOW |
| Rhea | REST proxy | Academic free | LOW |
| UniProt | Client library | CC-BY-4.0 | LOW |
| PubChem | REST proxy | Public domain | NONE |
| AlphaFold DB | REST proxy | CC-BY-4.0 | NONE |
| Atchley factors | Hardcoded | Published academic data | NONE |
| BLOSUM62 | Hardcoded | Public domain | NONE |
| E. coli genome | BLAST reference | NCBI public domain | NONE |
| VFDB | BLAST database | Academic free | LOW |
| CARD | BLAST database | CC-BY-4.0 | LOW |

---

### Security Concerns (Not IP, But Noted)

1. **`execSync` in inverseFoldingEngine.ts (line 925):** Uses `execSync` + `curl` for ESM-2 API calls. Shell injection risk. Replace with `fetch()`.
2. **HTTP in bigg/route.ts (line 5):** `http://bigg.ucsd.edu/api/v3/models` — should use HTTPS.

---

## PART 3: RECOMMENDATIONS

### Immediate (Before Commercial Launch)

| # | Action | Risk |
|---|--------|------|
| 1 | Add patent disclaimer to toehold switch design UI | Toehold patents |
| 2 | Add KEGG/BRENDA license notices to all affected tools | Database licensing |
| 3 | Contact Kanehisa Labs for KEGG commercial license | KEGG compliance |
| 4 | Create `THIRD_PARTY_LICENSES.md` | Full transparency |
| 5 | Replace `execSync` + `curl` with `fetch()` in inverseFoldingEngine.ts | Security |
| 6 | Change BiGG API URL from HTTP to HTTPS | Security |

### Short-Term (Next Quarter)

| # | Action | Gap |
|---|--------|-----|
| 7 | Integrate ESM-3 API or host ESM-3 for de novo protein design | GAP-1 |
| 8 | Extend AlphaFold proxy for AF3 complex prediction | GAP-2 |
| 9 | Add prime/base editing design to GenMIM | GAP-4 |
| 10 | Implement codon optimization engine | GAP-5 |
| 11 | Add SecureDNA-style screening | GAP-7 |

### Medium-Term (6 Months)

| # | Action | Gap |
|---|--------|-----|
| 12 | Build RNA engineering suite (mRNA/circRNA/saRNA) | GAP-3 |
| 13 | Add Gibson/Golden Gate assembly designer | GAP-5 |
| 14 | Export DBTLflow protocols in OT-2 JSON format | GAP-6 |
| 15 | Replace `leidenalg` with BSD-licensed alternative | IP-5 |

---

*Report generated by Claude Code on 2026-06-25. Consult legal counsel for commercial licensing decisions.*
