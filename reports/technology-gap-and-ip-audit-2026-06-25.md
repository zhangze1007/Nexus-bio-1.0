# Nexus-Bio 1.0 — Technology Gap & IP Infringement Audit

**Date:** 2026-06-25
**Scope:** Full codebase audit (35 critical files, 14 tool pages, all API routes, Python backend, package dependencies)
**Auditor:** Claude Code (ultracode mode)

---

## PART A: SYNTHETIC BIOLOGY TECHNOLOGY GAP ANALYSIS

### Current Coverage (14 Tools)

| # | Tool | What It Covers | Depth |
|---|------|---------------|-------|
| 1 | PathD | Pathway Designer — wraps MetabolicEngPage | ★★★ |
| 2 | MetabolicEng | 3D metabolic lab, XState FSM, 60 Hz FBA worker | ★★★★ |
| 3 | CATDES | Enzyme design: binding affinity, sequence, mutagenesis | ★★★ |
| 4 | CellFree | Cell-free TX-TL simulation, ODE kinetics, yield prediction | ★★★ |
| 5 | CETHX | Thermodynamics: ΔG cascade, ATP accounting, feasibility | ★★★★ |
| 6 | DBTLflow | DBTL cycle tracker, protocol generation, SBOL | ★★★ |
| 7 | DynCon | Dynamic control: bioreactor sim, Hill feedback, RK4 ODE | ★★★★ |
| 8 | FBAsim | FBA: single + community, knockout/OE, shadow prices | ★★★★ |
| 9 | GECAIR | Gene circuits: logic gates, Hill curves, dynamics | ★★★★ |
| 10 | GenMIM | Genome minimization: CRISPRi knockdown scheduling | ★★★ |
| 11 | MultiO | Multi-omics: VAE/UMAP, volcano, MOFA+ factors | ★★★ |
| 12 | NEXAI | AI research agent: citation verification, Socratic Q | ★★★ |
| 13 | ProEvol | Protein evolution: fitness landscape, trajectory | ★★★ |
| 14 | ScSpatial | Single-cell spatial: hex grid, UMAP, spatial autocorrelation | ★★★ |

### CRITICAL GAPS vs. 2024-2026 State-of-the-Art

#### GAP 1 — De Novo Protein Design [CRITICAL]

**What's missing:** No generative protein backbone or sequence design capability whatsoever.

**State of the art (2024-2026):**
- **RFdiffusion** (Baker Lab, Watson et al. Nature 2023): Diffusion model for de novo protein backbone generation — binders, symmetric assemblies, enzyme scaffolds from noise. MIT licensed. GitHub: RosettaCommons/RFdiffusion.
- **ESM-3** (Meta/EvolutionaryScale, Hayes et al. 2024): Multimodal generative protein LM reasoning over sequence + structure + function. Generated esmGFP — a novel fluorescent protein from scratch. Open source.
- **ProGen/ProGen2** (Salesforce): Autoregressive protein LM that generates functional enzymes conditioned on property tags.
- **Chroma** (Generate Biomedicines, Kroll et al. 2023): Diffusion model conditioned on fold specifications, symmetry, substructure composition.
- **ProteinMPNN/LigandMPNN** (Baker Lab): GNN for inverse folding — given backbone, design sequences. MIT licensed.

**Nexus-Bio status:** ProEvol simulates directed evolution campaigns (round-based libraries, survivor selection). ESM-2 client provides embeddings and fitness prediction. But there is zero de novo generation, no diffusion models, no property-conditioned design, no inverse folding beyond simplified heuristics.

**Impact:** This is the single biggest gap. De novo protein design has become the standard workflow in 2024-2026 synthetic biology. Every major platform (Cradle, Generate, Profluent, Isomorphic Labs) centers on generative design.

---

#### GAP 2 — AlphaFold3 Complex Prediction [HIGH]

**What's missing:** Only single-chain PDB retrieval from EBI AlphaFold DB.

**State of the art:**
- **AlphaFold3** (DeepMind, Abramson et al. Nature 2024): Predicts protein-ligand, protein-DNA, protein-RNA, protein-protein complexes using diffusion-based architecture. Available via server for non-commercial use; community reimplementations (OpenFold3, HelixFold3) exist.
- **DiffDock**: Diffusion-based molecular docking.
- **LigandMPNN**: Extends inverse folding to small-molecule binding sites.

**Nexus-Bio status:** `app/api/alphafold/route.ts` proxies EBI for single-chain PDB only. No complex prediction, no ligand docking, no protein-protein interaction modeling.

**Impact:** Cannot model enzyme-substrate interactions, drug-target binding, or protein complexes — essential for modern enzyme engineering and metabolic pathway design.

---

#### GAP 3 — RNA Engineering [HIGH]

**What's missing:** No mRNA design, codon optimization, circular RNA, saRNA, or UTR design tools.

**State of the art:**
- **Circular RNA (circRNA)**: Covalently closed loops with enhanced stability. Orna Therapeutics, Circio advancing therapeutics.
- **Self-Amplifying RNA (saRNA)**: ARCT-154 (Arcturus) approved in Japan 2023 as first saRNA vaccine. Lower doses, self-replication.
- **mRNA design optimization**: 5' UTR optimization, codon optimization, N1-methylpseudouridine, cap analog design, poly(A) tail engineering.
- **AHEAD**: Automated high-throughput RNA design.

**Nexus-Bio status:** `src/modules/rna-engine/rnaEngine.ts` implements hammerhead ribozymes, siRNA design, toehold switches, and aptamer design. No mRNA/circRNA/saRNA design, no codon optimization, no UTR engineering.

**Impact:** RNA therapeutics and mRNA vaccines are the fastest-growing area of synthetic biology (2024-2026). Missing this entirely is a significant gap.

---

#### GAP 4 — CRISPR Editing Design Beyond CRISPRi [HIGH]

**What's missing:** Only CRISPRi knockdown scheduling. No prime editing, base editing, epigenome editing, or PASTE design.

**State of the art:**
- **Prime editing** (PE3, PEmax, Twin Prime, GRAND): Writes precise edits without DSBs. Prime Medicine PM359 in clinical trials 2024. Anzalone et al. Nature 2019.
- **Base editing** (ABE8e, CGBEs): A→G and C→T conversions without DSBs. Beam Therapeutics, Verve Therapeutics in clinical programs. First CRISPR therapy (Casgevy) approved late 2023.
- **Epigenome editing** (CRISPRoff/CRISPRon): Heritable gene silencing without DNA changes. Tune Therapeutics, Chroma Medicine advancing to clinic.
- **PASTE** (Yarnall et al. Nat Biotech 2023): Large DNA cargo insertion (>1 kb) without HDR using CRISPR + serine integrases.
- **Perturb-seq**: CRISPRi/a screening at scale with single-cell readout.

**Nexus-Bio status:** GenMIM focuses exclusively on CRISPRi knockdown scheduling. No pegRNA design, no base editing target selection, no epigenome effector design, no large cargo insertion planning.

**Impact:** CRISPRi is 2015-era technology. The field has moved dramatically to precision editing tools.

---

#### GAP 5 — DNA Assembly Design [MEDIUM]

**What's missing:** No Gibson/Golden Gate/MoClo assembly design, no codon optimization, no synthesis order generation.

**State of the art:**
- **Enzymatic DNA synthesis** (Ansa, DNA Script, Camena): Template-independent TdT-based synthesis. Benchtop synthesizers.
- **Gibson Assembly innovations**: Automated multi-part assembly, higher efficiency enzyme cocktails.
- **Golden Gate / MoClo**: Standardized modular cloning for complex constructs.

**Nexus-Bio status:** DBTLflow generates assembly protocols and exports SBOL, but has no actual assembly design algorithms, no codon optimization engine, no synthesis order interface.

---

#### GAP 6 — Lab Automation / Biofoundry Integration [MEDIUM]

**What's missing:** No robot-compatible protocol export, no closed-loop automation.

**State of the art:**
- **Opentrons OT-2/Flex**: Open-source liquid handling. Protocol-sharing ecosystem.
- **Strateos/Emerald Cloud Lab**: Cloud robotic labs accessible via API.
- **Self-driving labs** (Arctoris, Cradle, Recursive): Closed-loop ML-guided experimentation.
- **Ginkgo Bioworks**: Industrial-scale organism engineering foundry.

**Nexus-Bio status:** DBTLflow is a workflow tracker, not an automation controller. No OT-2 JSON export, no Antha experiment files, no hardware integration.

---

#### GAP 7 — Biosafety/Biosecurity Screening [MEDIUM]

**What's missing:** No sequence-of-concern detection, no dual-use risk assessment.

**State of the art:**
- **SecureDNA** (open source): Screening DNA synthesis orders against dangerous pathogen sequences.
- **U.S. Framework for Nucleic Acid Synthesis Screening** (2024): Federal guidelines.
- **NIST Framework for AI & Biosecurity**, EBRC roadmaps, NTI guidelines.

**Nexus-Bio status:** Trust policy engine covers provenance and evidence tracing. blast_service.py does BLAST against VFDB/CARD for off-target analysis. But no formal biosafety screening pipeline, no sequence-of-concern detection integrated into design workflow.

---

#### GAP 8 — Microbiome Engineering [MEDIUM]

**What's missing:** No dedicated consortia design, cross-feeding network modeling, or spatial ecology simulation.

**State of the art:**
- **Synthetic microbial consortia**: Division of labor, cross-feeding, spatial structuring.
- **Agent-based modeling** of microbial communities.
- **Microbiome therapeutics**: Synlogic, Vedanta Biosciences.

**Nexus-Bio status:** FBAsim does community FBA (heuristic, not SteadyCom). No dedicated microbiome design tool.

---

#### GAP 9 — Molecular Docking / SBDD [MEDIUM]

**What's missing:** No docking, no ligand binding prediction, no structure-based drug design pipeline.

**Nexus-Bio status:** AlphaFold proxy retrieves PDB only. No docking capability.

---

#### GAP 10 — Continuous Evolution Platforms [LOW]

**What's missing:** No PACE/OrthoRep modeling, no active learning loop for evolution.

**State of the art:**
- **PACE** (David Liu Lab): Continuous phage-assisted evolution. Hundreds of rounds in days.
- **OrthoRep** (Chang Liu Lab): Orthogonal replication in yeast for continuous mutagenesis.
- **ML-guided directed evolution**: Active learning loops selecting next variants.

**Nexus-Bio status:** ProEvol simulates discrete round-based campaigns. No continuous evolution modeling.

---

#### GAP 11 — Whole-Cell Modeling [LOW]

**What's missing:** No whole-cell model import or integration.

**State of the art:**
- **Covert Lab E. coli WCM** (~1,200 genes): Comprehensive computational model integrating all known pathways.
- **EU Virtual Human Twin initiative**.

**Nexus-Bio status:** Digital twin exists for bioreactors (EKF). No cell-level whole-cell model.

---

#### GAP 12 — Joint Multi-Omics (CITE-seq, SHARE-seq) [LOW]

**What's missing:** No protein+RNA or RNA+ATAC joint analysis from same cell.

**Nexus-Bio status:** MultiO covers MOFA+/VAE/UMAP. ScSpatial covers spatial transcriptomics. No CITE-seq, no joint RNA+ATAC, no cell2location/SPOTlight deconvolution.

---

#### GAP 13 — Biosensor Design [LOW]

**What's missing:** No transcription factor-based biosensor design tool.

**Nexus-Bio status:** DynCon does Hill-function feedback control. No biosensor design for metabolite-responsive transcription factors.

---

### Technology Gap Priority Matrix

| Priority | Gap | Effort to Close | Business Impact |
|----------|-----|----------------|-----------------|
| P0 | De novo protein design | HIGH (new tool + API integration) | CRITICAL — table stakes in 2026 |
| P0 | AlphaFold3 complex prediction | MEDIUM (extend existing proxy) | HIGH — essential for enzyme eng. |
| P1 | RNA engineering suite | HIGH (new tool) | HIGH — fastest-growing synbio area |
| P1 | CRISPR editing design | MEDIUM (extend GenMIM) | HIGH — precision editing is standard |
| P2 | DNA assembly design | LOW-MEDIUM (new module) | MEDIUM — workflow completeness |
| P2 | Lab automation bridge | LOW (protocol export) | MEDIUM — industry adoption driver |
| P2 | Biosafety screening | LOW (integrate SecureDNA) | MEDIUM — regulatory requirement |
| P2 | Microbiome engineering | MEDIUM (new tool) | MEDIUM — emerging field |
| P3 | Molecular docking/SBDD | MEDIUM (new tool) | MEDIUM — drug design pipeline |
| P3 | Continuous evolution | LOW (modeling layer) | LOW — niche but growing |
| P3 | Whole-cell modeling | HIGH (research-grade) | LOW — academic frontier |
| P3 | Joint multi-omics | MEDIUM (extend MultiO) | LOW — specialized use case |
| P3 | Biosensor design | LOW (new module) | LOW — niche application |

---

## PART B: IP INFRINGEMENT & LICENSING COMPLIANCE AUDIT

### Executive Summary

The IP audit identified **2 high-risk items**, **5 moderate-risk items**, and **8 low-risk items**. No code-level copyright infringement was found (no copied source code). The risks are primarily related to **database licensing terms for commercial use** and **one patent-encumbered technology**.

---

### HIGH RISK — Immediate Action Required

#### 1. Toehold Switch Patents [HIGH]

- **File:** `src/modules/rna-engine/rnaEngine.ts` (lines 282-317)
- **Issue:** Implements toehold switch design referencing Green et al. (2014) Cell 159:925-939.
- **Patent:** US Patent 10,329,576 and related filings held by the Green lab / associated institutions.
- **Status:** Patent covers the toehold switch mechanism (RNA-based translational regulators with trigger and switch sequences). Filed ~2014, 20-year term → expires ~2034.
- **Risk level:** The implementation is a simplified design heuristic, not a full biophysical simulation. However, the toehold switch **concept itself** is patent-encumbered. Commercial use of toehold switch design tools requires a license from the patent holder.
- **Recommendation:**
  - **If academic/non-commercial:** Low practical risk — academic research exemption applies.
  - **If commercial:** Either (a) obtain a license, (b) replace with an alternative RNA switch design (e.g., riboregulators, strand displacement circuits), or (c) clearly mark as "research use only" with a disclaimer.
  - **Immediate action:** Add a `@patent_notice` annotation to the code and a UI disclaimer on the RNA engineering tool page.

#### 2. KEGG Database — Commercial License Required [HIGH]

- **Files:**
  - `src/server/pathwayDiscoveryEngine.ts` (500+ hardcoded reactions with KEGG IDs)
  - `app/api/kegg/route.ts` (live KEGG REST API proxy)
  - `src/services/database/keggClient.ts` (client library)
- **Issue:** KEGG is maintained by Kanehisa Laboratories (Kyoto University). The KEGG REST API is "public and free for academic use" (stated in `app/api/kegg/route.ts` line 16 comment). **Commercial use requires a paid KEGG license** from Kanehisa Laboratories.
- **Scope of use:**
  - `pathwayDiscoveryEngine.ts` contains 500+ reactions with KEGG reaction IDs (R00200, R00756, etc.), EC numbers, deltaG values, organism associations — this is a **derived database compilation**.
  - `kegg/route.ts` proxies 4 KEGG REST endpoints for live queries.
  - Multiple tools reference KEGG data: PathD, MetabolicEng, CETHX, FBAsim.
- **Risk level:** HIGH for commercial deployment. The systematic compilation of KEGG data into a derived database strengthens the case for requiring a commercial license.
- **Recommendation:**
  - **If academic/non-commercial:** Compliant as-is.
  - **If commercial:** Contact Kanehisa Laboratories for KEGG commercial licensing (http://www.kegg.jp/kegg/legal.html). Alternative: migrate to MetaCyc/BiGG for reactions (both CC-BY-4.0), though coverage is narrower.
  - **Immediate action:** Add license notice to all KEGG-using components: "KEGG data: free for academic use; commercial use requires license from Kanehisa Laboratories."

---

### MODERATE RISK — Plan for Resolution

#### 3. BRENDA Database — Commercial License Required [MODERATE]

- **File:** `src/services/database/brendaClient.ts` (re-exported from `database/index.ts`)
- **Issue:** BRENDA (brenda-enzymes.org) is maintained by the Technical University of Brunswick. Academic use is free; commercial use requires a license.
- **Scope:** Used for Km/kcat values in metabolic engineering tools (referenced in `toolValidity.ts`).
- **Recommendation:** Same as KEGG — obtain commercial license or migrate to SABIO-RK (free for all uses) or eQuilibrator.

#### 4. ViennaRNA — Commercial License Required [MODERATE]

- **Files:**
  - `src/modules/rna-engine/rnaEngine.ts` (optional ViennaRNA backend)
  - `scspatial-backend/main.py` (ViennaRNA RNA folding)
  - `scspatial-backend/requirements.txt` (ViennaRNA>=2.6.0)
  - `scspatial-backend/Dockerfile` (installs `vienna-rna` Debian package)
- **Issue:** ViennaRNA has a custom academic license (Institute for Theoretical Chemistry, University of Vienna). Free for academic use; commercial use requires a license.
- **Scope:** Used for RNA secondary structure prediction (Nussinov/MFE folding) and RNA engineering tools.
- **Recommendation:** Obtain commercial license, or replace with `LinearFold` (free) or implement Nussinov-only (already partially done).

#### 5. Copyleft Dependencies in Python Backend [MODERATE]

- **File:** `scspatial-backend/requirements.txt`
- **Issues:**
  - `leidenalg==0.10.2` — **GPL-3.0** (strong copyleft)
  - `mofapy2>=0.7.0` — **LGPL-3.0** (weak copyleft)
- **Risk analysis:**
  - **SaaS deployment (no distribution):** GPL copyleft does not trigger for server-side use. LGPL also does not trigger. **Risk is LOW for SaaS.**
  - **Distributing the Python backend (Docker image, pip package):** GPL-3.0 requires the entire derivative work to be GPL-licensed. LGPL-3.0 requires the library to be replaceable by end users.
  - **Vercel deployment:** The Python backend runs server-side only. Users never receive the code. **Risk is LOW for current deployment model.**
- **Recommendation:**
  - If ever distributing: replace `leidenalg` with a BSD-licensed alternative (e.g., `leiden` from the `graspologic` package) and ensure `mofapy2` is dynamically linked.
  - Add a `THIRD_PARTY_LICENSES.md` documenting all copyleft dependencies and their terms.

#### 6. OptKnock Patent [MODERATE → LOW]

- **File:** `app/api/fba/route.ts`
- **Issue:** OptKnock was patented by the University of California (US Patent 7,127,379, filed 2002). 20-year term → **expired 2022**.
- **Current status:** The patent has likely expired. The code uses a simplified iterative LP approximation, not the original bilevel MILP formulation.
- **Risk:** LOW. Patent expired. Implementation is a simplification, not a reimplementation.

#### 7. CARD Database Download [MODERATE → LOW]

- **File:** `scspatial-backend/blast_service.py`
- **Issue:** CARD (Comprehensive Antibiotic Resistance Database) is CC-BY-4.0 but the download URL (`https://card.mcmaster.ca/latest/data`) may require registration.
- **Risk:** LOW. CC-BY-4.0 permits commercial use with attribution. Registration requirement is a practical access issue, not a legal one.

---

### LOW RISK — No Action Required (Monitoring Only)

#### 8. BiGG Database [LOW]
- **License:** CC-BY-4.0 (Palsson Lab, UCSD)
- **Files:** `src/services/database/biggClient.ts`, `app/api/bigg/route.ts`
- **Status:** Fully compliant. Attribution recommended but not legally required for factual data.

#### 9. ESM-2 / ESM Atlas [LOW]
- **License:** MIT (Meta AI)
- **Files:** `src/services/esm2Client.ts`, `app/api/esm2/route.ts`
- **Status:** Fully compliant for all uses.

#### 10. AlphaFold DB [LOW]
- **License:** CC-BY-4.0 (EMBL-EBI/DeepMind)
- **Files:** `app/api/alphafold/route.ts`
- **Status:** Fully compliant.

#### 11. PubChem [LOW]
- **License:** Public domain (US government / NIH)
- **Files:** `app/api/pubchem/route.ts`
- **Status:** Fully compliant.

#### 12. Rhea Database [LOW]
- **License:** Free for academic use (SIB Swiss Institute of Bioinformatics)
- **Files:** `src/services/database/rheaClient.ts`, `app/api/rhea/route.ts`
- **Status:** Compliant for academic use. Commercial terms should be verified.

#### 13. ProteinMPNN Concepts [LOW]
- **License:** MIT (Baker Lab)
- **File:** `src/server/inverseFoldingEngine.ts`
- **Status:** The implementation is a simplified educational approximation, not a copy. ProteinMPNN is MIT-licensed anyway. Compliant.

#### 14. HiGHS LP Solver [LOW]
- **License:** MIT
- **Files:** `src/server/fbaEngine.ts`, `app/api/fba/route.ts`
- **Status:** Fully compliant.

#### 15. All Standard Biochemistry Methods [NEGLIGIBLE]
- FBA, Michaelis-Menten, Gibbs free energy, Eyring equation, Nussinov DP, BLOSUM62, Shannon entropy, A* search, RK4 ODE — all foundational, public-domain methods. No IP concern.

---

### Dependency License Audit (package.json + requirements.txt)

#### Node.js Dependencies (package.json) — ALL PERMISSIVE

| Package | License | Risk |
|---------|---------|------|
| `highs` | MIT | NONE |
| `onnxruntime-web` | MIT | NONE |
| `pyodide` | MPL-2.0 | NONE (weak copyleft, SaaS-safe) |
| `umap-js` | MIT | NONE |
| `@sentry/nextjs` | BSL-1.1/MIT | NONE |
| `@aws-sdk/client-s3` | Apache-2.0 | NONE |
| `@libsql/client` | MIT | NONE |
| `@react-three/fiber` | MIT | NONE |
| `@react-three/drei` | MIT | NONE |
| `three` | MIT | NONE |
| `xstate` | MIT | NONE |
| `next-auth` | ISC | NONE |
| `drizzle-orm` | Apache-2.0 | NONE |
| `@upstash/redis` | MIT | NONE |
| `framer-motion` | MIT | NONE |
| `recharts` | MIT | NONE |

**No copyleft or problematic licenses in Node.js dependencies.**

#### Python Dependencies (requirements.txt) — TWO COPIFY

| Package | License | Risk |
|---------|---------|------|
| `scanpy` | BSD-3 | NONE |
| `squidpy` | Apache-2.0 | NONE |
| `anndata` | BSD-3 | NONE |
| `mofapy2` | **LGPL-3.0** | LOW (SaaS-safe) |
| `mofax` | MIT | NONE |
| `umap-learn` | BSD-3 | NONE |
| `biopython` | BSD-3 | NONE |
| `ViennaRNA` | **Custom academic** | MODERATE (commercial license needed) |
| `leidenalg` | **GPL-3.0** | LOW (SaaS-safe) |
| `scikit-learn` | BSD-3 | NONE |
| `fastapi` | MIT | NONE |
| `numpy`, `scipy`, `pandas` | BSD-3 | NONE |

---

### Code-Level Copyright Analysis

**No copied source code was found.** The audit examined all 35 critical files and found:

- No third-party code copied without attribution
- No license headers from other projects present
- No GPL/copyleft code incorporated into the Nexus-Bio source
- All algorithm implementations are original (simplified approximations of published methods, not copies of open-source implementations)
- Academic references and `@scientific_provenance` annotations are present throughout

**The codebase is clean from a code-copyright perspective.**

---

### Data Provenance Audit

| Data Source | How Used | License | Risk |
|------------|----------|---------|------|
| KEGG (500+ reactions) | Hardcoded in pathwayDiscoveryEngine.ts | Academic free; commercial license | **HIGH** |
| KEGG REST API | Proxied via kegg/route.ts | Academic free; commercial license | **HIGH** |
| BRENDA (Km/kcat) | Client library, tool references | Academic free; commercial license | **MODERATE** |
| BiGG (iJO1366 model) | FBA stoichiometric data | CC-BY-4.0 | LOW |
| eQuilibrator (ΔG values) | Hardcoded in pathway discovery | CC-BY | LOW |
| Rhea (reaction IDs) | REST proxy | Academic free | LOW |
| UniProt (protein sequences) | Client library | CC-BY-4.0 | LOW |
| PubChem (compound data) | REST proxy | Public domain | NONE |
| AlphaFold DB (PDB files) | REST proxy | CC-BY-4.0 | NONE |
| Atchley factors (AA properties) | Hardcoded in esm2/route.ts | Published academic data | NONE |
| BLOSUM62 matrix | Hardcoded in inverseFoldingEngine.ts | Public domain | NONE |
| E. coli K-12 genome | BLAST reference in blast_service.py | NCBI public domain | NONE |
| VFDB (virulence factors) | BLAST database | Academic free | LOW |
| CARD (antibiotic resistance) | BLAST database | CC-BY-4.0 | LOW |

---

### Security Concerns (Not IP, But Noted)

1. **`execSync` in inverseFoldingEngine.ts (line 925):** Uses `execSync` + `curl` to call the ESM-2 API. This is a shell injection risk if user input reaches the URL. Should be replaced with `fetch()`.

2. **HTTP (not HTTPS) in bigg/route.ts (line 5):** `http://bigg.ucsd.edu/api/v3/models` — should use HTTPS.

---

## PART C: RECOMMENDATIONS SUMMARY

### Immediate Actions (Do Before Commercial Launch)

| # | Action | Risk Being Mitigated |
|---|--------|---------------------|
| 1 | Add patent disclaimer to toehold switch design UI | Toehold switch patents |
| 2 | Add KEGG/BRENDA license notices to all affected tools | KEGG/BRENDA commercial license |
| 3 | Contact Kanehisa Laboratories for KEGG commercial license quote | KEGG commercial compliance |
| 4 | Create `THIRD_PARTY_LICENSES.md` documenting all dependencies | Full compliance transparency |
| 5 | Replace `execSync` + `curl` with `fetch()` in inverseFoldingEngine.ts | Shell injection vulnerability |
| 6 | Change BiGG API URL from HTTP to HTTPS | Data in transit security |

### Short-Term (Next Quarter)

| # | Action | Gap Being Closed |
|---|--------|-----------------|
| 7 | Evaluate ESM-3 API integration for ProEvol | De novo protein design gap |
| 8 | Extend AlphaFold proxy for AF3 complex prediction | AlphaFold3 gap |
| 9 | Add prime/base editing design to GenMIM | CRISPR editing gap |
| 10 | Implement codon optimization engine | DNA assembly gap |
| 11 | Add SecureDNA-style screening to design pipeline | Biosafety gap |

### Medium-Term (Next 6 Months)

| # | Action | Gap Being Closed |
|---|--------|-----------------|
| 12 | Build RNA engineering suite (mRNA/circRNA/saRNA design) | RNA engineering gap |
| 13 | Add Gibson/Golden Gate assembly designer | DNA assembly gap |
| 14 | Export DBTLflow protocols in OT-2 JSON format | Lab automation gap |
| 15 | Replace `leidenalg` with BSD-licensed alternative | Copyleft dependency |

---

*Report generated by Claude Code on 2026-06-25. This audit is advisory — consult legal counsel for commercial licensing decisions.*
