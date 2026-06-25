# Third-Party Licenses

This document lists all third-party dependencies and data sources used by Nexus-Bio 1.0,
along with their licenses and any usage restrictions.

Last updated: 2026-06-25

---

## Node.js Dependencies (package.json)

| Package | License | Notes |
|---------|---------|-------|
| `@aws-sdk/client-s3` | Apache-2.0 | AWS SDK for S3-compatible storage |
| `@libsql/client` | MIT | LibSQL database client |
| `@react-three/drei` | MIT | Three.js helpers |
| `@react-three/fiber` | MIT | Three.js React bindings |
| `@sentry/nextjs` | BSL-1.1 / MIT | Error tracking (BSL-1.1 converts to MIT after 4 years) |
| `@upstash/redis` | MIT | Redis client |
| `drizzle-orm` | Apache-2.0 | SQL ORM |
| `framer-motion` | MIT | Animation library |
| `highs` | MIT | HiGHS LP solver |
| `next-auth` | ISC | Authentication (Auth.js) |
| `onnxruntime-web` | MIT | ONNX Runtime (Microsoft) |
| `pyodide` | MPL-2.0 | Python in WebAssembly (weak copyleft, SaaS-safe) |
| `recharts` | MIT | Charting library |
| `three` | MIT | Three.js 3D library |
| `umap-js` | MIT | UMAP dimensionality reduction |
| `xstate` | MIT | State machine library |

**All Node.js dependencies use permissive licenses (MIT, Apache-2.0, ISC, MPL-2.0).**

---

## Python Dependencies (scspatial-backend/requirements.txt)

| Package | License | Notes |
|---------|---------|-------|
| `anndata` | BSD-3-Clause | AnnData data structures |
| `biopython` | BSD-3-Clause | Biological computation |
| `fastapi` | MIT | Web framework |
| `leidenalg` | **GPL-3.0** | Leiden clustering (strong copyleft — SaaS-safe, distribution requires GPL) |
| `mofapy2` | **LGPL-3.0** | MOFA+ multi-omics (weak copyleft — SaaS-safe) |
| `mofax` | MIT | MOFA+ data loading |
| `numpy` | BSD-3-Clause | Numerical computing |
| `pandas` | BSD-3-Clause | Data manipulation |
| `scipy` | BSD-3-Clause | Scientific computing |
| `scikit-learn` | BSD-3-Clause | Machine learning |
| `scanpy` | BSD-3-Clause | Single-cell analysis |
| `squidpy` | Apache-2.0 | Spatial omics analysis |
| `umap-learn` | BSD-3-Clause | UMAP dimensionality reduction |
| `ViennaRNA` | **Custom academic** | RNA folding — free for academic use; commercial requires license from University of Vienna |

---

## External Data Sources

| Source | License | Used In | Commercial Status |
|--------|---------|---------|-------------------|
| **KEGG** | Academic free | pathwayDiscoveryEngine.ts, kegg/route.ts, keggClient.ts | **Requires paid license** |
| **BRENDA** | Academic free | brendaClient.ts | **Requires paid license** |
| **BiGG** | CC-BY-4.0 | biggClient.ts, bigg/route.ts, fbaEngine.ts | Free with attribution |
| **Rhea** | Academic free | rheaClient.ts, rhea/route.ts | Free for academic use |
| **UniProt** | CC-BY-4.0 | uniprotClient.ts | Free with attribution |
| **PubChem** | Public domain | pubchem/route.ts | Free (US government) |
| **AlphaFold DB** | CC-BY-4.0 | alphafold/route.ts | Free with attribution |
| **ESM Atlas** | MIT (Meta AI) | esm2/route.ts, esm2Client.ts | Free |
| **eQuilibrator** | CC-BY | pathwayDiscoveryEngine.ts | Free with attribution |
| **VFDB** | Academic free | blast_service.py | Free for academic use |
| **CARD** | CC-BY-4.0 | blast_service.py | Free with attribution |
| **NCBI RefSeq** | Public domain | blast_service.py | Free (US government) |

---

## Patent-Encumbered Technologies

| Technology | Patent | Used In | Status |
|------------|--------|---------|--------|
| **Toehold switches** | US 10,329,576 (Green lab, expires ~2034) | rnaEngine.ts | **Research use only** — commercial requires license |

---

## Copyleft Dependency Details

### leidenalg (GPL-3.0)
- **What it does:** Leiden community detection algorithm for graph clustering
- **Risk:** Strong copyleft. If distributing the software, the entire work must be GPL-licensed.
- **SaaS deployment:** Does NOT trigger GPL copyleft (no distribution occurs).
- **Mitigation:** Replace with `graspologic` (BSD-3-Clause) if distribution is needed.

### mofapy2 (LGPL-3.0)
- **What it does:** Multi-Omics Factor Analysis v2
- **Risk:** Weak copyleft. Must allow users to swap the library if distributing.
- **SaaS deployment:** Does NOT trigger LGPL requirements.
- **Mitigation:** Ensure dynamic linking if distributing.

### ViennaRNA (Custom Academic License)
- **What it does:** RNA secondary structure prediction (minimum free energy folding)
- **Risk:** Free for academic use. Commercial use requires a license from the Institute for Theoretical Chemistry, University of Vienna.
- **Mitigation:** Contact University of Vienna for commercial license, or replace with LinearFold (free).

---

## Notes

- This project is currently deployed as SaaS (Vercel). GPL/LGPL copyleft obligations do not trigger for server-side-only deployment.
- If the project transitions to distributing source code or Docker images, the `leidenalg` (GPL-3.0) dependency must be replaced or the entire project must adopt a GPL-compatible license.
- KEGG and BRENDA data are used extensively in the pathway discovery and metabolic engineering tools. For commercial use, licenses must be obtained from the respective maintainers.
